'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Form,
  Input,
  Space,
  Popconfirm,
  message,
  Tag,
  Row,
  Col,
  Tooltip,
  Switch,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
  SettingOutlined,
  FileTextOutlined,
  BankOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { listRoles, getRoleTemplates, createRole, updateRole, deleteRole } from '@/lib/actions';
import type { Role, RoleTemplate, CreateRolePayload } from '@/types';
import { parseApiError } from '@/lib/utils';
import { MODULES, ACTION_LABELS } from '@/lib/rbac/modules.registry';
import { applyTemplate } from '@/lib/rbac/permission.utils';
import type { CellDraft, GridDraft } from '@/lib/rbac/permission-grid-payload';
import { buildRolePayload, roleToDraft } from '@/lib/rbac/permission-grid-payload';
import { useRbacRegistry } from '@/hooks/useRbacRegistry';
import PermissionGrid from '@/components/rbac/PermissionGrid';
import { RolePresetSelector } from '@/components/rbac/RolePresetSelector';
import { PermissionPreview } from '@/components/rbac/PermissionPreview';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { DsDrawer } from '@/components/ui';
// Layout-matching skeletons shared with the route's loading.tsx (keep in sync).
import { RolesGridSkeleton, RolesPageSkeleton } from './skeleton';

// roleToDraft now lives in lib/rbac/permission-grid-payload (shared with the
// role detail page so the two editors stay identical).

const EMPTY_GRID_DRAFT: GridDraft = { flatByCell: {}, pathByCell: {} };

// Hex values mirror PRESET_COLORS in manekhr-app/features/rbac/data/modules.registry.ts.
// Wave 5 follow-up F8 (2026-05-10) - deduped: success-500 + danger-500 each
// appeared twice, tripping a React duplicate-key warning when this array
// renders the color-swatch picker. Replaced 2nd occurrences with -700 tones.
const ROLE_COLORS = [
  'var(--cr-info-700)',
  'var(--cr-indigo-400)',
  'var(--cr-success-500)',
  'var(--cr-warning-500)',
  'var(--cr-success-700)',
  'var(--cr-danger-500)',
  'var(--cr-danger-700)',
  'var(--cr-primary-hover)',
];

const MODULE_COLORS: Record<string, { bg: string; text: string }> = {
  attendance: { bg: 'var(--cr-info-50)', text: 'var(--cr-info-700)' },
  team: { bg: 'var(--cr-success-50)', text: 'var(--cr-success-700)' },
  salary: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)' },
  shifts: { bg: 'var(--cr-indigo-50)', text: 'var(--cr-indigo-400)' },
  roles: { bg: 'var(--cr-danger-50)', text: 'var(--cr-danger-700)' },
  settings: { bg: 'var(--cr-info-50)', text: 'var(--cr-info-700)' },
  bills: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)' },
};

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  Manager: <UserOutlined />,
  Supervisor: <TeamOutlined />,
  HR: <BankOutlined />,
  Accountant: <RupeeOutlined />,
  Viewer: <FileTextOutlined />,
  Admin: <SettingOutlined />,
};
const getTemplateIcon = (name: string) => {
  const key = Object.keys(TEMPLATE_ICONS).find((k) => name.toLowerCase().includes(k.toLowerCase()));
  return key ? TEMPLATE_ICONS[key] : <SafetyOutlined />;
};

