'use client';
import { useState, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  App as AntApp,
  Layout,
  Breadcrumb,
  Badge,
  Button,
  Dropdown,
  Drawer,
  Empty,
  Popconfirm,
  Tooltip,
} from 'antd';
import type { MenuProps } from 'antd';
import {
  ArrowLeftOutlined,
  BellOutlined,
  InboxOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  LogoutOutlined,
  SettingOutlined,
  CheckOutlined,
  DeleteOutlined,
  CrownOutlined,
  LockOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  DownOutlined,
  GlobalOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/lib/store';
import { useShellTitle } from '@/lib/shell-title';
import { useShellNotifications } from '@/lib/connect/NotificationProvider';
import type { NotificationItem } from '@/features/connect/notifications/notifications.actions';
import { HeaderRightActions } from '@/components/ui/HeaderRightActions';
import { FN_CHORDS, getModuleFromPath } from '@/lib/constants/keyboard-shortcuts.registry';
import ShortcutHint from '@/components/ui/ShortcutHint';
import { hasModuleGuide } from '@/lib/constants/module-guides';
import { pinApi, meApi } from '@/lib/api/modules';
import { useLogout } from '@/hooks/useLogout';
import { useBrowserPush } from '@/lib/push/useBrowserPush';
import { DsAvatar } from '@/components/ui';
import ModeSidebar, { type AppMode } from './ModeSidebar';
import ConnectSearchBar from '@/components/connect/ConnectSearchBar';
import ConnectMobileSearch from '@/components/connect/ConnectMobileSearch';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';
import { getLanguages, type Language } from '@/lib/actions/localization.actions';
dayjs.extend(relativeTime);

const { Header } = Layout;

// Breadcrumb labels: only TOP-LEVEL routes. Sub-paths inherit from the
// nearest ancestor here (used for the page <h1>) while breadcrumb segments
// still get their own humanized labels in the per-segment builder below.
const BREADCRUMB_MAP: Record<string, string> = {
  '/dashboard': 'navigation.dashboard',
  '/dashboard/team': 'navigation.team',
  '/dashboard/attendance': 'navigation.attendance',
  '/dashboard/salary': 'navigation.payroll',
  '/dashboard/shifts': 'navigation.shifts',
  '/dashboard/holidays': 'navigation.holidays',
  '/dashboard/bills': 'navigation.bills',
  '/dashboard/roles': 'navigation.roles',
  '/dashboard/settings': 'navigation.settings',
  '/dashboard/profile': 'navigation.profile',
  '/dashboard/workspace': 'navigation.workspace',
  '/dashboard/workspace/employee-code': 'navigation.employeeCodeSettings',
  '/account/subscription': 'subscription.title',
  '/dashboard/finance': 'navigation.billingAccounts',
  '/dashboard/machines': 'navigation.machines',
  '/dashboard/maintenance': 'navigation.machines',
  '/dashboard/production-utilisation': 'navigation.machines',
  '/dashboard/parties': 'navigation.parties',
  '/connect/feed': 'connectMode.pageTitle',
  '/connect/stores': 'connectMode.storesTitle',
  // The RFQ hub (`/connect/rfq` + its `<id>` detail via the ancestor walk).
  // Without this the resolver humanizes the route segment `rfq` -> "Rfq".
  // Label matches the sidebar item (connect.nav.rfq) so the two never disagree.
  '/connect/rfq': 'connectMode.rfqTitle',
  // Viewing another member's in-app profile (`/connect/u/<id>`). Without this
  // the title resolver humanizes the route segment `u` → "U". The `<id>` child
  // is dynamic (no static label), and the viewed person's name is not available
  // to this client-side header, so a stable "Profile" label is the right title
  // (mirrors how `/dashboard/team/<id>` shows "Member Detail", not the name).
  '/connect/u': 'connectMode.profileTitle',
  // Viewing a company page (`/connect/company/<slug>`). Without this the title
  // resolver humanizes the slug segment (e.g. `rajesh-mehta-textiles` ->
  // "Rajesh Mehta Textiles"), duplicating the name already shown on the page and
  // overflowing the bar for long names. A stable "Company" label is the right
  // title (mirrors `/connect/u` -> "Profile").
  '/connect/company': 'connectMode.companyTitle',
  // The owner's Company Pages hub (`/connect/pages`). Without this the resolver
  // humanizes the route segment `pages` -> "Pages", which reads as generic.
  // Reuse the existing hub label so the header says "Company pages".
  '/connect/pages': 'connect.companyPageAdmin.breadcrumbHub',
  // The create-page editor (`/connect/pages/new`). Without this it falls to the
  // `/connect/pages` ancestor ("Company pages") or humanizes "new" -> "New".
  '/connect/pages/new': 'connect.companyPageAdmin.createTitle',
};

// Category → route map. Phase 7a promoted `category` to a first-class
// field on the Notification schema, but legacy rows still carry it under
// `metadata.category` - we honour both. Returning `null` keeps the row
// clickable for mark-read without navigating.
function notificationHref(n: NotificationItem): string | null {
  const category = n.category ?? (n.metadata as { category?: string } | null | undefined)?.category;
  if (!category) return null;
  switch (category) {
    case 'INVITE_RECEIVED':
    case 'INVITE_ACCEPTED':
    // OQ-W6 - the auto-added consent notice deep-links to the invitations
    // surface, where the member can review the membership and self-serve Leave.
    case 'WORKSPACE_AUTO_ADDED':
      return '/dashboard/invitations';
    case 'connect.connection_requested':
      return '/connect/network?tab=invitations';
    case 'connect.connection_accepted':
    case 'connect.followed':
      return '/connect/network';
    case 'connect.post_reacted':
    case 'connect.post_commented':
    case 'connect.post_reposted':
    case 'connect.post_replied':
      // Land on the post-detail permalink when the post id is known; else feed.
      return n.entityId ? `/connect/posts/${n.entityId}` : '/connect/feed';
    case 'connect.inquiry_received': {
      // Deep-link to the conversation (thread id is on the dispatch metadata).
      const threadId = (n.metadata as { threadId?: string } | null)?.threadId;
      return threadId ? `/connect/inbox?thread=${threadId}` : '/connect/inbox?channel=inquiry';
    }
    case 'connect.page_followed':
      return n.entityId ? `/connect/pages/${n.entityId}` : '/connect/pages';
    case 'erp.leave_update': {
      // Leave/comp-off lifecycle (BE LeaveNotificationService) - the dispatch
      // metadata carries the absolute CTA URL; navigate to its path.
      const link = (n.metadata as { link?: string } | null)?.link;
      if (link) {
        try {
          return new URL(link).pathname;
        } catch {
          /* malformed - fall through to the leave hub */
        }
      }
      return '/dashboard/leave';
    }
    case 'erp.salary_update': {
      // Advance/loan request lifecycle (BE advance-salary-request +
      // loan-request services) - metadata.link is a RELATIVE path here.
      const link = (n.metadata as { link?: string } | null)?.link;
      return link && link.startsWith('/') ? link : '/dashboard/salary';
    }
    default:
      return null;
  }
}

// Title-case a route segment for fallback page titles when no
// BREADCRUMB_MAP entry exists. Strips dashes/underscores.
function humanizeSegment(seg: string): string {
  if (!seg) return '';
  return seg
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function TopHeader({
  collapsed,
  onToggle,
  mode = 'erp',
}: {
  collapsed: boolean;
  onToggle: () => void;
  mode?: AppMode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations();
  const shellTitleOverride = useShellTitle((s) => s.title);
  // Pillar 4 (auth-hardening): narrow selectors so the pin-touch heartbeat
  // (`unlockExpiresAt` updates ~every 20s) does not re-render the global header.
  // `setAppLocked` is a stable action ref.
  const user = useAuthStore((s) => s.user);
  const setAppLocked = useAuthStore((s) => s.setAppLocked);
  // Shared sign-out teardown (revoke session, clear state, hard-reload to /auth)
  // - the single correct logout path; see hooks/useLogout.ts.
  const handleLogout = useLogout();
  // Phase 7a - the bell reads shared notification state from
  // `NotificationProvider` (one socket + one source of truth for both
  // shells). The provider owns the connection, the unread count, the list,
  // and mark-read; TopHeader is a pure consumer now (no local poll / socket).
  //
  // "One engine, two inboxes": the provider holds BOTH products' rows, so the
  // bell is narrowed to the active shell's product - /connect/* → Connect,
  // account + ERP → ERP - so the Connect bell never shows ERP notifications
  // (and vice-versa). Counts + the mark/clear actions are product-scoped too.
  const shellProduct: 'connect' | 'erp' = mode === 'connect' ? 'connect' : 'erp';
  const {
    notifications,
    unseenCount,
    unreadCount,
    markAllSeen: markAllNotificationsSeenCtx,
    markRead: markNotificationRead,
    markAllRead: markAllNotificationsReadCtx,
    deleteOne: deleteNotificationCtx,
    clearAll: clearAllNotificationsCtx,
  } = useShellNotifications(shellProduct);
  const [mobileDrawer, setMobileDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  // P2.6 (2026-05-15) - invitations entry moved out of the sidebar into the
  // top-right action row alongside the bell. Mirrors GitHub / Linear /
  // Slack - invitation-class items belong adjacent to other notification-
  // class UI, not buried mid-sidebar. Loads on mount + refetches whenever
  // accept/decline elsewhere broadcasts `z360:invites-changed`.
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [currentLocale, setCurrentLocale] = useState<string>(() => {
    if (typeof document === 'undefined') return 'en';
    const match = document.cookie.match(/z360_locale=([^;]+)/);
    return match ? match[1] : 'en';
  });
  const [languages, setLanguages] = useState<Language[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fullscreen - sync local state with the actual Fullscreen API so the
  // toggle reflects ESC-key exits and OS-level changes, not just our clicks.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const sync = () => setIsFullscreen(!!document.fullscreenElement);
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // Unsupported (iOS Safari) or permission denied - swallow; the button
      // is already hidden on isMobile to avoid surfacing the failure path.
    }
  }, []);

  useEffect(() => {
    const loadLanguages = async () => {
      setLanguagesLoading(true);
      try {
        const langs = await getLanguages();
        setLanguages(langs);
      } catch {
        // silent fail - keep empty
      } finally {
        setLanguagesLoading(false);
      }
    };
    loadLanguages();
  }, []);

  const languageOptions = languages.map((lang) => ({
    value: lang.code,
    label: lang.name,
    example: lang.example,
  }));

  // P2.6 (2026-05-15) - pending invites count for the top-header inbox
  // button. Same `z360:invites-changed` event bus the Sidebar listens to;
  // every accept / decline / auto-accept call site already dispatches it.
  // ERP-only - gated out of the Connect shell (see the inbox-icon render).
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = () => {
      meApi
        .pendingInvites()
        .then((data) => {
          if (!cancelled) setPendingInvitesCount(Array.isArray(data) ? data.length : 0);
        })
        .catch(() => {
          // Silent - badge is a nice-to-have, not load-blocking.
        });
    };
    load();
    const onChanged = () => load();
    window.addEventListener('z360:invites-changed', onChanged);
    return () => {
      cancelled = true;
      window.removeEventListener('z360:invites-changed', onChanged);
    };
  }, [user]);

  // Bell mark-read - delegate to the provider (optimistic + server write).
  // Wrapped so the existing JSX call sites (`markRead(id)` / `markAllRead()`)
  // keep working unchanged.
  const markRead = markNotificationRead;
  const markAllRead = markAllNotificationsReadCtx;

  const segments = pathname.split('/').filter(Boolean);
  const isMongoId = (s: string) => /^[a-f0-9]{24}$/i.test(s);
  const DYNAMIC_SEGMENT_LABELS: Record<string, string> = {
    '/dashboard/team': 'Member Detail',
    '/dashboard/salary': 'Member Detail',
    '/dashboard/attendance': 'Detail',
  };
  // Finance URLs are firm-scoped (/dashboard/finance/firms/{firmId}/...) because a
  // firm is 1:1 with the workspace. That scoping is an implementation detail, not
  // user-meaningful, and it does not appear in the sidebar IA. Collapse the literal
  // "firms" segment and the {firmId} that follows so the breadcrumb mirrors the
  // sidebar (Billing & Accounts > Sales > Invoices) instead of showing the
  // confusing "Firms / Detail" links. Downstream hrefs keep the full path, so
  // every remaining crumb still navigates correctly.
  const financeFirmScoped =
    segments[0] === 'dashboard' && segments[1] === 'finance' && segments[2] === 'firms';
  const breadcrumbs = segments.reduce<Array<{ title: string; href?: string }>>((acc, seg, i) => {
    if (financeFirmScoped && (i === 2 || (i === 3 && isMongoId(seg)))) {
      return acc;
    }
    const path = '/' + segments.slice(0, i + 1).join('/');
    const key = BREADCRUMB_MAP[path];
    let label: string;
    if (key) {
      label = t(key as Parameters<typeof t>[0]);
    } else if (isMongoId(seg)) {
      const parentPath = '/' + segments.slice(0, i).join('/');
      label = DYNAMIC_SEGMENT_LABELS[parentPath] ?? 'Detail';
    } else {
      label = seg === 'dashboard' ? t('navigation.dashboard') : humanizeSegment(seg);
    }
    acc.push({ title: label, href: i < segments.length - 1 ? path : undefined });
    return acc;
  }, []);
  // Title resolution order:
  //   1. exact BREADCRUMB_MAP hit
  //   2. nearest ancestor in BREADCRUMB_MAP (walk up path)
  //   3. last non-id segment, humanized (e.g. /dashboard/foo/bar → "Bar")
  //   4. fall back to "Dashboard"
  const derivedTitle = (() => {
    if (BREADCRUMB_MAP[pathname]) {
      return t(BREADCRUMB_MAP[pathname] as Parameters<typeof t>[0]);
    }
    const segs = pathname.split('/').filter(Boolean);
    for (let i = segs.length - 1; i >= 0; i--) {
      const ancestor = '/' + segs.slice(0, i + 1).join('/');
      if (BREADCRUMB_MAP[ancestor]) {
        return t(BREADCRUMB_MAP[ancestor] as Parameters<typeof t>[0]);
      }
    }
    for (let i = segs.length - 1; i >= 0; i--) {
      const s = segs[i];
      if (!isMongoId(s) && s !== 'dashboard') return humanizeSegment(s);
    }
    return t('navigation.dashboard');
  })();
  // A page can override the title for a route the static map cannot name (e.g.
  // a storefront manage page showing the shop name). Falls back to derived.
  const currentTitle = shellTitleOverride ?? derivedTitle;

  // Sync document.title (browser tab) with currentTitle so every route shows
  // its own title even without a per-route metadata layout. Uses the same
  // template `%s | ManekHR` as `app/dashboard/layout.tsx`.
  //
  // Why dedupe: Next.js streams a layout-level <title> server-side ("Dashboard")
  // and our useEffect adds another. Browsers honor the FIRST <title> in <head>,
  // so the layout title wins unless we remove duplicates. We keep one element,
  // set its content, and re-run on every head mutation.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const desired = `${currentTitle} | ManekHR`;
    const apply = () => {
      const titles = Array.from(document.querySelectorAll('title'));
      if (titles.length === 0) {
        const t = document.createElement('title');
        t.textContent = desired;
        document.head.prepend(t);
        return;
      }
      // Keep the first, drop the rest, set content.
      for (let i = 1; i < titles.length; i++) titles[i].remove();
      if (titles[0].textContent !== desired) titles[0].textContent = desired;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [currentTitle]);

  // Remember the product page the user was on BEFORE entering the account
  // area, so the account Back button can jump straight there in one hop.
  //
  // Why not `document.referrer` + `router.back()`: referrer is the original
  // full-page-load referrer and does NOT change during client-side (SPA)
  // navigation, and `router.back()` only steps one history entry. Together
  // they made Back walk the account sub-pages (Profile -> Security -> ...)
  // instead of returning to the originating product page. We instead record
  // the last non-account / non-auth path here on every route change and push
  // to it on Back. `/account/*` and `/auth/*` are excluded so navigating
  // between account tabs never overwrites the stored product origin.
  // Cross-module: read by `handleAccountBack` below; persisted in
  // sessionStorage so it survives the layout remount when ERP/Connect ->
  // account swaps DashboardLayout instances.
  const ACCOUNT_RETURN_KEY = 'z360:account-return-to';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const p = pathname ?? '';
    if (p.startsWith('/account') || p.startsWith('/auth')) return;
    try {
      window.sessionStorage.setItem(ACCOUNT_RETURN_KEY, p + window.location.search);
    } catch {
      // sessionStorage unavailable (private mode quota) - Back still works via
      // the product-home fallback below.
    }
  }, [pathname]);

  /**
   * Account-mode back affordance.
   *
   * `/account/*` is product-neutral - no product sidebar mounts (see
   * `DashboardLayout.tsx`), so the standard collapse-toggle has nothing to
   * toggle. We swap it for a Back button (callers below) and route as
   * follows on click:
   *
   * 1. If a remembered product origin exists (recorded by the effect above
   *    while the user was last on a `/connect` or `/dashboard` page), push
   *    straight to it so the user lands exactly where they came from
   *    (e.g. mid-feed in `/connect/feed?postId=...`) in a single hop.
   * 2. Otherwise (fresh-tab open, deep-link from email, no prior product
   *    visit this session), fall back to the product home - `/connect/feed`
   *    for workspace-less Connect users; `/dashboard` for everyone else.
   *    Mirrors the `AuthClient.doRedirect` / `setup-pin#computePostPinTarget`
   *    policy.
   */
  const handleAccountBack = useCallback(() => {
    if (typeof window !== 'undefined') {
      let stored: string | null = null;
      try {
        stored = window.sessionStorage.getItem(ACCOUNT_RETURN_KEY);
      } catch {
        // Ignore - fall through to the deterministic product-home fallback.
      }
      // Guard against open-redirect / malformed values: only same-origin
      // relative paths ("/...", not "//host" protocol-relative) are honoured.
      if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
        router.push(stored);
        return;
      }
    }
    const target = user?.hasWorkspace === false ? '/connect/feed' : '/dashboard';
    router.push(target);
  }, [router, user?.hasWorkspace]);

  const handleLockNow = async () => {
    try {
      await pinApi.lock();
    } catch {
      // Lock locally even if backend write fails; the next API call will
      // 423 from the guard's lookup and re-converge state.
    }
    setAppLocked(true);
  };

  const handleLocaleChange = (locale: string) => {
    setCurrentLocale(locale);

    document.cookie = `z360_locale=${locale};path=/;max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
  };

  const userMenu: MenuProps['items'] = [
    {
      key: 'settings',
      label: t('navigation.settings'),
      icon: <SettingOutlined />,
      onClick: () => router.push('/account'),
    },
    {
      key: 'subscription',
      label: t('subscription.title'),
      icon: <CrownOutlined />,
      // Point at the product-neutral /account home (was /account/subscription,
      // which is ERP-gated and unreachable for Connect-only users). The old route
      // redirects here, so this stays consistent for ERP users too.
      onClick: () => router.push('/account/subscription'),
    },
    ...(user?.isAdmin
      ? [
          {
            key: 'admin',
            label: t('admin.title'),
            icon: <span className="text-warning">👑</span>,
            onClick: () => router.push('/admin'),
          },
        ]
      : []),
    // Language now has its own globe trigger in the top bar on ALL breakpoints
    // (see the language Dropdown below), so it no longer folds into this menu on
    // mobile - keeps language one tap away instead of buried in a submenu.
    { type: 'divider' as const },
    // Manual App Lock - ERP shell only. App Lock is an ERP-only protection, so
    // neither the Connect shell nor the product-neutral account area offers to
    // lock the session (mirrors DashboardLayout's `appLockEnabled = mode ===
    // 'erp'` gate + the backend PinUnlockGuard skip for both surfaces).
    ...(mode === 'erp'
      ? [
          {
            key: 'lockApp',
            label: (
              <span className="flex items-center justify-between gap-6">
                <span>{t('auth.appLock.topMenu.lockNow')}</span>
                <span className="text-[11px] font-medium text-faint">
                  {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
                    ? '⌘⇧L'
                    : 'Ctrl+Shift+L'}
                </span>
              </span>
            ),
            icon: <LockOutlined />,
            onClick: handleLockNow,
            disabled: !user?.hasPin,
          },
        ]
      : []),
    {
      key: 'logout',
      label: t('auth.logout'),
      icon: <LogoutOutlined style={{ color: 'var(--cr-error)' }} />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  // Browser-push opt-in state for the bell. `needsPush` (push supported but
  // permission not yet 'granted') drives BOTH a gold dot on the bell and an
  // "Enable" prompt inside the dropdown, so the user is nudged to turn on
  // notifications until they accept. Shared lifecycle with EnablePushBanner /
  // PreferencesDrawer via useBrowserPush. When 'denied' the native prompt can't
  // re-open, so we show the "blocked - unblock in browser settings" hint instead
  // of an Enable button.
  const { message: pushMessage } = AntApp.useApp();
  const {
    supported: pushSupported,
    permission: pushPermission,
    enable: enablePush,
    busy: pushBusy,
  } = useBrowserPush();
  const needsPush = pushSupported && pushPermission !== 'granted';
  const handleEnablePush = async () => {
    if (pushPermission === 'denied') return;
    // enable() reports which step failed (permission/token/register/prefs);
    // show the matching push.errors.* message. Cross-link: useBrowserPush
    // EnableResult.
    const res = await enablePush();
    if (res.ok) pushMessage.success(t('push.enabled'));
    else pushMessage.error(t(`push.errors.${res.reason ?? 'token'}`));
  };

  const notifPanel = (
    // `cr-notif-panel` + the `z360-notif-dropdown` root class (on the Dropdown
    // below) let globals.css turn this into a near-full-width sheet on phones.
    // A fixed 340px bubble anchored bottomRight overflowed the left edge on
    // narrow screens (the bell sits ~64px from the viewport right, so 340px
    // right-aligned spilled off-screen left). See the @media rule in globals.css.
    <div className="cr-notif-panel w-[340px] overflow-hidden rounded-lg border border-border-light bg-surface shadow-lg">
      <div className="flex items-center justify-between border-b border-border-light px-4 py-3.5">
        <span className="cr-heading text-[15px]">
          {t('notifications.title')}{' '}
          {unreadCount > 0 && (
            <Badge count={unreadCount} color="var(--cr-primary)" className="ml-1.5" />
          )}
        </span>
        {notifications.length > 0 && (
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                type="link"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => markAllRead()}
                className="p-0 text-xs"
              >
                {t('common.done')}
              </Button>
            )}
            <Popconfirm
              title={t('notifications.clearAllConfirm')}
              okText={t('common.clear')}
              cancelText={t('common.cancel')}
              okButtonProps={{ danger: true }}
              onConfirm={() => clearAllNotificationsCtx()}
            >
              <Button type="link" size="small" danger className="p-0 text-xs">
                {t('notifications.clearAll')}
              </Button>
            </Popconfirm>
          </div>
        )}
      </div>
      {/* Enable-push prompt - shown until the user grants browser notification
          permission. 'default' -> an Enable button fires the native prompt;
          'denied' -> the browser blocked it (JS can't re-prompt), so show the
          unblock-in-settings hint instead. Mirrors EnablePushBanner's enable(). */}
      {needsPush && (
        <div
          className="flex items-start gap-2.5 border-b border-border-light px-4 py-3"
          style={{ background: 'var(--cr-indigo-50)' }}
        >
          <BellOutlined className="mt-0.5 text-[15px]" style={{ color: 'var(--cr-primary)' }} />
          <div className="min-w-0 flex-1">
            <p className="m-0 text-[13px] font-semibold text-heading">{t('push.bannerTitle')}</p>
            <p className="m-0 mt-0.5 text-[12px] text-muted">
              {pushPermission === 'denied' ? t('push.blocked') : t('push.bannerBody')}
            </p>
            {pushPermission !== 'denied' && (
              <Button
                type="primary"
                size="small"
                loading={pushBusy}
                onClick={handleEnablePush}
                className="mt-2"
              >
                {t('push.enable')}
              </Button>
            )}
          </div>
        </div>
      )}
      <div className="max-h-[380px] overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-8">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <span className="text-[13px] text-subtle">{t('notifications.empty')}</span>
              }
            />
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n._id}
              onClick={() => {
                markRead(n._id);
                const href = notificationHref(n);
                if (href) {
                  setNotifOpen(false);
                  router.push(href);
                }
              }}
              className={`flex cursor-pointer items-start gap-2.5 border-b border-border-light px-4 py-3 transition-colors hover:bg-surface-2 ${n.isRead ? 'bg-surface' : 'bg-primary-light'}`}
            >
              <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
              <div className="min-w-0 flex-1">
                <p className="m-0 mb-0.5 overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap text-heading">
                  {n.title}
                </p>
                <p className="m-0 mb-1 text-xs leading-snug text-muted">{n.message}</p>
                <p className="m-0 text-[11px] text-subtle">{dayjs(n.createdAt).fromNow()}</p>
              </div>
              <Tooltip title={t('common.delete')}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotificationCtx(n._id);
                  }}
                  aria-label={t('common.delete')}
                  className="flex-shrink-0 cursor-pointer border-none bg-transparent p-0.5 text-faint transition-colors hover:text-error"
                >
                  <DeleteOutlined className="text-xs" />
                </button>
              </Tooltip>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <>
      <Header className="sticky top-0 z-[var(--z-header)] border-b border-border-light bg-surface/90 p-0 backdrop-blur-md supports-[backdrop-filter]:bg-surface/75">
        {/* Desktop (md+) header is a 3-column grid: [left chunk] [search] [right
            chunk]. The center column caps at 420px (search width) and is
            flanked by 1fr tracks left and right so the search sits at the
            visual horizontal center of the viewport - not pushed off-center by
            a long page title. Mobile drops to a 2-child flex justify-between
            (search hidden on narrow viewports) so the title + controls just
            anchor opposite ends. */}
        <div className="flex h-16 items-center justify-between gap-2 px-4 md:grid md:grid-cols-[1fr_minmax(0,420px)_1fr] md:px-lg">
          <div className="flex min-w-0 items-center gap-2 md:gap-3">
            {mode === 'account' ? (
              // Account mode is product-neutral - no product sidebar mounts
              // (ModeSidebar returns null for account), so neither the
              // desktop collapse-toggle nor the mobile drawer hamburger has
              // anything to act on - on mobile the drawer opened EMPTY. This
              // branch is checked BEFORE `isMobile` so the Back affordance
              // shows on BOTH viewports, routing the user back to their
              // product. See `handleAccountBack` above for the routing rules.
              <Tooltip
                title={t(
                  user?.hasWorkspace === false
                    ? 'navigation.backToConnect'
                    : 'navigation.backToWorkspace',
                )}
                placement="bottom"
              >
                <button
                  onClick={handleAccountBack}
                  aria-label={t(
                    user?.hasWorkspace === false
                      ? 'navigation.backToConnect'
                      : 'navigation.backToWorkspace',
                  )}
                  className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
                >
                  <ArrowLeftOutlined className="text-[15px]" />
                </button>
              </Tooltip>
            ) : isMobile ? (
              <button
                onClick={() => setMobileDrawer(true)}
                aria-label="Open navigation menu"
                className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
              >
                <MenuUnfoldOutlined className="text-[15px]" />
              </button>
            ) : (
              <Tooltip
                title={
                  <span className="inline-flex items-center gap-1.5">
                    {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    <ShortcutHint keys={FN_CHORDS.toggleSidebar} />
                  </span>
                }
                placement="bottom"
              >
                <button
                  onClick={onToggle}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  data-shortcut="sidebar-toggle"
                  className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
                >
                  {collapsed ? (
                    <MenuUnfoldOutlined className="text-[15px]" />
                  ) : (
                    <MenuFoldOutlined className="text-[15px]" />
                  )}
                </button>
              </Tooltip>
            )}
            {/* Page name anchors the left edge. The product switcher
                (ERP ⇄ Connect) now lives in the sidebar header with the
                ManekHR brand. H2: shell-level label; per-page content owns H1. */}
            <h2 className="page-header m-0 min-w-0 truncate text-base font-semibold md:text-lg">
              {currentTitle}
            </h2>
          </div>

          {/* Connect global search - desktop top bar (design-decisions doc §13).
              Lives in its OWN grid column so it sits at viewport-center on md+.
              Hidden on mobile (where the page would crowd it). ERP mode renders
              a 0-width placeholder so the 3-column grid still has three
              children and the right chunk stays flush-right. */}
          {mode === 'connect' ? (
            <div className="hidden w-full md:flex md:items-center md:justify-center">
              <ConnectSearchBar className="w-full" />
            </div>
          ) : (
            <div className="hidden md:block" aria-hidden />
          )}

          <div className="flex flex-shrink-0 items-center gap-2 md:justify-end">
            {/* Mobile Connect search - the desktop bar is hidden below md, so
                a search affordance lives here (design-decisions doc §6.4) and
                opens the full-screen ConnectMobileSearch sheet. */}
            {mode === 'connect' && (
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                aria-label={t('connect.shell.searchAriaLabel')}
                className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:hidden"
              >
                <SearchOutlined className="text-[15px]" />
              </button>
            )}
            {/* Language picker - icon-only globe Dropdown, shown on ALL
                breakpoints so mobile gets a one-tap quick language switch (it
                used to be buried in the avatar menu's submenu). */}
            <Dropdown
              menu={{
                items: languageOptions.map((opt) => ({
                  key: `lang-${opt.value}`,
                  label: (
                    <div className="flex items-center gap-3 py-0.5">
                      {opt.value === currentLocale ? (
                        <CheckOutlined className="text-[12px] text-primary" />
                      ) : (
                        <span className="inline-block w-[12px]" />
                      )}
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="font-medium">{opt.label}</span>
                        {opt.example && (
                          <span className="text-[11px] text-faint italic">{opt.example}</span>
                        )}
                      </span>
                    </div>
                  ),
                  onClick: () => handleLocaleChange(opt.value),
                })),
              }}
              trigger={['click']}
              placement="bottomRight"
              disabled={languagesLoading || languageOptions.length === 0}
            >
              <Tooltip title={t('profile.language')} placement="bottom">
                <button
                  type="button"
                  aria-label={t('profile.language')}
                  aria-haspopup="menu"
                  className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
                >
                  <GlobalOutlined className="text-[15px]" />
                </button>
              </Tooltip>
            </Dropdown>
            {/* Fullscreen toggle. Lives next to the language / bell cluster
                - owner-requested top-bar presence (earlier folded into the
                account menu and missed). Desktop only - the Fullscreen API
                is rarely useful on mobile browsers. */}
            {!isMobile && (
              <Tooltip
                title={
                  <span className="flex items-center gap-2">
                    <span>
                      {isFullscreen ? t('common.exitFullscreen') : t('common.enterFullscreen')}
                    </span>
                    <span className="rounded border border-white/20 px-1 text-[10px] font-medium opacity-80">
                      {typeof navigator !== 'undefined' &&
                      /Mac|iPhone|iPad/.test(navigator.platform)
                        ? '⌘⇧F'
                        : 'Ctrl+Shift+F'}
                    </span>
                  </span>
                }
                placement="bottom"
              >
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  data-shortcut="fullscreen-toggle"
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={isFullscreen}
                  className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
                >
                  {isFullscreen ? (
                    <FullscreenExitOutlined className="text-[15px]" />
                  ) : (
                    <FullscreenOutlined className="text-[15px]" />
                  )}
                </button>
              </Tooltip>
            )}
            {/* ERP workspace-invitations inbox → `/dashboard/invitations`.
                This is an ERP-product surface; hidden in the Connect shell
                (Connect surfaces connection requests via the sidebar Network
                badge + the bell). Phase 7a - fixes the cross-product leak. */}
            {mode !== 'connect' && (
              <Tooltip
                title={
                  pendingInvitesCount > 0
                    ? t('navigation.invitations') + ' (' + pendingInvitesCount + ')'
                    : t('navigation.invitations')
                }
              >
                <Badge count={pendingInvitesCount} size="small" overflowCount={9}>
                  <button
                    type="button"
                    aria-label={
                      pendingInvitesCount > 0
                        ? `${t('navigation.invitations')} (${pendingInvitesCount} pending)`
                        : t('navigation.invitations')
                    }
                    onClick={() => router.push('/dashboard/invitations')}
                    className="hover:bg-surface-3 flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
                  >
                    <InboxOutlined className="text-[15px]" />
                  </button>
                </Badge>
              </Tooltip>
            )}
            <Dropdown
              open={notifOpen}
              onOpenChange={(v) => {
                setNotifOpen(v);
                // Opening the bell marks everything SEEN - the red badge
                // clears immediately, but rows stay bold-unread until clicked
                // (LinkedIn/GitHub two-state). Per-row read happens on click.
                if (v) void markAllNotificationsSeenCtx();
              }}
              popupRender={() => notifPanel}
              trigger={['click']}
              placement="bottomRight"
              rootClassName="z360-notif-dropdown"
            >
              <Badge count={unseenCount} size="small" overflowCount={9}>
                <button
                  aria-label={
                    unseenCount > 0 ? `Notifications (${unseenCount} new)` : 'Notifications'
                  }
                  className="hover:bg-surface-3 relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-border-light bg-surface-2 text-muted transition-colors hover:border-border hover:text-heading md:h-9 md:w-9"
                >
                  <BellOutlined className="text-[15px]" />
                  {/* Gold "turn on notifications" dot - shown until push is
                      granted, and only when there's no unread count (which owns
                      the red badge) so the two never collide. The in-dropdown
                      Enable prompt shows regardless of unread count. */}
                  {needsPush && unseenCount === 0 && (
                    <span
                      aria-hidden
                      className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full"
                      style={{ background: 'var(--cr-gold)' }}
                    />
                  )}
                </button>
              </Badge>
            </Dropdown>
            <Dropdown
              menu={{ items: userMenu }}
              trigger={['click']}
              placement="bottomRight"
              open={userMenuOpen}
              onOpenChange={setUserMenuOpen}
            >
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={`Account menu for ${user?.name ?? 'user'}`}
                className={`flex h-10 cursor-pointer items-center gap-2 rounded-md border px-1.5 transition-all md:h-9 ${
                  userMenuOpen
                    ? 'bg-surface-3 border-primary-border shadow-sm'
                    : 'hover:bg-surface-3 border-border-light bg-surface-2 hover:border-border'
                }`}
              >
                <DsAvatar name={user?.name ?? ''} size={26} />
                {!isMobile && (
                  <>
                    <span className="flex max-w-[160px] items-center gap-1 truncate text-[13px] font-semibold text-heading">
                      <span className="truncate">{user?.name}</span>
                      {user?.isAdmin && (
                        <CrownOutlined className="text-[10px] text-warning" aria-label="Admin" />
                      )}
                    </span>
                    <DownOutlined
                      className={`text-[9px] text-faint transition-transform duration-200 ${
                        userMenuOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </Dropdown>
          </div>
        </div>

        {breadcrumbs.length >= 1 &&
          pathname !== '/dashboard' &&
          !pathname.startsWith('/connect') && (
            <div className="border-t border-border-light bg-surface-2/60 py-1.5">
              <div className="flex items-center justify-between gap-3 px-4 md:px-lg">
                {/* Breadcrumb scrolls horizontally rather than wrapping/overflowing
                  on narrow screens; the actions stay pinned right. */}
                <div className="min-w-0 flex-1 overflow-x-auto">
                  <Breadcrumb
                    aria-label="Page breadcrumb"
                    // [&_ol]:flex-nowrap overrides AntD Breadcrumb's internal
                    // flex-wrap so a long trail scrolls (parent is overflow-x-auto)
                    // instead of wrapping to multiple cramped lines on mobile.
                    className="whitespace-nowrap [&_ol]:flex-nowrap"
                    items={breadcrumbs.map((b) => ({
                      key: b.href || b.title,
                      title: b.href ? (
                        <Link
                          href={b.href}
                          className="text-xs text-body transition-colors hover:text-heading"
                        >
                          {b.title}
                        </Link>
                      ) : (
                        <span className="text-xs font-medium text-body">{b.title}</span>
                      ),
                    }))}
                  />
                </div>
                <div className="flex-shrink-0">
                  <HeaderRightActions
                    module={getModuleFromPath(pathname)}
                    pageLabel={currentTitle}
                    hide={{ guide: !hasModuleGuide(getModuleFromPath(pathname)) }}
                  />
                </div>
              </div>
            </div>
          )}
      </Header>

      <Drawer
        open={mobileDrawer}
        onClose={() => setMobileDrawer(false)}
        placement="left"
        aria-label="Navigation menu"
        rootClassName="nav-drawer"
        styles={{
          body: { padding: 0 },
          header: { display: 'none' },
          wrapper: { width: '85vw', maxWidth: 320 },
        }}
      >
        {/* The mobile sidebar renders an antd <Sider>. A bare <Sider> here
            would register - via antd's Layout React context, which flows
            through the Drawer portal - with the PAGE's inner <Layout> that
            wraps this TopHeader. That flips the page Layout to
            `ant-layout-has-sider` (flex-direction: row), stretching the page
            <Header> to full document height and overflowing the page
            horizontally whenever the drawer is open. Wrapping in a dedicated
            <Layout> scopes the Sider registration here, leaving the page
            layout untouched. */}
        <Layout style={{ height: '100%' }}>
          <ModeSidebar
            mode={mode}
            collapsed={false}
            onCollapse={() => {}}
            mobileOpen={mobileDrawer}
            onMobileClose={() => setMobileDrawer(false)}
          />
        </Layout>
      </Drawer>

      {/* Full-screen mobile search sheet (design-decisions doc §6.4). Connect
          mode only; self-hides below its own `md:hidden` + the `open` gate. */}
      {mode === 'connect' && (
        <ConnectMobileSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
    </>
  );
}
