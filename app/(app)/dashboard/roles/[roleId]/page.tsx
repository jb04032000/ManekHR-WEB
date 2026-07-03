'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Card,
  Tabs,
  Button,
  Table,
  Avatar,
  Popconfirm,
  Modal,
  Select,
  message,
  Tag,
  Divider,
  Space,
  Spin,
  Switch,
} from 'antd';
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  UserAddOutlined,
  SafetyOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { getRole, updateRole, deleteRole, listTeam, updateTeamMember } from '@/lib/actions';
import type { Role, TeamMember } from '@/types';
import { parseApiError, getInitials, avatarColor } from '@/lib/utils';
// Same registry-driven editor as the roles list drawer AND the team
// app-access tab (PermissionOverridesMatrix wraps the same grid), replacing
// the old hardcoded flat matrix so all three surfaces stay identical.
import type { GridDraft } from '@/lib/rbac/permission-grid-payload';
import { buildRolePayload, roleToDraft } from '@/lib/rbac/permission-grid-payload';
import { useRbacRegistry } from '@/hooks/useRbacRegistry';
import PermissionGrid from '@/components/rbac/PermissionGrid';
import { PermissionPreview } from '@/components/rbac/PermissionPreview';

const EMPTY_GRID_DRAFT: GridDraft = { flatByCell: {}, pathByCell: {} };

const ROLE_COLORS = [
  'var(--cr-primary)',
  'var(--cr-success-500)',
  'var(--cr-indigo-400)',
  'var(--cr-warning-500)',
  'var(--cr-danger-500)',
  'var(--cr-info-500)',
  // Deduped (mirrors the roles list page fix): danger-500 + warning-500 each
  // appeared twice, tripping React duplicate-key warnings in the color picker.
  'var(--cr-danger-700)',
  'var(--cr-warning-700)',
];