export default function RolesPage() {
  const router = useRouter();
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();
  const {
    can: canPermission,
    data: permissionsData,
    loading: permissionsLoading,
  } = useMyPermissions();
  const registry = useRbacRegistry(currentWorkspaceId);
  const [roles, setRoles] = useState<Role[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<GridDraft>(EMPTY_GRID_DRAFT);
  const [showSensitive, setShowSensitive] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();
  const [selectedColor, setSelectedColor] = useState(ROLE_COLORS[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Check module access. Each action gate (ADR-001 R-1 follow-on) is the
  // subscription entitlement AND-ed with the RBAC permission - both must
  // pass. `canPermission` returns false while permissions resolve and
  // owners short-circuit to true.
  const hasAccess = entitlements?.moduleAccess?.find((m) => m.module === 'roles')?.enabled ?? false;
  const canCreate =
    hasAccess &&
    entitlements?.moduleAccess
      ?.find((m) => m.module === 'roles')
      ?.subFeatures?.find((sf) => sf.key === 'create_role')?.access !== 'locked' &&
    canPermission('roles', 'create');
  const canEdit =
    hasAccess &&
    entitlements?.moduleAccess
      ?.find((m) => m.module === 'roles')
      ?.subFeatures?.find((sf) => sf.key === 'edit_role')?.access !== 'locked' &&
    canPermission('roles', 'edit');
  const canDelete =
    hasAccess &&
    entitlements?.moduleAccess
      ?.find((m) => m.module === 'roles')
      ?.subFeatures?.find((sf) => sf.key === 'delete_role')?.access !== 'locked' &&
    canPermission('roles', 'delete');

  // Reload counter - handlers bump this from event scope to retrigger the
  // fetch effect (rather than calling a setState-bearing useCallback inside
  // the effect, which trips react-hooks/set-state-in-effect).
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (!currentWorkspaceId || !hasAccess) return;
    let cancelled = false;
    void (async () => {
      try {
        const [rolesRes, tmplRes] = await Promise.allSettled([
          listRoles(currentWorkspaceId),
          getRoleTemplates(currentWorkspaceId),
        ]);
        if (cancelled) return;
        if (rolesRes.status === 'fulfilled')
          setRoles(Array.isArray(rolesRes.value) ? rolesRes.value : []);
        if (tmplRes.status === 'fulfilled')
          setTemplates(Array.isArray(tmplRes.value) ? tmplRes.value : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, hasAccess, reloadKey]);

  // RBAC Remediation Tier 1.5 (2026-05-18, ADR-001 R-1): page-level
  // permission guard, AND-ed with the subscription gate below. Show a
  // loading skeleton while permissions resolve; render an Access-Denied
  // surface if the caller lacks roles.view. Owners bypass (isOwner === true).
  const canViewRoles = permissionsData?.isOwner || canPermission('roles', 'view');
  if (permissionsLoading || permissionsData == null) {
    return <RolesPageSkeleton />;
  }
  if (!canViewRoles) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <Alert
          type="error"
          showIcon
          title="Access Denied"
          description="You do not have permission to view roles and permissions. Contact your workspace owner to request access."
          style={{ maxWidth: 480 }}
        />
      </div>
    );
  }

  // Module gating
  if (!isHydrated) {
    return <RolesPageSkeleton />;
  }

  if (!hasAccess) {
    return <ModuleLockedPage module="roles" />;
  }

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    setDraft(EMPTY_GRID_DRAFT);
    setShowSensitive(false);
    setSelectedColor(ROLE_COLORS[0]);
    setSelectedTemplate(null);
    setDrawerOpen(true);
  };

  const openEdit = (e: React.MouseEvent, r: Role) => {
    e.stopPropagation();
    setEditing(r);
    form.setFieldsValue({ name: r.name, description: r.description });
    setDraft(roleToDraft(r));
    setShowSensitive(false);
    setSelectedColor(r.color ?? ROLE_COLORS[0]);
    setSelectedTemplate(null);
    setDrawerOpen(true);
  };

  /**
   * Convert a RoleTemplate's level map into a GridDraft for the new grid.
   * Templates only carry flat module-level permissions (no path grants), so
   * we populate flatByCell with every action that the level implies and leave
   * pathByCell empty.
   */
  const applyTemplateCard = (t: RoleTemplate) => {
    setSelectedTemplate(t.name);
    form.resetFields();
    form.setFieldsValue({ name: t.name, description: t.description });
    // applyTemplate returns Record<string, string[]> (module → actions[]). We
    // convert that to a GridDraft so the PermissionGrid can display it.
    const flatPerms = applyTemplate(t.permissions);
    const flatByCell: Record<string, CellDraft> = {};
    for (const [module, actions] of Object.entries(flatPerms)) {
      for (const action of actions) {
        flatByCell[`${module}.${action}`] = { allowed: true, scope: 'self' };
      }
    }
    setDraft({ flatByCell, pathByCell: {} });
    setShowSensitive(false);
    setEditing(null);
    setSelectedColor(ROLE_COLORS[0]);
    setDrawerOpen(true);
  };

  const handleSave = async (vals: Pick<CreateRolePayload, 'name' | 'description'>) => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    const { permissions: permissionsArr, permissionPaths } = buildRolePayload({ draft });
    const payload = {
      ...vals,
      color: selectedColor,
      permissions: permissionsArr,
      permissionPaths,
    };
    try {
      if (editing) {
        await updateRole(currentWorkspaceId, editing._id, payload);
        msgApi.success('Role updated');
      } else {
        await createRole(currentWorkspaceId, payload);
        msgApi.success('Role created');
      }
      setDrawerOpen(false);
      reload();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteRole(currentWorkspaceId, id);
      msgApi.success('Role deleted');
      reload();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  return (
    <>
      {ctx}

      {/* Two-column on lg+ (roles | templates); stacks to one column on
          mobile/tablet so the fixed-width templates rail can't squeeze the
          roles column to a few px (mobile-responsive fix). */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Left: Roles ── */}
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h1 className="m-0 font-display text-[17px] font-bold text-heading">
                Manage roles and their permissions
              </h1>
              <p className="m-0 mt-0.5 text-[12px] text-muted">Roles & Permissions</p>
            </div>
            {canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
                New Role
              </Button>
            )}
          </div>

          {loading ? (
            <RolesGridSkeleton />
          ) : roles.length === 0 ? (
            <div className="bg-surface-secondary rounded-2xl border border-border-light px-6 py-14 text-center">
              <SafetyOutlined className="mb-3 block text-[36px] text-subtle" />
              <p className="m-0 text-[15px] font-semibold text-secondary">No custom roles yet</p>
              <p className="m-0 mt-1 text-[13px] text-muted">
                Create roles with fine-grained permissions and assign them to team members.
              </p>
              {canCreate && (
                <Button type="primary" className="mt-4" onClick={openAdd}>
                  Create First Role
                </Button>
              )}
            </div>
          ) : (
            <div
              className="grid gap-3"
              style={{
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              }}
            >
              {roles.map((role) => (
                <div
                  key={role._id}
                  className="card-hover cursor-pointer rounded-2xl bg-white p-5"
                  style={{ border: `1.5px solid ${role.color ?? 'var(--cr-primary)'}22` }}
                  onClick={() => router.push(`/dashboard/roles/${role._id}`)}
                >
                  <div className="mb-2.5 flex items-start justify-between">
                    {/* items-start so the icon pins to the top next to the role name;
                        items-center made it drift to the vertical middle on cards with
                        long descriptions. */}
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px]"
                        style={{ background: `${role.color ?? 'var(--cr-primary)'}18` }}
                      >
                        <SafetyOutlined
                          className="text-lg"
                          style={{ color: role.color ?? 'var(--cr-primary)' }}
                        />
                      </div>
                      <div>
                        <p className="m-0 font-display text-[15px] font-bold text-heading">
                          {role.name}
                        </p>
                        {role.description && (
                          <p className="m-0 mt-0.5 text-xs text-muted">{role.description}</p>
                        )}
                        {role.isSystem && (
                          <Tag color="blue" className="mt-1 text-[10px]">
                            System
                          </Tag>
                        )}
                      </div>
                    </div>
                    {!role.isSystem && (
                      <Space size={4}>
                        {canEdit && (
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={(e) => openEdit(e, role)}
                          />
                        )}
                        {canDelete && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Popconfirm
                              title="Delete this role?"
                              onConfirm={() => handleDelete(role._id)}
                              okButtonProps={{ danger: true }}
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Popconfirm>
                          </div>
                        )}
                      </Space>
                    )}
                  </div>

                  <div className="mb-2.5 flex items-center gap-1">
                    <TeamOutlined className="text-[11px] text-subtle" />
                    <span className="text-[11px] text-muted">
                      {role.memberCount
                        ? `${role.memberCount} member${role.memberCount !== 1 ? 's' : ''}`
                        : 'No members assigned yet'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {/* Merge permissions by module so each module renders exactly one
                        chip. A role can carry more than one entry for the same module
                        (e.g. two `salary` rows); rendering them raw keyed by module
                        produced duplicate React keys. Union the actions so the single
                        chip's tooltip still lists everything. */}
                    {Object.values(
                      (role.permissions ?? []).reduce<
                        Record<string, { module: string; actions: string[] }>
                      >((acc, p) => {
                        const existing = acc[p.module];
                        if (existing)
                          existing.actions = [...new Set([...existing.actions, ...p.actions])];
                        else acc[p.module] = { module: p.module, actions: [...p.actions] };
                        return acc;
                      }, {}),
                    ).map((p) => {
                      const mc = MODULE_COLORS[p.module] ?? {
                        bg: 'var(--cr-neutral-100)',
                        text: 'var(--cr-text-4)',
                      };
                      return (
                        <Tooltip
                          key={p.module}
                          title={p.actions.map((a) => ACTION_LABELS[a] ?? a).join(', ')}
                        >
                          <span
                            className="cursor-default rounded-full px-2 py-0.5 text-[10px] font-bold"
                            style={{ background: mc.bg, color: mc.text }}
                          >
                            {MODULES.find((m) => m.key === p.module)?.label ?? p.module}
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Vertical separator (only when columns sit side by side) ── */}
        <div
          className="hidden w-px flex-shrink-0 self-stretch bg-border-light lg:block"
          style={{ minHeight: 200 }}
        />

        {/* ── Right: Templates (full width on mobile, fixed rail on lg+) ── */}
        <div className="w-full flex-shrink-0 lg:w-72">
          <div className="mb-3">
            <h2 className="m-0 font-display text-[17px] font-bold text-heading">
              Quick-start with a Template
            </h2>
            <p className="m-0 mt-0.5 text-[12px] text-muted">
              Pick a preset to create a role instantly
            </p>
          </div>

          {templates.length === 0 ? (
            <div className="bg-surface-secondary rounded-xl border border-border-light px-4 py-8 text-center">
              <p className="m-0 text-[13px] text-muted">No templates available</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {templates.map((t) => {
                const isSelected = selectedTemplate === t.name;
                return (
                  <div
                    key={t.name}
                    className="cursor-pointer rounded-xl border p-4 transition-all duration-150 select-none"
                    style={{
                      borderColor: isSelected ? 'var(--cr-primary)' : 'var(--cr-border)',
                      background: isSelected ? 'var(--cr-info-50)' : 'var(--cr-surface-secondary)',
                      boxShadow: isSelected ? '0 0 0 2px rgba(11,110,79,0.13)' : 'none',
                    }}
                    onClick={() => applyTemplateCard(t)}
                  >
                    <div className="mb-1 flex items-center gap-2.5">
                      <span
                        className="text-[16px]"
                        style={{
                          color: isSelected ? 'var(--cr-primary)' : 'var(--cr-text-3)',
                        }}
                      >
                        {getTemplateIcon(t.name)}
                      </span>
                      <p className="m-0 text-[13px] font-bold text-heading">{t.name}</p>
                    </div>
                    {t.description && (
                      <p className="m-0 text-[11px] leading-relaxed text-muted">{t.description}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Drawer */}
      <DsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Role' : 'Create New Role'}
        okText={editing ? 'Save Changes' : 'Create Role'}
        okLoading={saving}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="name" label="Role Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. HR Manager, Supervisor" size="large" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item label="Color">
                <div className="flex gap-2" style={{ flexWrap: 'nowrap' }}>
                  {ROLE_COLORS.map((c) => (
                    <div
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className="flex flex-shrink-0 cursor-pointer items-center justify-center rounded-full"
                      style={{
                        width: 20,
                        height: 20,
                        background: c,
                        boxShadow:
                          selectedColor === c ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : 'none',
                        transition: 'box-shadow 0.15s ease',
                      }}
                    >
                      {selectedColor === c && (
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M2 6l3 3 5-5"
                            stroke="#fff"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </Form.Item>
            </Col>
          </Row>
          {/* <Form.Item name="description" label="Description">
            <Input placeholder="Brief description of this role" />
          </Form.Item> */}

          <div className="mt-1 mb-3 flex items-center gap-2">
            <div className="h-px flex-1 bg-border-light" />
            <span className="px-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">
              Module Permissions
            </span>
            <div className="h-px flex-1 bg-border-light" />
          </div>

          <div className="mb-3 flex items-center justify-end gap-2">
            <EyeOutlined className="text-[12px] text-subtle" />
            <span className="text-[11px] text-muted">Show sensitive</span>
            <Switch
              size="small"
              checked={showSensitive}
              onChange={setShowSensitive}
              disabled={saving}
            />
          </div>

          <RolePresetSelector
            registry={registry}
            value={draft}
            onChange={setDraft}
            disabled={saving}
          />
          <PermissionGrid
            registry={registry}
            mode="role"
            value={draft}
            onChange={setDraft}
            disabled={saving}
            showSensitive={showSensitive}
          />
          <PermissionPreview registry={registry} value={draft} mode="role" />
        </Form>
      </DsDrawer>
    </>
  );
}
