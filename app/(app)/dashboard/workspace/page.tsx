'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { useTranslations, useLocale } from 'next-intl';
import {
  Form,
  Input,
  Select,
  Button,
  message,
  Tag,
  Modal,
  Popconfirm,
  Alert,
  Collapse,
  InputNumber,
} from 'antd';
import {
  PlusOutlined,
  CrownOutlined,
  DeleteOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  BankOutlined,
  TeamOutlined,
  ClockCircleOutlined,
  SafetyOutlined,
  EditOutlined,
  TagOutlined,
  UserSwitchOutlined,
  IdcardOutlined,
  LockOutlined,
  FilePdfOutlined,
  BellOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useWorkspaceStore, useAuthStore, useSubscriptionStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { env } from '@/lib/env';
import { BrandingSection } from '@/components/workspace/BrandingSection';
import { ExportPreferencesSection } from '@/components/workspace/ExportPreferencesSection';
// OQ-W3 - 30-day workspace-delete recovery list, rendered owner-only next to the
// Danger Zone (restore is the inverse of delete). Self-fetches; hides when empty.
import { DeletedWorkspacesSection } from '@/components/workspace/DeletedWorkspacesSection';
import {
  getWorkspaceMembers,
  updateWorkspace,
  listWorkspaces,
  inviteMember,
  createWorkspace,
  removeMember,
  changeMemberRole,
  deleteWorkspace,
  listShifts,
  getPendingInvitations,
  resendInvite,
  cancelInvite,
  listRoles,
} from '@/lib/actions';
import {
  listDesignations,
  addDesignation as apiAddDesignation,
  renameDesignation as apiRenameDesignation,
  deleteDesignation as apiDeleteDesignation,
  getDesignationUsage,
} from '@/lib/actions/workspaces.actions';
import type { PendingInvitation } from '@/lib/actions/workspaces.actions';
import { DsAvatar, DsPageHeader, StatTile } from '@/components/ui';
import type {
  WorkspaceMember,
  UpdateWorkspacePayload,
  InviteMemberPayload,
  CreateWorkspacePayload,
  Workspace,
  Shift,
  BankAccount,
  Role,
  DesignationRecord,
  DesignationLocale,
} from '@/types';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import { parseApiError } from '@/lib/utils';

const { Option } = Select;

function InviteForm({
  onFinish,
  inviting,
  msgApi,
  roles,
  t,
}: {
  onFinish: (vals: InviteMemberPayload) => Promise<void>;
  inviting: boolean;
  msgApi: ReturnType<typeof message.useMessage>[0];
  roles: Role[];
  t: ReturnType<typeof useTranslations>;
}) {
  const [form] = Form.useForm();
  const [identifierType, setIdentifierType] = useState<'email' | 'mobile'>('email');
  const hasRoles = roles && roles.length > 0;
  const handleFinish = async (vals: Record<string, string>) => {
    if (!hasRoles) {
      msgApi.error(t('invite.noRolesError'));
      return;
    }
    const payload: InviteMemberPayload =
      identifierType === 'email'
        ? { email: vals.email, roleId: vals.roleId }
        : { mobile: vals.mobile, roleId: vals.roleId };
    await onFinish(payload);
    form.resetFields();
  };
  return (
    <>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleFinish}
        requiredMark={false}
        style={{ marginTop: 16 }}
      >
        <Form.Item label={t('invite.inviteViaLabel')} name="type" initialValue="email">
          <Select size="large" onChange={(val) => setIdentifierType(val)}>
            <Option value="email">{t('invite.emailOption')}</Option>
            <Option value="mobile">{t('invite.mobileOption')}</Option>
          </Select>
        </Form.Item>
        {identifierType === 'email' ? (
          <Form.Item
            name="email"
            label={t('invite.emailLabel')}
            rules={[{ required: true, type: 'email', message: t('invite.emailInvalid') }]}
          >
            <Input placeholder={t('invite.emailPlaceholder')} size="large" />
          </Form.Item>
        ) : (
          <Form.Item
            name="mobile"
            label={t('invite.mobileLabel')}
            rules={[{ required: true, message: t('invite.mobileInvalid') }]}
          >
            <Input placeholder="+919876543210" size="large" />
          </Form.Item>
        )}
        <Form.Item
          name="roleId"
          label={t('invite.roleLabel')}
          rules={[{ required: true, message: t('invite.roleRequired') }]}
        >
          <Select
            size="large"
            placeholder={hasRoles ? t('invite.rolePlaceholder') : t('invite.roleCreateFirst')}
            disabled={!hasRoles}
          >
            {roles.map((role) => (
              <Option key={role._id} value={role._id}>
                {role.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
        {!hasRoles && <p className="mb-2 text-xs text-error">{t('invite.noRolesHint')}</p>}
        <Button
          type="primary"
          htmlType="submit"
          loading={inviting}
          block
          size="large"
          disabled={!hasRoles}
        >
          {t('invite.sendBtn')}
        </Button>
      </Form>
    </>
  );
}

function CreateWorkspaceForm({
  onFinish,
  creating,
  t,
}: {
  onFinish: (vals: CreateWorkspacePayload) => Promise<void>;
  creating: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [form] = Form.useForm();
  const handleFinish = async (vals: CreateWorkspacePayload) => {
    await onFinish(vals);
    form.resetFields();
  };
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleFinish}
      requiredMark={false}
      style={{ marginTop: 24 }}
    >
      <div className="mb-5 rounded-xl border border-primary-border bg-primary-light p-3.5 text-[13px] leading-relaxed text-body">
        {t.rich('createForm.explainer', { strong: (chunks) => <strong>{chunks}</strong> })}
      </div>
      <Form.Item
        name="name"
        label={t('createForm.nameLabel')}
        rules={[{ required: true, message: t('createForm.nameRequired') }]}
        style={{ marginBottom: 20 }}
      >
        <Input size="large" placeholder={t('createForm.namePlaceholder')} />
      </Form.Item>
      <Form.Item name="location" label={t('createForm.locationLabel')} style={{ marginBottom: 16 }}>
        <Input size="large" placeholder={t('createForm.locationPlaceholder')} />
      </Form.Item>

      <Collapse
        ghost
        className="-mx-2 mb-2"
        items={[
          {
            key: 'business',
            label: (
              <span className="flex items-center gap-2 text-[13px] font-semibold text-body">
                <BankOutlined className="text-primary" />
                Business Details (optional)
              </span>
            ),
            children: (
              <>
                <p className="m-0 mb-3 text-[12px] leading-relaxed text-muted">
                  {t('createForm.businessDetailsHint')}
                </p>
                <Form.Item
                  name="businessType"
                  label={t('createForm.businessTypeLabel')}
                  style={{ marginBottom: 16 }}
                >
                  <Select
                    placeholder={t('createForm.businessTypePlaceholder')}
                    size="large"
                    allowClear
                    options={[
                      { value: 'trading', label: t('createForm.businessTypeTrading') },
                      { value: 'manufacturing', label: t('createForm.businessTypeManufacturing') },
                      { value: 'service', label: t('createForm.businessTypeService') },
                      { value: 'composition', label: t('createForm.businessTypeComposition') },
                    ]}
                  />
                </Form.Item>
                <Form.Item
                  name="gstin"
                  label={t('business.gstinLabel')}
                  rules={[
                    {
                      pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
                      message: t('business.gstinInvalid'),
                    },
                  ]}
                  style={{ marginBottom: 16 }}
                >
                  <Input
                    placeholder={t('createForm.gstinPlaceholder')}
                    size="large"
                    maxLength={15}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Form.Item>
                <Form.Item
                  name="pan"
                  label={t('business.panLabel')}
                  rules={[
                    {
                      pattern: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
                      message: t('business.panInvalid'),
                    },
                  ]}
                  style={{ marginBottom: 16 }}
                >
                  <Input
                    placeholder="ABCDE1234F"
                    size="large"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                </Form.Item>
                <Form.Item
                  name="fyStartMonth"
                  label={t('createForm.fyStartMonthLabel')}
                  initialValue={4}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    min={1}
                    max={12}
                    size="large"
                    style={{ width: '100%' }}
                    placeholder={t('createForm.fyStartMonthPlaceholder')}
                  />
                </Form.Item>
              </>
            ),
          },
        ]}
      />

      <div className="mt-6 flex justify-end gap-2">
        <Button type="primary" htmlType="submit" loading={creating}>
          {t('createForm.submitBtn')}
        </Button>
      </div>
    </Form>
  );
}

function GeneralSettingsForm({
  ws,
  onFinish,
  saving,
  onCancel,
  t,
}: {
  ws: Workspace;
  onFinish: (vals: UpdateWorkspacePayload) => Promise<void>;
  saving: boolean;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const [form] = Form.useForm();
  useEffect(() => {
    // Seed editable fields. `address` is the company postal address — the single
    // source of truth for the employee ID card, persisted via updateWorkspace.
    form.setFieldsValue({ name: ws.name, location: ws.location, address: ws.address });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ws._id]);
  return (
    <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
      <Form.Item
        name="name"
        label={t('generalSettings.nameLabel')}
        rules={[{ required: true }]}
        style={{ marginBottom: 16 }}
      >
        <Input size="large" placeholder={t('generalSettings.namePlaceholder')} />
      </Form.Item>
      <Form.Item
        name="location"
        label={t('generalSettings.locationLabel')}
        style={{ marginBottom: 20 }}
      >
        <Input size="large" placeholder={t('generalSettings.locationPlaceholder')} />
      </Form.Item>
      {/* Company postal address — single source of truth for the employee ID card. */}
      <Form.Item
        name="address"
        label={t('generalSettings.addressLabel')}
        style={{ marginBottom: 20 }}
      >
        <Input.TextArea
          rows={3}
          maxLength={300}
          showCount
          placeholder={t('generalSettings.addressPlaceholder')}
        />
      </Form.Item>
      <div className="flex gap-2">
        <Button type="primary" htmlType="submit" loading={saving}>
          {t('generalSettings.saveBtn')}
        </Button>
        <Button
          onClick={onCancel}
          style={{ borderColor: 'var(--cr-neutral-300)', color: 'var(--cr-text-4)' }}
        >
          {t('generalSettings.cancelBtn')}
        </Button>
      </div>
    </Form>
  );
}

function ChangeRoleForm({
  currentRole,
  onFinish,
  changingRole,
  t,
}: {
  currentRole: string;
  onFinish: (vals: { role: 'admin' | 'member' }) => Promise<void>;
  changingRole: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const [form] = Form.useForm();
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={onFinish}
      requiredMark={false}
      style={{ marginTop: 24 }}
    >
      <Form.Item
        name="role"
        label={t('changeRole.newRoleLabel')}
        rules={[{ required: true }]}
        initialValue={currentRole}
      >
        <Select size="large">
          <Option value="admin">{t('changeRole.adminOption')}</Option>
          <Option value="member">{t('changeRole.memberOption')}</Option>
        </Select>
      </Form.Item>
      <div className="mt-4 flex justify-end gap-2">
        <Button type="primary" htmlType="submit" loading={changingRole}>
          {t('changeRole.submitBtn')}
        </Button>
      </div>
    </Form>
  );
}

// ── App Lock Idle Timeout Form ─────────────────────────────────────────────
const IDLE_PRESETS = [
  { value: 60_000, labelKey: 'appLockIdle.opt1min' },
  { value: 120_000, labelKey: 'appLockIdle.opt2min' },
  { value: 300_000, labelKey: 'appLockIdle.opt5min' },
  { value: 600_000, labelKey: 'appLockIdle.opt10min' },
  { value: 900_000, labelKey: 'appLockIdle.opt15min' },
  { value: 1_800_000, labelKey: 'appLockIdle.opt30min' },
] as const;

function AppLockIdleForm({
  ws,
  onFinish,
  saving,
  onCancel,
  t,
}: {
  ws: Workspace;
  onFinish: (vals: UpdateWorkspacePayload) => Promise<void>;
  saving: boolean;
  onCancel: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const currentValue = ws.appLockIdleMs ?? env.appLockIdleMs;
  const [selected, setSelected] = useState<number>(currentValue);
  const isDirty = selected !== currentValue;
  const showDefaultHint = selected === env.appLockIdleMs && ws.appLockIdleMs !== null;

  const handleSave = () => {
    if (!isDirty) return;
    onFinish({
      appLockIdleMs: selected === env.appLockIdleMs ? null : selected,
    });
  };

  return (
    <div className="space-y-4">
      <p className="m-0 text-[13px] leading-relaxed text-muted">{t('appLockIdle.description')}</p>

      <div>
        <label className="mb-1.5 block text-[12px] font-medium text-body" htmlFor="app-lock-idle">
          Idle timeout
        </label>
        <Select
          id="app-lock-idle"
          value={selected}
          onChange={setSelected}
          className="w-full max-w-[280px]"
          size="large"
          options={IDLE_PRESETS.map((p) => ({
            value: p.value,
            label: t(p.labelKey),
          }))}
        />
        {showDefaultHint && (
          <p className="m-0 mt-1.5 text-[11.5px] text-muted italic">
            {t('appLockIdle.defaultHint')}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Button type={isDirty ? 'primary' : 'default'} loading={saving} onClick={handleSave}>
          {t('generalSettings.saveBtn')}
        </Button>
        {isDirty && (
          <Button
            onClick={() => {
              setSelected(currentValue);
              onCancel();
            }}
          >
            {t('generalSettings.cancelBtn')}
          </Button>
        )}
        {isDirty ? (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-amber-700">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
            Unsaved changes
          </span>
        ) : (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] text-subtle">
            <CheckCircleOutlined style={{ fontSize: 11 }} />
            Saved
          </span>
        )}
      </div>
    </div>
  );
}


// Section row component (extracted to avoid creating components during render)
type SectionDensity = 'standard' | 'heavy';
const DENSITY_STYLES: Record<
  SectionDensity,
  {
    padding: string;
    iconBox: string;
    iconSize: string;
    title: string;
    subtitle: string;
    gap: string;
  }
> = {
  standard: {
    padding: 'px-4 py-3',
    iconBox: 'h-10 w-10 rounded-[10px]',
    iconSize: 'text-[16px]',
    title: 'text-[14px]',
    subtitle: 'text-[12px] mt-0.5',
    gap: 'gap-3',
  },
  heavy: {
    padding: 'px-4 py-3.5',
    iconBox: 'h-11 w-11 rounded-[12px]',
    iconSize: 'text-[18px]',
    title: 'text-[15px]',
    subtitle: 'text-[12.5px] mt-0.5',
    gap: 'gap-3.5',
  },
};

function SectionRow({
  sectionKey,
  icon,
  title,
  subtitle,
  badge,
  danger = false,
  density = 'standard',
  children,
  activeSection,
  onToggle,
}: {
  sectionKey: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  danger?: boolean;
  density?: SectionDensity;
  children: React.ReactNode;
  activeSection: string | null;
  onToggle: (key: string) => void;
}) {
  const open = activeSection === sectionKey;
  const d = DENSITY_STYLES[density];
  return (
    <div
      id={`ws-section-${sectionKey}`}
      className={`overflow-hidden rounded-xl transition-all ${
        danger
          ? 'border border-red-200 shadow-sm'
          : 'border border-[var(--cr-border)] bg-white shadow-card'
      }`}
    >
      <button
        onClick={() => onToggle(sectionKey)}
        className={`flex w-full cursor-pointer items-center ${d.gap} border-none ${d.padding} text-left transition-colors ${open ? 'bg-surface-2' : 'bg-white hover:bg-primary-light'}`}
      >
        <div
          className={`flex flex-shrink-0 items-center justify-center ${d.iconBox} ${d.iconSize} ${
            danger ? 'bg-red-50 text-red-700' : 'bg-primary-light text-primary'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`m-0 ${d.title} leading-snug font-semibold ${danger ? 'text-red-700' : 'text-heading'}`}
          >
            {title}
          </p>
          <p className={`m-0 ${d.subtitle} leading-snug text-muted`}>{subtitle}</p>
        </div>
        {badge}
        <svg
          className={`h-4 w-4 flex-shrink-0 text-subtle transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <>
          <div className="border-t border-[var(--cr-border)]" />
          <div className="bg-white px-4 py-4">{children}</div>
        </>
      )}
    </div>
  );
}

export default function WorkspacePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // AC-4.1: narrow Zustand subscriptions to per-slice selectors so a mutation to
  // one slice (e.g. currentWorkspace on rename) does not re-render this 3000-line
  // page through unrelated slices, and unrelated layout consumers stay still.
  // setCurrentWorkspace patches the selected workspace in place (AC-4.2) so the
  // header/sidebar/switcher reflect rename/branding without a full-list refetch.
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);
  const setCurrentWorkspace = useWorkspaceStore((s) => s.setCurrentWorkspace);
  // Used when an owner deletes their ONLY workspace: empties the store so the
  // DashboardLayout onboarding gate redirects to /auth/setup-workspace. The
  // store's setCurrentWorkspaceId is typed string-only, so clearWorkspace is the
  // canonical "no workspace selected" affordance (resets id + list + current).
  const clearWorkspace = useWorkspaceStore((s) => s.clearWorkspace);
  const { user } = useAuthStore();
  const {
    can: canPermission,
    data: permissionsData,
    loading: permissionsLoading,
  } = useMyPermissions();
  const t = useTranslations('workspace');
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [inviteModal, setInviteModal] = useState(false);
  const [inviting, setInviting] = useState(false);
  // AC-10.3 - rehire notice. Set when an invite reattaches to a prior
  // removed/declined membership for the same person (BE returns priorMembership).
  // Surfaced as a confirmation notice so re-adding is deliberate, not silent.
  const [rehireNotice, setRehireNotice] = useState<{
    removedAt: string | null;
    declinedAt: string | null;
  } | null>(null);
  const [createModal, setCreateModal] = useState(() => searchParams.get('action') === 'create');
  const [creating, setCreating] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [workspaceRoles, setWorkspaceRoles] = useState<Role[]>([]);

  // Which section is expanded: null = none, 'general' | 'designations' | 'members' | 'roles' | 'delete'
  const [activeSection, setActiveSection] = useState<string | null>(() =>
    searchParams.get('section'),
  );

  // Designations
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [newDesig, setNewDesig] = useState('');
  const [savingDesig, setSavingDesig] = useState(false);
  const [designationModalOpen, setDesignationModalOpen] = useState(false);
  // Edit modal - record being edited (deep-copied so cancel doesn't leak state)
  const [editingDesignation, setEditingDesignation] = useState<{
    original: DesignationRecord;
    draft: DesignationRecord;
  } | null>(null);
  const [deletingDesignation, setDeletingDesignation] = useState<DesignationRecord | null>(null);
  // Rename-cascade confirm - set when the canonical en label changes on save
  const [renameCascade, setRenameCascade] = useState<{
    original: DesignationRecord;
    draft: DesignationRecord;
    inUseCount: number;
    sampleMemberIds: string[];
  } | null>(null);
  // Delete-blocked surface - set on 400 DESIGNATION_IN_USE response
  const [deleteBlocked, setDeleteBlocked] = useState<{
    canonical: string;
    inUseCount: number;
  } | null>(null);
  const locale = useLocale() as DesignationLocale;
  const renderDesignationLabel = useCallback(
    (rec: DesignationRecord): string => rec.labels[locale] ?? rec.labels.en,
    [locale],
  );

  // Bank Accounts (Payment From)
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [newBankLabel, setNewBankLabel] = useState('');
  const [savingBankAccounts, setSavingBankAccounts] = useState(false);
  const [bankAccountModalOpen, setBankAccountModalOpen] = useState(false);
  const [editingBankAccount, setEditingBankAccount] = useState<{
    index: number;
    label: string;
  } | null>(null);

  // Change role
  const [changeRoleModal, setChangeRoleModal] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WorkspaceMember | null>(null);
  const [changingRole, setChangingRole] = useState(false);

  // Delete workspace
  const [deleteModal, setDeleteModal] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  // Derive initial state from search params (avoids setState-in-effect)
  const initialSection = searchParams.get('section');

  // Force refresh workspace data if missing
  useEffect(() => {
    const refreshIfNeeded = async () => {
      if (isHydrated && !currentWorkspace && workspaces.length === 0) {
        try {
          const res = await listWorkspaces();
          if (res.ok) {
            const list = normalizeWorkspaceList(res.data);
            setWorkspaces(list);
          }
        } catch (e) {
          console.error('[WorkspacePage] Failed to refresh:', e);
        }
      }
    };
    refreshIfNeeded();
  }, [isHydrated, currentWorkspace, workspaces, setWorkspaces]);

  const ws = currentWorkspace as Workspace | null;

  const loadMembers = useCallback(
    async (wsId: string) => {
      setLoadingMembers(true);
      try {
        const res = await getWorkspaceMembers(wsId);
        if (res.ok) {
          setMembers(Array.isArray(res.data) ? res.data : []);
        } else {
          msgApi.error(res.error);
          setMembers([]);
        }
      } catch {
        msgApi.error(t('members.loadFailed'));
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    },
    [msgApi, t],
  );

  const loadPendingInvitations = useCallback(async (wsId: string) => {
    try {
      setLoadingPending(true);
      const res = await getPendingInvitations(wsId);
      if (res.ok) {
        setPendingInvitations(Array.isArray(res.data) ? res.data : []);
      } else {
        setPendingInvitations([]);
      }
    } catch {
      setPendingInvitations([]);
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const loadShifts = useCallback(async (wsId: string) => {
    setLoadingShifts(true);
    try {
      const res = await listShifts(wsId);
      setShifts(Array.isArray(res) ? res : []);
    } catch {
      setShifts([]);
    } finally {
      setLoadingShifts(false);
    }
  }, []);

  // Sync local editable state + load data when workspace changes.
  // RBAC Remediation Tier 1 (2026-05-18): guard workspace data fetches behind
  // resolved permissions. Do not fetch until permissionsData is non-null;
  // this prevents the race where a restricted member lands on the page,
  // permissions are still loading, and data calls fire against ungated paths.
  const prevWsId = useRef<string | null>(null);
  useEffect(() => {
    // Wait for permissions to resolve before fetching workspace data.
    if (permissionsLoading || permissionsData == null) return;
    const wsId = ws?._id ?? null;
    if (wsId === prevWsId.current) return;
    prevWsId.current = wsId;
    if (ws) {
      setBankAccounts(ws.bankAccounts ?? []);
    }
    if (currentWorkspaceId) {
      // Designations: fetch via dedicated endpoint to guarantee record shape
      // (legacy string[] coerced server-side). Avoids trusting the embedded
      // workspace.designations field which may carry mixed legacy data.
      void listDesignations(currentWorkspaceId).then((res) => {
        if (res.ok) setDesignations(res.data);
      });
      loadMembers(currentWorkspaceId);
      loadShifts(currentWorkspaceId);
      loadPendingInvitations(currentWorkspaceId);
    }
  }, [
    ws,
    currentWorkspaceId,
    loadMembers,
    loadShifts,
    loadPendingInvitations,
    permissionsData,
    permissionsLoading,
  ]);

  // RBAC Remediation Tier 1 (2026-05-18): page-level permission guard.
  // Show loading skeleton while permissions are resolving; render a
  // permission-denied surface if the caller lacks workspaces.view.
  // Owners bypass this check (permissionsData.isOwner === true).
  const canViewWorkspace = permissionsData?.isOwner || canPermission('workspaces', 'view');
  if (permissionsLoading || permissionsData == null) {
    return (
      <div className="w-full animate-pulse">
        <div className="mb-10 flex items-center gap-4 rounded-xl border border-[var(--cr-border)] bg-white p-5">
          <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gray-100" />
          <div className="flex-1">
            <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
            <div className="h-3.5 w-32 rounded bg-gray-100" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-gray-100" />
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4"
            >
              <div className="h-10 w-10 flex-shrink-0 rounded-[10px] bg-gray-100" />
              <div className="flex-1">
                <div className="mb-2 h-3.5 w-32 rounded bg-gray-100" />
                <div className="h-3 w-44 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!canViewWorkspace) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <Alert
          type="error"
          showIcon
          title={t('accessDenied.title')}
          description={t('accessDenied.description')}
          style={{ maxWidth: 480 }}
        />
      </div>
    );
  }

  // Show loading while store is hydrating
  if (!isHydrated) {
    return (
      <div className="w-full animate-pulse">
        {/* Overview card skeleton */}
        <div className="mb-10 flex items-center gap-4 rounded-xl border border-[var(--cr-border)] bg-white p-5">
          <div className="h-14 w-14 flex-shrink-0 rounded-xl bg-gray-100" />
          <div className="flex-1">
            <div className="mb-2 h-5 w-48 rounded bg-gray-100" />
            <div className="h-3.5 w-32 rounded bg-gray-100" />
          </div>
          <div className="h-8 w-24 rounded-lg bg-gray-100" />
        </div>
        {/* Section header skeleton */}
        <div className="mb-5 flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-gray-100" />
          <div>
            <div className="mb-1.5 h-3 w-20 rounded bg-gray-100" />
            <div className="h-2.5 w-40 rounded bg-gray-100" />
          </div>
        </div>
        {/* Card skeleton row */}
        <div className="mb-12 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4"
            >
              <div className="h-10 w-10 flex-shrink-0 rounded-[10px] bg-gray-100" />
              <div className="flex-1">
                <div className="mb-2 h-3.5 w-40 rounded bg-gray-100" />
                <div className="h-3 w-56 rounded bg-gray-100" />
              </div>
              <div className="h-5 w-16 rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
        {/* Second section skeleton */}
        <div className="mb-5 flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-gray-100" />
          <div>
            <div className="mb-1.5 h-3 w-32 rounded bg-gray-100" />
            <div className="h-2.5 w-48 rounded bg-gray-100" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-[var(--cr-border)] bg-white p-4"
            >
              <div className="h-10 w-10 flex-shrink-0 rounded-[10px] bg-gray-100" />
              <div className="flex-1">
                <div className="mb-2 h-3.5 w-32 rounded bg-gray-100" />
                <div className="h-3 w-44 rounded bg-gray-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const workspaceName = ws?.name ?? '';
  // `myRole`/`isOwner`/`isAdmin` are the coarse membership-string signal -
  // retained only as display labels (overview sub-text) and for the
  // owner-only danger zone. Action visibility is gated by RBAC, not the
  // membership string (ADR-001 R-3): drive `canManage` from
  // workspaces.edit - owners short-circuit inside `canPermission`.
  const myRole = members.find((m) => m.userId === user?._id)?.role;
  const isOwner = myRole === 'owner';
  const isAdmin = myRole === 'admin';
  const canManage = canPermission('workspaces', 'edit');

  const handleResendInvite = async (memberId: string) => {
    if (!currentWorkspaceId) return;
    try {
      const res = await resendInvite(currentWorkspaceId, memberId);
      if (res.ok) {
        msgApi.success(t('invitations.resendSuccess'));
      } else {
        msgApi.error(res.error || t('invitations.resendFailed'));
      }
    } catch {
      msgApi.error(t('invitations.resendFailed'));
    }
  };

  const handleCancelInvite = async (memberId: string) => {
    if (!currentWorkspaceId) return;
    try {
      const res = await cancelInvite(currentWorkspaceId, memberId);
      if (res.ok) {
        msgApi.success(t('invitations.cancelSuccess'));
        setPendingInvitations((prev) => prev.filter((p) => p._id !== memberId));
      } else {
        msgApi.error(res.error || t('invitations.cancelFailed'));
      }
    } catch {
      msgApi.error(t('invitations.cancelFailed'));
    }
  };

  const loadRoles = async (wsId: string) => {
    try {
      const res = await listRoles(wsId);
      setWorkspaceRoles(Array.isArray(res) ? res : []);
    } catch {
      setWorkspaceRoles([]);
    }
  };

  const openInviteModal = async () => {
    if (currentWorkspaceId) {
      await loadRoles(currentWorkspaceId);
    }
    setInviteModal(true);
  };

  const refreshWorkspaces = async () => {
    try {
      const res = await listWorkspaces();
      if (res.ok) {
        const list = normalizeWorkspaceList(res.data);
        setWorkspaces(list);
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('refreshFailed'));
    }
  };

  const handleSave = async (vals: UpdateWorkspacePayload) => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    try {
      const res = await updateWorkspace(currentWorkspaceId, vals);
      if (res.ok) {
        msgApi.success(t('generalSettings.saveSuccess'));
        // AC-3.1 / AC-4.2: rename is a single-workspace change. Patch the store
        // entry in place (header/sidebar/switcher reflect the new name at once)
        // instead of refetching the whole `GET /workspaces` list and churning
        // every store consumer. Merge onto the current doc so unrelated fields
        // (branding, settings) the PATCH response may omit are preserved.
        if (currentWorkspace) setCurrentWorkspace({ ...currentWorkspace, ...res.data });
        else setCurrentWorkspace(res.data);
        setActiveSection(null);
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('generalSettings.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  /**
   * Add a new (user-custom) designation. Single en label only - custom user
   * input is stored as-entered per owner constraint (no FE translation).
   */
  const addDesignation = async (name?: string) => {
    const trimmed = (name || newDesig).trim();
    if (
      !trimmed ||
      designations.some((d) => d.canonical.toLowerCase() === trimmed.toLowerCase()) ||
      !currentWorkspaceId
    )
      return;
    setSavingDesig(true);
    try {
      const res = await apiAddDesignation(currentWorkspaceId, {
        canonical: trimmed,
        isPreset: false,
        labels: { en: trimmed },
      });
      if (res.ok) {
        setDesignations(res.data);
        setNewDesig('');
      } else {
        msgApi.error(res.error || t('designations.addFailed'));
      }
    } catch {
      msgApi.error(t('designations.addFailed'));
    } finally {
      setSavingDesig(false);
    }
  };

  /**
   * Save edits to an existing designation. If canonical (en) changed, route
   * through the rename-cascade confirm modal first; otherwise commit a
   * labels-only patch (BE will skip cascade because old===new).
   */
  const commitDesignationEdit = async (
    original: DesignationRecord,
    draft: DesignationRecord,
  ): Promise<void> => {
    if (!currentWorkspaceId) return;
    const trimmedEn = draft.labels.en.trim();
    if (!trimmedEn) {
      msgApi.error(t('designations.duplicate'));
      return;
    }
    setSavingDesig(true);
    try {
      const res = await apiRenameDesignation(currentWorkspaceId, original.canonical, {
        newCanonical: trimmedEn,
        labels: draft.labels,
      });
      if (res.ok) {
        setDesignations(res.data.designations);
        if (res.data.cascadedMembers > 0) {
          msgApi.success(t('designations.renameSuccessToast', { count: res.data.cascadedMembers }));
        } else {
          msgApi.success(t('designations.renameSuccessToastZero'));
        }
        setEditingDesignation(null);
        setRenameCascade(null);
      } else {
        msgApi.error(res.error || t('designations.updateFailed'));
      }
    } catch {
      msgApi.error(t('designations.updateFailed'));
    } finally {
      setSavingDesig(false);
    }
  };

  const handleSaveDesignationEdit = async () => {
    if (!editingDesignation || !currentWorkspaceId) return;
    const { original, draft } = editingDesignation;
    const oldCanonical = original.canonical.trim();
    const newCanonical = draft.labels.en.trim();
    if (!newCanonical) return;
    // Duplicate check (case-insensitive, ignore self)
    const dup = designations.some(
      (d) =>
        d.canonical.toLowerCase() === newCanonical.toLowerCase() &&
        d.canonical.toLowerCase() !== oldCanonical.toLowerCase(),
    );
    if (dup) {
      msgApi.error(t('designations.duplicate'));
      return;
    }
    if (oldCanonical.toLowerCase() === newCanonical.toLowerCase()) {
      // No canonical change → straight save, no cascade modal.
      await commitDesignationEdit(original, { ...draft, canonical: newCanonical });
      return;
    }
    // Canonical changed → fetch usage count and surface cascade-confirm modal.
    const usage = await getDesignationUsage(currentWorkspaceId, oldCanonical);
    if (!usage.ok) {
      msgApi.error(usage.error);
      return;
    }
    if (usage.data.inUseCount === 0) {
      // No members affected - skip modal, commit immediately.
      await commitDesignationEdit(original, { ...draft, canonical: newCanonical });
      return;
    }
    setRenameCascade({
      original,
      draft: { ...draft, canonical: newCanonical },
      inUseCount: usage.data.inUseCount,
      sampleMemberIds: usage.data.sampleMemberIds,
    });
  };

  /** Triggered from the per-row delete icon - opens the delete confirm modal. */
  const removeDesignation = async (canonical: string) => {
    if (!currentWorkspaceId) return;
    setSavingDesig(true);
    try {
      const res = await apiDeleteDesignation(currentWorkspaceId, canonical);
      if (res.ok) {
        setDesignations(res.data);
        setDeletingDesignation(null);
      } else if (res.code === 'DESIGNATION_IN_USE') {
        setDeletingDesignation(null);
        setDeleteBlocked({
          canonical,
          inUseCount: res.inUseCount ?? 0,
        });
      } else {
        msgApi.error(res.error || t('designations.removeFailed'));
      }
    } catch {
      msgApi.error(t('designations.removeFailed'));
    } finally {
      setSavingDesig(false);
    }
  };

  const sanitizeBankAccounts = (accounts: BankAccount[]) =>
    accounts.map(({ id, label }) => ({ id, label }));

  const addBankAccount = async (label?: string) => {
    const trimmed = (label || newBankLabel).trim();
    if (
      !trimmed ||
      bankAccounts.some((a) => a.label.toLowerCase() === trimmed.toLowerCase()) ||
      !currentWorkspaceId
    )
      return;
    const next = [...bankAccounts, { id: Date.now().toString(), label: trimmed }];
    setSavingBankAccounts(true);
    try {
      const res = await updateWorkspace(currentWorkspaceId, {
        bankAccounts: sanitizeBankAccounts(next),
      });
      if (res.ok) {
        setBankAccounts(next);
        setNewBankLabel('');
        // AC-4.2: single-workspace change → patch the store in place instead of
        // a full list refetch. Merge the PATCH response onto the current doc.
        if (currentWorkspace) setCurrentWorkspace({ ...currentWorkspace, ...res.data });
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('bankAccounts.addFailed'));
    } finally {
      setSavingBankAccounts(false);
    }
  };

  const updateBankAccount = async (index: number, newLabel: string) => {
    const trimmed = newLabel.trim();
    if (
      !trimmed ||
      bankAccounts.some((a, i) => i !== index && a.label.toLowerCase() === trimmed.toLowerCase()) ||
      !currentWorkspaceId
    )
      return;
    const next = bankAccounts.map((a, i) => (i === index ? { ...a, label: trimmed } : a));
    setSavingBankAccounts(true);
    try {
      const res = await updateWorkspace(currentWorkspaceId, {
        bankAccounts: sanitizeBankAccounts(next),
      });
      if (res.ok) {
        setBankAccounts(next);
        setEditingBankAccount(null);
        // AC-4.2: patch in place instead of refetching the whole list.
        if (currentWorkspace) setCurrentWorkspace({ ...currentWorkspace, ...res.data });
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('bankAccounts.updateFailed'));
    } finally {
      setSavingBankAccounts(false);
    }
  };

  const removeBankAccount = async (index: number) => {
    if (!currentWorkspaceId) return;
    const next = bankAccounts.filter((_, i) => i !== index);
    try {
      const res = await updateWorkspace(currentWorkspaceId, {
        bankAccounts: sanitizeBankAccounts(next),
      });
      if (res.ok) {
        setBankAccounts(next);
        // AC-4.2: patch in place instead of refetching the whole list.
        if (currentWorkspace) setCurrentWorkspace({ ...currentWorkspace, ...res.data });
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('bankAccounts.removeFailed'));
    }
  };

  const handleInvite = async (vals: InviteMemberPayload) => {
    if (!currentWorkspaceId) return;
    setInviting(true);
    try {
      const res = await inviteMember(currentWorkspaceId, vals);
      if (res.ok) {
        msgApi.success(res.data?.message || t('invite.sendSuccess'));
        setInviteModal(false);
        // AC-10.3 - when the BE reattached to a prior removed/declined membership
        // for this person, surface a clear "previously a member" notice so the
        // owner understands the existing record (employee code, history) was
        // restored rather than a fresh row created.
        if (res.data?.priorMembership) {
          setRehireNotice({
            removedAt: res.data.priorMembership.removedAt ?? null,
            declinedAt: res.data.priorMembership.declinedAt ?? null,
          });
        }
        loadMembers(currentWorkspaceId);
        loadPendingInvitations(currentWorkspaceId);
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('invite.sendFailed'));
    } finally {
      setInviting(false);
    }
  };

  const handleCreate = async (vals: CreateWorkspacePayload) => {
    setCreating(true);
    try {
      const res = await createWorkspace(vals);
      if (res.ok) {
        const newWorkspace = res.data;
        await refreshWorkspaces();
        // Explicitly set the newly created workspace as current
        // This is especially important for first-time users
        if (newWorkspace?._id) {
          setCurrentWorkspaceId(newWorkspace._id);
        }
        msgApi.success(t('createSuccess'));
        setCreateModal(false);
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('createFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!currentWorkspaceId) return;
    try {
      const res = await removeMember(currentWorkspaceId, memberId);
      if (res.ok) {
        msgApi.success(t('members.removeSuccess'));
        await loadMembers(currentWorkspaceId);
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('members.removeFailed'));
    }
  };

  const handleOpenChangeRole = (member: WorkspaceMember) => {
    setSelectedMember(member);
    setChangeRoleModal(true);
  };

  const handleChangeRole = async (vals: { role: 'admin' | 'member' }) => {
    if (!currentWorkspaceId || !selectedMember) return;
    setChangingRole(true);
    try {
      const res = await changeMemberRole(currentWorkspaceId, selectedMember._id, {
        roleId: vals.role,
      });
      if (res.ok) {
        msgApi.success(t('changeRole.success'));
        setChangeRoleModal(false);
        setSelectedMember(null);
        await loadMembers(currentWorkspaceId);
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('changeRole.failed'));
    } finally {
      setChangingRole(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspaceId || deleteConfirmName !== workspaceName) return;

    // Deleting your only/last workspace is now allowed (lands the user in the
    // supported zero-workspace state: Connect stays open, the ERP area redirects
    // to /auth/setup-workspace, and the workspace is restorable for 30 days). The
    // old `workspaces.length <= 1` block is gone — see the strengthened confirm
    // notice in the delete modal.
    setDeleting(true);
    try {
      const res = await deleteWorkspace(currentWorkspaceId);
      if (res.ok) {
        msgApi.success(t('deleteModal.deleteSuccess'));
        const listRes = await listWorkspaces();
        if (listRes.ok) {
          const list = normalizeWorkspaceList(listRes.data);
          if (list.length > 0) {
            setWorkspaces(list);
            setCurrentWorkspaceId(list[0]._id);
          } else {
            // No workspaces left: clear the whole store (id + list + current) so
            // a stale pointer doesn't flash before DashboardLayout's onboarding
            // gate redirects to /auth/setup-workspace.
            clearWorkspace();
          }
        }
        setDeleteModal(false);
        setDeleteConfirmName('');
      } else {
        msgApi.error(res.error);
      }
    } catch {
      msgApi.error(t('deleteModal.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  const toggle = (key: string) => setActiveSection((p) => (p === key ? null : key));

  const openAndScroll = (key: string) => {
    setActiveSection(key);
    // Wait for section to expand, then scroll + flash highlight ring
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.getElementById(`ws-section-${key}`);
        if (!el) return;
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2');
        window.setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2');
        }, 2200);
      });
    });
  };

  // ── Setup progress (computed locally from existing state) ──────────────
  const setupItems = ws
    ? [
        {
          key: 'general',
          label: 'Name & location',
          done: Boolean(ws.name && ws.location),
          action: () => openAndScroll('general'),
        },
        {
          key: 'designations',
          label: 'Designations',
          done: designations.length > 0,
          action: () => openAndScroll('designations'),
        },
        {
          key: 'bank-accounts',
          label: 'Payment accounts',
          done: bankAccounts.length > 0,
          action: () => openAndScroll('bank-accounts'),
        },
        {
          key: 'shifts',
          label: 'Shifts',
          done: shifts.length > 0,
          action: () => router.push('/dashboard/shifts'),
        },
        {
          key: 'branding',
          label: 'Branding',
          done: Boolean(ws.branding?.logo),
          action: () => openAndScroll('branding'),
        },
        {
          key: 'members',
          label: 'Team invited',
          done: members.length > 1 || pendingInvitations.length > 0,
          action: () => openAndScroll('members'),
        },
      ]
    : [];
  const setupDone = setupItems.filter((i) => i.done).length;
  const setupTotal = setupItems.length;
  const firstPending = setupItems.find((i) => !i.done);

  if (!ws) {
    return (
      <>
        {ctx}
        <div className="mx-auto mt-12 max-w-[480px] text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] border-2 border-dashed border-border bg-surface-2 text-3xl">
            🏢
          </div>
          <h2 className="mb-2 font-display text-[20px] font-bold text-heading">
            {t('noWorkspace.title')}
          </h2>
          <p className="mb-6 text-[14px] text-muted">{t('noWorkspace.description')}</p>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => setCreateModal(true)}
          >
            {t('noWorkspace.createBtn')}
          </Button>
        </div>

        {/* Create workspace modal - Must be rendered even when no workspace */}
        {createModal && (
          <Modal
            open={createModal}
            onCancel={() => {
              setCreateModal(false);
            }}
            title={<span className="font-display">{t('createForm.modalTitle')}</span>}
            footer={null}
          >
            <CreateWorkspaceForm onFinish={handleCreate} creating={creating} t={t} />
          </Modal>
        )}
      </>
    );
  }

  return (
    <>
      {ctx}

      {/* ── Workspace Overview Header ── */}
      <DsPageHeader
        title={ws.name}
        sub={[
          isOwner
            ? t('overview.youreOwner')
            : isAdmin
              ? t('overview.admin')
              : myRole === 'member'
                ? t('overview.member')
                : '',
          ws.location ?? '',
        ]
          .filter(Boolean)
          .join(' · ')}
        icon={
          ws.branding?.logo ? (
            <Image
              src={ws.branding.logo}
              alt={ws.name}
              width={40}
              height={40}
              className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
            />
          ) : (
            <BankOutlined />
          )
        }
        right={
          <>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10.5px] font-semibold tracking-wide text-green-700"
              role="status"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              {t('overview.active')}
            </span>
            {canManage && (
              <Button
                icon={<EditOutlined />}
                onClick={() => setActiveSection('general')}
                size="middle"
              >
                {t('overview.editBtn')}
              </Button>
            )}
          </>
        }
        style={{ marginBottom: 24 }}
      />

      {/* ── KPI Tiles (admin pattern; mirrors Team v2) ── */}
      <section className="!mb-[40px]" aria-label={t('overview.statTileMembersLabel')}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={t('overview.statTileMembersLabel')}
            value={String(members.length)}
            hint={t('overview.statTileMembersHint')}
            emphasis
          />
          <StatTile
            label={t('overview.statTilePendingLabel')}
            value={String(pendingInvitations.length)}
            hint={
              pendingInvitations.length === 0
                ? t('overview.statTilePendingHintNone')
                : t('overview.statTilePendingHintSome')
            }
          />
          <StatTile
            label={t('overview.statTileWorkspacesLabel')}
            value={String(workspaces.length)}
            hint={t('overview.statTileWorkspacesHint')}
          />
          <StatTile
            label={t('overview.statTileKioskLabel')}
            value={ws.kioskEnabled ? '✓' : '-'}
            hint={
              ws.kioskEnabled
                ? t('overview.statTileKioskHintEnabled')
                : t('overview.statTileKioskHintDisabled')
            }
          />
        </div>
      </section>

      {/* ── Setup Progress Strip ── */}
      {setupTotal > 0 && setupDone < setupTotal && (
        <div className="!mb-[24px] flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/40 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-bold text-heading">
                {setupDone} of {setupTotal}
              </span>
              <span className="text-[12.5px] text-muted">{t('setup.itemsConfigured')}</span>
            </div>
            {firstPending && (
              <p className="m-0 mt-0.5 text-[11.5px] text-subtle">
                Finish <span className="font-medium text-heading">{firstPending.label}</span>
                {setupTotal - setupDone > 1
                  ? ` and ${setupTotal - setupDone - 1} other${setupTotal - setupDone - 1 === 1 ? '' : 's'}`
                  : ''}{' '}
                to unlock payroll runs.
              </p>
            )}
            <div className="mt-2 flex items-center gap-1">
              {setupItems.map((it) => (
                <button
                  key={it.key}
                  type="button"
                  onClick={it.action}
                  title={`${it.label} - ${it.done ? 'Done' : 'Set up'}`}
                  className={`h-1.5 flex-1 cursor-pointer rounded-full border-none transition-colors ${
                    it.done
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-amber-200/70 hover:bg-amber-300'
                  }`}
                />
              ))}
            </div>
          </div>
          {firstPending && (
            <Button type="primary" size="middle" className="shrink-0" onClick={firstPending.action}>
              Resume setup →
            </Button>
          )}
        </div>
      )}
      {setupTotal > 0 && setupDone === setupTotal && (
        <div className="!mb-[24px] flex items-center gap-2 rounded-xl border border-green-200 bg-green-50/50 px-4 py-2.5">
          <CheckCircleOutlined className="text-green-600" />
          <p className="m-0 text-[12.5px] text-green-800">
            <span className="font-semibold">{t('setup.allSet')}</span> {t('setup.allSetBody')}
          </p>
        </div>
      )}

      <div className="w-full max-w-none">
        {/* Section header */}
        <div className="mt-2 !mb-[20px] flex items-center gap-2.5">
          <div className="h-5 w-1 flex-shrink-0 rounded-full bg-primary" />
          <div>
            <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-heading">
              {t('generalSettings.sectionHeader')}
            </h2>
            <p className="m-0 text-[12px] text-muted">{t('generalSettings.sectionDescription')}</p>
          </div>
        </div>
        <div className="!mb-[48px] flex flex-col !gap-[16px]">
          <SectionRow
            activeSection={activeSection}
            onToggle={toggle}
            sectionKey="general"
            icon={<EditOutlined />}
            title={t('generalSettings.title')}
            subtitle={t('generalSettings.subtitle')}
          >
            <GeneralSettingsForm
              ws={ws}
              onFinish={handleSave}
              saving={saving}
              onCancel={() => setActiveSection(null)}
              t={t}
            />
          </SectionRow>

          {/* Locations — restored standalone (2026-07-04, owner directive). Full
              CRUD lives at its own route; this is just a launch card. */}
          <SectionRow
            activeSection={activeSection}
            onToggle={toggle}
            sectionKey="locations"
            icon={<HomeOutlined />}
            title="Locations"
            subtitle="Physical work sites your staff are assigned to"
          >
            <p className="m-0 text-[13px] text-muted">
              Manage the list of work locations employees can be assigned to on their profile.
            </p>
            <Button
              type="primary"
              icon={<HomeOutlined />}
              onClick={() => router.push('/dashboard/workspace/locations')}
              className="mt-3"
            >
              Manage Locations
            </Button>
          </SectionRow>

          <SectionRow
            activeSection={activeSection}
            onToggle={toggle}
            sectionKey="appLockIdle"
            icon={<LockOutlined />}
            title={t('appLockIdle.title')}
            subtitle={t('appLockIdle.subtitle')}
            badge={
              <span className="shrink-0 rounded-md border border-border-light bg-surface px-2 py-0.5 text-[11px] font-semibold text-muted">
                {(() => {
                  const ms = ws.appLockIdleMs ?? env.appLockIdleMs;
                  const mins = Math.round(ms / 60_000);
                  return t('appLockIdle.badgeMinutes', { count: mins });
                })()}
              </span>
            }
          >
            <AppLockIdleForm
              ws={ws}
              onFinish={handleSave}
              saving={saving}
              onCancel={() => setActiveSection(null)}
              t={t}
            />
          </SectionRow>
        </div>

        <div className="mt-2 !mb-[20px] flex items-center gap-2.5">
          <div className="h-5 w-1 flex-shrink-0 rounded-full bg-primary" />
          <div>
            <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-heading">
              {t('people.sectionHeader')}
            </h2>
            <p className="m-0 text-[12px] text-muted">{t('people.sectionDescription')}</p>
          </div>
        </div>
        <div className="!mb-[48px] grid grid-cols-1 gap-4 md:grid-flow-dense md:grid-cols-2">
          {/* Roles & Permissions - Navigation only */}
          <div
            onClick={() => router.push('/dashboard/roles')}
            className="group block cursor-pointer overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white shadow-card transition-all hover:bg-primary-light hover:shadow-md"
          >
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-light text-[16px] text-primary transition-transform group-hover:scale-105">
                <SafetyOutlined />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] leading-snug font-semibold text-heading">
                  {t('roles.title')}
                </p>
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted">
                  {t('roles.subtitle')}
                </p>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-subtle"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <div className="md:col-span-2">
            <SectionRow
              activeSection={activeSection}
              onToggle={toggle}
              sectionKey="designations"
              icon={<TagOutlined />}
              title={t('designations.title')}
              subtitle={t('designations.subtitle')}
              badge={
                designations.length === 0 ? (
                  <span className="shrink-0 text-[11.5px] font-semibold text-amber-700">
                    Set up first title →
                  </span>
                ) : (
                  <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    {designations.length} {designations.length === 1 ? 'title' : 'titles'}
                  </span>
                )
              }
            >
              <p className="mb-3 text-[13px] text-muted">{t('designations.description')}</p>
              <div className="mb-4 flex min-h-8 flex-wrap gap-2">
                {designations.length === 0 && (
                  <span className="text-[13px] text-border">{t('designations.empty')}</span>
                )}
                {designations.slice(0, 5).map((d) => (
                  <span
                    key={d.canonical}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-[13px] font-medium text-gray-700"
                  >
                    {renderDesignationLabel(d)}
                  </span>
                ))}
                {designations.length > 5 && (
                  <span className="self-center text-[13px] text-muted">
                    +{designations.length - 5} more
                  </span>
                )}
              </div>
              <Button
                type="primary"
                icon={<TagOutlined />}
                onClick={() => setDesignationModalOpen(true)}
              >
                {t('designations.manageBtn')}
              </Button>
            </SectionRow>
          </div>

          {/* Employee Code Settings - navigation only */}
          <div
            onClick={() => router.push('/dashboard/workspace/employee-code')}
            className="group block cursor-pointer overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white shadow-card transition-all hover:bg-primary-light hover:shadow-md"
          >
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-light text-[16px] text-primary transition-transform group-hover:scale-105">
                <IdcardOutlined />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] leading-snug font-semibold text-heading">
                  {t('employeeCode.title')}
                </p>
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted">
                  {t('employeeCode.subtitle')}
                </p>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-subtle"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {/* Notification Settings - navigation only */}
          <div
            onClick={() => router.push('/dashboard/workspace/notifications')}
            className="group block cursor-pointer overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white shadow-card transition-all hover:bg-primary-light hover:shadow-md"
          >
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-light text-[16px] text-primary transition-transform group-hover:scale-105">
                <BellOutlined />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] leading-snug font-semibold text-heading">
                  {t('notifications.tileTitle')}
                </p>
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted">
                  {t('notifications.tileSubtitle')}
                </p>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-subtle"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <div className="md:col-span-2">
            <SectionRow
              activeSection={activeSection}
              onToggle={toggle}
              sectionKey="members"
              icon={<TeamOutlined />}
              title={t('members.title')}
              subtitle={t('members.subtitle')}
              badge={
                <span className="shrink-0 rounded-md border border-primary-border bg-primary-light px-2 py-0.5 text-[11px] font-bold text-primary">
                  {loadingMembers
                    ? '...'
                    : `${members.length} ${members.length !== 1 ? 'members' : 'member'}`}
                </span>
              }
            >
              <div className="mb-3 flex justify-end">
                {canManage && (
                  <Button
                    size="small"
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={openInviteModal}
                  >
                    {t('members.inviteBtn')}
                  </Button>
                )}
              </div>
              {loadingMembers ? (
                <div className="flex animate-pulse flex-col gap-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-xl border border-border-light px-3 py-2.5"
                    >
                      <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100" />
                      <div className="flex-1">
                        <div className="mb-1.5 h-3.5 w-32 rounded bg-gray-100" />
                        <div className="h-3 w-44 rounded bg-gray-100" />
                      </div>
                      <div className="h-5 w-14 rounded-full bg-gray-100" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {members.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-subtle">{t('members.empty')}</p>
                  ) : (
                    members.map((m) => {
                      const name = m.user?.name ?? 'Unknown';
                      const isThisOwner = m.role === 'owner';
                      const isMe = m.userId === user?._id;
                      const canModifyThis = canManage && !isThisOwner && !isMe;
                      return (
                        <div
                          key={m._id}
                          className="flex items-center gap-2.5 rounded-xl border border-border-light px-3 py-2.5"
                        >
                          <DsAvatar name={name} size={32} />
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[13px] font-semibold text-heading">
                              {name}
                              {isMe && (
                                <span className="ml-1 font-normal text-subtle">
                                  {t('members.you')}
                                </span>
                              )}
                            </p>
                            <p className="m-0 truncate text-[11px] text-subtle">
                              {m.user?.email ?? m.user?.mobile ?? '-'}
                            </p>
                          </div>
                          <Tag
                            color={isThisOwner ? 'gold' : m.role === 'admin' ? 'blue' : 'default'}
                            className="shrink-0 capitalize"
                          >
                            {isThisOwner && <CrownOutlined className="mr-0.5" />}
                            {m.role}
                          </Tag>
                          {canModifyThis && (
                            <div className="flex shrink-0 gap-1">
                              <Button
                                type="text"
                                size="small"
                                icon={<UserSwitchOutlined />}
                                title={t('members.changeRoleTitle')}
                                onClick={() => handleOpenChangeRole(m)}
                              />
                              <Popconfirm
                                title={t('members.removeTitle', { name })}
                                description={t('members.removeDescription')}
                                okText={t('members.removeBtn')}
                                okButtonProps={{ danger: true }}
                                onConfirm={() => handleRemoveMember(m._id)}
                              >
                                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
              {isOwner && members.length > 1 && (
                <p className="mt-3 mb-0 text-[11px] text-subtle">💡 {t('members.ownerTip')}</p>
              )}
            </SectionRow>
          </div>

          {canManage && (
            <div className="md:col-span-2">
              <SectionRow
                activeSection={activeSection}
                onToggle={toggle}
                sectionKey="pendingInvitations"
                icon={<ClockCircleOutlined />}
                title={t('invitations.title')}
                subtitle={t('invitations.subtitle')}
                badge={
                  pendingInvitations.length === 0 && !loadingPending ? (
                    <span className="shrink-0 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-400">
                      {t('invitations.nonePending')}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md border border-yellow-200 bg-yellow-50 px-2 py-0.5 text-[11px] font-bold text-yellow-700">
                      {loadingPending ? '...' : pendingInvitations.length} pending
                    </span>
                  )
                }
              >
                <div className="flex flex-col gap-2">
                  {pendingInvitations.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-subtle">
                      No pending invitations
                    </p>
                  ) : (
                    pendingInvitations.map((inv) => {
                      const isExpired = inv.inviteExpiry && new Date(inv.inviteExpiry) < new Date();
                      return (
                        <div
                          key={inv._id}
                          className="flex items-center gap-2.5 rounded-xl border border-border-light px-3 py-2.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="m-0 truncate text-[13px] font-semibold text-heading">
                              {inv.inviteeIdentifier || 'Unknown'}
                              {inv.inviteeType === 'mobile' && (
                                <span className="ml-1 text-subtle">📱</span>
                              )}
                            </p>
                            <p className="m-0 truncate text-[11px] text-subtle">
                              {t('invitations.rolePrefix', { role: inv.role })} •{' '}
                              {t('invitations.invitedByPrefix', { name: inv.invitedBy })}
                            </p>
                          </div>
                          {isExpired && (
                            <Tag color="warning" className="shrink-0">
                              Expired
                            </Tag>
                          )}
                          <div className="flex shrink-0 gap-1">
                            <Button
                              type="text"
                              size="small"
                              title={t('invitations.resendBtn')}
                              onClick={() => handleResendInvite(inv._id)}
                            >
                              Resend
                            </Button>
                            <Popconfirm
                              title={t('invitations.cancelConfirmTitle')}
                              description={t('invitations.cancelConfirmDescription')}
                              okText={t('invitations.cancelConfirmBtn')}
                              okButtonProps={{ danger: true }}
                              onConfirm={() => handleCancelInvite(inv._id)}
                            >
                              <Button type="text" size="small" danger>
                                {t('invitations.cancelBtn')}
                              </Button>
                            </Popconfirm>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </SectionRow>
            </div>
          )}
        </div>

        <div className="mt-2 !mb-[20px] flex items-center gap-2.5">
          <div className="h-5 w-1 flex-shrink-0 rounded-full bg-primary" />
          <div>
            <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-heading">
              {t('operationsFinanceSectionHeader')}
            </h2>
            <p className="m-0 text-[12px] text-muted">{t('operationsFinanceSectionDescription')}</p>
          </div>
        </div>
        <div className="!mb-[48px] grid grid-cols-1 gap-4 md:grid-flow-dense md:grid-cols-2">
          {/* Shifts - Navigation only */}
          <div
            onClick={() => router.push('/dashboard/shifts')}
            className="group block cursor-pointer overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white shadow-card transition-all hover:bg-primary-light hover:shadow-md"
          >
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-light text-[16px] text-primary transition-transform group-hover:scale-105">
                <ClockCircleOutlined />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] leading-snug font-semibold text-heading">
                  {t('shifts.title')}
                </p>
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted">
                  {t('shifts.subtitle')}
                </p>
              </div>
              {loadingShifts ? (
                <span className="shrink-0 text-[11.5px] text-muted">...</span>
              ) : shifts.length === 0 ? (
                <span className="shrink-0 text-[11.5px] font-semibold text-amber-700">
                  Set up first shift →
                </span>
              ) : (
                <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                  {shifts.length} {shifts.length !== 1 ? 'shifts' : 'shift'}
                </span>
              )}
              <svg
                className="h-4 w-4 flex-shrink-0 text-subtle"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          <div className="md:col-span-2">
            <SectionRow
              activeSection={activeSection}
              onToggle={toggle}
              sectionKey="bank-accounts"
              icon={<BankOutlined />}
              title={t('bankAccounts.title')}
              subtitle={t('bankAccounts.subtitle')}
              badge={
                bankAccounts.length === 0 ? (
                  <span className="shrink-0 text-[11.5px] font-semibold text-amber-700">
                    Set up first account →
                  </span>
                ) : (
                  <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
                    {bankAccounts.length} {bankAccounts.length === 1 ? 'account' : 'accounts'}
                  </span>
                )
              }
            >
              <p className="mb-3 text-[13px] text-muted">{t('bankAccounts.description')}</p>
              <div className="mb-4 flex min-h-8 flex-wrap gap-2">
                {bankAccounts.length === 0 && (
                  <span className="text-[13px] text-border">{t('bankAccounts.empty')}</span>
                )}
                {bankAccounts.slice(0, 5).map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-100 px-3 py-1.5 text-[13px] font-medium text-gray-700"
                  >
                    {a.label}
                  </span>
                ))}
                {bankAccounts.length > 5 && (
                  <span className="self-center text-[13px] text-muted">
                    +{bankAccounts.length - 5} more
                  </span>
                )}
              </div>
              <Button
                type="primary"
                icon={<BankOutlined />}
                onClick={() => setBankAccountModalOpen(true)}
              >
                {t('bankAccounts.manageBtn')}
              </Button>
            </SectionRow>
          </div>

          <div
            onClick={() => router.push('/dashboard/salary/settings')}
            className="group block cursor-pointer overflow-hidden rounded-xl border border-[var(--cr-border)] bg-white shadow-card transition-all hover:bg-primary-light hover:shadow-md"
          >
            <div className="flex w-full items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[10px] bg-primary-light text-[16px] text-primary transition-transform group-hover:scale-105">
                <RupeeOutlined />
              </div>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[14px] leading-snug font-semibold text-heading">
                  {t('payroll.title')}
                </p>
                <p className="m-0 mt-0.5 text-[12px] leading-snug text-muted">
                  {t('payroll.subtitle')}
                </p>
              </div>
              <svg
                className="h-4 w-4 flex-shrink-0 text-subtle"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="mt-2 !mb-[20px] flex items-center gap-2.5">
          <div className="h-5 w-1 flex-shrink-0 rounded-full bg-primary" />
          <div>
            <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-heading">
              {t('brandingSection.sectionHeader')}
            </h2>
            <p className="m-0 text-[12px] text-muted">{t('brandingSection.sectionDescription')}</p>
          </div>
        </div>
        <div className="!mb-[48px] flex flex-col !gap-[16px]">
          <SectionRow
            activeSection={activeSection}
            onToggle={toggle}
            sectionKey="branding"
            icon={<EditOutlined />}
            title={t('brandingSection.brandingTitle')}
            subtitle={t('brandingSection.brandingSubtitle')}
            density="heavy"
            badge={
              ws.branding?.logo ? (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11.5px] font-medium text-green-700">
                  <CheckCircleOutlined style={{ fontSize: 11 }} />
                  Logo set
                </span>
              ) : (
                <span className="shrink-0 text-[11.5px] font-semibold text-amber-700">
                  Add logo →
                </span>
              )
            }
          >
            <BrandingSection
              key={`branding-${currentWorkspaceId}`}
              workspaceId={currentWorkspaceId!}
              branding={ws.branding}
            />
          </SectionRow>
          <SectionRow
            activeSection={activeSection}
            onToggle={toggle}
            sectionKey="exportPreferences"
            icon={<FilePdfOutlined />}
            title={t('brandingSection.exportTitle')}
            subtitle={t('brandingSection.exportSubtitle')}
            density="heavy"
          >
            <ExportPreferencesSection
              key={`export-${currentWorkspaceId}`}
              workspaceId={currentWorkspaceId!}
              preferences={ws.exportPreferences}
            />
          </SectionRow>
        </div>

        {/* Operations section removed (2026-07-04) — Machines/Maintenance module
            deleted; OperationsMaintenanceForm was its only content. */}

        {isOwner && (
          <>
            <div className="mt-2 !mb-[20px] flex items-center gap-2.5">
              <div className="h-5 w-1 flex-shrink-0 rounded-full bg-red-400" />
              <div>
                <h2 className="m-0 mb-0.5 font-label text-[12px] font-bold text-heading">
                  {t('dangerZone.sectionHeader')}
                </h2>
                <p className="m-0 text-[12px] text-muted">{t('dangerZone.sectionDescription')}</p>
              </div>
            </div>
            <div
              className="overflow-hidden rounded-xl border border-[var(--cr-border)] bg-[var(--cr-cream,#fffdf7)]"
              style={{ borderTop: '3px solid var(--cr-danger-500, #ef4444)' }}
            >
              {/* Owner warning */}
              {members.filter((m) => m.role === 'owner').length <= 1 && (
                <div className="flex items-center gap-2 border-b border-[var(--cr-border)] bg-amber-50 px-4 py-2.5">
                  <WarningOutlined className="text-[13px] text-amber-600" />
                  <p className="m-0 text-[12px] text-amber-700">
                    {t('dangerZone.soleOwnerWarning')}
                  </p>
                </div>
              )}
              <div className="px-4 py-4">
                {/* Impact counts */}
                <div className="mb-4 flex flex-wrap gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${members.length > 0 ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-gray-200 bg-gray-50 text-gray-400'}`}
                  >
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${designations.length > 0 ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-gray-200 bg-gray-50 text-gray-400'}`}
                  >
                    {designations.length}{' '}
                    {designations.length === 1 ? 'designation' : 'designations'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${bankAccounts.length > 0 ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-gray-200 bg-gray-50 text-gray-400'}`}
                  >
                    {bankAccounts.length} {bankAccounts.length === 1 ? 'account' : 'accounts'}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${shifts.length > 0 ? 'border border-red-200 bg-red-50 text-red-700' : 'border border-gray-200 bg-gray-50 text-gray-400'}`}
                  >
                    {shifts.length} {shifts.length === 1 ? 'shift' : 'shifts'}
                  </span>
                </div>

                {/* Delete action */}
                <div className="flex items-start gap-3 rounded-lg border-l-[3px] border-red-500 bg-white py-3 pr-4 pl-3">
                  <div className="flex-1">
                    <p className="m-0 text-[14px] font-semibold text-heading">
                      {t('dangerZone.deleteTitle')}
                    </p>
                    <p className="m-0 mt-0.5 text-[12px] text-muted">
                      {t('dangerZone.deleteDescription')}
                    </p>
                    <p className="m-0 mt-1.5 text-[11px] text-subtle">
                      ⌨ {t('dangerZone.typeToConfirmHint', { name: workspaceName })}
                    </p>
                  </div>
                  {/* Delete always shows now, including for an owner's only/last
                      workspace (the old workspaces.length <= 1 swap is gone). The
                      extra last-workspace consequence is surfaced in the confirm
                      modal below, not by hiding the button. */}
                  <Button
                    danger
                    type="primary"
                    icon={<DeleteOutlined />}
                    className="shrink-0 self-center"
                    onClick={() => {
                      setDeleteConfirmName('');
                      setDeleteModal(true);
                    }}
                  >
                    {t('dangerZone.deleteBtn')}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* OQ-W3 - recently-deleted workspace recovery (30-day undo). Owner-only.
            Renders its own loading + empty states inside the section. */}
        {isOwner && <DeletedWorkspacesSection />}
      </div>

      {/* ── Modals ── */}

      {/* Invite */}
      {inviteModal && (
        <Modal
          open={inviteModal}
          onCancel={() => {
            setInviteModal(false);
          }}
          title={<span className="font-display">{t('invite.modalTitle')}</span>}
          footer={null}
        >
          <InviteForm
            onFinish={handleInvite}
            inviting={inviting}
            msgApi={msgApi}
            roles={workspaceRoles}
            t={t}
          />
        </Modal>
      )}

      {/* AC-10.3 - rehire notice. Shown after an invite that reattached to a
          prior removed/declined membership, so the owner knows the person's
          existing record (employee code, history) was restored. */}
      {rehireNotice && (
        <Modal
          open={!!rehireNotice}
          onCancel={() => setRehireNotice(null)}
          onOk={() => setRehireNotice(null)}
          okText={t('rehire.okBtn')}
          cancelButtonProps={{ style: { display: 'none' } }}
          title={
            <span className="font-display">
              <UserSwitchOutlined className="mr-2 text-primary" />
              {t('rehire.noticeTitle')}
            </span>
          }
        >
          <p className="m-0 text-[13px] leading-relaxed text-body">
            {rehireNotice.removedAt
              ? t('rehire.noticeRemovedOn', {
                  date: new Date(rehireNotice.removedAt).toLocaleDateString(),
                })
              : rehireNotice.declinedAt
                ? t('rehire.noticeDeclinedOn', {
                    date: new Date(rehireNotice.declinedAt).toLocaleDateString(),
                  })
                : t('rehire.noticeGeneric')}
          </p>
        </Modal>
      )}

      {/* Create workspace - Always available */}
      {createModal && (
        <Modal
          open={createModal}
          onCancel={() => {
            setCreateModal(false);
          }}
          title={<span className="font-display">{t('createForm.modalTitle')}</span>}
          footer={null}
        >
          <CreateWorkspaceForm onFinish={handleCreate} creating={creating} t={t} />
        </Modal>
      )}

      {/* Change role */}
      {changeRoleModal && selectedMember && (
        <Modal
          open={changeRoleModal}
          onCancel={() => {
            setChangeRoleModal(false);
            setSelectedMember(null);
          }}
          title={
            <span className="font-display">
              {t('changeRole.modalTitle', { name: selectedMember.user?.name ?? '' })}
            </span>
          }
          footer={null}
        >
          <ChangeRoleForm
            currentRole={selectedMember.role}
            onFinish={handleChangeRole}
            changingRole={changingRole}
            t={t}
          />
        </Modal>
      )}

      {/* Delete workspace */}
      <Modal
        open={deleteModal}
        onCancel={() => {
          setDeleteModal(false);
          setDeleteConfirmName('');
        }}
        title={
          <span className="font-display" style={{ color: 'var(--cr-danger-700)' }}>
            <WarningOutlined className="mr-2" />
            {t('deleteModal.title')}
          </span>
        }
        styles={{ body: { padding: '16px 24px 8px' } }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setDeleteModal(false);
              setDeleteConfirmName('');
            }}
          >
            {t('deleteModal.cancelBtn')}
          </Button>,
          <Button
            key="delete"
            danger
            type={deleteConfirmName === workspaceName ? 'primary' : 'default'}
            loading={deleting}
            onClick={handleDeleteWorkspace}
            icon={<DeleteOutlined />}
          >
            {t('deleteModal.deleteBtn')}
          </Button>,
        ]}
      >
        <div className="space-y-5">
          <Alert
            type="error"
            showIcon
            title={t('deleteModal.permanentWarning')}
            description={
              <ul className="mt-1 mb-0 pl-4 text-[13px]">
                <li>{t('deleteModal.willDelete.members')}</li>
                <li>{t('deleteModal.willDelete.attendance')}</li>
                <li>{t('deleteModal.willDelete.salary')}</li>
                <li>{t('deleteModal.willDelete.settings')}</li>
              </ul>
            }
          />

          {/* Last-workspace consequence notice. Only when this is the owner's
              only workspace: deleting it signs them out of the work area until
              they create/join another (Connect stays open), and it can be
              restored for 30 days. Replaces the old hide-the-button block. */}
          {workspaces.length <= 1 && (
            <Alert type="warning" showIcon title={t('deleteModal.lastWorkspaceNotice')} />
          )}

          <div>
            <label
              htmlFor="delete-confirm-input"
              className="m-0 mb-2 block text-[13px] font-medium text-heading"
            >
              {t.rich('deleteModal.typeToConfirm', {
                name: workspaceName,
                strong: (chunks) => <strong>{chunks}</strong>,
              })}
            </label>
            <Input
              id="delete-confirm-input"
              size="large"
              placeholder={workspaceName}
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              status={
                deleteConfirmName && deleteConfirmName !== workspaceName ? 'error' : undefined
              }
            />
            <div className="mt-2 min-h-[20px]">
              {deleteConfirmName === workspaceName && deleteConfirmName && (
                <p className="m-0 flex items-center gap-1 text-[12px] text-green-700">
                  <CheckCircleOutlined style={{ fontSize: 12 }} />
                  {t('deleteModal.nameConfirmed')}
                </p>
              )}
              {deleteConfirmName && deleteConfirmName !== workspaceName && (
                <p className="m-0 text-[12px] text-red-700">{t('deleteModal.nameMismatch')}</p>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* Designation Management Modal */}
      <Modal
        open={designationModalOpen}
        onCancel={() => setDesignationModalOpen(false)}
        title={<span className="font-display">{t('designations.modalTitle')}</span>}
        footer={null}
        width={500}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-muted">{t('designations.modalDescription')}</p>

          {/* Add new designation */}
          <div className="flex gap-2">
            <Input
              placeholder={t('designations.addPlaceholder')}
              value={newDesig}
              onChange={(e) => setNewDesig(e.target.value)}
              onPressEnter={() => addDesignation()}
              maxLength={40}
              className="flex-1"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={savingDesig}
              onClick={() => addDesignation()}
            >
              Add
            </Button>
          </div>
          {newDesig.trim() &&
            designations.some(
              (d) => d.canonical.toLowerCase() === newDesig.trim().toLowerCase(),
            ) && <p className="m-0 text-[12px] text-red-700">{t('designations.duplicate')}</p>}

          {/* Designation list */}
          <div className="max-h-[360px] overflow-y-auto rounded-lg border border-gray-200">
            {designations.length === 0 ? (
              <div className="p-6 text-center">
                <TagOutlined className="mb-2 text-2xl text-faint" />
                <p className="m-0 text-[13px] text-muted">{t('designations.emptyList')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {designations.map((d) => (
                  <div
                    key={d.canonical}
                    className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="flex-1 text-[14px] font-medium text-gray-700">
                      {renderDesignationLabel(d)}
                    </span>
                    {d.isPreset && (
                      <span
                        className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-blue-700 uppercase"
                        aria-label={t('designations.presetChipAria')}
                      >
                        {t('designations.preset')}
                      </span>
                    )}
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      aria-label={t('designations.editAria', { name: renderDesignationLabel(d) })}
                      onClick={() =>
                        setEditingDesignation({
                          original: d,
                          draft: {
                            canonical: d.canonical,
                            isPreset: d.isPreset,
                            labels: { ...d.labels },
                          },
                        })
                      }
                    />
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      aria-label={t('designations.deleteAria', { name: renderDesignationLabel(d) })}
                      onClick={() => setDeletingDesignation(d)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Edit Designation Modal - multi-locale for presets, single en for custom */}
      <Modal
        open={!!editingDesignation}
        onCancel={() => setEditingDesignation(null)}
        title={t('designations.editTitle')}
        footer={null}
        width={520}
        destroyOnHidden
      >
        {editingDesignation && (
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="designation-label-en"
                className="text-[12px] font-semibold text-gray-700"
              >
                {t('designations.labelEn')} <span className="text-red-700">*</span>
              </label>
              <Input
                id="designation-label-en"
                value={editingDesignation.draft.labels.en}
                onChange={(e) =>
                  setEditingDesignation({
                    ...editingDesignation,
                    draft: {
                      ...editingDesignation.draft,
                      canonical: e.target.value,
                      labels: { ...editingDesignation.draft.labels, en: e.target.value },
                    },
                  })
                }
                maxLength={64}
                autoFocus
              />
            </div>
            {editingDesignation.original.isPreset ? (
              <>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="designation-label-gu-en"
                    className="text-[12px] font-semibold text-gray-700"
                  >
                    {t('designations.labelGuEn')}
                  </label>
                  <Input
                    id="designation-label-gu-en"
                    value={editingDesignation.draft.labels['gu-en'] ?? ''}
                    onChange={(e) =>
                      setEditingDesignation({
                        ...editingDesignation,
                        draft: {
                          ...editingDesignation.draft,
                          labels: {
                            ...editingDesignation.draft.labels,
                            'gu-en': e.target.value,
                          },
                        },
                      })
                    }
                    maxLength={64}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="designation-label-hi-en"
                    className="text-[12px] font-semibold text-gray-700"
                  >
                    {t('designations.labelHiEn')}
                  </label>
                  <Input
                    id="designation-label-hi-en"
                    value={editingDesignation.draft.labels['hi-en'] ?? ''}
                    onChange={(e) =>
                      setEditingDesignation({
                        ...editingDesignation,
                        draft: {
                          ...editingDesignation.draft,
                          labels: {
                            ...editingDesignation.draft.labels,
                            'hi-en': e.target.value,
                          },
                        },
                      })
                    }
                    maxLength={64}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="designation-label-gu"
                    className="text-[12px] font-semibold text-gray-700"
                  >
                    {t('designations.labelGu')}
                  </label>
                  <Input
                    id="designation-label-gu"
                    value={editingDesignation.draft.labels.gu ?? ''}
                    onChange={(e) =>
                      setEditingDesignation({
                        ...editingDesignation,
                        draft: {
                          ...editingDesignation.draft,
                          labels: {
                            ...editingDesignation.draft.labels,
                            gu: e.target.value,
                          },
                        },
                      })
                    }
                    maxLength={64}
                  />
                </div>
                <p className="m-0 text-[12px] text-muted">{t('designations.localeFallbackHint')}</p>
              </>
            ) : (
              <p className="m-0 text-[12px] text-muted">{t('designations.customNoTranslate')}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setEditingDesignation(null)}>
                {t('designations.cancelAction')}
              </Button>
              <Button
                type="primary"
                loading={savingDesig}
                onClick={() => void handleSaveDesignationEdit()}
                disabled={!editingDesignation.draft.labels.en.trim()}
              >
                {t('designations.saveAction')}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Rename Cascade Warning Modal */}
      <Modal
        open={!!renameCascade}
        onCancel={() => setRenameCascade(null)}
        title={t('designations.renameCascadeTitle')}
        footer={null}
        width={460}
        destroyOnHidden
      >
        {renameCascade && (
          <>
            <p className="mb-4 text-[14px] text-gray-700">
              {t('designations.renameCascadeBody', {
                old: renameCascade.original.canonical,
                new: renameCascade.draft.canonical,
                count: renameCascade.inUseCount,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setRenameCascade(null)}>
                {t('designations.cancelAction')}
              </Button>
              <Button
                type="primary"
                loading={savingDesig}
                onClick={() =>
                  void commitDesignationEdit(renameCascade.original, renameCascade.draft)
                }
              >
                {t('designations.renameCascadeConfirm')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingDesignation}
        onCancel={() => setDeletingDesignation(null)}
        title={t('designations.deleteConfirmTitle')}
        footer={null}
        width={420}
      >
        {deletingDesignation && (
          <>
            <p className="mb-4 text-[14px] text-gray-700">
              {t('designations.deleteConfirmBody', {
                canonical: renderDesignationLabel(deletingDesignation),
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDeletingDesignation(null)}>
                {t('designations.cancelAction')}
              </Button>
              <Button
                danger
                type="primary"
                loading={savingDesig}
                onClick={() => void removeDesignation(deletingDesignation.canonical)}
              >
                {t('designations.deleteConfirmAction')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete Blocked Modal - designation still referenced by team members */}
      <Modal
        open={!!deleteBlocked}
        onCancel={() => setDeleteBlocked(null)}
        title={
          <span className="flex items-center gap-2">
            <WarningOutlined style={{ color: 'var(--cr-warning-500, #f59e0b)' }} />
            {t('designations.deleteBlockedTitle')}
          </span>
        }
        footer={null}
        width={460}
      >
        {deleteBlocked && (
          <>
            <p className="mb-4 text-[14px] text-gray-700">
              {t('designations.deleteBlockedBody', {
                canonical: deleteBlocked.canonical,
                count: deleteBlocked.inUseCount,
              })}
            </p>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setDeleteBlocked(null)}>
                {t('designations.cancelAction')}
              </Button>
              <Button
                type="primary"
                onClick={() => {
                  router.push(
                    `/dashboard/team?designation=${encodeURIComponent(deleteBlocked.canonical)}`,
                  );
                  setDeleteBlocked(null);
                }}
              >
                {t('designations.deleteBlockedJump')}
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Manage Payment Accounts Modal */}
      <Modal
        open={bankAccountModalOpen}
        onCancel={() => {
          setBankAccountModalOpen(false);
          setEditingBankAccount(null);
          setNewBankLabel('');
        }}
        title={<span className="font-display">{t('bankAccounts.modalTitle')}</span>}
        footer={null}
        width={500}
      >
        <div className="space-y-4">
          <p className="text-[13px] text-muted">{t('bankAccounts.modalDescription')}</p>

          {/* Add new account */}
          <div className="flex gap-2">
            <Input
              placeholder={t('bankAccounts.addPlaceholder')}
              value={newBankLabel}
              onChange={(e) => setNewBankLabel(e.target.value)}
              onPressEnter={() => addBankAccount()}
              maxLength={60}
              className="flex-1"
            />
            <Button
              type="primary"
              icon={<PlusOutlined />}
              loading={savingBankAccounts}
              onClick={() => addBankAccount()}
            >
              Add
            </Button>
          </div>
          {newBankLabel.trim() &&
            bankAccounts.some(
              (a) => a.label.toLowerCase() === newBankLabel.trim().toLowerCase(),
            ) && <p className="m-0 text-[12px] text-red-700">{t('bankAccounts.duplicate')}</p>}

          {/* Account list */}
          <div className="max-h-[300px] overflow-y-auto rounded-lg border border-gray-200">
            {bankAccounts.length === 0 ? (
              <div className="p-6 text-center">
                <BankOutlined className="mb-2 text-2xl text-faint" />
                <p className="m-0 text-[13px] text-muted">{t('bankAccounts.emptyList')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {bankAccounts.map((a, index) => (
                  <div key={a.id} className="flex items-center gap-2 px-4 py-3 hover:bg-gray-50">
                    {editingBankAccount?.index === index ? (
                      <>
                        <Input
                          value={editingBankAccount.label}
                          onChange={(e) =>
                            setEditingBankAccount({
                              ...editingBankAccount,
                              label: e.target.value,
                            })
                          }
                          onPressEnter={() =>
                            updateBankAccount(editingBankAccount.index, editingBankAccount.label)
                          }
                          autoFocus
                          className="flex-1"
                        />
                        <Button
                          size="small"
                          type="primary"
                          loading={savingBankAccounts}
                          onClick={() =>
                            updateBankAccount(editingBankAccount.index, editingBankAccount.label)
                          }
                        >
                          Save
                        </Button>
                        <Button size="small" onClick={() => setEditingBankAccount(null)}>
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-[14px] font-medium text-gray-700">
                          {a.label}
                        </span>
                        <Button
                          size="small"
                          type="text"
                          icon={<EditOutlined />}
                          onClick={() => setEditingBankAccount({ index, label: a.label })}
                        >
                          Edit
                        </Button>
                        <Popconfirm
                          title={t('bankAccounts.deleteConfirmTitle')}
                          description={t('bankAccounts.deleteConfirmDescription', {
                            label: a.label,
                          })}
                          okText={t('bankAccounts.deleteBtn')}
                          okButtonProps={{ danger: true }}
                          onConfirm={() => removeBankAccount(index)}
                        >
                          <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                            Delete
                          </Button>
                        </Popconfirm>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
