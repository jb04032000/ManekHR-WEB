'use client';
/* eslint-disable react-hooks/exhaustive-deps -- Pre-existing lazy-loader effect pattern (loadLedger / loadGratuityStatus / loadDocuments / load all setState within useEffect) and intentional manual deps lists for tab-change + member-id resets; documented Phase 5 W3 carry-forward for separate refactor approval. */
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Alert, App, ConfigProvider, Form, Result, Skeleton } from 'antd';
import {
  UserOutlined,
  BankOutlined,
  CalendarOutlined,
  HistoryOutlined,
  RiseOutlined,
  FileOutlined,
  WalletOutlined,
  ExclamationCircleOutlined,
  AppstoreOutlined,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- PAUSED 2026-05-14: Karigar rail item commented out; keep import for revive.
  ToolOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';

import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import {
  getTeamMember,
  updateTeamMember,
  listShifts,
  listRoles,
  listTeam,
  listLocations,
  getSalaryLedger,
  getGratuityLedger,
  listMemberDocuments,
  deleteMemberDocument,
  createMemberDocument,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { uploadService } from '@/lib/services/upload.service';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { PieceRateConfigTab } from '@/components/team/PieceRateConfigTab';
import type { Machine } from '@/types';
import type {
  TeamMember,
  Shift,
  Role,
  Location,
  LedgerRecord,
  GratuityLedger as GratuityLedgerRecord,
  TeamMemberDocument,
  TeamMemberDocumentType,
  PendingDocument,
  EmployeeComponentOverride,
  UpdateTeamMemberPayload,
} from '@/types';

import MemberProfileShell from '@/components/dashboard/team/MemberProfileShell';
import MemberProfileHeader from '@/components/dashboard/team/MemberProfileHeader';
import AppAccessSection from '@/components/dashboard/team/AppAccessSection';
import MemberProfileRail, {
  type MemberProfileRailItem,
} from '@/components/dashboard/team/MemberProfileRail';
import PersonalTab from '@/components/dashboard/team/form/PersonalTab';
import { useUniqueIdentifierValidator } from '@/components/dashboard/team/form/useUniqueIdentifierValidator';
import WorkTab from '@/components/dashboard/team/form/WorkTab';
import { MemberActivityPanel } from '@/components/activity/MemberActivityPanel';
import BankTab from '@/components/dashboard/team/form/BankTab';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- PAUSED 2026-05-14: Karigar feature paused on web. Revive by uncommenting this import + matching blocks in this file, memberFormPayload.ts, and reports page. Mobile + BE still live.
import KarigarTab from '@/components/dashboard/team/form/KarigarTab';
import DocumentsTab from '@/components/dashboard/team/form/DocumentsTab';
import AttendanceTab from '@/components/dashboard/team/form/AttendanceTab';
import SalaryTab from '@/components/dashboard/team/form/SalaryTab';
import EmployeeOverviewTab from '@/components/dashboard/team/overview/EmployeeOverviewTab';
import CreateShiftDrawer from '@/components/dashboard/team/form/CreateShiftDrawer';
import CreateDesignationModal from '@/components/dashboard/team/form/CreateDesignationModal';
import { DocumentUploadModal } from '@/components/dashboard/team/DocumentUploadModal';
import { DocumentPreviewModal } from '@/components/dashboard/team/DocumentPreviewModal';
// P1.8-revert (2026-05-14) - grant flow is now inline inside
// AppAccessSection on the rail. No modal/drawer trigger on this page.
import { DEFAULT_STATUTORY_FORM_VALUES } from '@/components/dashboard/team/form/memberFormDefaults';
import { buildMemberPayload } from '@/components/dashboard/team/form/memberFormPayload';

/**
 * §7 Part B - payload keys a self-edit-blocked member may still send for
 * their OWN record (personal / contact fields only). Mirrors the backend
 * `SELF_EDITABLE_PROFILE_FIELDS` allowlist. The save path trims the
 * payload to these keys for a blocked self-editor so the always-sent
 * (unchanged) compensation / bank values don't trip the BE SoD guard.
 */
const SELF_EDITABLE_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'name',
  'mobile',
  'email',
  'avatar',
  'gender',
  'dateOfBirth',
  'bloodGroup',
  'address',
  'emergencyContactName',
  'emergencyContactNumber',
  'maritalStatus',
]);

type TabKey =
  | 'overview'
  | 'personal'
  | 'work'
  | 'bank'
  | 'documents'
  | 'salary'
  | 'attendance'
  // PAUSED 2026-05-14: 'karigar' kept in union so revive is a single uncomment; not reachable from VALID_TABS below.
  | 'karigar'
  | 'piece-rate'
  | 'app-access'
  | 'activity';
const VALID_TABS: TabKey[] = [
  'overview',
  'personal',
  'work',
  'bank',
  'documents',
  'salary',
  'attendance',
  // PAUSED 2026-05-14: Karigar feature paused on web. Revive by restoring 'karigar' below.
  // 'karigar',
  'piece-rate',
  'app-access',
  'activity',
];

// Maps a form field to the tab that renders it, so a validation error can send
// the user straight to the offending section. Personal and Bank fields are
// listed explicitly; every other validatable field lives on the Work tab.
const PERSONAL_TAB_FIELDS = new Set<string>([
  'name',
  'mobile',
  'email',
  'gender',
  'dateOfBirth',
  'bloodGroup',
  'address',
  'emergencyContactName',
  'emergencyContactNumber',
  'employeeCode',
  'maritalStatus',
  'avatar',
]);
const BANK_TAB_FIELDS = new Set<string>([
  'bankName',
  'accountHolderName',
  'isSameAsEmployeeName',
  'accountNumber',
  'confirmAccountNumber',
  'ifscCode',
  'upiId',
  'qrCodeUrl',
  'passbookImageUrl',
  'preferredMethod',
]);
function tabForFieldName(name: (string | number)[]): TabKey {
  const key = String(name[0]);
  if (PERSONAL_TAB_FIELDS.has(key)) return 'personal';
  if (BANK_TAB_FIELDS.has(key)) return 'bank';
  return 'work';
}
const TAB_LABEL_KEY: Partial<Record<TabKey, string>> = {
  personal: 'team.railPersonalLabel',
  work: 'team.railWorkLabel',
  bank: 'team.railBankLabel',
};

