'use client';

/**
 * ConnectMobileTabBar - the locked 5-tab bottom bar (design-decisions doc §6.1):
 * Home · Network · Marketplace · Inbox · You. Mobile only (`md:hidden`).
 *
 * Jobs is intentionally NOT a tab - it is reached via a banner on Home (design
 * doc §6.1). A tab whose module's phase is not yet live renders disabled.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  HomeOutlined,
  TeamOutlined,
  ShopOutlined,
  InboxOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Badge } from 'antd';
import { useTranslations } from 'next-intl';
import { isConnectModuleEnabled, type ConnectModule } from '@/lib/connect/flags';
import { useNetworkBadge } from '@/features/connect/network/useNetworkBadge';
import { useInboxBadge } from '@/features/connect/inbox/useInboxBadge';

interface TabSpec {
  /** Key under the `connect.tabbar` i18n namespace. */
  id: string;
  href: string;
  icon: ReactNode;
  gate: ConnectModule;
}

const TABS: TabSpec[] = [
  { id: 'home', href: '/connect/feed', icon: <HomeOutlined />, gate: 'feed' },
  { id: 'network', href: '/connect/network', icon: <TeamOutlined />, gate: 'network' },
  { id: 'marketplace', href: '/connect/marketplace', icon: <ShopOutlined />, gate: 'marketplace' },
  { id: 'inbox', href: '/connect/inbox', icon: <InboxOutlined />, gate: 'inbox' },
  { id: 'you', href: '/connect/profile', icon: <UserOutlined />, gate: 'profile' },
];

export default function ConnectMobileTabBar() {
  const t = useTranslations('connect.tabbar');
  const pathname = usePathname();
  // Phase 7a - Network tab carries the same pending-request badge as the
  // sidebar nav. Live-updating via the same hook so mobile sees instant
  // increments when a request arrives.
  const networkBadge = useNetworkBadge();
  const inboxBadge = useInboxBadge();

  return (
    <nav
      aria-label="Connect"
      // `cr-connect-tabbar` is the styling hook for the active/inactive tab
      // colours: the tabs are <a> links, so AntD's global anchor colour
      // (--ant-color-link) overrides the text-primary/text-subtle utilities
      // below; globals.css re-asserts them under this class (keyed off
      // aria-current), mirroring the .cr-sidebar nav-anchor override.
      className="cr-connect-tabbar fixed inset-x-0 bottom-0 z-[var(--z-sidebar)] grid grid-cols-5 border-t border-border-light bg-surface/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {TABS.map((tab) => {
        const enabled = isConnectModuleEnabled(tab.gate);
        const active = pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
        const label = t(tab.id as Parameters<typeof t>[0]);
        const badge =
          tab.id === 'network' && networkBadge > 0
            ? networkBadge
            : tab.id === 'inbox' && inboxBadge > 0
              ? inboxBadge
              : 0;
        const icon =
          badge > 0 ? (
            <Badge count={badge} size="small" overflowCount={9} offset={[4, -2]}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
            </Badge>
          ) : (
            <span style={{ fontSize: 18, lineHeight: 1 }}>{tab.icon}</span>
          );
        const inner = (
          <span className="flex flex-col items-center gap-0.5 py-2">
            {icon}
            <span className="text-[10px] font-semibold">{label}</span>
          </span>
        );

        if (!enabled) {
          return (
            <span
              key={tab.id}
              aria-disabled="true"
              className="flex items-center justify-center text-faint opacity-50"
            >
              {inner}
            </span>
          );
        }

        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`flex items-center justify-center no-underline transition-colors ${
              active ? 'text-primary' : 'text-subtle'
            }`}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
