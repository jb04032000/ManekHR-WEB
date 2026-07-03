'use client';

import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarOutlined,
  CheckSquareOutlined,
  ControlOutlined,
  GiftOutlined,
  SettingOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useMyPermissions } from '@/hooks/useMyPermissions';

interface LeaveNavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  matches: (p: string) => boolean;
}

function activeLinkStyle(active: boolean): CSSProperties {
  return {
    borderColor: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
    background: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
    color: active ? 'var(--cr-surface)' : 'var(--cr-text-2)',
    boxShadow: active ? '0 10px 24px rgba(22,119,255,0.16)' : 'none',
  };
}

/**
 * Leave-module sub-nav. Admins (owner or `leave/manage_leave`) get the full L5
 * surface set; workers with leave self-service get the L6 My Leave / My
 * Comp-off tabs. Anyone without leave access sees nothing.
 */
export function LeaveWorkspaceNav() {
  const t = useTranslations('leave.nav');
  const pathname = usePathname();
  const { canPath, data, loading } = useMyPermissions();

  if (loading || !data) return null;
  const isAdmin = data.isOwner || canPath('leave.approval.decide');
  if (!isAdmin && !canPath('leave.request.view')) return null;

  const adminItems: LeaveNavItem[] = [
    {
      key: 'approvals',
      label: t('approvals'),
      href: '/dashboard/leave/approvals',
      icon: <CheckSquareOutlined />,
      matches: (p) => p.startsWith('/dashboard/leave/approvals'),
    },
    {
      key: 'calendar',
      label: t('calendar'),
      href: '/dashboard/leave/calendar',
      icon: <CalendarOutlined />,
      matches: (p) => p.startsWith('/dashboard/leave/calendar'),
    },
    {
      key: 'balances',
      label: t('balances'),
      href: '/dashboard/leave/balances',
      icon: <WalletOutlined />,
      matches: (p) => p.startsWith('/dashboard/leave/balances'),
    },
    {
      key: 'config',
      label: t('configuration'),
      href: '/dashboard/leave/config',
      icon: <ControlOutlined />,
      matches: (p) => p.startsWith('/dashboard/leave/config'),
    },
    {
      key: 'settings',
      label: t('settings'),
      href: '/dashboard/leave/settings',
      icon: <SettingOutlined />,
      matches: (p) => p.startsWith('/dashboard/leave/settings'),
    },
  ];

  const workerItems: LeaveNavItem[] = [
    {
      key: 'me',
      label: t('myLeave'),
      href: '/dashboard/leave/me',
      icon: <CalendarOutlined />,
      matches: (p) =>
        p.startsWith('/dashboard/leave/me') && !p.startsWith('/dashboard/leave/me/comp-off'),
    },
    // Comp-off self-service is its own grant - a member can hold leave.request
    // (My Leave) without leave.compOff.apply. Gate the tab on the comp-off
    // grant so it only appears for members who can actually claim comp-off
    // (mirrors the page-level guard on /dashboard/leave/me/comp-off).
    ...(canPath('leave.compOff.apply')
      ? [
          {
            key: 'me-comp-off',
            label: t('myCompOff'),
            href: '/dashboard/leave/me/comp-off',
            icon: <GiftOutlined />,
            matches: (p: string) => p.startsWith('/dashboard/leave/me/comp-off'),
          },
        ]
      : []),
  ];

  const items = isAdmin ? adminItems : workerItems;

  const navItemClass =
    'inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-[14px] font-semibold transition-all duration-200 cursor-pointer select-none no-underline';

  return (
    // Single content-width capsule - no outer card wrapping an inner pill.
    // Module name lives in the breadcrumb + page <h1>. Matches
    // AttendanceWorkspaceNav so both module navs share one layout.
    <nav
      aria-label={t('landmark')}
      className="flex max-w-full min-w-0 items-center gap-2 overflow-x-auto rounded-[20px] border p-1.5"
      style={{
        borderColor: 'var(--cr-border)',
        background: 'var(--cr-surface)',
        boxShadow: 'var(--cr-shadow-card)',
      }}
    >
      {items.map((item) => {
        const active = item.matches(pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={navItemClass}
            style={activeLinkStyle(active)}
          >
            <span className="text-[15px] leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