function hydrateForm(form: ReturnType<typeof Form.useForm>[0], member: TeamMember) {
  form.setFieldsValue({
    avatar: member.avatar,
    name: member.name,
    mobile: member.mobile,
    email: member.email,
    gender: member.gender,
    dateOfBirth: member.dateOfBirth ? dayjs(member.dateOfBirth) : undefined,
    bloodGroup: member.bloodGroup,
    address: member.address,
    emergencyContactName: member.emergencyContactName,
    emergencyContactNumber: member.emergencyContactNumber,
    designation: member.designation,
    // Location: hydrate both the master-list reference and its denormalised name.
    locationId: member.locationId,
    location: member.location,
    dateOfJoining: member.dateOfJoining ? dayjs(member.dateOfJoining) : undefined,
    salaryType: member.salaryType,
    salaryAmount: member.salaryAmount,
    salaryDayBasis: member.salaryDayBasis ?? 'fixed_month_days',
    fixedMonthDays: member.fixedMonthDays ?? undefined,
    attendancePayMode: member.attendancePayMode ?? 'default',
    dailyHours: member.dailyHours,
    finalMonthlyOverride: member.finalMonthlyOverride,
    pan: member.pan,
    uan: member.uan,
    taxRegime: member.taxRegime ?? DEFAULT_STATUTORY_FORM_VALUES.taxRegime,
    stateOfEmployment: member.stateOfEmployment,
    employmentType: member.employmentType ?? DEFAULT_STATUTORY_FORM_VALUES.employmentType,
    pfApplicable: member.pfApplicable ?? DEFAULT_STATUTORY_FORM_VALUES.pfApplicable,
    pfOptedOut: member.pfOptedOut ?? DEFAULT_STATUTORY_FORM_VALUES.pfOptedOut,
    esiApplicable: member.esiApplicable ?? DEFAULT_STATUTORY_FORM_VALUES.esiApplicable,
    esiIpNumber: member.esiIpNumber,
    maritalStatus: member.maritalStatus,
    isNonItrFiler: member.isNonItrFiler ?? DEFAULT_STATUTORY_FORM_VALUES.isNonItrFiler,
    scheduleType: member.scheduleType ?? 'shift',
    shiftId: member.shift?.id,
    customScheduleStart: member.customSchedule?.startTime
      ? dayjs(member.customSchedule.startTime, 'HH:mm')
      : undefined,
    customScheduleEnd: member.customSchedule?.endTime
      ? dayjs(member.customSchedule.endTime, 'HH:mm')
      : undefined,
    weeklyOff: member.weeklyOff ?? [],
    rbacRoleId: member.rbacRole?.id,
    isActive: member.isActive,
    bankName: member.bankDetails?.bankName,
    isSameAsEmployeeName: member.bankDetails?.accountHolderName === member.name,
    accountHolderName: member.bankDetails?.accountHolderName,
    accountNumber: member.bankDetails?.accountNumber,
    confirmAccountNumber: member.bankDetails?.accountNumber,
    ifscCode: member.bankDetails?.ifscCode,
    passbookImageUrl: member.bankDetails?.passbookImageUrl,
    upiId: member.upiDetails?.upiId,
    qrCodeUrl: member.upiDetails?.qrCodeUrl,
    preferredMethod: member.preferredMethod,
    ctcAmount: member.ctcAmount,
    componentTemplateId: member.componentTemplateId ?? undefined,
    reportsTo: member.reportsTo ?? null,
    // Phase 1 compliance - per-member minimum wage override.
    // Seed undefined (not null) so InputNumber renders as empty placeholder.
    minimumWageMonthlyOverride:
      member.minimumWageMonthlyOverride !== null && member.minimumWageMonthlyOverride !== undefined
        ? member.minimumWageMonthlyOverride
        : undefined,
    /* PAUSED 2026-05-14 - Karigar feature paused on web. Revive by uncommenting
       this hydration block + matching blocks in TabKey/VALID_TABS, rail items,
       tab panel render, memberFormPayload.ts, and reports page. Mobile + BE
       still live. */
    // isKarigar: !!member.isKarigar,
    // karigarSkillType: member.karigarSkillType,
    // karigarDailyRateRupees:
    //   typeof member.karigarDailyRatePaise === 'number'
    //     ? member.karigarDailyRatePaise / 100
    //     : undefined,
  });
}

