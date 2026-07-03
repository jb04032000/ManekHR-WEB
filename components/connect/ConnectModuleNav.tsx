'use client';

/**
 * ConnectModuleNav - the Connect-mode desktop sidebar.
 *
 * Replaces the placeholder `ConnectSidebar`. Mirrors the ERP `Sidebar` shell
 * (same `<Sider>` sizing, `.cr-sidebar` styling, logo header, ModeSwitcher) so
 * the two product modes feel like one app. Module items are gated by
 * `isConnectModuleEnabled` - a module not yet reached by the deploy's phase
 * renders disabled ("coming soon"), so the shell always looks complete.
 */

import { useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge, Layout, Menu, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  HomeOutlined,
  TeamOutlined,
  ShopOutlined,
  SolutionOutlined,
  BankOutlined,
  InboxOutlined,
  BellOutlined,
  UserOutlined,
  ThunderboltOutlined,
  IdcardOutlined,
  ProfileOutlined,
  RocketOutlined,
  GiftOutlined,
  UsergroupAddOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import ModeSwitcher from '@/components/layout/ModeSwitcher';
import KeyboardShortcutsDrawer from '@/components/ui/KeyboardShortcutsDrawer';
import ShortcutHint from '@/components/ui/ShortcutHint';
import {
  getChordKeysForPath,
  SHORTCUTS_OPEN_EVENT,
} from '@/lib/constants/keyboard-shortcuts.registry';
import { isConnectModuleEnabled, type ConnectModule } from '@/lib/connect/flags';
import { useNetworkBadge } from '@/features/connect/network/useNetworkBadge';
import { useInboxBadge } from '@/features/connect/inbox/useInboxBadge';
import { useShellNotifications } from '@/lib/connect/NotificationProvider';
// Referral program kill switch - nav item is dark when REFERRAL_ENABLED=false.
// Cross-module: features/connect/referrals/referral-gate.ts. Watch: flip to
// true AFTER legal sign-off + smoke tests, never before.
import { REFERRAL_ENABLED } from '@/features/connect/referrals/referral-gate';

const { Sider } = Layout;

const MOBILE_VIEWPORT_QUERY = '(max-width: 767.98px)';
function subscribeMobileViewport(notify: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const mq = window.matchMedia(MOBILE_VIEWPORT_QUERY);
  mq.addEventListener('change', notify);
  return () => mq.removeEventListener('change', notify);
}
function getMobileViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

interface NavSpec {
  /** Key under the `connect.nav` i18n namespace. */
  key: string;
  href: string;
  icon: ReactNode;
  /** Connect module this item is gated by. */
  gate: ConnectModule;
}

const MAIN_NAV: NavSpec[] = [
  { key: 'feed', href: '/connect/feed', icon: <HomeOutlined />, gate: 'feed' },
  { key: 'network', href: '/connect/network', icon: <TeamOutlined />, gate: 'network' },
  {
    key: 'marketplace',
    href: '/connect/marketplace',
    icon: <ShopOutlined />,
    gate: 'marketplace',
  },
  { key: 'jobs', href: '/connect/jobs', icon: <SolutionOutlined />, gate: 'jobs' },
  // Companies directory hidden for now -- route still exists but redirects; remove this comment to re-enable
  // { key: 'companies', href: '/connect/companies', icon: <BankOutlined />, gate: 'companies' },
  { key: 'inbox', href: '/connect/inbox', icon: <InboxOutlined />, gate: 'inbox' },
  {
    key: 'notifications',
    href: '/connect/notifications',
    icon: <BellOutlined />,
    gate: 'notifications',
  },
];

// The owner's own selling surfaces. Gated under `marketplace` (phase 4) so they
// go live with the marketplace itself; they are all built and reachable. (The
// company *directory* / jobs / inbox modules ship later under their own gates.)
const BUSINESS_NAV: NavSpec[] = [
  { key: 'pages', href: '/connect/pages', icon: <IdcardOutlined />, gate: 'marketplace' },
  { key: 'stores', href: '/connect/stores', icon: <ShopOutlined />, gate: 'marketplace' },
  // Products live INSIDE a storefront (Storefronts -> a shop -> Products) and
  // inquiries live in the Inbox (the unified hub's Inquiries channel) - neither
  // is a separate item here. RFQs remain a cross-shop seller surface.
  { key: 'rfq', href: '/connect/rfq', icon: <ProfileOutlined />, gate: 'marketplace' },
  { key: 'boosts', href: '/connect/boosts', icon: <RocketOutlined />, gate: 'marketplace' },
];

// Base PRESENCE_NAV items always shown.
// Introductions (broker-mediated, anti-gaming core) lives here: visible to ALL
// signed-in users (the to-confirm queue is for everyone; only the Introduce
// trigger inside the page is broker-gated). Gated by `profile` so it is always
// live once Connect is on, like My Profile. Cross-module:
// app/connect/introductions/page.tsx + features/connect/introductions/*.
const PRESENCE_NAV: NavSpec[] = [
  { key: 'profile', href: '/connect/profile', icon: <UserOutlined />, gate: 'profile' },
  {
    key: 'introductions',
    href: '/connect/introductions',
    icon: <UsergroupAddOutlined />,
    gate: 'profile',
  },
];

// "Refer & earn" item injected only when the referral program is live.
// Key `connect.referrals.nav.referrals` is added by Phase 9 i18n pass.
// Cross-module: referral-gate.ts (kill switch) / app/connect/referrals/page.tsx.
// Watch: keep gate here so zero referral UI leaks when REFERRAL_ENABLED=false.
const REFERRAL_NAV_ITEM: NavSpec = {
  key: 'referrals',
  href: '/connect/referrals',
  icon: <GiftOutlined />,
  gate: 'profile', // same phase-gate as profile (always live once Connect is on)
};

interface ConnectModuleNavProps {
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function ConnectModuleNav({
  collapsed,
  onCollapse,
  mobileOpen,
  onMobileClose,
}: ConnectModuleNavProps) {
  const t = useTranslations('connect');
  const tNetwork = useTranslations('connect.network');
  const pathname = usePathname();
  const isMobileViewport = useSyncExternalStore(
    subscribeMobileViewport,
    getMobileViewport,
    () => false,
  );
  // Pending connection-request count - drives the "My Network" badge so a
  // member sees waiting invitations without opening the screen.
  const pendingRequests = useNetworkBadge();
  // Unread message count -- rides the global notifications socket, no 2nd socket.
  const inboxUnread = useInboxBadge();
  // Unseen Connect notifications -- lights the sidebar bell badge so a new job
  // application (and every other connect.* event) is visible without first
  // opening the top-header bell. Connect-scoped (one engine, two inboxes), so it
  // never reflects ERP notifications. Source: NotificationProvider unseenCount.
  const { unseenCount: notificationsUnseen } = useShellNotifications('connect');

  // Shared per-item computed bits, used by BOTH the expanded Menu item and the
  // collapsed icon rail so the badge + chord tooltip stay identical across rail
  // states (network/inbox/notifications counts; chord teaches the shortcut).
  const getItemMeta = (spec: NavSpec) => {
    const enabled = isConnectModuleEnabled(spec.gate);
    const label = t(`nav.${spec.key}` as Parameters<typeof t>[0]);
    // Network carries a pending-invitations count; Inbox an unread-message count;
    // Notifications the unseen bell count.
    const badgeCount =
      spec.key === 'network'
        ? pendingRequests
        : spec.key === 'inbox'
          ? inboxUnread
          : spec.key === 'notifications'
            ? notificationsUnseen
            : 0;
    const badgeAria =
      spec.key === 'inbox'
        ? t('nav.inboxUnreadAria', { count: badgeCount })
        : tNetwork('navBadgeAria', { count: badgeCount });
    const showBadge = enabled && badgeCount > 0;
    // Chord bound to this nav target on the Connect surface (e.g. `g>f` for
    // /connect/feed). Passing 'connect' stops the cross-product switcher `g>c`
    // (inert on /connect/*) from shadowing the real chord. `undefined` when no
    // chord is pressable here.
    const chord = getChordKeysForPath(spec.href, 'connect');
    return { enabled, label, badgeCount, badgeAria, showBadge, chord };
  };

  // Expanded Menu item. The collapsed state renders a separate icon rail (see
  // buildCollapsedRailItem) because AntD's `inlineCollapsed` mode hides this
  // in-label <Link> (so the icon click was dead) and swaps our chord tooltip
  // for a plain label one. Keep the two in sync.
  const buildItem = (spec: NavSpec): NonNullable<MenuProps['items']>[number] => {
    const { enabled, label, badgeCount, badgeAria, showBadge, chord } = getItemMeta(spec);
    const linkNode = (
      <Link
        href={spec.href}
        onClick={onMobileClose}
        className="flex items-center gap-2 text-[13px] font-medium no-underline"
      >
        <span>{label}</span>
        {showBadge && <Badge count={badgeCount} overflowCount={99} aria-label={badgeAria} />}
      </Link>
    );
    const enabledLabel = chord ? (
      <Tooltip
        title={
          <span className="inline-flex items-center gap-1.5">
            {label}
            <ShortcutHint keys={chord} />
          </span>
        }
        placement="right"
      >
        {linkNode}
      </Tooltip>
    ) : (
      linkNode
    );
    return {
      key: spec.href,
      // Collapsed rail shows icons only - surface the count as a dot on the
      // icon so the signal survives the collapse.
      icon: showBadge ? (
        <Badge dot offset={[2, -2]} aria-hidden>
          {spec.icon}
        </Badge>
      ) : (
        spec.icon
      ),
      disabled: !enabled,
      label: enabled ? enabledLabel : <span className="text-[13px] font-medium">{label}</span>,
    };
  };

  // The business group only appears once at least one of its surfaces is live,
  // so a deploy that has not reached the marketplace phase shows no empty group.
  const businessEnabled = BUSINESS_NAV.some((s) => isConnectModuleEnabled(s.gate));

  // Merged PRESENCE group: base items + referral entry when program is live.
  // The referral item sits after "My Profile" so it's always the last item
  // in the sidebar (lowest visual priority, gated dark by default).
  const presenceNavItems = [...PRESENCE_NAV, ...(REFERRAL_ENABLED ? [REFERRAL_NAV_ITEM] : [])];

  // Expanded Menu items - labelled groups. The collapsed (64px) state renders a
  // hand-rolled icon rail below (not this Menu), so there is no icon-only items
  // variant here.
  const expandedItems: MenuProps['items'] = [
    ...MAIN_NAV.map(buildItem),
    ...(businessEnabled
      ? [
          {
            type: 'group' as const,
            label: t('nav.businessGroup'),
            children: BUSINESS_NAV.map(buildItem),
          },
        ]
      : []),
    {
      type: 'group' as const,
      label: t('nav.presenceGroup'),
      children: presenceNavItems.map(buildItem),
    },
  ];

  // Longest-prefix match so a nested route (e.g. /connect/profile/edit)
  // selects its parent item rather than a shorter-prefix sibling.
  const selectedKey =
    [...MAIN_NAV, ...BUSINESS_NAV, ...presenceNavItems]
      .map((s) => s.href)
      .filter((href) => pathname === href || pathname?.startsWith(`${href}/`))
      .sort((a, b) => b.length - a.length)[0] ?? '';

  // Collapsed (64px) icon-rail item. Mirrors the ERP Sidebar's hand-rolled
  // collapsed rail: the ICON itself is the <Link> (so a click navigates) and
  // our own <Tooltip> (label + chord hint) wraps it. AntD `inlineCollapsed`
  // Menu is NOT used here because it hides the in-label link (dead icon clicks)
  // and replaces the chord tooltip with a plain label. Keep in sync with
  // buildItem (expanded) above. Active styling uses the same --cr-sidebar-*
  // tokens as the expanded .cr-sider-menu so the highlight matches.
  const buildCollapsedRailItem = (spec: NavSpec): ReactNode => {
    const { enabled, label, badgeAria, showBadge, chord } = getItemMeta(spec);
    const isActive = selectedKey === spec.href;
    if (!enabled) {
      // Coming-soon module: muted, non-clickable, label-only tooltip.
      return (
        <Tooltip key={spec.href} title={label} placement="right">
          <div
            className="flex h-[42px] w-[42px] cursor-not-allowed items-center justify-center rounded-[10px] text-[17px]"
            style={{ color: 'var(--cr-sidebar-fg)', opacity: 0.45 }}
            aria-disabled
          >
            {spec.icon}
          </div>
        </Tooltip>
      );
    }
    const iconEl = (
      <div
        className="flex h-[42px] w-[42px] items-center justify-center rounded-[10px] text-[17px] transition-colors"
        style={{
          background: isActive ? 'var(--cr-sidebar-active-bg)' : 'transparent',
          color: isActive ? 'var(--cr-sidebar-active-fg)' : 'var(--cr-sidebar-fg)',
        }}
      >
        {showBadge ? (
          <Badge dot offset={[2, -2]} aria-label={badgeAria}>
            {spec.icon}
          </Badge>
        ) : (
          spec.icon
        )}
      </div>
    );
    return (
      <Tooltip
        key={spec.href}
        title={
          chord ? (
            <span className="inline-flex items-center gap-1.5">
              {label}
              <ShortcutHint keys={chord} />
            </span>
          ) : (
            label
          )
        }
        placement="right"
      >
        <Link href={spec.href} onClick={onMobileClose} aria-label={label} className="no-underline">
          {iconEl}
        </Link>
      </Tooltip>
    );
  };

  const railHidden = isMobileViewport && collapsed && !mobileOpen;

  return (
    <Sider
      width={mobileOpen ? '100%' : 240}
      collapsedWidth={isMobileViewport ? 0 : 64}
      // Force-collapsed on the mobile persistent rail from the first client
      // paint (isMobileViewport is tearing-free via useSyncExternalStore), so
      // the rail never flashes open at 240px before the `breakpoint` callback
      // collapses it - the "sidebar opens then quickly closes" flick seen when
      // navigating back from an account page (which mounts a fresh layout with
      // collapsed=false). The drawer instance (mobileOpen) is exempt.
      collapsed={collapsed || (isMobileViewport && !mobileOpen)}
      onCollapse={onCollapse}
      aria-label={mobileOpen ? 'Mobile navigation menu' : 'Connect navigation'}
      style={{
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
      breakpoint={mobileOpen ? undefined : 'md'}
      onBreakpoint={(broken) => {
        if (broken) onCollapse(true);
      }}
    >
      {/* Logo */}
      <div
        className={`flex h-16 items-center border-b border-border-light ${
          collapsed ? 'justify-center px-2' : 'justify-start px-4 py-3'
        }`}
      >
        <Link
          href="/connect/feed"
          {...(collapsed ? { 'aria-label': 'ManekHR Connect home' } : {})}
          className="group flex items-center gap-2.5 rounded-lg p-2 no-underline transition-all duration-200 hover:bg-neutral-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark; next/image adds no optimisation for SVG */}
          <img
            src="/manekhr-symbol.svg"
            width={32}
            height={32}
            alt="ManekHR"
            className="h-10 w-10 flex-shrink-0 transition-transform duration-200 group-hover:scale-105"
          />
          {!collapsed && (
            <span className="flex min-w-0 flex-col items-start leading-tight">
              {/* eslint-disable-next-line @next/next/no-img-element -- static SVG wordmark with intrinsic w-auto sizing */}
              <img
                src="/manekhr-wordmark-on-light.svg"
                alt="ManekHR"
                className="h-6 w-auto flex-shrink-0"
              />
              {/* items-start on the column is REQUIRED: without it the column's
                  default align-items:stretch stretches the wordmark IMAGE to the
                  column width whenever a sibling row is wider, distorting it and
                  inflating its built-in left padding so nothing lines up. With the
                  wordmark at its natural width, the 7px inline padding below sits the
                  tagline under the wordmark's visible "Z" (the SVG has ~7px blank left
                  padding at h-6, measured via getBBox). Keep both items-start and the
                  7px in sync with the ERP label in Sidebar.tsx. */}
              <span
                className="mt-0.5 text-[11px] font-semibold tracking-wide text-primary"
                style={{ paddingLeft: '7px' }}
              >
                {t('shell.tagline')}
              </span>
            </span>
          )}
        </Link>
      </div>

      {/* Product switcher - ERP ⇄ Connect */}
      <div
        className={`border-b border-border-light ${
          collapsed ? 'flex justify-center px-2 py-2' : 'px-3 py-2.5'
        }`}
      >
        <ModeSwitcher collapsed={collapsed} />
      </div>

      {/* Module nav. Collapsed = hand-rolled icon rail (icons are real links,
          chord tooltips preserved); expanded = AntD Menu with labelled groups. */}
      <div className="flex-1 overflow-auto py-2">
        {collapsed ? (
          <div className="flex flex-col items-center gap-1 py-1">
            {MAIN_NAV.map(buildCollapsedRailItem)}
            {businessEnabled && (
              <>
                <div
                  className="my-1 h-px w-6"
                  style={{ background: 'var(--cr-border-light)' }}
                  aria-hidden
                />
                {BUSINESS_NAV.map(buildCollapsedRailItem)}
              </>
            )}
            <div
              className="my-1 h-px w-6"
              style={{ background: 'var(--cr-border-light)' }}
              aria-hidden
            />
            {presenceNavItems.map(buildCollapsedRailItem)}
          </div>
        ) : (
          <Menu
            mode="inline"
            selectedKeys={selectedKey ? [selectedKey] : []}
            items={expandedItems}
            className="cr-sider-menu"
            style={{ border: 'none', background: 'transparent' }}
          />
        )}
      </div>

      {/* Footer - keyboard-shortcuts cheat-sheet. Hidden on mobile (touch, no
          physical keyboard): the chord cheat-sheet is a desktop-only affordance,
          so the visible trigger is suppressed below the `md` breakpoint (matches
          the rail's own mobile-drawer behaviour). The drawer stays mounted below
          so the global Shift+? hotkey still works on any desktop that toggles to
          a narrow viewport; with no keyboard there is nothing to trigger it on a
          real phone. Keep `isMobileViewport` in sync with the Sider breakpoint. */}
      {!isMobileViewport && (
        <div className="border-t border-border-light p-2">
          <button
            type="button"
            onClick={() => {
              onMobileClose();
              window.dispatchEvent(new Event(SHORTCUTS_OPEN_EVENT));
            }}
            aria-label={t('shell.shortcuts')}
            title={collapsed ? t('shell.shortcuts') : undefined}
            className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent py-2 text-[13px] font-medium text-muted transition-colors hover:bg-neutral-100 hover:text-body ${
              collapsed ? 'justify-center px-0' : 'px-3'
            }`}
          >
            <ThunderboltOutlined />
            {!collapsed && <span>{t('shell.shortcuts')}</span>}
          </button>
        </div>
      )}
      <KeyboardShortcutsDrawer module="connect" />
    </Sider>
  );
}
