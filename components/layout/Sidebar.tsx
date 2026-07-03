'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout, Menu, Tooltip, Dropdown, Badge } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  SafetyOutlined,
  SettingOutlined,
  SwapOutlined,
  BankOutlined,
  PlusOutlined,
  LockOutlined,
  ExportOutlined,
  LinkOutlined,
  TranslationOutlined,
  CheckOutlined,
  ToolOutlined,
  HomeOutlined,
  ApartmentOutlined,
  CalculatorOutlined,
  BookOutlined,
  FunnelPlotOutlined,
  CreditCardOutlined,
  ShoppingOutlined,
  FileDoneOutlined,
  InboxOutlined,
  WalletOutlined,
  BarChartOutlined,
  ScanOutlined,
  ScheduleOutlined,
  TransactionOutlined,
  BellOutlined,
  PhoneOutlined,
  AppstoreOutlined,
  GiftOutlined,
  DeleteOutlined,
  QrcodeOutlined,
  CarOutlined,
  FileProtectOutlined,
  FormOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useWorkspaceStore, useSubscriptionStore, useAuthStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMemo, useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { attendanceDevicesApi } from '@/lib/api/modules/attendance-devices.api';
import { regularizationApi } from '@/lib/api/modules/regularization.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { filterNavItems } from '@/lib/constants/nav-permissions';
import { meApi } from '@/lib/api/modules/me.api';
import type { PendingInvite } from '@/lib/api/modules/me.api';
import { listWorkspaces } from '@/lib/actions';
import { getCurrentFirm } from '@/lib/actions/finance.actions';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import { App as AntdApp, Tag as AntdTag, Button as AntdButton } from 'antd';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import ModeSwitcher from './ModeSwitcher';
// Disabled for now per owner request (2026-06-24); re-enable with the render site below.
// import ConnectNudge from '@/components/connect/ConnectNudge';

const { Sider } = Layout;

/**
 * Locked-feature indicator for sidebar menu labels.
 * Plan-agnostic premium icon (crown) - no plan name text, so works for
 * any tier (Pro / Custom / Enterprise / etc). flex-shrink-0 prevents
 * clipping at narrow sidebar widths.
 */
function ProLockBadge() {
  return (
    <span
      className="cr-pro-lock-badge inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full"
      style={{
        background: 'var(--cr-gold-100)',
        border: '1px solid var(--cr-gold-400)',
      }}
      aria-label="Premium feature"
    >
      <CrownOutlined className="text-[10px]" style={{ color: 'var(--cr-gold-700)' }} />
    </span>
  );
}

const WORKSPACE_ITEM_KEYS = ['/dashboard/roles', '/dashboard/workspace'];

// Time & Attendance group - Attendance, Leave, Shifts, Holidays all live
// under one collapsible sidebar parent (2026-05-17). The four modules stay
// independent on the backend; this is nav grouping only.
const TIME_ATTENDANCE_ITEM_KEYS = [
  '/dashboard/attendance',
  '/dashboard/leave',
  '/dashboard/shifts',
  '/dashboard/holidays',
];

const MACHINES_ITEM_KEYS = [
  '/dashboard/machines',
  '/dashboard/machines/shop-floor',
  '/dashboard/machines/locations',
  '/dashboard/machines/resource-scopes',
  '/dashboard/machines/production-logs/bulk',
  '/dashboard/production-utilisation',
];

function useModuleEnabled(module: string): boolean {
  const { entitlements, isHydrated } = useSubscriptionStore();

  const enabled = useMemo(() => {
    if (!isHydrated) return true;
    if (!entitlements?.moduleAccess || entitlements.moduleAccess.length === 0) return false;
    const moduleEntry = entitlements.moduleAccess.find((m) => m.module === module);
    return moduleEntry?.enabled ?? false;
  }, [entitlements, isHydrated, module]);

  return enabled;
}

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const MOBILE_VIEWPORT_QUERY = '(max-width: 767.98px)';
function subscribeMobileViewport(notify: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
}
function getMobileViewportSnapshot(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}
function getMobileViewportServerSnapshot(): boolean {
  return false;
}

