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
  TranslationOutlined,
  CheckOutlined,
  FileDoneOutlined,
  ScheduleOutlined,
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
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import { App as AntdApp, Tag as AntdTag, Button as AntdButton } from 'antd';
// Disabled for now per owner request (2026-06-24); re-enable with the render site below.

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

/**
 * "Coming Soon" indicator for sidebar menu labels. Rendered instead of the
 * gold ProLockBadge crown when the locked module is platform-flagged coming
 * soon (subscription store comingSoonModules, admin-set) - the module isn't
 * for sale yet, so no premium/upgrade signalling. Same 18px pill anatomy as
 * ProLockBadge so locked rows keep one visual rhythm.
 */
function ComingSoonBadge() {
  return (
    <span
      className="inline-flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full"
      style={{
        background: 'var(--cr-surface-2)',
        border: '1px solid var(--cr-border)',
      }}
      aria-label="Coming soon"
    >
      <ClockCircleOutlined className="text-[10px]" style={{ color: 'var(--cr-text-4)' }} />
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

  const allItemKeys = [
    '/dashboard',
    '/dashboard/team',
    '/dashboard/attendance',
    '/dashboard/salary',
    ...WORKSPACE_ITEM_KEYS,
    ...TIME_ATTENDANCE_ITEM_KEYS,
  ];
  // Pick the LONGEST (most specific) matching key, not the first.
  const activeKey =
    allItemKeys
      .filter((k) => pathname === k || (k !== '/dashboard' && pathname.startsWith(k)))
      .sort((a, b) => b.length - a.length)[0] ?? '/dashboard';

  const isWorkspaceItemActive = WORKSPACE_ITEM_KEYS.some(
    (k) => pathname === k || pathname.startsWith(k),
  );

  const isTimeAttendanceItemActive = TIME_ATTENDANCE_ITEM_KEYS.some(
    (k) => pathname === k || pathname.startsWith(k),
  );

  // ---------------------------------------------------------------------------
  // Sidebar open-state (accordion). Only one top-level module opens at a time.
  const ROOT_SUBMENU_KEYS = ['time-attendance-submenu', 'workspace-submenu'];

  // Seed open-state from the active branch once (mount). Thereafter user clicks
  // drive it via handleOpenChange. We intentionally do NOT re-sync on every
  // navigation (would be a setState-in-effect, which this codebase lint-bans);
  // clicking a link keeps its own section open, which covers the common path.
  const [openKeys, setOpenKeys] = useState<string[]>(() => {
    const k: string[] = [];
    if (isWorkspaceItemActive) k.push('workspace-submenu');
    if (isTimeAttendanceItemActive) k.push('time-attendance-submenu');
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

  // Platform "Coming Soon" module flags (admin-set, fetched into the
  // subscription store by DashboardLayout bootstrap). A locked nav entry for a
  // flagged module swaps the premium crown + "premium plan" tooltip for the
  // ComingSoonBadge + "coming soon" tooltip - the module isn't for sale yet.
  // Keep in sync with FeatureGate/ModuleGate's isComingSoon branch.
  const { comingSoonModules } = useSubscriptionStore();
  const moduleComingSoon = (module?: string) =>
    !!module && (comingSoonModules || []).includes(module);
  const lockedBadge = (module?: string) =>
    moduleComingSoon(module) ? <ComingSoonBadge /> : <ProLockBadge />;
  const lockedTitle = (label: string, module?: string) =>
    moduleComingSoon(module)
      ? t('navigation.comingSoonTooltip', { label })
      : lockedTooltip(label);

  // Top-level locked entry (Team, Payroll, ...). Non-interactive;
  // the menu item itself is `disabled`. Optional `module` swaps the premium
  // treatment for the Coming Soon one when the module is flagged.
  const renderLockedTop = (label: string, module?: string) => (
    <Tooltip title={lockedTitle(label, module)} placement="right">
      <div className="flex w-full min-w-0 items-center gap-2">
        <span
          className="min-w-0 flex-1 truncate text-[13px] font-medium"
          style={{ color: 'var(--cr-neutral-300)' }}
        >
          {label}
        </span>
        {lockedBadge(module)}
      </div>
    </Tooltip>
  );

  // Locked submenu child (Attendance, Leave, Roles, ...). Non-interactive.
  const renderLockedSub = (label: string, module?: string) => (
    <Tooltip title={lockedTitle(label, module)} placement="right">
      <div className="flex w-full min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--cr-neutral-300)' }}>
          {label}
        </span>
        {lockedBadge(module)}
      </div>
    </Tooltip>
  );

  // Locked entry that stays navigable to a read-only/upgrade page (Tally Export,
  // FY Close, Portal Access, bulk production entry). Same muted+crown look as the
  // others, but wraps a Link so the click still lands somewhere useful.
  const renderLockedLink = (label: string, href: string, module?: string) => (
    <Tooltip title={lockedTitle(label, module)} placement="right">
      <Link href={href} className="flex w-full min-w-0 items-center gap-2 no-underline">
        <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--cr-neutral-300)' }}>
          {label}
        </span>
        {lockedBadge(module)}
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
        renderLockedTop(t('navigation.team'), 'team')
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
            renderLockedSub(t('navigation.attendance'), 'attendance')
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
            renderLockedSub(t('navigation.leave'), 'leave')
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
            renderLockedSub(t('navigation.shifts'), 'shifts')
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
            renderLockedSub(t('navigation.holidays'), 'holidays')
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
        renderLockedTop(t('navigation.payroll'), 'salary')
      ),
      disabled: !salaryEnabled,
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
            renderLockedSub(t('rbac.roles'), 'roles')
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
            renderLockedSub(t('workspace.settings'), 'settings')
          ),
          disabled: !workspaceVisible,
        },
        // Administration holds only Roles + Workspace Settings (Finance/
        // Machines settings sub-pages removed with those modules).
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
          {!attendanceEnabled && lockedBadge('attendance')}
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
          {!leaveEnabled && lockedBadge('leave')}
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
          {!shiftsEnabled && lockedBadge('shifts')}
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
          {!holidaysEnabled && lockedBadge('holidays')}
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
          {!workspaceEnabled && lockedBadge('settings')}
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
          {!rolesEnabled && lockedBadge('roles')}
        </span>
      ),
      disabled: !rolesEnabled,
    },
    // RBAC re-architecture §7 - "New Workspace" lives in the workspace
    // switcher, not the nav (see the expanded navItems note above).
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
              {/* "ERP" label under the wordmark + the plan pill. ALIGNMENT: the
                  column needs items-start - otherwise its default
                  align-items:stretch stretches the wordmark image out to the
                  width of this wider "ERP + plan pill" row, distorting it and
                  inflating its left padding so nothing lines up. At natural
                  width, the 7px inline padding below puts "ERP" under the
                  wordmark's visible "Z". The plan pill sits inline to its
                  right so the label + plan share one row inside the h-16 logo
                  height. Keep items-start + the 7px in sync if this changes. */}
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
              const isWorkspaceSubmenu = item.submenuKind === 'workspace';
              const isTimeAttendanceSubmenu = item.submenuKind === 'time-attendance';
              const isActive = isWorkspaceSubmenu
                ? isWorkspaceItemActive
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
                const popupItems = isTimeAttendanceSubmenu
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