export default function MemberProfilePage() {
  const params = useParams<{ memberId: string }>();
  const memberId = params?.memberId;
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();

  // §7 Part B - scope-aware gating. This route is shared by managers
  // (full edit) and self-scoped members (own profile, mostly read-only);
  // the BE enforces the contract, the UI mirrors it so there are no dead
  // controls and no surfaces a self-scoped member must not see.
  //
  // Phase 1c: Team grants live on the path model - flat `can('team', ...)`
  // no longer reflects matrix overrides granted via `permissionPathOverrides`.
  // Every gate below uses `canPath` against the registry path that the BE
  // actually enforces (kept in lockstep with `team-field-groups.ts` +
  // `team.service.assertProfileUpdateAllowed`).
  // `canPath` for Team (fully path-migrated in Phase 1c); `can` is still
  // needed for Salary surfaces - that module hasn't been path-migrated yet
  // and the canonical grant lives on flat `permissions[]`.
  const { can, canPath, data: myPerms } = useMyPermissions();
  const isOwner = !!myPerms?.isOwner;
  const isOwnRecord = !!myPerms?.teamMemberId && myPerms.teamMemberId === memberId;
  // Edit-mode is unlockable if the caller can edit ANY profile field group;
  // per-field gating then narrows what's actually writable. Covers every
  // group enumerated in `permission-registry.ts` (`personal` / `job` /
  // `pay` / `bank` / `statutory` / `org` / `documents`) so a member whose
  // only grant is e.g. `documents.edit` still enters edit mode for that
  // section.
  const canEditProfile =
    isOwner ||
    canPath('team.profile.personal.edit') ||
    canPath('team.profile.job.edit') ||
    canPath('team.profile.pay.edit') ||
    canPath('team.profile.bank.edit') ||
    canPath('team.profile.statutory.edit') ||
    canPath('team.profile.org.edit') ||
    canPath('team.profile.documents.edit');
  // App-access management (invite / role / overrides) is an org-wide
  // manager action; never available on one's own record to a non-owner
  // (the BE blocks self-role / self-override edits - self-escalation).
  const canManageAccess = canPath('team.appAccess.manage', 'all') && !(isOwnRecord && !isOwner);
  // Salary surfaces (ledger + payslips) follow the salary-module grant.
  const canViewSalary = isOwner || can('salary', 'view');
  // Attendance section: self sees own (record.view), manager sees others (analytics.view).
  // The data call self-filters server-side regardless; this only controls tab visibility.
  const canViewAttendance =
    isOwner ||
    (isOwnRecord ? canPath('attendance.record.view') : canPath('attendance.analytics.view'));
  // SoD: a non-owner whose role blocks self-profile-edit may edit only
  // personal fields on their OWN record - comp / role / bank stay locked.
  const selfEditBlocked = isOwnRecord && !isOwner && myPerms?.role?.selfProfileEdit === 'block';

  // §7 Part B (read side) - mirror the BE read-filter
  // (`crewroster-backend/src/modules/team/team-read-filter.ts`): a sensitive
  // field-group's DISPLAY is gated by its `*.view` grant at the caller's scope
  // (self on own record, all on others). The BE strips the group's fields from
  // the response when this is false, so the FE must not render an empty tab for
  // data it never received. Owner sees all.
  const profileViewScope: 'self' | 'all' = isOwnRecord ? 'self' : 'all';
  const canViewGroup = (group: string): boolean =>
    isOwner || canPath(`team.profile.${group}.view`, profileViewScope);
  // (Personal-detail view is gated inside PersonalTab itself, which self-
  // computes from useMyPermissions - the tab stays visible for identity.)
  // The Work tab spans job + pay + statutory groups; show if ANY is viewable
  // (per-section gating inside WorkTab narrows what actually renders).
  const canViewWorkGroup = canViewGroup('job') || canViewGroup('pay') || canViewGroup('statutory');
  const canViewBankGroup = canViewGroup('bank');
  const canViewDocumentsGroup = canViewGroup('documents');

  const { message: msgApi, modal } = App.useApp();
  const [form] = Form.useForm();

  // Core data
  const [member, setMember] = useState<TeamMember | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit state
  const [editMode, setEditMode] = useState(() => searchParams?.get('edit') === '1');
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [componentOverrides, setComponentOverrides] = useState<EmployeeComponentOverride[]>([]);
  const [editingOverride, setEditingOverride] = useState<string | null>(null);

  // Wraps the raw componentOverrides setter so user-driven changes from
  // WorkTab mark the form dirty. Programmatic resets (load/save/cancel)
  // use the raw setter directly so they don't trip the dirty flag.
  const trackedSetComponentOverrides = useCallback<
    React.Dispatch<React.SetStateAction<EmployeeComponentOverride[]>>
  >((updater) => {
    setComponentOverrides(updater);
    setIsDirty(true);
  }, []);

  // All members - for "Reports To" dropdown in WorkTab
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);

  // Local shifts / designations (extended by create-* modals)
  const [localShifts, setLocalShifts] = useState<Shift[]>([]);
  // Workspace Locations master list (shared with Machines) → WorkTab radio.
  const [localLocations, setLocalLocations] = useState<Location[]>([]);
  // F2: workspace.designations is a union (string | DesignationRecord)[] for
  // back-compat. The detail-page dropdown needs canonical strings - flatten here.
  const [localDesignations, setLocalDesignations] = useState<string[]>(
    (currentWorkspace?.designations ?? []).map((d) => (typeof d === 'string' ? d : d.canonical)),
  );
  useEffect(() => {
    setLocalDesignations(
      (currentWorkspace?.designations ?? []).map((d) => (typeof d === 'string' ? d : d.canonical)),
    );
  }, [currentWorkspace?.designations]);

  const [createShiftOpen, setCreateShiftOpen] = useState(false);
  const [createDesignationOpen, setCreateDesignationOpen] = useState(false);

  // Salary ledger + gratuity
  const [ledger, setLedger] = useState<LedgerRecord | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [gratuityLedger, setGratuityLedger] = useState<GratuityLedgerRecord | null>(null);
  const [gratuityLoading, setGratuityLoading] = useState(false);
  const [gratuityLoaded, setGratuityLoaded] = useState(false);

  // Documents
  const [memberDocuments, setMemberDocuments] = useState<TeamMemberDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [pendingDocs] = useState<PendingDocument[]>([]);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadModalType, setUploadModalType] = useState<TeamMemberDocumentType | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewSource, setPreviewSource] = useState<{
    fileUrl: string;
    fileName?: string;
    mimeType?: string;
    type: TeamMemberDocumentType;
    label?: string;
  } | null>(null);

  const salaryFeatures = useSalaryFeatures();
  const canViewGratuityTracking = salaryFeatures.gratuityTracking.enabled;
  const payrollChipsEnabled = salaryFeatures.statutoryCompliance.enabled;

  // ── Piece-rate sub-feature gate + machines list (Phase 23) ──────────────────
  const t = useTranslations();
  const pieceRateAccess = useFeatureAccess('machines', 'piece_rate_payroll');
  const pieceRatePayrollEnabled = pieceRateAccess.hasAccess;
  const showPieceRateTab =
    pieceRatePayrollEnabled && (member?.salaryType === 'piece_rate' || editMode);
  const [machinesList, setMachinesList] = useState<Machine[]>([]);
  const [machinesLoaded, setMachinesLoaded] = useState(false);

  // ── Tab state (URL-synced) ─────────────────────────────────────────────────
  const urlTabRaw = searchParams?.get('tab') ?? null;
  const urlSection = searchParams?.get('section');
  // Back-compat: legacy ?tab=payslips / ?tab=ledger now live under the merged Salary tab.
  const resolvedTab =
    urlTabRaw === 'payslips' || urlTabRaw === 'ledger' ? 'salary' : (urlTabRaw as TabKey | null);
  const initialTab: TabKey =
    resolvedTab && VALID_TABS.includes(resolvedTab) ? resolvedTab : 'overview';
  const salaryInitialSection: 'summary' | 'history' | 'payslips' =
    urlTabRaw === 'payslips' || urlSection === 'payslips'
      ? 'payslips'
      : urlTabRaw === 'ledger' || urlSection === 'history'
        ? 'history'
        : 'summary';
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const { validateMobile, validateEmail } = useUniqueIdentifierValidator({
    workspaceId: currentWorkspaceId ?? null,
    excludeId: member?.id,
  });

  useEffect(() => {
    const current = searchParams?.get('tab');
    if (current === activeTab) return;
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (activeTab === 'overview') sp.delete('tab');
    else sp.set('tab', activeTab);
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : '?', { scroll: false });
  }, [activeTab]);

  // ── Tab switch ────────────────────────────────────────────────────────────
  // Safe to switch freely: Form is hoisted to page level and all tabs stay
  // mounted (display:none), so tab changes do NOT discard any field values.
  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
  };

  // ── Hydrate form synchronously after member data commits (before paint) ───
  useLayoutEffect(() => {
    if (member) {
      hydrateForm(form, member);
      setIsDirty(false);
    }
  }, [member]);

  // ── Stale-shiftId cleanup ─────────────────────────────────────────────────
  // If the member references a shift that no longer exists in the current
  // workspace's shifts list (deleted, or stale cross-workspace ref left over
  // because the BE doesn't null member refs on shift delete), drop the value
  // from the form so the dropdown stays clean instead of resolving to a
  // ghost label. The user can re-pick if they meant to keep one.
  useEffect(() => {
    if (loading || !member) return;
    const fid = form.getFieldValue('shiftId');
    if (!fid) return;
    const inList = localShifts.some((s) => {
      const raw = (s as unknown as { id?: unknown }).id ?? (s as unknown as { _id?: unknown })._id;
      return raw != null && String(raw) === String(fid);
    });
    if (!inList) form.setFieldValue('shiftId', undefined);
  }, [loading, member, localShifts, form]);

  // ── Browser-level guard when leaving page with unsaved edits ──────────────
  useEffect(() => {
    if (!editMode || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [editMode, isDirty]);

  // ── In-app navigation guard (sidebar, top header, breadcrumbs, back btn) ──
  // Intercepts anchor clicks + browser back/forward while dirty. Reuses the
  // same Modal.confirm UX as handleCancel/handleBack so the prompt is
  // consistent across every exit surface.
  useEffect(() => {
    if (!editMode || !isDirty) return;

    const confirmLeave = (onConfirm: () => void) => {
      modal.confirm({
        title: t('team.detailLeaveTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('team.detailLeaveContent'),
        okText: t('team.detailLeavePage'),
        okButtonProps: { danger: true },
        cancelText: t('team.detailStay'),
        onOk: onConfirm,
      });
    };

    const onAnchorClick = (e: MouseEvent) => {
      // Respect modifier keys + middle-click (new tab / new window)
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      // External links: let them through (beforeunload handler still fires)
      let dest: URL;
      try {
        dest = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (dest.origin !== window.location.origin) return;

      // Same-page navigation (already here, no risk)
      if (dest.pathname === window.location.pathname && dest.search === window.location.search)
        return;

      e.preventDefault();
      e.stopPropagation();
      confirmLeave(() => router.push(dest.pathname + dest.search + dest.hash));
    };

    // popstate: back/forward button. Push a sentinel entry so the first
    // back-press triggers our handler instead of navigating away silently.
    const sentinel = { __unsavedGuard: true };
    window.history.pushState(sentinel, '', window.location.href);
    const onPopState = () => {
      // Re-push so we stay put while showing the confirm
      window.history.pushState(sentinel, '', window.location.href);
      confirmLeave(() => {
        // Pop our sentinel AND the user's intended previous entry
        window.history.go(-2);
      });
    };

    // Keyboard-shortcut nav (g>h, g>d, g>t, etc.) bypasses anchor-click +
    // popstate. KeyboardShortcutProvider dispatches a cancellable
    // 'cr:beforenav' event before router.push; intercept it here and route
    // through the same confirm-leave UX as anchor clicks.
    const onShortcutNav = (e: Event) => {
      const ce = e as CustomEvent<{ href: string }>;
      if (!ce.detail?.href) return;
      e.preventDefault();
      const target = ce.detail.href;
      confirmLeave(() => router.push(target));
    };

    document.addEventListener('click', onAnchorClick, true);
    window.addEventListener('popstate', onPopState);
    window.addEventListener('cr:beforenav', onShortcutNav);
    return () => {
      document.removeEventListener('click', onAnchorClick, true);
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener('cr:beforenav', onShortcutNav);
    };
  }, [editMode, isDirty, router, modal]);

  // ── Cross-tab form watchers ────────────────────────────────────────────────
  const watchedName = Form.useWatch('name', form);
  const isSameAsEmployeeName = Form.useWatch('isSameAsEmployeeName', form);
  const pfApplicable = Form.useWatch('pfApplicable', form);
  const salaryAmount = Form.useWatch('salaryAmount', form);
  const esiApplicable = Form.useWatch('esiApplicable', form);

  useEffect(() => {
    if (isSameAsEmployeeName) {
      form.setFieldValue('accountHolderName', watchedName || '');
    }
  }, [isSameAsEmployeeName, watchedName, form]);

  useEffect(() => {
    const isPfOptOutAllowed = pfApplicable === true && Number(salaryAmount ?? 0) > 15000;
    if (!isPfOptOutAllowed && form.getFieldValue('pfOptedOut')) {
      form.setFieldValue('pfOptedOut', false);
    }
  }, [pfApplicable, salaryAmount, form]);

  useEffect(() => {
    if (!esiApplicable && form.getFieldValue('esiIpNumber')) {
      form.setFieldValue('esiIpNumber', undefined);
    }
  }, [esiApplicable, form]);

  // ── Reset state when navigating between members (same route pattern) ──────
  // Next.js App Router reuses this component across /team/:id changes; without
  // this reset, stale member data flashes before the new fetch resolves.
  useEffect(() => {
    setMember(null);
    setLoadError(null);
    setComponentOverrides([]);
    setEditingOverride(null);
    setIsDirty(false);
    setLedger(null);
    setLedgerLoaded(false);
    setLedgerLoading(false);
    setGratuityLedger(null);
    setGratuityLoaded(false);
    setGratuityLoading(false);
    setMemberDocuments([]);
    setDocumentsLoaded(false);
    setDocumentsLoading(false);
    form.resetFields();
  }, [memberId]);

  // ── Initial load ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentWorkspaceId || !memberId) return;
    setLoading(true);
    setLoadError(null);
    try {
      // §7 Part B - only the member fetch is a hard dependency. Shifts /
      // roles / the team list are manager-context aids; a self-scoped
      // member legitimately lacks `roles.view` etc., so a rejection there
      // must degrade gracefully - never 404 the member's own profile.
      const [mRes, sRes, rRes, tRes, lRes] = await Promise.allSettled([
        getTeamMember(currentWorkspaceId, memberId),
        listShifts(currentWorkspaceId),
        listRoles(currentWorkspaceId),
        listTeam(currentWorkspaceId, { limit: 500 }),
        listLocations(currentWorkspaceId),
      ]);
      if (mRes.status === 'rejected') {
        setLoadError(parseApiError(mRes.reason) ?? t('team.detailFailedLoad'));
        return;
      }
      setMember(mRes.value);
      setComponentOverrides(mRes.value.componentOverrides ?? []);
      setLocalShifts(sRes.status === 'fulfilled' ? (sRes.value ?? []) : []);
      setRoles(rRes.status === 'fulfilled' ? (rRes.value ?? []) : []);
      setLocalLocations(lRes.status === 'fulfilled' ? (lRes.value ?? []) : []);
      const fetchedTeam = tRes.status === 'fulfilled' ? tRes.value : [];
      const teamArr = Array.isArray(fetchedTeam)
        ? fetchedTeam
        : ((fetchedTeam as { members?: TeamMember[] }).members ?? []);
      setAllMembers(teamArr);
    } catch (e) {
      setLoadError(parseApiError(e) ?? t('team.detailFailedLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  // ── Lazy loaders ───────────────────────────────────────────────────────────
  const loadLedger = useCallback(async () => {
    if (!currentWorkspaceId || !memberId) return;
    setLedgerLoading(true);
    try {
      const res = await getSalaryLedger(currentWorkspaceId, memberId);
      setLedger(res);
    } catch {
      setLedger(null);
    } finally {
      setLedgerLoading(false);
      setLedgerLoaded(true);
    }
  }, [currentWorkspaceId, memberId]);

  const loadGratuityStatus = useCallback(async () => {
    if (!canViewGratuityTracking || !currentWorkspaceId || !memberId) return;
    setGratuityLoading(true);
    try {
      const res = await getGratuityLedger(currentWorkspaceId, memberId);
      setGratuityLedger(res);
    } catch {
      setGratuityLedger(null);
    } finally {
      setGratuityLoading(false);
      setGratuityLoaded(true);
    }
  }, [canViewGratuityTracking, currentWorkspaceId, memberId]);

  const loadDocuments = useCallback(async () => {
    if (!currentWorkspaceId || !memberId) return;
    setDocumentsLoading(true);
    try {
      const docs = await listMemberDocuments(currentWorkspaceId, memberId);
      setMemberDocuments(docs ?? []);
    } catch (e) {
      msgApi.error(parseApiError(e) ?? t('team.detailDocsFailedLoad'));
    } finally {
      setDocumentsLoading(false);
      // Mark loaded even on error so the lazy-load guard doesn't keep
      // re-firing this request on every render. Mirrors loadGratuityStatus.
      setDocumentsLoaded(true);
    }
  }, [currentWorkspaceId, memberId, msgApi, t]);

  useEffect(() => {
    if (
      (activeTab !== 'salary' && activeTab !== 'overview') ||
      !canViewSalary ||
      ledgerLoaded ||
      ledgerLoading
    )
      return;
    void loadLedger();
  }, [activeTab, canViewSalary, ledgerLoaded, ledgerLoading, loadLedger]);

  useEffect(() => {
    if (activeTab !== 'salary' || !canViewGratuityTracking || gratuityLoaded || gratuityLoading)
      return;
    void loadGratuityStatus();
  }, [activeTab, canViewGratuityTracking, gratuityLoaded, gratuityLoading, loadGratuityStatus]);

  useEffect(() => {
    if (activeTab !== 'documents' || documentsLoaded || documentsLoading) return;
    void loadDocuments();
  }, [activeTab, documentsLoaded, documentsLoading, loadDocuments]);

  // Machines module removed (2026-07-04) — machinesList stays empty; the
  // piece-rate per-machine override picker (Phase 23) has no data source.
  useEffect(() => {
    if (activeTab !== 'piece-rate' || machinesLoaded) return;
    setMachinesList([]);
    setMachinesLoaded(true);
  }, [activeTab, machinesLoaded]);

  // ── Document handlers ──────────────────────────────────────────────────────
  const handleOpenUpload = (type: TeamMemberDocumentType) => {
    setUploadModalType(type);
    setUploadModalOpen(true);
  };

  const handleCloseUpload = () => {
    setUploadModalOpen(false);
    setUploadModalType(null);
  };

  const handleConfirmUpload = async (file: File, label?: string) => {
    if (!uploadModalType || !currentWorkspaceId || !memberId) return;
    setUploadingDoc(true);
    setUploadProgress(0);
    try {
      const uploaded = await uploadService.uploadSingle(file, {
        category: 'proofs',
        onProgress: (p) => setUploadProgress(p),
      });
      const doc = await createMemberDocument(currentWorkspaceId, memberId, {
        type: uploadModalType,
        label,
        fileUrl: uploaded.url,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
      setMemberDocuments((prev) => [...prev, doc]);
      msgApi.success(t('team.detailDocUploaded'));
      handleCloseUpload();
    } catch (e) {
      msgApi.error(parseApiError(e) ?? t('team.detailUploadFailed'));
    } finally {
      setUploadingDoc(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteServerDoc = (doc: TeamMemberDocument) => {
    if (!currentWorkspaceId || !memberId) return;
    void (async () => {
      try {
        await deleteMemberDocument(currentWorkspaceId, memberId, doc.id);
        setMemberDocuments((prev) => prev.filter((d) => d.id !== doc.id));
        msgApi.success(t('team.detailDocDeleted'));
      } catch (e) {
        msgApi.error(parseApiError(e) ?? t('team.detailDeleteFailed'));
      }
    })();
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!currentWorkspaceId || !member) return;

    // Validate the form, but ignore errors on fields the user never touched.
    // The form loads the whole record across tabs, so a section the user did
    // not edit (e.g. an optional Bank/payout left empty at registration) must
    // not block saving an edit to another section. Errors on fields the user
    // DID touch still block, and we jump to the offending tab so the message
    // points at the exact section that needs attention.
    let vals: Record<string, unknown>;
    try {
      vals = (await form.validateFields()) as Record<string, unknown>;
    } catch (err) {
      if (!err || typeof err !== 'object' || !('errorFields' in err)) {
        msgApi.error(t('team.detailSaveFailed'));
        return;
      }
      const errorFields = (err as { errorFields: { name: (string | number)[] }[] }).errorFields;
      const blocking = errorFields.filter((f) => form.isFieldTouched(f.name));
      if (blocking.length > 0) {
        const tab = tabForFieldName(blocking[0].name);
        setActiveTab(tab);
        const labelKey = TAB_LABEL_KEY[tab];
        msgApi.error(t('team.detailFillRequiredSection', { section: labelKey ? t(labelKey) : '' }));
        return;
      }
      // Every error is on an untouched field: keep the saved values for those
      // sections and proceed with the user's actual edits.
      vals = form.getFieldsValue(true) as Record<string, unknown>;
    }

    setSaving(true);
    try {
      const oldUrls: string[] = [];

      let avatarUrl = vals.avatar as string | undefined;
      if (vals.avatar instanceof File) {
        const response = await uploadService.uploadSingle(vals.avatar, {
          category: 'avatars',
        });
        avatarUrl = response.url;
        if (member.avatar) oldUrls.push(member.avatar);
      }

      let passbookImageUrl = vals.passbookImageUrl as string | undefined;
      if (vals.passbookImageUrl instanceof File) {
        const response = await uploadService.uploadSingle(vals.passbookImageUrl, {
          category: 'passbooks',
        });
        passbookImageUrl = response.url;
        if (member.bankDetails?.passbookImageUrl) oldUrls.push(member.bankDetails.passbookImageUrl);
      }

      let qrCodeUrl = vals.qrCodeUrl as string | undefined;
      if (vals.qrCodeUrl instanceof File) {
        const response = await uploadService.uploadSingle(vals.qrCodeUrl, {
          category: 'qrcodes',
        });
        qrCodeUrl = response.url;
        if (member.upiDetails?.qrCodeUrl) oldUrls.push(member.upiDetails.qrCodeUrl);
      }

      const fullPayload = buildMemberPayload({
        vals,
        mode: 'edit',
        avatarUrl,
        passbookImageUrl,
        qrCodeUrl,
        componentOverrides,
      }) as UpdateTeamMemberPayload;
      // §7 Part B - a self-edit-blocked member may persist only personal
      // fields on their own record. Trim the always-full payload so the
      // unchanged comp / bank values don't trip the backend SoD guard.
      const payload: UpdateTeamMemberPayload = selfEditBlocked
        ? (Object.fromEntries(
            Object.entries(fullPayload).filter(([k]) => SELF_EDITABLE_PAYLOAD_KEYS.has(k)),
          ) as unknown as UpdateTeamMemberPayload)
        : fullPayload;

      const updated = await updateTeamMember(currentWorkspaceId, member.id, payload);
      for (const url of oldUrls) {
        await uploadService.deleteFile(url);
      }
      setMember(updated);
      hydrateForm(form, updated);
      setComponentOverrides(updated.componentOverrides ?? []);
      setIsDirty(false);
      msgApi.success(t('team.detailMemberUpdated'));
      setEditMode(false);
      // strip ?edit=1 from URL if present
      const sp = new URLSearchParams(searchParams?.toString() ?? '');
      if (sp.has('edit')) {
        sp.delete('edit');
        const qs = sp.toString();
        router.replace(qs ? `?${qs}` : '?', { scroll: false });
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : (parseApiError(e) ?? t('team.detailSaveFailed'));
      if (raw.startsWith('MEMBER_MOBILE_CONFLICT:')) {
        const msg = raw.slice('MEMBER_MOBILE_CONFLICT:'.length);
        form.setFields([{ name: 'mobile', errors: [msg] }]);
        setActiveTab('personal');
        msgApi.error(msg);
      } else if (raw.startsWith('MEMBER_EMAIL_CONFLICT:')) {
        const msg = raw.slice('MEMBER_EMAIL_CONFLICT:'.length);
        form.setFields([{ name: 'email', errors: [msg] }]);
        setActiveTab('personal');
        msgApi.error(msg);
      } else {
        msgApi.error(raw);
      }
    } finally {
      setSaving(false);
    }
  };

  const doCancel = useCallback(() => {
    if (member) hydrateForm(form, member);
    setComponentOverrides(member?.componentOverrides ?? []);
    setIsDirty(false);
    setEditMode(false);
    const sp = new URLSearchParams(searchParams?.toString() ?? '');
    if (sp.has('edit')) {
      sp.delete('edit');
      const qs = sp.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    }
  }, [member, form, searchParams, router]);

  const handleCancel = () => {
    if (!isDirty) {
      doCancel();
      return;
    }
    modal.confirm({
      title: t('team.detailDiscardTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('team.detailDiscardContent'),
      okText: t('team.detailDiscard'),
      okButtonProps: { danger: true },
      cancelText: t('team.detailKeepEditing'),
      onOk: doCancel,
    });
  };

  const handleEnterEdit = () => {
    setIsDirty(false);
    setEditMode(true);
  };

  const handleBack = () => {
    if (editMode && isDirty) {
      modal.confirm({
        title: t('team.detailLeaveTitle'),
        icon: <ExclamationCircleOutlined />,
        content: t('team.detailLeaveContent'),
        okText: t('team.detailLeavePage'),
        okButtonProps: { danger: true },
        cancelText: t('team.detailStay'),
        onOk: () => router.push('/dashboard/team'),
      });
      return;
    }
    router.push('/dashboard/team');
  };

  // ── Rail items ─────────────────────────────────────────────────────────────
  const railItems: MemberProfileRailItem[] = useMemo(
    () =>
      [
        {
          key: 'overview',
          label: t('team.railOverviewLabel'),
          description: t('team.railOverviewDesc'),
          icon: <AppstoreOutlined />,
        },
        {
          key: 'personal',
          label: t('team.railPersonalLabel'),
          description: t('team.railPersonalDesc'),
          icon: <UserOutlined />,
        },
        {
          key: 'work',
          label: t('team.railWorkLabel'),
          description: t('team.railWorkDesc'),
          icon: <RiseOutlined />,
        },
        {
          key: 'bank',
          label: t('team.railBankLabel'),
          description: t('team.railBankDesc'),
          icon: <BankOutlined />,
        },
        {
          key: 'documents',
          label: t('team.railDocsLabel'),
          description: t('team.railDocsDesc'),
          icon: <FileOutlined />,
          badge: memberDocuments.length,
        },
        {
          key: 'attendance',
          label: t('team.railAttendanceLabel'),
          description: t('team.railAttendanceDesc'),
          icon: <CalendarOutlined />,
        },
        {
          key: 'salary',
          label: t('team.railSalaryLabel'),
          description: t('team.railSalaryDesc'),
          icon: <WalletOutlined />,
        },
        /* PAUSED 2026-05-14 - Karigar rail item hidden. Revive by uncommenting. */
        // {
        //   key: 'karigar',
        //   label: t('team.railKarigarLabel'),
        //   description: t('team.railKarigarDesc'),
        //   icon: <ToolOutlined />,
        // },
        ...(showPieceRateTab
          ? [
              {
                key: 'piece-rate',
                label: t('salary.piece_rate.config.tabLabel'),
                description: t('salary.piece_rate.config.title'),
                icon: <RupeeOutlined />,
              } as MemberProfileRailItem,
            ]
          : []),
        {
          key: 'app-access',
          label: t('team.railAppAccessLabel'),
          description: t('team.railAppAccessDesc'),
          icon: <KeyOutlined />,
        },
        {
          key: 'activity',
          label: t('team.railActivityLabel'),
          description: t('team.railActivityDesc'),
          icon: <HistoryOutlined />,
        },
      ].filter((item) => {
        // §7 Part B - drop tabs the viewer cannot use: app-access is a
        // manager-only surface (and never one's own record as a non-owner);
        // payslips + ledger follow the salary-module grant.
        if (item.key === 'app-access') return canManageAccess;
        if (item.key === 'activity') return canManageAccess;
        if (item.key === 'attendance') return canViewAttendance;
        if (item.key === 'salary') return canViewSalary;
        // `personal` tab stays visible: it carries directory IDENTITY
        // (name / mobile / avatar) which `directory.view` already grants. The
        // personal-DETAIL fields inside are gated by `personal.view` within
        // PersonalTab (via canViewPersonalDetail).
        if (item.key === 'work') return canViewWorkGroup;
        if (item.key === 'bank') return canViewBankGroup;
        if (item.key === 'documents') return canViewDocumentsGroup;
        return true;
      }),
    [
      memberDocuments.length,
      showPieceRateTab,
      t,
      canManageAccess,
      canViewAttendance,
      canViewSalary,
      canViewWorkGroup,
      canViewBankGroup,
      canViewDocumentsGroup,
    ],
  );

  // §7 Part B - if the active tab was gated away (e.g. a self-scoped
  // member deep-linked `?tab=app-access`), fall back to Personal.
  useEffect(() => {
    if (!railItems.some((i) => i.key === activeTab)) {
      // `personal` may itself be gated now, so land on the first available tab.
      setActiveTab((railItems[0]?.key ?? 'personal') as TabKey);
    }
  }, [railItems, activeTab]);

  // §7 Part B - never leave a non-editor sitting in edit mode (e.g. via a
  // stale `?edit=1` deep link). Only acts once permissions resolve.
  useEffect(() => {
    if (myPerms && !canEditProfile && editMode) {
      setEditMode(false);
    }
  }, [myPerms, canEditProfile, editMode]);

  // §7 Part B - edit mode for the SoD-sensitive tabs (Work, Bank). A
  // self-edit-blocked member keeps these read-only even while editing
  // their personal fields.
  const sensitiveEditMode = editMode && !selfEditBlocked;

  // ── Early returns ──────────────────────────────────────────────────────────
  if (loading && !member) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton active paragraph={{ rows: 1 }} />
        <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <Skeleton.Node active style={{ width: 260, height: 320 }} />
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      </div>
    );
  }

  if (loadError || !member) {
    return (
      <Result
        status="404"
        title={t('team.detailNotFound')}
        subTitle={loadError ?? t('team.detailNotFoundSubtitle')}
        extra={
          <button type="button" onClick={handleBack} className="text-blue-700 hover:underline">
            {t('team.detailBackToTeam')}
          </button>
        }
      />
    );
  }

  return (
    <>
      <MemberProfileShell
        header={
          <MemberProfileHeader
            member={member}
            editMode={editMode}
            saving={saving}
            isDirty={isDirty}
            canEdit={canEditProfile}
            onEdit={handleEnterEdit}
            onCancel={handleCancel}
            onSave={handleSave}
            onBack={handleBack}
          />
        }
        rail={
          <MemberProfileRail items={railItems} activeKey={activeTab} onChange={handleTabChange} />
        }
        activeKey={activeTab}
      >
        {activeTab === 'overview' && member && currentWorkspaceId && (
          <EmployeeOverviewTab
            wsId={currentWorkspaceId}
            member={member}
            ledger={ledger}
            ledgerLoading={ledgerLoading && !ledgerLoaded}
            canViewAttendance={canViewAttendance}
            canViewSalary={canViewSalary}
            isOwnRecord={isOwnRecord}
            canViewAll={isOwner || canPath('attendance.analytics.view')}
            onOpenTab={(tab) => setActiveTab(tab)}
            reportsToName={
              member.reportsTo
                ? (allMembers.find((m) => m.id === member.reportsTo)?.name ?? undefined)
                : undefined
            }
          />
        )}

        <Form
          form={form}
          layout="vertical"
          requiredMark={false}
          disabled={!editMode}
          onValuesChange={() => {
            if (editMode) setIsDirty(true);
          }}
        >
          <div style={{ display: activeTab === 'personal' ? 'block' : 'none' }}>
            <PersonalTab
              form={form}
              mode={editMode ? 'edit' : 'view'}
              editMode={editMode}
              member={member}
              employeeCodeSettings={null}
              employeeCodePreview=""
              mobileAvailabilityValidator={editMode ? validateMobile : undefined}
              emailAvailabilityValidator={editMode ? validateEmail : undefined}
              workspaceId={currentWorkspaceId ?? ''}
              excludeId={member?.id}
              onMemberChange={setMember}
            />
          </div>

          <div style={{ display: activeTab === 'work' ? 'block' : 'none' }}>
            {selfEditBlocked && (
              <Alert
                type="info"
                showIcon
                className="mb-4"
                title={t('team.selfManagedFieldsTitle')}
                description={t('team.selfManagedFieldsBody')}
              />
            )}
            {/* §7 Part B - ConfigProvider disables every control inside
                regardless of the page-level Form, so a self-edit-blocked
                member sees Work read-only even while editing Personal. */}
            <ConfigProvider componentDisabled={!sensitiveEditMode}>
              <WorkTab
                form={form}
                mode={sensitiveEditMode ? 'edit' : 'view'}
                editMode={sensitiveEditMode}
                member={member}
                workspaceId={currentWorkspaceId ?? ''}
                roles={roles}
                localShifts={localShifts}
                localDesignations={localDesignations}
                locations={localLocations}
                allMembers={allMembers}
                onOpenCreateShift={() => setCreateShiftOpen(true)}
                onOpenCreateDesignation={() => setCreateDesignationOpen(true)}
                componentOverrides={componentOverrides}
                setComponentOverrides={trackedSetComponentOverrides}
                editingOverride={editingOverride}
                setEditingOverride={setEditingOverride}
                canViewPay={canViewGroup('pay')}
                canViewStatutory={canViewGroup('statutory')}
              />
            </ConfigProvider>
          </div>

          <div style={{ display: activeTab === 'bank' ? 'block' : 'none' }}>
            {selfEditBlocked && (
              <Alert
                type="info"
                showIcon
                className="mb-4"
                title={t('team.selfManagedFieldsTitle')}
                description={t('team.selfManagedFieldsBody')}
              />
            )}
            <ConfigProvider componentDisabled={!sensitiveEditMode}>
              <BankTab
                form={form}
                mode={sensitiveEditMode ? 'edit' : 'view'}
                editMode={sensitiveEditMode}
              />
            </ConfigProvider>
          </div>
        </Form>

        {/* Documents lives OUTSIDE the Form so the Form's `disabled={!editMode}`
            context doesn't propagate down and disable the preview / upload /
            delete buttons in DocumentsPanel. View-mode users still need to
            click the eye-icon to preview their uploaded docs. */}
        <div style={{ display: activeTab === 'documents' ? 'block' : 'none' }}>
          <DocumentsTab
            mode={editMode ? 'edit' : 'view'}
            editMode={editMode}
            documents={memberDocuments}
            pendingDocs={pendingDocs}
            loading={documentsLoading && !documentsLoaded}
            payrollEnabled={payrollChipsEnabled}
            onUploadClick={handleOpenUpload}
            onPreview={setPreviewSource}
            onDeleteServer={handleDeleteServerDoc}
            onRemovePending={() => {}}
          />
        </div>

        {/* PAUSED 2026-05-14 - Karigar tab panel hidden. Revive by uncommenting.
        {activeTab === 'karigar' && member && (
          <KarigarTab
            member={member}
            workspaceId={currentWorkspaceId ?? ''}
            onUpdated={(updated) => setMember(updated)}
          />
        )}
        */}

        {activeTab === 'piece-rate' && member && showPieceRateTab && (
          <PieceRateConfigTab
            wsId={currentWorkspaceId ?? ''}
            member={member}
            machines={machinesList.map((m) => ({
              _id: m._id ?? m.id,
              machineCode: m.machineCode ?? m.name,
            }))}
            onSaved={() => {
              void load();
            }}
          />
        )}

        {activeTab === 'activity' && member && currentWorkspaceId && (
          <MemberActivityPanel workspaceId={currentWorkspaceId} memberId={member.id} />
        )}

        {activeTab === 'attendance' && currentWorkspaceId && member && (
          <AttendanceTab
            wsId={currentWorkspaceId}
            memberId={member.id}
            isOwnRecord={isOwnRecord}
            canViewAll={isOwner || canPath('attendance.analytics.view')}
            member={member}
          />
        )}

        <div style={{ display: activeTab === 'salary' ? 'block' : 'none' }}>
          <SalaryTab
            memberId={member.id}
            memberName={member.name}
            memberEmail={member.email}
            ledger={ledger}
            ledgerLoading={ledgerLoading && !ledgerLoaded}
            gratuityLedger={gratuityLedger}
            gratuityLoading={gratuityLoading}
            gratuityLoaded={gratuityLoaded}
            canViewGratuityTracking={canViewGratuityTracking}
            initialSection={salaryInitialSection}
          />
        </div>

        <div style={{ display: activeTab === 'app-access' ? 'block' : 'none' }}>
          {canManageAccess && member && currentWorkspaceId && (
            <AppAccessSection
              workspaceId={currentWorkspaceId}
              member={member}
              roles={roles}
              onMemberChange={setMember}
              onRefresh={load}
            />
          )}
        </div>
      </MemberProfileShell>

      <DocumentUploadModal
        open={uploadModalOpen}
        type={uploadModalType}
        uploading={uploadingDoc}
        progress={uploadProgress}
        onClose={handleCloseUpload}
        onConfirm={handleConfirmUpload}
      />

      <DocumentPreviewModal
        open={!!previewSource}
        fileUrl={previewSource?.fileUrl ?? null}
        fileName={previewSource?.fileName}
        mimeType={previewSource?.mimeType}
        title={previewSource?.label ?? previewSource?.fileName ?? t('team.detailDocPreview')}
        onClose={() => setPreviewSource(null)}
      />

      <CreateShiftDrawer
        open={createShiftOpen}
        onClose={() => setCreateShiftOpen(false)}
        onCreated={(newShift) => {
          setLocalShifts((prev) => [...prev, newShift]);
          form.setFieldValue('shiftId', newShift._id ?? newShift.id);
          setCreateShiftOpen(false);
        }}
        workspaceId={currentWorkspaceId ?? ''}
      />

      <CreateDesignationModal
        open={createDesignationOpen}
        onClose={() => setCreateDesignationOpen(false)}
        onCreated={(newDesignation) => {
          setLocalDesignations((prev) => [...prev, newDesignation]);
          form.setFieldValue('designation', newDesignation);
          setCreateDesignationOpen(false);
        }}
        workspaceId={currentWorkspaceId ?? ''}
        existingDesignations={localDesignations}
      />
    </>
  );
}