export default function Sidebar({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  // AC-4.1: per-slice selectors. The sidebar (workspace switcher) reads
  // currentWorkspace + workspaces; selecting them individually keeps it from
  // re-rendering on unrelated store writes and lets the in-place patch
  // (setCurrentWorkspace, used by settings flows) update the switcher label/logo
  // without a full-list churn.
  const currentWorkspace = useWorkspaceStore((s) => s.currentWorkspace);
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const { user } = useAuthStore();
  const { message: msg } = AntdApp.useApp();

  // Resolve the workspace's firm (finance is 1:1 firm:workspace) so the
  // Billing & Accounts menu renders even when the user is off finance pages
  // (otherwise currentFirmId is URL-only and the section collapses to Dashboard).
  const [resolvedFirmId, setResolvedFirmId] = useState<string | null>(null);
  const [firmResolved, setFirmResolved] = useState(false);
  useEffect(() => {
    const wsId = currentWorkspace?._id;
    if (!wsId) return;
    let active = true;
    getCurrentFirm(wsId)
      .then((f) => {
        if (active) setResolvedFirmId(f?._id ?? null);
      })
      .catch(() => {
        if (active) setResolvedFirmId(null);
      })
      .finally(() => {
        if (active) setFirmResolved(true);
      });
    return () => {
      active = false;
    };
  }, [currentWorkspace?._id]);
  // Wave 4 W4.2 (2026-05-10) - pending invites surfaced in workspace switcher.
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      meApi
        .pendingInvites()
        .then((data) => {
          if (!cancelled) setPendingInvites(data);
        })
        .catch(() => {
          // Silent - pending-invites is a nice-to-have, not load-blocking.
        });
    };
    load();
    // P2.0.2 (2026-05-15) - refetch when accept/decline fires elsewhere
    // (auto-accept in DashboardLayout, Accept button in ReceivedInvitesList,
    // Accept button in this switcher). Without this, the switcher keeps
    // showing a "Pending invites" row + Accept/Decline buttons even after
    // the membership has been activated.
    const onInvitesChanged = () => load();
    window.addEventListener('z360:invites-changed', onInvitesChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('z360:invites-changed', onInvitesChanged);
    };
  }, [user]);
  const { subscription, plan } = useSubscriptionStore();

  const isTrialStatus = subscription?.status === 'trial';
  const fullPlanLabel = isTrialStatus ? 'Trial' : plan?.name || 'Pro';
  // Strip parenthesized qualifier (e.g. "Custom (Admin Assigned)" → "Custom")
  // for the badge so the truncation point is meaningful. Full label still
  // appears in the tooltip.
  const planLabel = fullPlanLabel.replace(/\s*\([^)]*\)\s*$/, '').trim() || fullPlanLabel;
  const badgeColor = isTrialStatus
    ? { bg: 'bg-warning-50', text: 'text-warning-700', dot: 'bg-warning-500' }
    : { bg: 'bg-gold-100', text: 'text-gold-700', dot: 'bg-gold-500' };

  const renewsOn = subscription?.currentPeriodEnd
    ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const tooltipTitle = `${fullPlanLabel}${renewsOn ? ` · Renews ${renewsOn}` : ''}`;

  // Sidebar "Upgrade" button visibility. Show for everyone EXCEPT the top
  // tiers (Business / Custom) - they already have full access, so an upgrade
  // CTA would be noise. Gold-accent CTA -> the in-app plans hub (same route the
  // trial banners + MemberCapNotice use). Keep the tier list in sync with the
  // backend plan tiers + dashboard.upgrade i18n.
  const planTier = (plan?.tier ?? '').toLowerCase();
  const isTopTier = planTier === 'business' || planTier === 'custom' || planTier === 'enterprise';
  const showUpgradeButton = !isTopTier;

  const shiftsEnabled = useModuleEnabled('shifts');
  const holidaysEnabled = useModuleEnabled('holidays');
  const rolesEnabled = useModuleEnabled('roles');
  // bills module DEPRECATED - superseded by Finance/Purchases (audit pass-2 decision).
  // Variable removed; route redirects via next.config.ts.
  const teamEnabled = useModuleEnabled('team');
  const attendanceEnabled = useModuleEnabled('attendance');
  const salaryEnabled = useModuleEnabled('salary');
  const leaveEnabled = useModuleEnabled('leave');
  const workspaceEnabled = useModuleEnabled('settings');
  const machinesEnabled = useModuleEnabled('machines');
  const locationsEnabled = useModuleEnabled('locations');
  const resourceScopesEnabled = useModuleEnabled('resource_scopes');
  const machinesProductionAccess = useFeatureAccess('machines', 'machines_production');
  const machinesProductionLocked = machinesProductionAccess.isLocked;
  // Phase 25 / Plan 25-12 - Production Utilisation Dashboard sidebar gate.
  const utilisationDashboardAccess = useFeatureAccess(
    'machines',
    'production_utilisation_dashboard',
  );
  const utilisationDashboardEnabled = !utilisationDashboardAccess.isLocked;
  // Phase 22 / Plan 22-11 - Downtime Reasons settings entry (owner-only;
  // workspace owner short-circuits usePermission, so subscription gate is
  // the practical visibility lever here).
  const machinesDowntimeAccess = useFeatureAccess('machines', 'machines_downtime');
  const machinesDowntimeEnabled = !machinesDowntimeAccess.isLocked;
  const financeEnabled = useModuleEnabled('finance');
  const inventoryEnabled = useModuleEnabled('inventory');
  // Wave-2 audit decision: BOM promoted into top-level Manufacturing module.
  // Keep `bom` fallback for backward-compat with legacy plans that still
  // grant `bom` module key. Either grants access to the manufacturing UI.
  const manufacturingEnabled = useModuleEnabled('manufacturing');
  const bomEnabled = useModuleEnabled('bom');
  const manufacturingOrBomEnabled = manufacturingEnabled || bomEnabled;
  const jobWorkEnabled = useModuleEnabled('job_work');
  const gstComplianceEnabled = useModuleEnabled('gst_compliance');
  // Wave-2 audit additions - newly-promoted top-level modules.
  const regularizationEnabled = useModuleEnabled('regularization');
  const downtimeEnabled = useModuleEnabled('downtime');
  const maintenanceEnabled = useModuleEnabled('maintenance');

  // Tally Export, FY Close, Portal Access entries (moved under Billing &
  // Accounts). Each now keys off its OWN canonical Finance sub-feature so an
  // admin can actually unlock it via Module Access. The old single
  // `finance_advanced` gate was a dropped legacy key absent from both the
  // backend and web feature registries, so these stayed permanently locked
  // (the bug). Keep in sync with the Finance subFeatures in
  // lib/constants/feature-access.registry.ts (mirrors module-features.registry.ts).
  const tallyExportLocked = useFeatureAccess('finance', 'accounting_tally_export').isLocked;
  const fyCloseLocked = useFeatureAccess('finance', 'accounting_fiscal_years').isLocked;
  const portalAccessLocked = useFeatureAccess('finance', 'party_portal_access').isLocked;

  // Track whether the antd `breakpoint="md"` has fired so we can collapse
  // the rail to zero on mobile (lets the TopHeader drawer take over) instead
  // of showing a narrow icon strip alongside the drawer toggle. Read via
  // useSyncExternalStore to avoid the lint-banned setState-in-effect pattern
  // and to give a tearing-free hydration contract (server renders desktop;
  // client commits to the real media-query value on first paint).
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewportSnapshot,
    getMobileViewportServerSnapshot,
  );

  // Mobile drawer - close it once the user navigates to a new route so the
  // freshly-loaded page is not left hidden behind the open nav drawer. Only
  // the drawer-mounted instance gets a real `onMobileClose`; the persistent
  // rail passes a no-op, so this is inert there.
  const prevPathnameRef = useRef(pathname);
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;
    if (mobileOpen) onMobileClose();
  }, [pathname, mobileOpen, onMobileClose]);

  const {
    can: canPermission,
    canPath: canPathPermission,
    data: permissionsData,
    loading: permissionsLoading,
  } = useMyPermissions();
  const permissionsIsOwner = permissionsData?.isOwner ?? false;
  // Only gate when the BE actually told us what the caller can do. Pre-
  // fetch (no workspace bound yet) and fetch-error states render-through
  // so the nav never empties out just because the permission probe hasn't
  // landed yet - BE still enforces 403 on the route itself.
  const permissionsHasData = permissionsData != null;

  // RBAC Remediation Tier 1 (2026-05-18): RBAC check for the workspace
  // settings nav entry. Both the subscription gate AND the permission gate
  // must pass. When permissions have not loaded yet (permissionsHasData=false)
  // render-through is safe because the page itself guards behind permission
  // resolution - the sidebar entry being visible during loading is not a
  // data leak. Owners always pass (canPermission short-circuits on isOwner).
  const canViewWorkspaceRbac =
    !permissionsHasData || permissionsIsOwner || canPermission('workspaces', 'view');
  const workspaceVisible = workspaceEnabled && canViewWorkspaceRbac;

  // Unassigned punch badge - fire-and-forget, failure must not break nav.
  // Gated by MANAGE_DEVICES - silently skip when user lacks perm (avoids 403 console noise).
  const [unassignedCount, setUnassignedCount] = useState(0);
  useEffect(() => {
    const currentWorkspaceId = currentWorkspace?._id;
    if (!currentWorkspaceId || !attendanceEnabled) return;
    if (!canPermission('attendance', 'MANAGE_DEVICES')) return;
    attendanceDevicesApi
      .getUnassignedPunches(currentWorkspaceId)
      .then((pairs) => setUnassignedCount(pairs.length))
      .catch(() => {}); // silently fail - badge is non-critical
  }, [currentWorkspace?._id, attendanceEnabled, canPermission]);

  // Pending regularization badge - fetch count of requests awaiting current user's decision.
  // Gated by MANAGE_REGULARIZATIONS - silently skip when user lacks perm.
  const [pendingRegularizationCount, setPendingRegularizationCount] = useState<number>(0);
  useEffect(() => {
    const currentWorkspaceId = currentWorkspace?._id;
    if (!currentWorkspaceId || !attendanceEnabled) return;
    if (!canPermission('attendance', 'MANAGE_REGULARIZATIONS')) return;
    regularizationApi
      .listPendingForMe(currentWorkspaceId)
      .then((list) => setPendingRegularizationCount(list.length))
      .catch(() => setPendingRegularizationCount(0)); // silently fail - badge is non-critical
  }, [currentWorkspace?._id, attendanceEnabled, canPermission]);

  // Extract firmId from current URL when browsing finance sub-pages; fall back
  // to the workspace's resolved firm so billing links work from anywhere.
  const firmIdMatch = pathname.match(/\/dashboard\/finance\/firms\/([^/]+)/);
  const urlFirmId = firmIdMatch?.[1] ?? null;
  const currentFirmId = urlFirmId ?? resolvedFirmId;

  // Extract bankAccountId when browsing bank-account detail or reconcile pages
  const bankAccountIdMatch = pathname.match(/\/dashboard\/finance\/bank-accounts\/([^/]+)/);
  const currentBankAccountId = bankAccountIdMatch?.[1] ?? null;

  const reminderItemKeys = currentFirmId
    ? [
        `/dashboard/finance/firms/${currentFirmId}/reminders`,
        `/dashboard/finance/firms/${currentFirmId}/call-todos`,
      ]
    : [];

  // Sales section child keys. These MUST be registered here so the active-key
  // matcher (allItemKeys, below) can highlight the open Sales page. Without them
  // the generic '/dashboard/finance' catch-all swallowed every /sales/* route and
  // nothing highlighted. Keep in sync with the Sales submenu children rendered below.
  const salesItemKeys = currentFirmId
    ? [
        `/dashboard/finance/firms/${currentFirmId}/sales/invoices`,
        `/dashboard/finance/firms/${currentFirmId}/sales/quotations`,
        `/dashboard/finance/firms/${currentFirmId}/sales/orders`,
        `/dashboard/finance/firms/${currentFirmId}/sales/proforma`,
        `/dashboard/finance/firms/${currentFirmId}/sales/delivery-challans`,
        `/dashboard/finance/firms/${currentFirmId}/sales/recurring`,
        `/dashboard/finance/firms/${currentFirmId}/returns/credit-notes`,
      ]
    : [];

  const inventoryItemKeys = currentFirmId
    ? [
        `/dashboard/finance/firms/${currentFirmId}/inventory`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/godowns`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/lots`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/batches`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/serials`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/transfers`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/wastage`,
        `/dashboard/finance/firms/${currentFirmId}/inventory/samples`,
      ]
    : [];

  const manufacturingItemKeys = currentFirmId
    ? [
        `/dashboard/finance/firms/${currentFirmId}/manufacturing/bom`,
        `/dashboard/finance/firms/${currentFirmId}/manufacturing/vouchers`,
      ]
    : [];

  const jobWorkItemKeys = currentFirmId
    ? [
        `/dashboard/finance/firms/${currentFirmId}/job-work/inward-challans`,
        `/dashboard/finance/firms/${currentFirmId}/job-work/outward-challans`,
        `/dashboard/finance/firms/${currentFirmId}/job-work/invoices`,
        `/dashboard/finance/firms/${currentFirmId}/job-work/pending-material`,
        `/dashboard/finance/firms/${currentFirmId}/job-work/itc04`,
      ]
    : [];

  const gstItemKeys = currentFirmId
    ? [
        `/dashboard/finance/firms/${currentFirmId}/gst`,
        `/dashboard/finance/firms/${currentFirmId}/gst/gstr1`,
        `/dashboard/finance/firms/${currentFirmId}/gst/gstr3b`,
        `/dashboard/finance/firms/${currentFirmId}/gst/einvoice`,
        `/dashboard/finance/firms/${currentFirmId}/gst/ewaybill`,
        `/dashboard/finance/firms/${currentFirmId}/gst/verify`,
        `/dashboard/finance/firms/${currentFirmId}/gst/itc04`,
      ]
    : [];

  const reconcileHref = currentBankAccountId
    ? `/dashboard/finance/bank-accounts/${currentBankAccountId}/reconcile`
    : `/dashboard/finance/bank-accounts`;

  const reportsHref = currentFirmId ? `/dashboard/finance/firms/${currentFirmId}/reports` : null;

  const allItemKeys = [
    '/dashboard',
    '/dashboard/bills',
    '/dashboard/team',
    '/dashboard/attendance',
    '/dashboard/salary',
    '/dashboard/finance/expenses',
    '/dashboard/finance/journal-vouchers',
    '/dashboard/finance/contras',
    '/dashboard/finance/cash-registers',
    '/dashboard/finance/bank-accounts',
    '/dashboard/finance/cheques',
    '/dashboard/finance/loans',
    '/dashboard/finance',
    '/dashboard/settings/party-intelligence',
    // Moved into Billing & Accounts - register so the active-key highlight
    // resolves to these routes (longest-match wins over '/dashboard/finance').
    '/dashboard/settings/tally-export',
    '/dashboard/settings/fy-close',
    '/dashboard/reports/party-pnl',
    reconcileHref,
    ...salesItemKeys,
    ...reminderItemKeys,
    ...inventoryItemKeys,
    ...manufacturingItemKeys,
    ...jobWorkItemKeys,
    ...gstItemKeys,
    ...(reportsHref ? [reportsHref] : []),
    ...MACHINES_ITEM_KEYS,
    ...WORKSPACE_ITEM_KEYS,
    ...TIME_ATTENDANCE_ITEM_KEYS,
  ];
  // Note: fixed-assets routes are under /dashboard/finance/firms/.../fixed-assets
  // They are captured by the /dashboard/finance prefix above for activeKey detection.
  const isBankReconcilePath = /^\/dashboard\/finance\/bank-accounts\/[^/]+\/reconcile/.test(
    pathname,
  );
  // Pick the LONGEST (most specific) matching key, not the first. A first-match
  // scan let the broad '/dashboard/finance' entry shadow every deeper finance route
  // (e.g. /sales/invoices), so the open page never highlighted. Longest-match makes
  // '/dashboard/finance/firms/<id>/sales/invoices' win over '/dashboard/finance'.
  const activeKey = isBankReconcilePath
    ? 'finance-bank-reconciliation'
    : (allItemKeys
        .filter((k) => pathname === k || (k !== '/dashboard' && pathname.startsWith(k)))
        .sort((a, b) => b.length - a.length)[0] ?? '/dashboard');

  const isWorkspaceItemActive = WORKSPACE_ITEM_KEYS.some(
    (k) => pathname === k || pathname.startsWith(k),
  );

  const isTimeAttendanceItemActive = TIME_ATTENDANCE_ITEM_KEYS.some(
    (k) => pathname === k || pathname.startsWith(k),
  );

  // ---------------------------------------------------------------------------
  // Sidebar open-state (accordion). The Billing & Accounts submenu used to dump
  // its whole tree open at once (every section was a non-collapsible group),
  // which was slow to mount and overwhelming to scan. Sections are now real
  // collapsible submenus and only one top-level module opens at a time. Closed
  // inline submenus don't mount their children, so the expand is cheap.
  // Keys -> menu drives: 'finance-submenu' parent, and `fin-sec-*` per section.
  // The moved-in settings pages (Tally Export, FY Close, Party Intelligence)
  // live under /dashboard/settings/* but now belong to Billing & Accounts, so
  // they also count as "finance active" for auto-opening the finance submenu.
  const isFinanceSettingsActive =
    pathname.startsWith('/dashboard/settings/tally-export') ||
    pathname.startsWith('/dashboard/settings/fy-close') ||
    pathname.startsWith('/dashboard/settings/party-intelligence');
  const isFinanceActive = pathname.startsWith('/dashboard/finance') || isFinanceSettingsActive;

  // Which Billing & Accounts section (if any) contains the active route, so we
  // can auto-open just that section on first paint. Pathname fragments are the
  // stable signal (firm-scoped routes carry the firm id, ledger routes do not).
  const activeFinanceSectionKey = useMemo<string | null>(() => {
    if (!isFinanceActive) return null;
    const p = pathname;
    const has = (frag: string) => p.includes(frag);
    // Moved-in settings pages -> the new "Closing & Export" section.
    if (has('/settings/tally-export') || has('/settings/fy-close')) return 'fin-sec-closing';
    if (has('/sales/')) return 'fin-sec-sales';
    if (has('/parties') || has('/payments') || has('/receivables')) return 'fin-sec-payments';
    if (has('/job-work/')) return 'fin-sec-jobwork';
    // Returns folded into their parent flow: credit notes -> Sales,
    // debit notes + GRN returns -> Purchases (no standalone Returns section).
    if (has('/returns/credit-notes')) return 'fin-sec-sales';
    if (has('/purchases') || has('/ocr/') || has('/returns/')) return 'fin-sec-purchases';
    if (has('/fixed-assets')) return 'fin-sec-fixedassets';
    if (
      has('/finance/expenses') ||
      has('/journal-vouchers') ||
      has('/contras') ||
      has('/cash-registers')
    )
      return 'fin-sec-vouchers';
    if (has('/bank-accounts') || has('/cheques') || has('/loans')) return 'fin-sec-banking';
    if (has('/reminders') || has('/call-todos')) return 'fin-sec-reminders';
    if (has('/inventory')) return 'fin-sec-inventory';
    if (has('/manufacturing')) return 'fin-sec-manufacturing';
    if (has('/gst')) return 'fin-sec-gst';
    return null;
  }, [isFinanceActive, pathname]);

  const ROOT_SUBMENU_KEYS = [
    'time-attendance-submenu',
    'finance-submenu',
    'machines-submenu',
    'workspace-submenu',
  ];

  // Seed open-state from the active branch once (mount). Thereafter user clicks
  // drive it via handleOpenChange. We intentionally do NOT re-sync on every
  // navigation (would be a setState-in-effect, which this codebase lint-bans);
  // clicking a link keeps its own section open, which covers the common path.
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const k: string[] = [];
    if (isWorkspaceItemActive) k.push('workspace-submenu');
    if (isTimeAttendanceItemActive) k.push('time-attendance-submenu');
    if (isFinanceActive) {
      k.push('finance-submenu');
      if (activeFinanceSectionKey) k.push(activeFinanceSectionKey);
    }
    return k;
  });

  // Accordion: opening a top-level module closes the others (sections inside a
  // module can still stack since each is small). Closes always pass through.
  const handleOpenChange: MenuProps['onOpenChange'] = (keys) => {
    const latest = keys.find((k) => !openKeys.includes(k));
    if (latest && ROOT_SUBMENU_KEYS.includes(latest)) {
      // New module opened - show only it (its sections start collapsed).
      setOpenKeys([latest]);
    } else {
      setOpenKeys(keys);
    }
  };

  // ---------------------------------------------------------------------------
  // Locked-item presentation helpers. Every premium-gated nav entry renders the
  // SAME treatment: a right-placed tooltip, a truncated muted label, and the
  // gold ProLockBadge crown. This replaces the three earlier ad-hoc variants
  // (muted div, bare muted span with no tooltip, clickable link with no muting)
  // so the locked sidebar reads as one consistent language. Visual-only, no
  // item's disabled state changes.
  const lockedTooltip = (label: string) => t('navigation.lockedTooltip', { label });

  // Top-level locked entry (Team, Payroll, Finance, Machines). Non-interactive;
  // the menu item itself is `disabled`.
  const renderLockedTop = (label: string) => (
    <Tooltip title={lockedTooltip(label)} placement="right">
      <div className="flex w-full min-w-0 items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate text-[13px] font-medium"
          style={{ color: 'var(--cr-neutral-300)' }}
        >
          {label}
        </span>
        <ProLockBadge />
      </div>
    </Tooltip>
  );

  // Locked submenu child (Attendance, Leave, Roles, ...). Non-interactive.
  const renderLockedSub = (label: string) => (
    <Tooltip title={lockedTooltip(label)} placement="right">
      <div className="flex w-full min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--cr-neutral-300)' }}>
          {label}
        </span>
        <ProLockBadge />
      </div>
    </Tooltip>
  );

  // Locked entry that stays navigable to a read-only/upgrade page (Tally Export,
  // FY Close, Portal Access, bulk production entry). Same muted+crown look as the
  // others, but wraps a Link so the click still lands somewhere useful.
  const renderLockedLink = (label: string, href: string) => (
    <Tooltip title={lockedTooltip(label)} placement="right">
      <Link href={href} className="flex w-full min-w-0 items-center gap-2 no-underline">
        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--cr-neutral-300)' }}>
          {label}
        </span>
        <ProLockBadge />
      </Link>
    </Tooltip>
  );

  const navItems: MenuProps['items'] = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: (
        <Link href="/dashboard" className="text-[13px] font-medium no-underline">
          {t('navigation.dashboard')}
        </Link>
      ),
    },
    // P2.6 (2026-05-15) - Invitations entry moved out of the sidebar nav
    // into the top header (next to the bell). Modern pattern: invitation-
    // class items belong adjacent to notification-class UI, not buried
    // mid-sidebar. The switcher's pending-invites group (further below)
    // stays as the in-context shortcut for quick accept/decline.
    // Bills menu entry DEPRECATED - superseded by Finance/Purchases (audit pass-2 decision).
    // /dashboard/bills now redirects to /dashboard/finance via next.config.ts.
    {
      key: '/dashboard/team',
      icon: <TeamOutlined />,
      // Plain label when the sidebar is expanded: the name is already on
      // screen, so no hover tooltip (it would only repeat the label and sat
      // over the click target). The g>t chord stays discoverable in the
      // Shift+? shortcuts drawer. Keep in sync with the Attendance item, which
      // follows the same no-tooltip-when-expanded rule.
      label: teamEnabled ? (
        <Link href="/dashboard/team" className="text-[13px] font-medium no-underline">
          {t('navigation.team')}
        </Link>
      ) : (
        renderLockedTop(t('navigation.team'))
      ),
      disabled: !teamEnabled,
    },
    {
      // Time & Attendance group (2026-05-17) - Attendance, Leave, Shifts,
      // Holidays under one collapsible parent. The four remain independent
      // backend modules; the parent itself is ungated (no NAV_PERMISSIONS
      // row) so it shows whenever the caller can see at least one child.
      key: 'time-attendance-submenu',
      icon: <ScheduleOutlined />,
      label: <span className="text-[13px] font-medium">{t('navigation.timeAttendance')}</span>,
      children: [
        {
          key: '/dashboard/attendance',
          icon: <CalendarOutlined className="cr-submenu-icon" />,
          // Plain label when expanded (no hover tooltip; the name is visible
          // and g>a lives in the Shift+? drawer). Keep the <Link> a bare
          // sibling (NOT wrapped in <Badge>) so it inherits the 12.5px submenu
          // size exactly like Leave/Shifts/Holidays; the counts render as
          // adjacent badge pills. Mirrors the Team item's no-tooltip rule.
          label: attendanceEnabled ? (
            <span className="flex items-center gap-2">
              <Link href="/dashboard/attendance" className="no-underline">
                {t('navigation.attendance')}
              </Link>
              {unassignedCount > 0 && (
                <Badge count={unassignedCount} size="small" overflowCount={99} />
              )}
              {pendingRegularizationCount > 0 && (
                <Badge count={pendingRegularizationCount} size="small" overflowCount={99} />
              )}
            </span>
          ) : (
            renderLockedSub(t('navigation.attendance'))
          ),
          disabled: !attendanceEnabled,
        },
        {
          key: '/dashboard/leave',
          icon: <FileDoneOutlined className="cr-submenu-icon" />,
          label: leaveEnabled ? (
            <Link href="/dashboard/leave" className="no-underline">
              {t('navigation.leave')}
            </Link>
          ) : (
            renderLockedSub(t('navigation.leave'))
          ),
          disabled: !leaveEnabled,
        },
        {
          key: '/dashboard/shifts',
          icon: <ClockCircleOutlined className="cr-submenu-icon" />,
          label: shiftsEnabled ? (
            <Link href="/dashboard/shifts" className="no-underline">
              {t('navigation.shifts')}
            </Link>
          ) : (
            renderLockedSub(t('navigation.shifts'))
          ),
          disabled: !shiftsEnabled,
        },
        {
          key: '/dashboard/holidays',
          icon: <CalendarOutlined className="cr-submenu-icon" />,
          label: holidaysEnabled ? (
            <Link href="/dashboard/holidays" className="no-underline">
              {t('navigation.holidays')}
            </Link>
          ) : (
            renderLockedSub(t('navigation.holidays'))
          ),
          disabled: !holidaysEnabled,
        },
      ],
    },
    {
      key: '/dashboard/salary',
      icon: <RupeeOutlined />,
      label: salaryEnabled ? (
        <Link href="/dashboard/salary" className="text-[13px] font-medium no-underline">
          {t('navigation.payroll')}
        </Link>
      ) : (
        renderLockedTop(t('navigation.payroll'))
      ),
      disabled: !salaryEnabled,
    },
    {
      key: 'finance-submenu',
      icon: <CalculatorOutlined />,
      label: financeEnabled ? (
        <span className="text-[13px] font-medium">{t('navigation.billingAccounts')}</span>
      ) : (
        renderLockedTop(t('navigation.billingAccounts'))
      ),
      disabled: !financeEnabled,
      children: [
        {
          key: '/dashboard/finance',
          icon: <DashboardOutlined className="cr-submenu-icon" />,
          label: financeEnabled ? (
            <Link href="/dashboard/finance" className="no-underline">
              Dashboard
            </Link>
          ) : (
            <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
              Dashboard
            </span>
          ),
          disabled: !financeEnabled,
        },
        // ---- Moved-in finance settings (NOT firm-scoped) -------------------
        // These four pages live at /dashboard/settings/* (per-party / per-
        // workspace), so they must render whenever the finance module is on,
        // regardless of whether a firm is selected yet (the common case for
        // first-time setup). They were previously misfiled under Administration.
        // Each lock flag now points at its own canonical Finance sub-feature so
        // Module Access can toggle it (was the dead `finance_advanced` key).
        //
        // "Closing & Export" groups the two end-of-period tools.
        ...(financeEnabled
          ? [
              {
                key: 'fin-sec-closing',
                icon: <ExportOutlined className="cr-submenu-icon" />,
                // Hardcoded English label matches the existing finance section
                // style (Purchases / Vouchers / Banking & Loans) - no new i18n.
                label: <span className="text-[13px] font-medium">Closing &amp; Export</span>,
                children: [
                  {
                    key: '/dashboard/settings/tally-export',
                    icon: <ExportOutlined className="cr-submenu-icon" />,
                    label: tallyExportLocked ? (
                      renderLockedLink('Tally Export', '/dashboard/settings/tally-export')
                    ) : (
                      <Tooltip title="Tally Export" placement="right">
                        <Link
                          href="/dashboard/settings/tally-export"
                          className="flex w-full min-w-0 items-center gap-2 no-underline"
                        >
                          <span className="min-w-0 flex-1 truncate">Tally Export</span>
                        </Link>
                      </Tooltip>
                    ),
                  },
                  {
                    key: '/dashboard/settings/fy-close',
                    icon: <LockOutlined className="cr-submenu-icon" />,
                    label: fyCloseLocked ? (
                      renderLockedLink('FY Close', '/dashboard/settings/fy-close')
                    ) : (
                      <Tooltip title="FY Close" placement="right">
                        <Link
                          href="/dashboard/settings/fy-close"
                          className="flex w-full min-w-0 items-center gap-2 no-underline"
                        >
                          <span className="min-w-0 flex-1 truncate">FY Close</span>
                        </Link>
                      </Tooltip>
                    ),
                  },
                ],
              },
              // Party Intelligence - still gated only on the finance module
              // (page-level useFeatureAccess('finance','party_intelligence_rfm')
              // + server @RequirePermissions handle the rest). Keeps its i18n
              // label.
              {
                key: '/dashboard/settings/party-intelligence',
                icon: <FunnelPlotOutlined className="cr-submenu-icon" />,
                label: (
                  <Link href="/dashboard/settings/party-intelligence" className="no-underline">
                    {t('party-intelligence.settings.title')}
                  </Link>
                ),
              },
              // Portal Access - opens the finance dashboard (per-party tokens are
              // generated from a party's detail drawer). Locked state points at
              // the plans page, same as before the move.
              {
                key: 'portal-access-entry',
                icon: <LinkOutlined className="cr-submenu-icon" />,
                label: portalAccessLocked ? (
                  renderLockedLink('Portal Access', '/account/subscription/plans')
                ) : (
                  <Tooltip
                    title="Generate per-party portal tokens from any party's detail drawer."
                    placement="right"
                  >
                    <Link
                      href="/dashboard/finance"
                      className="flex w-full min-w-0 items-center gap-2 no-underline"
                    >
                      <span className="min-w-0 flex-1 truncate">Portal Access</span>
                    </Link>
                  </Tooltip>
                ),
              },
            ]
          : []),
        ...(currentFirmId
          ? [
              // Chart of Accounts - the firm's ledger master (group -> sub-group ->
              // ledger). The whole accounting system posts to these accounts (sales
              // ledger-posting, journal vouchers, opening balances), so it is the
              // foundation of the books; surfaced at the top of the firm nav so it
              // is reachable, not just deep-linked. Page lives at
              // finance/firms/[firmId]/accounts; also a tab under firm Settings.
              {
                key: `/dashboard/finance/firms/${currentFirmId}/accounts`,
                icon: <BookOutlined className="cr-submenu-icon" />,
                label: financeEnabled ? (
                  <Link
                    href={`/dashboard/finance/firms/${currentFirmId}/accounts`}
                    className="no-underline"
                  >
                    Chart of Accounts
                  </Link>
                ) : (
                  <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                    Chart of Accounts
                  </span>
                ),
                disabled: !financeEnabled,
              },
              {
                key: 'fin-sec-sales',
                icon: <FileTextOutlined className="cr-submenu-icon" />,
                label: (
                  <span className="text-[13px] font-medium">
                    {t('navigation.billingGroups.sales')}
                  </span>
                ),
                children: [
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/sales/invoices`,
                    icon: <FileTextOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/sales/invoices`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.invoices')}
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/sales/quotations`,
                    icon: <FileDoneOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/sales/quotations`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.quotations')}
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/sales/orders`,
                    icon: <ShoppingOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/sales/orders`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.orders')}
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/sales/proforma`,
                    icon: <FileProtectOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/sales/proforma`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.proforma')}
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/sales/delivery-challans`,
                    icon: <CarOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/sales/delivery-challans`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.deliveryChallans')}
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/sales/recurring`,
                    icon: <ScheduleOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/sales/recurring`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.recurring')}
                      </Link>
                    ),
                  },
                  // Credit Notes live in Sales (a sales return finishes the
                  // sale flow). Folded out of the old standalone Returns section.
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/returns/credit-notes`,
                    icon: <FileTextOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/returns/credit-notes`}
                        className="no-underline"
                      >
                        {t('navigation.salesItems.creditNotes')}
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        {t('navigation.salesItems.creditNotes')}
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                ],
              },
              {
                key: 'fin-sec-payments',
                icon: <CreditCardOutlined className="cr-submenu-icon" />,
                label: (
                  <span className="text-[13px] font-medium">
                    {t('navigation.billingGroups.paymentsDues')}
                  </span>
                ),
                children: [
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/parties`,
                    icon: <TeamOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/parties`}
                        className="no-underline"
                      >
                        Parties
                      </Link>
                    ),
                  },
                  {
                    // D19 onboarding import (parties step). Sits by Parties since it creates them.
                    key: `/dashboard/finance/firms/${currentFirmId}/import/parties`,
                    icon: <InboxOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/import/parties`}
                        className="no-underline"
                      >
                        Import parties
                      </Link>
                    ),
                  },
                  {
                    // D19 onboarding import (opening balances).
                    key: `/dashboard/finance/firms/${currentFirmId}/import/opening-balances`,
                    icon: <InboxOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/import/opening-balances`}
                        className="no-underline"
                      >
                        Import opening balances
                      </Link>
                    ),
                  },
                  {
                    // D19 onboarding import (item masters).
                    key: `/dashboard/finance/firms/${currentFirmId}/import/items`,
                    icon: <InboxOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/import/items`}
                        className="no-underline"
                      >
                        Import items
                      </Link>
                    ),
                  },
                  {
                    // D19 onboarding import (pending invoices / bill-wise outstanding).
                    key: `/dashboard/finance/firms/${currentFirmId}/import/pending-invoices`,
                    icon: <InboxOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/import/pending-invoices`}
                        className="no-underline"
                      >
                        Import outstanding bills
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/payments`,
                    icon: <CreditCardOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/payments`}
                        className="no-underline"
                      >
                        Payments Received
                      </Link>
                    ),
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/receivables`,
                    icon: <FunnelPlotOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/receivables`}
                        className="no-underline"
                      >
                        Receivables
                      </Link>
                    ),
                  },
                ],
              },
              // Purchases sub-menu - F-04. Wrapped in a collapsible section so
              // the eight purchase entries no longer flood the Billing tree.
              {
                key: 'fin-sec-purchases',
                icon: <ShoppingOutlined className="cr-submenu-icon" />,
                label: <span className="text-[13px] font-medium">Purchases</span>,
                children: [
                  {
                    key: `purchases-dashboard-${currentFirmId}`,
                    icon: <ShoppingOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases`}
                        className="no-underline"
                      >
                        Purchases
                      </Link>
                    ),
                  },
                  {
                    key: `purchases-orders-${currentFirmId}`,
                    icon: <FileDoneOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases/purchase-orders`}
                        className="no-underline"
                      >
                        Purchase Orders
                      </Link>
                    ),
                  },
                  {
                    key: `purchases-grn-${currentFirmId}`,
                    icon: <InboxOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases/grn`}
                        className="no-underline"
                      >
                        GRN
                      </Link>
                    ),
                  },
                  {
                    key: `purchases-bills-${currentFirmId}`,
                    icon: <FileTextOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases/purchase-bills`}
                        className="no-underline"
                      >
                        Purchase Bills
                      </Link>
                    ),
                  },
                  {
                    key: `purchases-payment-out-${currentFirmId}`,
                    icon: <WalletOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases/payment-out`}
                        className="no-underline"
                      >
                        Payment-Out
                      </Link>
                    ),
                  },
                  {
                    key: `purchases-cap-itc-${currentFirmId}`,
                    icon: <BankOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases/capital-goods-itc`}
                        className="no-underline"
                      >
                        Capital Goods ITC
                      </Link>
                    ),
                  },
                  {
                    key: `purchases-payables-${currentFirmId}`,
                    icon: <BarChartOutlined className="cr-submenu-icon" />,
                    label: (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/purchases/payables`}
                        className="no-underline"
                      >
                        Payables Aging
                      </Link>
                    ),
                  },
                  // PAUSED 2026-06-06 - OCR Capture (Vendor Bill OCR) held: needs a
                  // paid AI/OCR API + owner provider decision (Document AI / Textract /
                  // LLM-vision). Manual purchase-bill entry is unaffected. The OCR pages,
                  // OcrUploadZone, action, endpoint, types and BE module are kept intact
                  // for revival - re-enable by uncommenting this nav item and the
                  // OcrModule registration in crewroster-backend purchases.module.ts.
                  // Revive via: rg "PAUSED 2026-06-06 . OCR Capture"
                  // {
                  //   key: `purchases-ocr-${currentFirmId}`,
                  //   icon: <ScanOutlined className="cr-submenu-icon" />,
                  //   label: (
                  //     <Link
                  //       href={`/dashboard/finance/firms/${currentFirmId}/ocr/upload`}
                  //       className="no-underline"
                  //     >
                  //       OCR Intake
                  //     </Link>
                  //   ),
                  // },
                  // Debit Notes + GRN Returns live in Purchases (a purchase
                  // return finishes the buy flow). Folded out of the old
                  // standalone Returns section; Credit Notes went to Sales.
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/returns/debit-notes`,
                    icon: <FileTextOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/returns/debit-notes`}
                        className="no-underline"
                      >
                        Debit Notes
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Debit Notes
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/returns/grn-returns`,
                    icon: <InboxOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/returns/grn-returns`}
                        className="no-underline"
                      >
                        GRN Returns
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        GRN Returns
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                ],
              },
              // Job-Work - F-11 (embroidery edge; placed after Purchases in the
              // buy-side flow). Shown when financeEnabled + jobWorkEnabled + currentFirmId.
              ...(financeEnabled && jobWorkEnabled && currentFirmId
                ? [
                    {
                      key: 'fin-sec-jobwork',
                      icon: <SwapOutlined className="cr-submenu-icon" />,
                      label: (
                        <span className="text-[13px] font-medium">
                          {t('navigation.billingGroups.jobWork')}
                        </span>
                      ),
                      children: [
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/job-work/inward-challans`,
                          icon: <InboxOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/job-work/inward-challans`}
                              className="no-underline"
                            >
                              Inward Challans
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/job-work/outward-challans`,
                          icon: <ExportOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/job-work/outward-challans`}
                              className="no-underline"
                            >
                              Outward Challans
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/job-work/invoices`,
                          icon: <FileTextOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/job-work/invoices`}
                              className="no-underline"
                            >
                              JW Invoices
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/job-work/pending-material`,
                          icon: <ClockCircleOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/job-work/pending-material`}
                              className="no-underline"
                            >
                              Pending Material
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/job-work/itc04`,
                          icon: <FileProtectOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/job-work/itc04`}
                              className="no-underline"
                            >
                              ITC-04
                            </Link>
                          ),
                        },
                      ],
                    },
                  ]
                : []),
              // Vouchers - F-06 (FINANCE_VOUCHERS)
              {
                key: 'fin-sec-vouchers',
                icon: <WalletOutlined className="cr-submenu-icon" />,
                label: <span className="text-[13px] font-medium">Vouchers</span>,
                children: [
                  {
                    key: `/dashboard/finance/expenses`,
                    icon: <WalletOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/expenses`} className="no-underline">
                        Expenses
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Expenses
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/journal-vouchers`,
                    icon: <SwapOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/journal-vouchers`} className="no-underline">
                        Journal Vouchers
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Journal Vouchers
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/contras/new`,
                    icon: <TransactionOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/contras/new`} className="no-underline">
                        Contras
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Contras
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/cash-registers`,
                    icon: <BankOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/cash-registers`} className="no-underline">
                        Cash Registers
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Cash Registers
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                ],
              },
              // Banking & Loans - F-06-07
              {
                key: 'fin-sec-banking',
                icon: <BankOutlined className="cr-submenu-icon" />,
                label: <span className="text-[13px] font-medium">Banking &amp; Loans</span>,
                children: [
                  {
                    key: `/dashboard/finance/bank-accounts`,
                    icon: <BankOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/bank-accounts`} className="no-underline">
                        Bank Accounts
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Bank Accounts
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/cheques`,
                    icon: <TransactionOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/cheques`} className="no-underline">
                        Cheques
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Cheques
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/loans`,
                    icon: <CreditCardOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={`/dashboard/finance/loans`} className="no-underline">
                        Loans
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Loans
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  // Bank Reconciliation - F-13
                  {
                    key: 'finance-bank-reconciliation',
                    icon: <CheckOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link href={reconcileHref} className="no-underline">
                        Bank Reconciliation
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Bank Reconciliation
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                ],
              },
              // Inventory - F-09 (only shown when financeEnabled + inventoryEnabled)
              ...(financeEnabled && inventoryEnabled
                ? [
                    {
                      key: 'fin-sec-inventory',
                      icon: <InboxOutlined className="cr-submenu-icon" />,
                      label: <span className="text-[13px] font-medium">Inventory</span>,
                      children: [
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory`,
                          icon: <BarChartOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory`}
                              className="no-underline"
                            >
                              Stock Summary
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/godowns`,
                          icon: <HomeOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/godowns`}
                              className="no-underline"
                            >
                              Godowns
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/lots`,
                          icon: <InboxOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/lots`}
                              className="no-underline"
                            >
                              Lots
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/batches`,
                          icon: <AppstoreOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/batches`}
                              className="no-underline"
                            >
                              Batches
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/serials`,
                          icon: <ScanOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/serials`}
                              className="no-underline"
                            >
                              Serials
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/transfers`,
                          icon: <SwapOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/transfers`}
                              className="no-underline"
                            >
                              Stock Transfers
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/wastage`,
                          icon: <DeleteOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/wastage`}
                              className="no-underline"
                            >
                              Wastage Register
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/inventory/samples`,
                          icon: <GiftOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/inventory/samples`}
                              className="no-underline"
                            >
                              Samples &amp; Consignment
                            </Link>
                          ),
                        },
                      ],
                    },
                  ]
                : []),
              // Manufacturing - F-10. Gated by Manufacturing module (Wave-2 audit promotion)
              // OR legacy `bom` module key for backward-compat with older plans.
              ...(financeEnabled && manufacturingOrBomEnabled
                ? [
                    {
                      key: 'fin-sec-manufacturing',
                      icon: <ToolOutlined className="cr-submenu-icon" />,
                      label: <span className="text-[13px] font-medium">Manufacturing</span>,
                      children: [
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/manufacturing/bom`,
                          icon: <FormOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/manufacturing/bom`}
                              className="no-underline"
                            >
                              Bill of Materials
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/manufacturing/vouchers`,
                          icon: <ToolOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/manufacturing/vouchers`}
                              className="no-underline"
                            >
                              Manufacturing Vouchers
                            </Link>
                          ),
                        },
                      ],
                    },
                  ]
                : []),
              // Fixed Assets - F-05 (capital-asset register; placed late, near
              // compliance, since it is touched far less often than the daily
              // sales/buy flows).
              {
                key: 'fin-sec-fixedassets',
                icon: <BankOutlined className="cr-submenu-icon" />,
                label: <span className="text-[13px] font-medium">Fixed Assets</span>,
                children: [
                  {
                    key: `fixed-assets-${currentFirmId}`,
                    icon: <BankOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/fixed-assets`}
                        className="no-underline"
                      >
                        Fixed Assets
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Fixed Assets
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  // Fixed Assets Reports - F-05-06
                  {
                    key: `fixed-assets-reports-${currentFirmId}`,
                    icon: <BankOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/fixed-assets/reports`}
                        className="no-underline"
                      >
                        FA Reports
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        FA Reports
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                ],
              },
              // GST Compliance - F-12 (only shown when financeEnabled + gstComplianceEnabled + currentFirmId)
              ...(financeEnabled && gstComplianceEnabled && currentFirmId
                ? [
                    {
                      key: 'fin-sec-gst',
                      icon: <SafetyOutlined className="cr-submenu-icon" />,
                      label: <span className="text-[13px] font-medium">GST Compliance</span>,
                      children: [
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst`,
                          icon: <SafetyOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst`}
                              className="no-underline"
                            >
                              GST Overview
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst/gstr1`,
                          icon: <FileDoneOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst/gstr1`}
                              className="no-underline"
                            >
                              GSTR-1
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst/gstr3b`,
                          icon: <FileTextOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst/gstr3b`}
                              className="no-underline"
                            >
                              GSTR-3B
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst/einvoice`,
                          icon: <QrcodeOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst/einvoice`}
                              className="no-underline"
                            >
                              e-Invoice
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst/ewaybill`,
                          icon: <CarOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst/ewaybill`}
                              className="no-underline"
                            >
                              e-Way Bills
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst/verify`,
                          icon: <ScanOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst/verify`}
                              className="no-underline"
                            >
                              Verify Data
                            </Link>
                          ),
                        },
                        {
                          key: `/dashboard/finance/firms/${currentFirmId}/gst/itc04`,
                          icon: <FileProtectOutlined className="cr-submenu-icon" />,
                          label: (
                            <Link
                              href={`/dashboard/finance/firms/${currentFirmId}/gst/itc04`}
                              className="no-underline"
                            >
                              ITC-04
                            </Link>
                          ),
                        },
                      ],
                    },
                  ]
                : []),
              // Reminders - F-08 (collections follow-up; not an accounting
              // document, so it sits near the end just before Reports).
              {
                key: 'fin-sec-reminders',
                icon: <BellOutlined className="cr-submenu-icon" />,
                label: <span className="text-[13px] font-medium">Reminders</span>,
                children: [
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/reminders`,
                    icon: <BellOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/reminders`}
                        className="no-underline"
                      >
                        Reminders
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Reminders
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                  {
                    key: `/dashboard/finance/firms/${currentFirmId}/call-todos`,
                    icon: <PhoneOutlined className="cr-submenu-icon" />,
                    label: financeEnabled ? (
                      <Link
                        href={`/dashboard/finance/firms/${currentFirmId}/call-todos`}
                        className="no-underline"
                      >
                        Call Todos
                      </Link>
                    ) : (
                      <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                        Call Todos
                      </span>
                    ),
                    disabled: !financeEnabled,
                  },
                ],
              },
              // Reports - F-14 (single entry; rendered as a direct link)
              {
                key: `/dashboard/finance/firms/${currentFirmId}/reports`,
                icon: <BarChartOutlined className="cr-submenu-icon" />,
                label: financeEnabled ? (
                  <Link
                    href={`/dashboard/finance/firms/${currentFirmId}/reports`}
                    className="no-underline"
                  >
                    Reports
                  </Link>
                ) : (
                  <span className="" style={{ color: 'var(--cr-neutral-300)' }}>
                    Reports
                  </span>
                ),
                disabled: !financeEnabled,
              },
            ]
          : financeEnabled && firmResolved
            ? [
                {
                  key: 'finance-setup-cta',
                  label: (
                    <Link href="/dashboard/finance" className="no-underline">
                      {t('navigation.setUpBilling')}
                    </Link>
                  ),
                },
              ]
            : []),
      ],
    },
    {
      key: 'machines-submenu',
      icon: <ToolOutlined />,
      label: machinesEnabled ? (
        <span className="text-[13px] font-medium">Machines</span>
      ) : (
        renderLockedTop('Machines')
      ),
      disabled: !machinesEnabled,
      children: [
        {
          key: '/dashboard/machines',
          icon: <ToolOutlined className="cr-submenu-icon" />,
          label: machinesEnabled ? (
            <Link href="/dashboard/machines" className="no-underline">
              Machines
            </Link>
          ) : (
            renderLockedSub('Machines')
          ),
          disabled: !machinesEnabled,
        },
        // Shop Floor Control - work-order routes + CPM/PERT over the same
        // machines/locations/team records (page self-gates; BE re-checks).
        {
          key: '/dashboard/machines/shop-floor',
          icon: <ApartmentOutlined className="cr-submenu-icon" />,
          label: machinesEnabled ? (
            <Link href="/dashboard/machines/shop-floor" className="no-underline">
              Shop Floor
            </Link>
          ) : (
            renderLockedSub('Shop Floor')
          ),
          disabled: !machinesEnabled,
        },
        {
          key: '/dashboard/machines/locations',
          icon: <HomeOutlined className="cr-submenu-icon" />,
          label: locationsEnabled ? (
            <Link href="/dashboard/machines/locations" className="no-underline">
              Locations
            </Link>
          ) : (
            renderLockedSub('Locations')
          ),
          disabled: !locationsEnabled,
        },
        {
          key: '/dashboard/machines/resource-scopes',
          icon: <SafetyOutlined className="cr-submenu-icon" />,
          label: resourceScopesEnabled ? (
            <Link href="/dashboard/machines/resource-scopes" className="no-underline">
              Resource Scopes
            </Link>
          ) : (
            renderLockedSub('Resource Scopes')
          ),
          disabled: !resourceScopesEnabled,
        },
        {
          key: '/dashboard/machines/production-logs/bulk',
          icon: <FormOutlined className="cr-submenu-icon" />,
          label: machinesProductionLocked ? (
            renderLockedLink(
              t('machines-production.nav.bulkEntry'),
              '/dashboard/machines/production-logs/bulk',
            )
          ) : (
            <Tooltip title={t('machines-production.nav.bulkEntry')} placement="right">
              <Link
                href="/dashboard/machines/production-logs/bulk"
                className="flex w-full min-w-0 items-center gap-2 no-underline"
              >
                <span className="min-w-0 flex-1 truncate">
                  {t('machines-production.nav.bulkEntry')}
                </span>
              </Link>
            </Tooltip>
          ),
        },
        // Phase 25 / Plan 25-12 - Production Utilisation Dashboard.
        // Sub-feature gated; backend re-checks `dashboard.production.view`
        // permission and ResourceScope on every aggregation request.
        ...(utilisationDashboardEnabled
          ? [
              {
                key: '/dashboard/production-utilisation',
                icon: <BarChartOutlined className="cr-submenu-icon" />,
                label: (
                  <Link href="/dashboard/production-utilisation" className="no-underline">
                    {t('dashboard-production-utilisation.sidebar.label')}
                  </Link>
                ),
              },
            ]
          : []),
        // Phase 22 / Plan 22-11 - Downtime Reasons settings (owner-only
        // catalogue editor). Gated by `machines_downtime` sub-feature;
        // backend re-checks `machines.downtime.reasons.manage` permission.
        ...(machinesDowntimeEnabled
          ? [
              {
                key: '/dashboard/settings/downtime-reasons',
                icon: <ClockCircleOutlined className="cr-submenu-icon" />,
                label: (
                  <Link href="/dashboard/settings/downtime-reasons" className="no-underline">
                    {t('machines-downtime.settings.title')}
                  </Link>
                ),
              },
            ]
          : []),
      ],
    },
    {
      key: 'workspace-submenu',
      icon: <BankOutlined />,
      label: (
        <span className="truncate text-[13px] font-medium">{t('navigation.administration')}</span>
      ),
      children: [
        // Roles first, then Workspace Settings (owner-requested order).
        {
          key: '/dashboard/roles',
          icon: <SafetyOutlined className="cr-submenu-icon" />,
          label: rolesEnabled ? (
            <Link href="/dashboard/roles" className="no-underline">
              {t('rbac.roles')}
            </Link>
          ) : (
            renderLockedSub(t('rbac.roles'))
          ),
          disabled: !rolesEnabled,
        },
        {
          key: '/dashboard/workspace',
          icon: <SettingOutlined className="cr-submenu-icon" />,
          label: workspaceVisible ? (
            <Link href="/dashboard/workspace" className="no-underline">
              {t('workspace.settings')}
            </Link>
          ) : (
            renderLockedSub(t('workspace.settings'))
          ),
          disabled: !workspaceVisible,
        },
        // Tally Export / FY Close / Portal Access / Party Intelligence were
        // relocated OUT of Administration and INTO Billing & Accounts (their
        // routes are /dashboard/settings/* + finance-scoped, so they belong with
        // the books, not workspace admin). Administration now holds only
        // Roles + Workspace Settings. See the finance-submenu children below.
        // RBAC re-architecture §7 - "New Workspace" is NOT workspace-admin;
        // it lives in the workspace switcher (the `create` item there). Kept
        // out of Administration so the submenu collapses for a member with
        // no admin permission instead of lingering with a lone child.
      ],
    },
    ...(user?.isAdmin
      ? [
          {
            key: '/admin/localization',
            icon: <TranslationOutlined className="cr-submenu-icon" />,
            label: (
              <Link href="/admin/localization" className="text-[13px] font-medium no-underline">
                Translations
              </Link>
            ),
          },
        ]
      : []),
  ];

  // Wave 1 Permission-Gated UI (2026-05-15) - RBAC filter applied to every
  // nav surface. Hides items the caller lacks BE permission for; owner
  // bypass + loading state render-through handled by `filterNavItems`.
  // Submenu parents collapse if every child gates out.
  const visibleNavItems = filterNavItems(
    navItems ?? [],
    canPermission,
    canPathPermission,
    permissionsIsOwner,
    permissionsLoading,
    permissionsHasData,
  );

  // Wave 4 W4.7 (2026-05-10) - accept-from-switcher flow.
  // Authorizes via the membership row's `userId` match (not raw token), so
  // the switcher can act on invites without exposing tokens through the
  // /me/invites/pending listing. Tokens still authorize the email/SMS
  // landing-page flow at /invites/:token/accept for new users.
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);

  const handleAcceptInvite = async (inviteId: string, workspaceName: string) => {
    setAcceptingInviteId(inviteId);
    try {
      await meApi.acceptInvite(inviteId);
      const [invites, wsRes] = await Promise.all([
        meApi.pendingInvites().catch(() => [] as PendingInvite[]),
        listWorkspaces().catch(() => null),
      ]);
      setPendingInvites(invites);
      if (wsRes && typeof wsRes === 'object' && 'ok' in wsRes && wsRes.ok) {
        setWorkspaces(normalizeWorkspaceList(wsRes.data));
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
      msg.success(`Joined ${workspaceName}`);
    } catch (err) {
      msg.error(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAcceptingInviteId(null);
    }
  };

  const handleDeclineInvite = async (inviteId: string, workspaceName: string) => {
    setAcceptingInviteId(inviteId);
    try {
      await meApi.declineInvite(inviteId);
      const invites = await meApi.pendingInvites().catch(() => [] as PendingInvite[]);
      setPendingInvites(invites);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
      msg.success(`Declined invite to ${workspaceName}`);
    } catch (err) {
      msg.error(err instanceof Error ? err.message : 'Failed to decline invite');
    } finally {
      setAcceptingInviteId(null);
    }
  };

  // Wave 4 W4.3 - role pill per workspace. Owner always shown; non-owner
  // pills require a per-workspace role lookup not yet wired (would need
  // either a /me/workspaces-with-roles endpoint or N parallel /me/permissions
  // calls). Owner is the cheap signal - workspace.ownerId === user._id.
  const renderRolePill = (ws: { _id: string; ownerId?: unknown }) => {
    const ownerId =
      typeof ws.ownerId === 'object' && ws.ownerId !== null && '_id' in ws.ownerId
        ? (ws.ownerId as { _id: string })._id
        : (ws.ownerId as string | undefined);
    if (user?._id && ownerId && String(ownerId) === String(user._id)) {
      return (
        <AntdTag color="gold" style={{ marginInlineStart: 6, fontSize: 10, padding: '0 4px' }}>
          Owner
        </AntdTag>
      );
    }
    return null;
  };

  const wsMenuItems: MenuProps['items'] = [
    // Wave 4 W4.2 (2026-05-10) - pending invites section. Surfaces invites
    // sent to this user across all workspaces; one-click Accept / Decline
    // updates the switcher without a page reload.
    ...(pendingInvites.length > 0
      ? [
          {
            type: 'group' as const,
            key: 'pending-invites-group',
            label: (
              <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
                Pending invites ({pendingInvites.length})
              </span>
            ),
            children: pendingInvites.map((inv) => {
              const workspaceName = inv.workspace?.name ?? 'Workspace';
              const isBusy = acceptingInviteId === inv.id;
              return {
                key: `invite-${inv.id}`,
                label: (
                  <div className="flex flex-col gap-1 py-1">
                    <div className="flex items-center gap-2">
                      <BankOutlined style={{ color: 'var(--cr-info-700)' }} />
                      <span className="truncate text-[13px] font-medium">{workspaceName}</span>
                    </div>
                    <span className="text-[11px] text-muted">
                      Invited as {inv.role?.name ?? 'Member'} by {inv.invitedBy}
                    </span>
                    <div className="mt-1 flex items-center gap-1.5">
                      <AntdButton
                        size="small"
                        type="primary"
                        loading={isBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleAcceptInvite(inv.id, workspaceName);
                        }}
                      >
                        Accept
                      </AntdButton>
                      <AntdButton
                        size="small"
                        disabled={isBusy}
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleDeclineInvite(inv.id, workspaceName);
                        }}
                      >
                        Decline
                      </AntdButton>
                    </div>
                  </div>
                ),
              };
            }),
          },
          { type: 'divider' as const, key: 'invite-divider' },
        ]
      : []),
    ...(workspaces ?? [])
      .filter((ws, index, self) => index === self.findIndex((w) => w._id === ws._id))
      .map((ws) => ({
        key: `workspace-${ws._id}`,
        label: (
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              {ws.branding?.logo ? (
                <img
                  src={ws.branding.logo}
                  alt={ws.name}
                  className="h-5 w-5 rounded object-cover"
                />
              ) : ws._id === currentWorkspace?._id ? (
                <BankOutlined style={{ color: 'var(--cr-primary)' }} />
              ) : (
                <BankOutlined />
              )}
              <span className="max-w-[140px] truncate">{ws.name}</span>
              {renderRolePill(ws)}
            </div>
            {ws._id === currentWorkspace?._id && (
              <CheckOutlined className="ml-auto text-xs text-primary" />
            )}
          </div>
        ),
        onClick: () => setCurrentWorkspaceId(ws._id),
        style:
          ws._id === currentWorkspace?._id
            ? { backgroundColor: 'var(--cr-primary-light)' }
            : undefined,
      })),
    { type: 'divider' as const, key: 'divider-1' },
    {
      key: 'create',
      label: (
        <span
          style={{
            color: workspaceEnabled ? 'var(--cr-primary)' : 'var(--cr-text-5)',
            fontWeight: 600,
          }}
        >
          {t('workspace.add')}
        </span>
      ),
      icon: (
        <PlusOutlined
          style={{ color: workspaceEnabled ? 'var(--cr-primary)' : 'var(--cr-text-5)' }}
        />
      ),
      disabled: !workspaceEnabled,
      onClick: workspaceEnabled
        ? () => router.push('/dashboard/workspace?action=create')
        : undefined,
    },
  ];

  const collapsedNavItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: t('navigation.dashboard'),
    },
    // Bills entry DEPRECATED - see comment in expanded navItems above.
    {
      key: '/dashboard/team',
      icon: <TeamOutlined />,
      label: t('navigation.team'),
      disabled: !teamEnabled,
    },
    {
      key: 'time-attendance-submenu',
      icon: <ScheduleOutlined />,
      label: t('navigation.timeAttendance'),
      isSubmenu: true,
      submenuKind: 'time-attendance' as const,
    },
    {
      key: '/dashboard/salary',
      icon: <RupeeOutlined />,
      label: t('navigation.payroll'),
      disabled: !salaryEnabled,
    },
    {
      key: '/dashboard/finance',
      icon: <CalculatorOutlined />,
      label: 'Finance',
      disabled: !financeEnabled,
    },
    {
      key: 'machines-submenu',
      icon: <ToolOutlined />,
      label: 'Machines',
      isSubmenu: true,
      submenuKind: 'machines' as const,
      disabled: !machinesEnabled,
    },
    {
      key: 'workspace-submenu',
      icon: <BankOutlined />,
      label: t('navigation.administration'),
      isSubmenu: true,
      submenuKind: 'workspace' as const,
    },
    ...(user?.isAdmin
      ? [
          {
            key: '/admin/localization',
            icon: <TranslationOutlined className="cr-submenu-icon" />,
            label: 'Translations',
          },
        ]
      : []),
  ];

  // Collapsed-rail popup for the Time & Attendance group.
  const timeAttendancePopupItems: MenuProps['items'] = [
    {
      key: '/dashboard/attendance',
      icon: attendanceEnabled ? <CalendarOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          {t('navigation.attendance')}
          {!attendanceEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !attendanceEnabled,
    },
    {
      key: '/dashboard/leave',
      icon: leaveEnabled ? <FileDoneOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          {t('navigation.leave')}
          {!leaveEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !leaveEnabled,
    },
    {
      key: '/dashboard/shifts',
      icon: shiftsEnabled ? <ClockCircleOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          {t('navigation.shifts')}
          {!shiftsEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !shiftsEnabled,
    },
    {
      key: '/dashboard/holidays',
      icon: holidaysEnabled ? <CalendarOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          {t('navigation.holidays')}
          {!holidaysEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !holidaysEnabled,
    },
  ];

  const submenuPopupItems: MenuProps['items'] = [
    {
      key: '/dashboard/workspace',
      icon: <SettingOutlined />,
      label: (
        <span
          className={`flex items-center gap-2 ${!workspaceEnabled ? 'pointer-events-none' : ''}`}
        >
          {t('workspace.settings')}
          {!workspaceEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !workspaceVisible,
    },
    {
      key: '/dashboard/roles',
      icon: rolesEnabled ? <SafetyOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          {t('rbac.roles')}
          {!rolesEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !rolesEnabled,
    },
    // RBAC re-architecture §7 - "New Workspace" lives in the workspace
    // switcher, not the nav (see the expanded navItems note above).
  ];

  const machinesPopupItems: MenuProps['items'] = [
    {
      key: '/dashboard/machines',
      icon: machinesEnabled ? <ToolOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          Machines
          {!machinesEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !machinesEnabled,
    },
    {
      key: '/dashboard/machines/shop-floor',
      icon: machinesEnabled ? <ApartmentOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          Shop Floor
          {!machinesEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !machinesEnabled,
    },
    {
      key: '/dashboard/machines/locations',
      icon: locationsEnabled ? <HomeOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          Locations
          {!locationsEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !locationsEnabled,
    },
    {
      key: '/dashboard/machines/resource-scopes',
      icon: resourceScopesEnabled ? <SafetyOutlined /> : <LockOutlined className="text-faint" />,
      label: (
        <span className="flex items-center gap-2">
          Resource Scopes
          {!resourceScopesEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !resourceScopesEnabled,
    },
    {
      key: '/dashboard/machines/production-logs/bulk',
      icon: <FormOutlined />,
      label: (
        <span className="flex items-center gap-2">
          {t('machines-production.nav.bulkEntry')}
          {machinesProductionLocked && <ProLockBadge />}
        </span>
      ),
    },
    {
      key: '/dashboard/production-utilisation',
      icon: utilisationDashboardEnabled ? (
        <BarChartOutlined />
      ) : (
        <LockOutlined className="text-faint" />
      ),
      label: (
        <span className="flex items-center gap-2">
          {t('dashboard-production-utilisation.sidebar.label')}
          {!utilisationDashboardEnabled && <ProLockBadge />}
        </span>
      ),
      disabled: !utilisationDashboardEnabled,
    },
  ];

  // Wave 1 Permission-Gated UI (2026-05-15) - same filter as expanded nav,
  // applied to the collapsed icon rail + the two popover submenus surfaced
  // when the sidebar is collapsed. `collapsedNavItems` carries non-Menu
  // fields (`isSubmenu`, `submenuKind`) which `filterNavItems` passes
  // through via object spread.
  const visibleCollapsedNavItems = filterNavItems(
    collapsedNavItems,
    canPermission,
    canPathPermission,
    permissionsIsOwner,
    permissionsLoading,
    permissionsHasData,
  );
  const visibleSubmenuPopupItems = filterNavItems(
    submenuPopupItems ?? [],
    canPermission,
    canPathPermission,
    permissionsIsOwner,
    permissionsLoading,
    permissionsHasData,
  );
  const visibleMachinesPopupItems = filterNavItems(
    machinesPopupItems ?? [],
    canPermission,
    canPathPermission,
    permissionsIsOwner,
    permissionsLoading,
    permissionsHasData,
  );
  const visibleTimeAttendancePopupItems = filterNavItems(
    timeAttendancePopupItems ?? [],
    canPermission,
    canPathPermission,
    permissionsIsOwner,
    permissionsLoading,
    permissionsHasData,
  );

  // The persistent rail is fully hidden (width 0) on mobile - the TopHeader
  // drawer takes over. Drop its border + shadow then so no 1px sliver bleeds
  // onto the page.
  const railHidden = isMobileViewport && collapsed && !mobileOpen;

  return (
    <Sider
      // Inside the mobile nav drawer the sidebar fills the drawer width;
      // as the desktop rail it is a fixed 240px (64px icon-rail collapsed).
      width={mobileOpen ? '100%' : 240}
      // Below md (768px) the persistent rail hides entirely - mobile users
      // get the TopHeader drawer instead. The drawer instance keeps its
      // expanded width since `collapsed` is false there.
      collapsedWidth={isMobileViewport ? 0 : 64}
      // Force-collapsed on the mobile persistent rail from the first client
      // paint (isMobileViewport is tearing-free via useSyncExternalStore), so
      // the rail never flashes open at 240px before the `breakpoint` callback
      // collapses it - the "sidebar opens then quickly closes" flick seen when
      // navigating back from an account page (which mounts a fresh layout with
      // collapsed=false). The drawer instance (mobileOpen) is exempt.
      collapsed={collapsed || (isMobileViewport && !mobileOpen)}
      onCollapse={onCollapse}
      aria-label={mobileOpen ? 'Mobile navigation menu' : 'Main navigation'}
      style={{
        // dvh (not vh) so the rail matches the visible viewport on mobile
        // browsers where the URL bar steals height. Inside the drawer the
        // sidebar is a normal block filling the drawer body.
        height: mobileOpen ? '100%' : '100dvh',
        position: mobileOpen ? 'relative' : 'sticky',
        top: 0,
        left: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--cr-surface)',
        borderRight: mobileOpen || railHidden ? 'none' : '1px solid var(--cr-border-light)',
        boxShadow: mobileOpen || railHidden ? 'none' : '2px 0 12px rgba(0,0,0,0.04)',
      }}
      className="cr-sidebar"
      // The breakpoint auto-collapse is for the persistent rail only - the
      // drawer instance must never collapse itself.
      breakpoint={mobileOpen ? undefined : 'md'}
      onBreakpoint={(broken) => {
        if (broken) onCollapse(true);
      }}
    >
      {/* Logo */}
      <div
        className={`flex h-16 items-center border-b border-border-light ${collapsed ? 'justify-center px-2' : 'justify-between px-4 py-3'}`}
      >
        <Link
          href="/dashboard"
          {...(collapsed ? { 'aria-label': 'ManekHR home' } : {})}
          className="group flex items-center gap-2.5 rounded-lg p-2 no-underline transition-all duration-200 hover:bg-neutral-100"
        >
          <img
            src="/manekhr-symbol.svg"
            width={32}
            height={32}
            alt="ManekHR"
            className="h-10 w-10 flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          {!collapsed && (
            <div className="flex min-w-0 flex-col items-start leading-tight">
              <img
                src="/manekhr-wordmark-on-light.svg"
                alt="ManekHR"
                className="h-6 w-auto flex-shrink-0"
              />
              {/* ERP-mode label under the wordmark - mirrors the Connect sidebar's
                  "Connect" tagline so both modes read symmetrically. Reuses the
                  ModeSwitcher i18n key (connectMode.switchErp) so the toggle and this
                  label share ONE source. ALIGNMENT: the column needs items-start -
                  otherwise its default align-items:stretch stretches the wordmark
                  image out to the width of this wider "ERP + plan pill" row, distorting
                  it and inflating its left padding so nothing lines up. At natural
                  width, the 7px inline padding below puts "ERP" under the wordmark's
                  visible "Z". The plan pill sits inline to its right so mode + plan
                  share one row inside the h-16 logo height. Keep items-start + the 7px
                  in sync with the Connect tagline. */}
              <div
                className="mt-0.5 flex min-w-0 items-center gap-1.5"
                style={{ paddingLeft: '7px' }}
              >
                <span className="flex-shrink-0 text-[11px] font-semibold tracking-wide text-primary">
                  {t('connectMode.switchErp')}
                </span>
                {subscription?.currentPeriodEnd && (
                  <Tooltip title={tooltipTitle} placement="right">
                    <span
                      className={`rounded-full px-2 py-0.5 ${badgeColor.bg} ${badgeColor.text} inline-flex max-w-[150px] items-center gap-1 overflow-hidden text-[10px] leading-none font-semibold`}
                      style={{
                        border: `1px solid ${isTrialStatus ? 'var(--cr-warning-500)' : 'var(--cr-gold-400)'}`,
                      }}
                    >
                      <CrownOutlined
                        className="flex-shrink-0 text-[10px]"
                        style={{
                          color: isTrialStatus ? 'var(--cr-warning-700)' : 'var(--cr-gold-700)',
                        }}
                      />
                      <span className="min-w-0 truncate">{planLabel}</span>
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
        </Link>
      </div>

      {/* Product switcher - ERP ⇄ Connect. Brand-adjacent (directly under
          the logo); collapses to an icon-only toggle on the 64px rail. */}
      <div
        className={`border-b border-border-light ${collapsed ? 'flex justify-center px-2 py-2' : 'px-3 py-2.5'}`}
      >
        <ModeSwitcher collapsed={collapsed} />
      </div>

      {/* Workspace switcher */}
      {currentWorkspace && (
        <div className={`border-b border-border-light ${collapsed ? 'px-0 py-2' : 'p-3'}`}>
          <Dropdown menu={{ items: wsMenuItems }} trigger={['click']} placement="bottomLeft">
            <Tooltip title={collapsed ? currentWorkspace.name : ''} placement="right">
              {collapsed ? (
                currentWorkspace.branding?.logo ? (
                  <div className="flex justify-center">
                    <img
                      src={currentWorkspace.branding.logo}
                      alt={currentWorkspace.name}
                      className="h-[36px] w-[36px] cursor-pointer rounded-[10px] object-cover transition-opacity hover:opacity-80"
                    />
                  </div>
                ) : (
                  <div
                    className="mx-auto flex h-[36px] w-[36px] cursor-pointer items-center justify-center rounded-[10px] text-sm font-bold text-white transition-opacity select-none hover:opacity-80"
                    style={{ background: 'var(--cr-grad-primary)' }}
                  >
                    {currentWorkspace.name.charAt(0).toUpperCase()}
                  </div>
                )
              ) : (
                <div
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-md px-2.5 py-2 transition-colors hover:bg-neutral-100"
                  style={{
                    background: 'var(--cr-surface)',
                    border: '1px solid var(--cr-border)',
                  }}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    {currentWorkspace.branding?.logo ? (
                      <img
                        src={currentWorkspace.branding.logo}
                        alt={currentWorkspace.name}
                        className="h-[26px] w-[26px] flex-shrink-0 rounded-[7px] object-cover"
                      />
                    ) : (
                      <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[7px] bg-primary-light">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--cr-primary)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </div>
                    )}
                    <span className="max-w-[120px] overflow-hidden text-xs font-semibold text-ellipsis whitespace-nowrap text-heading">
                      {currentWorkspace.name}
                    </span>
                  </div>
                  <SwapOutlined className="flex-shrink-0 text-[11px] text-subtle" />
                </div>
              )}
            </Tooltip>
          </Dropdown>
        </div>
      )}

      {/* Upgrade CTA - top-left area, between workspace switcher and nav.
          Hidden for top-tier plans (Business / Custom). Gold accent so it
          stands out gently without breaking the rail; collapses to an
          icon-only button on the 64px rail. Links to the in-app plans hub
          (same route as the trial banners + capped-report notice). */}
      {showUpgradeButton && (
        <div className={`border-b border-border-light ${collapsed ? 'px-0 py-2' : 'px-3 py-2.5'}`}>
          {collapsed ? (
            <Tooltip title={t('navigation.upgrade')} placement="right">
              <Link
                href="/account/subscription/plans"
                aria-label={t('navigation.upgrade')}
                className="mx-auto flex h-[36px] w-[36px] items-center justify-center rounded-[10px] no-underline transition-opacity hover:opacity-90"
                style={{
                  background: 'var(--cr-gold-100)',
                  border: '1px solid var(--cr-gold-400)',
                  color: 'var(--cr-gold-700)',
                }}
              >
                <CrownOutlined className="text-[15px]" />
              </Link>
            </Tooltip>
          ) : (
            <Link
              href="/account/subscription/plans"
              className="flex w-full items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-semibold no-underline transition-opacity hover:opacity-90"
              style={{
                background: 'var(--cr-gold-100)',
                border: '1px solid var(--cr-gold-400)',
                color: 'var(--cr-gold-700)',
              }}
            >
              <CrownOutlined className="text-[13px]" />
              <span>{t('navigation.upgrade')}</span>
            </Link>
          )}
        </div>
      )}

      {/* Main nav */}
      <div className="flex-1 overflow-auto py-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 py-1">
            {visibleCollapsedNavItems.map((item) => {
              const isMachinesSubmenu = item.submenuKind === 'machines';
              const isWorkspaceSubmenu = item.submenuKind === 'workspace';
              const isTimeAttendanceSubmenu = item.submenuKind === 'time-attendance';
              const isActive = isWorkspaceSubmenu
                ? isWorkspaceItemActive
                : isMachinesSubmenu
                  ? MACHINES_ITEM_KEYS.some((k) => pathname === k || pathname.startsWith(k))
                  : isTimeAttendanceSubmenu
                    ? isTimeAttendanceItemActive
                    : activeKey === item.key;
              const iconEl = (
                <div
                  className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-[10px] text-[17px] transition-colors"
                  style={{
                    background: isActive ? 'var(--cr-sidebar-active-bg)' : 'transparent',
                    color: isActive ? 'var(--cr-sidebar-active-fg)' : 'var(--cr-sidebar-fg)',
                  }}
                >
                  {item.icon}
                </div>
              );
              if (item.isSubmenu) {
                const popupItems = isMachinesSubmenu
                  ? visibleMachinesPopupItems
                  : isTimeAttendanceSubmenu
                    ? visibleTimeAttendancePopupItems
                    : visibleSubmenuPopupItems;
                return (
                  <Dropdown
                    key={item.key}
                    menu={{
                      items: popupItems,
                      selectedKeys: [activeKey],
                      onClick: ({ key }) => {
                        if (key === 'create-workspace') {
                          if (workspaceEnabled) {
                            router.push('/dashboard/workspace?action=create');
                          }
                          return;
                        }
                        if (typeof key === 'string' && key.startsWith('/')) {
                          router.push(key);
                        }
                      },
                    }}
                    trigger={['click']}
                    placement="bottomRight"
                    disabled={item.disabled}
                  >
                    <Tooltip title={item.label} placement="right">
                      <div
                        style={{
                          opacity: item.disabled ? 0.5 : 1,
                          cursor: item.disabled ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {iconEl}
                      </div>
                    </Tooltip>
                  </Dropdown>
                );
              }
              if (item.disabled) {
                return (
                  <Tooltip
                    key={item.key}
                    title={lockedTooltip(String(item.label))}
                    placement="right"
                  >
                    <div
                      className="flex h-[42px] w-[42px] cursor-not-allowed items-center justify-center rounded-[10px] text-[17px] transition-colors"
                      style={{
                        background: isActive ? 'var(--cr-primary-light)' : 'transparent',
                        color: isActive ? 'var(--cr-primary)' : 'var(--cr-text-3)',
                        opacity: 0.5,
                      }}
                    >
                      {item.icon}
                    </div>
                  </Tooltip>
                );
              }
              return (
                <Tooltip key={item.key} title={item.label} placement="right">
                  <Link href={item.key}>{iconEl}</Link>
                </Tooltip>
              );
            })}
          </div>
        ) : (
          <Menu
            mode="inline"
            selectedKeys={[activeKey]}
            openKeys={openKeys}
            onOpenChange={handleOpenChange}
            style={{ border: 'none', background: 'transparent' }}
            className="cr-sider-menu"
            items={visibleNavItems}
          />
        )}
      </div>

      {/* Connect nudge - compact dismissible invite to try Connect.
          Shown only when expanded (not the 64px collapsed rail) so it has
          enough width. i18n keys land in Wave C Task 5.
          Disabled for now per owner request (2026-06-24): re-enable by
          uncommenting the line below. */}
      {/* {!collapsed && <ConnectNudge />} */}
    </Sider>
  );
}