export default function RoleDetailPage() {
  const { roleId } = useParams<{ roleId: string }>();
  const router = useRouter();
  const { currentWorkspaceId } = useWorkspaceStore();
  const {
    can: canPermission,
    data: permissionsData,
    loading: permissionsLoading,
  } = useMyPermissions();

  const [role, setRole] = useState<Role | null>(null);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addIds, setAddIds] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  // GridDraft mirrors the roles list drawer: flat legacy grants + registry
  // permissionPaths edited together in the shared PermissionGrid.
  const [draft, setDraft] = useState<GridDraft>(EMPTY_GRID_DRAFT);
  const [showSensitive, setShowSensitive] = useState(false);
  const [selectedColor, setSelectedColor] = useState(ROLE_COLORS[0]);
  const [msgApi, ctx] = message.useMessage();
  const registry = useRbacRegistry(currentWorkspaceId);

  // Reload counter - handlers bump this from event scope to retrigger the
  // fetch effect (rather than calling a setState-bearing useCallback inside
  // the effect, which trips react-hooks/set-state-in-effect).
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  useEffect(() => {
    if (!currentWorkspaceId || !roleId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [roleRes, teamRes] = await Promise.allSettled([
          getRole(currentWorkspaceId, roleId),
          listTeam(currentWorkspaceId),
        ]);
        if (cancelled) return;
        if (roleRes.status === 'fulfilled' && roleRes.value) {
          const r = roleRes.value;
          setRole(r);
          setSelectedColor(r.color ?? ROLE_COLORS[0]);
          setDraft(
            roleToDraft({ permissions: r.permissions ?? [], permissionPaths: r.permissionPaths }),
          );
        }
        if (teamRes.status === 'fulfilled') {
          const val = teamRes.value as { members?: TeamMember[]; data?: TeamMember[] };
          setTeam(
            val.members ??
              (Array.isArray(val) ? (val as unknown as TeamMember[]) : (val.data ?? [])),
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, roleId, reloadKey]);

  const members = team.filter((m) => m.rbacRole?.id === roleId);
  const unassigned = team.filter((m) => !m.rbacRole || m.rbacRole.id !== roleId);

  const handleRemove = async (memberId: string) => {
    if (!currentWorkspaceId) return;
    try {
      await updateTeamMember(currentWorkspaceId, memberId, { rbacRoleId: null });
      msgApi.success('Member removed from role');
      reload();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleAddMembers = async () => {
    if (!currentWorkspaceId || addIds.length === 0) return;
    setAdding(true);
    try {
      await Promise.all(
        addIds.map((id) => updateTeamMember(currentWorkspaceId, id, { rbacRoleId: roleId })),
      );
      msgApi.success(`${addIds.length} member${addIds.length > 1 ? 's' : ''} added`);
      setAddOpen(false);
      setAddIds([]);
      reload();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setAdding(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!currentWorkspaceId || !role) return;
    setSaving(true);
    // Same payload builder as the roles list drawer: flat rows + registry
    // permissionPaths, so path grants are no longer dropped on save here.
    const { permissions: permissionsArr, permissionPaths } = buildRolePayload({ draft });
    try {
      await updateRole(currentWorkspaceId, role._id, {
        permissions: permissionsArr,
        permissionPaths,
        color: selectedColor,
      });
      msgApi.success('Permissions saved');
      reload();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!currentWorkspaceId || !role) return;
    setDeleting(true);
    try {
      await deleteRole(currentWorkspaceId, role._id);
      msgApi.success('Role deleted');
      router.push('/dashboard/roles');
    } catch (e) {
      msgApi.error(parseApiError(e));
      setDeleting(false);
    }
  };

  // RBAC Remediation Tier 1.5 (2026-05-18, ADR-001 R-1): page-level
  // permission guard. Show a spinner while permissions resolve; render an
  // Access-Denied surface if the caller lacks roles.view. Owners bypass
  // (isOwner === true). Mirrors the /dashboard/workspace gate.
  const canViewRoles = permissionsData?.isOwner || canPermission('roles', 'view');
  if (permissionsLoading || permissionsData == null) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spin size="large" />
      </div>
    );
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="py-24 text-center">
        <p className="text-secondary">Role not found.</p>
        <Button onClick={() => router.push('/dashboard/roles')}>Back to Roles</Button>
      </div>
    );
  }

  const membersTab = (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <span className="text-[13px] text-muted">
          {members.length} member{members.length !== 1 ? 's' : ''} assigned
        </span>
        <Button icon={<UserAddOutlined />} onClick={() => setAddOpen(true)}>
          Add Members
        </Button>
      </div>
      <Table
        dataSource={members}
        rowKey="id"
        pagination={false}
        size="small"
        locale={{ emptyText: 'No members assigned to this role yet.' }}
        columns={[
          {
            title: 'Member',
            render: (_, m) => (
              <div className="flex items-center gap-2.5">
                <Avatar size={32} style={{ background: avatarColor(m.name), fontSize: 12 }}>
                  {getInitials(m.name)}
                </Avatar>
                <div>
                  <p className="m-0 text-[13px] font-semibold text-heading">{m.name}</p>
                  {(m.email || m.mobile) && (
                    <p className="m-0 text-[11px] text-muted">{m.email ?? m.mobile}</p>
                  )}
                </div>
              </div>
            ),
          },
          {
            title: 'Designation',
            dataIndex: 'designation',
            render: (v) => (v ? <span className="text-[12px] text-secondary">{v}</span> : '-'),
          },
          {
            title: <span className="sr-only">Actions</span>,
            width: 80,
            render: (_, m) => (
              <Popconfirm
                title="Remove from role?"
                description="Member will lose permissions tied to this role."
                onConfirm={() => handleRemove(m.id)}
                okButtonProps={{ danger: true }}
                okText="Remove"
              >
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            ),
          },
        ]}
      />

      {/* Add Members Modal */}
      <Modal
        open={addOpen}
        onCancel={() => {
          setAddOpen(false);
          setAddIds([]);
        }}
        title="Add Members to Role"
        onOk={handleAddMembers}
        confirmLoading={adding}
        okText="Add Selected"
        okButtonProps={{ disabled: addIds.length === 0 }}
      >
        <p className="mb-3 text-[13px] text-muted">
          Select members who don&apos;t have a role assigned yet.
        </p>
        <Select
          mode="multiple"
          style={{ width: '100%' }}
          placeholder="Search members…"
          value={addIds}
          onChange={setAddIds}
          optionFilterProp="label"
          options={unassigned.map((m) => ({ value: m.id, label: m.name }))}
        />
      </Modal>
    </div>
  );

  // RBAC action gates (ADR-001 R-1 follow-on): editing the permission
  // matrix requires roles.edit, deleting the role requires roles.delete.
  // Owners short-circuit to true inside `canPermission`.
  const canEditRole = canPermission('roles', 'edit');
  const canDeleteRole = canPermission('roles', 'delete');

  const permissionsTab = (
    <div>
      <div className="mb-4 flex items-center justify-between">
        {/* Sensitive-field toggle, same as the roles drawer + team app-access. */}
        <div className="flex items-center gap-2">
          <EyeOutlined className="text-[12px] text-subtle" />
          <span className="text-[11px] text-muted">Show sensitive</span>
          <Switch
            size="small"
            checked={showSensitive}
            onChange={setShowSensitive}
            disabled={saving}
          />
        </div>
        <div className="flex gap-2">
          {!role.isSystem && canDeleteRole && (
            <Popconfirm
              title="Delete this role?"
              description={
                members.length > 0
                  ? `${members.length} member${members.length > 1 ? 's' : ''} will lose their permissions.`
                  : 'This action cannot be undone.'
              }
              onConfirm={handleDeleteRole}
              okButtonProps={{ danger: true }}
              okText="Delete"
            >
              <Button danger loading={deleting} icon={<DeleteOutlined />}>
                Delete Role
              </Button>
            </Popconfirm>
          )}
          {canEditRole && (
            <Button type="primary" loading={saving} onClick={handleSavePermissions}>
              Save Permissions
            </Button>
          )}
        </div>
      </div>

      {/* Color picker */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-[12px] text-muted">Role color:</span>
        {ROLE_COLORS.map((c) => (
          <div
            key={c}
            onClick={() => setSelectedColor(c)}
            className="h-5 w-5 cursor-pointer rounded-full"
            style={{
              background: c,
              border: selectedColor === c ? `3px solid ${c}` : '3px solid transparent',
              outline: selectedColor === c ? `2px solid ${c}55` : 'none',
              boxSizing: 'border-box',
            }}
          />
        ))}
      </div>

      <Divider className="my-3" />

      {/* Shared registry-driven editor (same grid as the roles drawer and the
          team app-access matrix). Read-only for holders without roles.edit. */}
      <PermissionGrid
        registry={registry}
        mode="role"
        value={draft}
        onChange={setDraft}
        disabled={saving || !canEditRole}
        showSensitive={showSensitive}
      />
      <PermissionPreview registry={registry} value={draft} mode="role" />
    </div>
  );

  return (
    <>
      {ctx}
      <div className="mb-4 flex items-center gap-3">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push('/dashboard/roles')}
        />
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-[10px]"
            style={{ background: `${role.color ?? 'var(--cr-primary)'}18` }}
          >
            <SafetyOutlined style={{ color: role.color ?? 'var(--cr-primary)' }} />
          </div>
          <div>
            <p className="m-0 font-display text-[17px] font-bold text-heading">{role.name}</p>
            {role.description && <p className="m-0 text-[12px] text-muted">{role.description}</p>}
          </div>
          {role.isSystem && <Tag color="blue">System</Tag>}
        </div>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="members"
          items={[
            {
              key: 'members',
              label: (
                <Space>
                  <UserOutlined />
                  Members
                  {members.length > 0 && (
                    <span
                      className="rounded-full px-1.5 py-0.5 text-[11px] font-bold"
                      style={{
                        background: `${role.color ?? 'var(--cr-primary)'}18`,
                        color: role.color ?? 'var(--cr-primary)',
                      }}
                    >
                      {members.length}
                    </span>
                  )}
                </Space>
              ),
              children: membersTab,
            },
            {
              key: 'permissions',
              label: (
                <Space>
                  <SafetyOutlined />
                  Permissions
                </Space>
              ),
              children: permissionsTab,
            },
          ]}
        />
      </Card>
    </>
  );
}
