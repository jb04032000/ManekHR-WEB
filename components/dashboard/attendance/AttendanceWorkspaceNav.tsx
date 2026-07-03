'use client';

// Workspace nav for the Attendance module.
//
// Layout strategy - a flat pill rail of single tabs. Earlier revs collapsed
// related routes into click-Dropdowns to fight horizontal scroll, but that
// left the rail with two interaction models (Settings was a tabbed page,
// Reports/Devices/Data were dropdowns). This rev unifies on the tabbed-page
// pattern: Reports, Devices, and Data are now single tabs that each land on
// a page with its own internal <Tabs> (Overtime/Compliance/Patterns,
// Biometric Devices/Kiosk Setup, Import/Statutory Exports). One model
// everywhere; siblings are always visible inside the landing page.
//
//   • Overview            standalone - default landing (analytics + register view)
//   • Mark                standalone - daily/monthly marking console
//   • Reports             tabbed page - Overtime / Compliance / Patterns
//   • Anomalies           standalone (badge - keep visible)
//   • Regularizations     standalone (badge - keep visible)
//   • Devices             tabbed page - Biometric Devices / Kiosk Setup
//   • Data                tabbed page - Import / Statutory Exports
//   • Settings            tabbed page - Self-Service / Regularization / Policies
//
// Action queues (Anomalies, Regularizations) stay standalone - their
// pending-count badges are the whole point of the nav for a manager.

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Badge } from 'antd';
import {
  ApiOutlined,
  SafetyOutlined,
  CheckSquareOutlined,
  UploadOutlined,
  SettingOutlined,
  BarChartOutlined,
  EditOutlined,
  LineChartOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { anomaliesApi } from '@/lib/api/modules/anomalies.api';
import { regularizationApi } from '@/lib/api/modules/regularization.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { useEffect, useState } from 'react';

interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  badge?: number;
  matches: (pathname: string) => boolean;
}

// Shared active link style
function activeLinkStyle(active: boolean): React.CSSProperties {
  return {
    borderColor: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
    background: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
    color: active ? 'var(--cr-surface)' : 'var(--cr-text-2,var(--cr-text-4))',
    boxShadow: active ? '0 10px 24px rgba(22,119,255,0.16)' : 'none',
  };
}

export function AttendanceWorkspaceNav() {
  const pathname = usePathname();
  const { currentWorkspaceId } = useWorkspaceStore();

  const { canPath, data, loading } = useMyPermissions();
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [regularizationCount, setRegularizationCount] = useState(0);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    if (canPath('attendance.anomaly.manage')) {
      anomaliesApi
        .count(currentWorkspaceId)
        .then((r) => setAnomalyCount(r.count))
        .catch(() => {});
    }
    if (canPath('regularization.approval.decide')) {
      regularizationApi
        .listPendingForMe(currentWorkspaceId)
        .then((list) => setRegularizationCount(list.length))
        .catch(() => {});
    }
  }, [currentWorkspaceId, canPath]);

  // Access Control Initiative §8 - self-scoped members get the standalone
  // <MyAttendance/> surface, so the manager tab bar must not render for
  // them. Render nothing until permissions resolve (avoids flashing the
  // management nav to a worker), then hide for anyone without org-wide
  // attendance view.
  if (loading || !data) return null;
  if (!data.isOwner && !canPath('attendance.analytics.view')) return null;

  // Helper - the "Attendance" root + the Overview route both highlight
  // the Overview tab, since visiting /dashboard/attendance redirects to
  // /dashboard/attendance/overview.
  const matchesOverview = (p: string) =>
    p === '/dashboard/attendance' || p.startsWith('/dashboard/attendance/overview');

  // Reports / Devices / Data each match their new landing route AND the
  // legacy child routes - the legacy routes redirect into the landing
  // page's `?tab=` deep-link, but matching them keeps the rail highlighted
  // through the redirect hop.
  const matchesReports = (p: string) =>
    p.startsWith('/dashboard/attendance/reports') ||
    p.startsWith('/dashboard/attendance/overtime') ||
    p.startsWith('/dashboard/attendance/compliance') ||
    p.startsWith('/dashboard/attendance/patterns');

  const matchesDevices = (p: string) =>
    p.startsWith('/dashboard/attendance/devices') ||
    p.startsWith('/dashboard/attendance/unassigned') ||
    p.startsWith('/dashboard/attendance/kiosk-setup');

  const matchesData = (p: string) =>
    p.startsWith('/dashboard/attendance/data') ||
    p.startsWith('/dashboard/attendance/import') ||
    p.startsWith('/dashboard/attendance/statutory');

  const navItems: NavItem[] = [
    {
      key: 'overview',
      label: 'Overview',
      href: '/dashboard/attendance/overview',
      icon: <BarChartOutlined />,
      matches: matchesOverview,
    },
    {
      key: 'mark',
      label: 'Mark',
      href: '/dashboard/attendance/mark',
      icon: <EditOutlined />,
      matches: (p) => p.startsWith('/dashboard/attendance/mark'),
    },
    {
      key: 'reports',
      label: 'Reports',
      href: '/dashboard/attendance/reports',
      icon: <LineChartOutlined />,
      matches: matchesReports,
    },
    // ── Action queues - badges must stay visible, so kept standalone ─────────
    {
      key: 'anomalies',
      label: 'Anomalies',
      href: '/dashboard/attendance/anomalies',
      icon: <SafetyOutlined />,
      badge: anomalyCount,
      matches: (p) => p.startsWith('/dashboard/attendance/anomalies'),
    },
    {
      key: 'regularizations',
      label: 'Regularizations',
      href: '/dashboard/attendance/regularizations',
      icon: <CheckSquareOutlined />,
      badge: regularizationCount,
      matches: (p) => p.startsWith('/dashboard/attendance/regularizations'),
    },
    {
      key: 'devices',
      label: 'Devices',
      href: '/dashboard/attendance/devices',
      icon: <ApiOutlined />,
      matches: matchesDevices,
    },
    {
      key: 'data',
      label: 'Data',
      href: '/dashboard/attendance/data',
      icon: <UploadOutlined />,
      matches: matchesData,
    },
    {
      key: 'settings',
      label: 'Settings',
      href: '/dashboard/attendance/settings',
      icon: <SettingOutlined />,
      matches: (p) => p.startsWith('/dashboard/attendance/settings'),
    },
  ];

  const navItemClass =
    'inline-flex items-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-semibold transition-all duration-200 cursor-pointer select-none whitespace-nowrap';

  return (
    // Single content-width capsule - the rail IS the nav surface. `inline-flex`
    // hugs the tabs so the capsule ends where the tabs end (no dead space on
    // wide viewports); `max-w-full` + `overflow-x-auto` then cap it and let it
    // scroll on viewports too narrow to fit the tabs.
    <div
      className="attendance-nav-rail inline-flex max-w-full min-w-0 items-center gap-2 overflow-x-auto rounded-[20px] border p-1.5"
      style={{
        borderColor: 'var(--cr-border)',
        background: 'var(--cr-surface)',
        boxShadow: 'var(--cr-shadow-card)',
      }}
    >
      {navItems.map((item) => {
        const active = item.matches(pathname);
        return (
          <Link
            key={item.key}
            href={item.href}
            className={navItemClass}
            style={activeLinkStyle(active)}
          >
            <span className="text-[15px] leading-none">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge != null && item.badge > 0 && (
              <Badge count={item.badge} size="small" overflowCount={99} />
            )}
          </Link>
        );
      })}
    </div>
  );
}
