'use client';

import Sidebar from './Sidebar';


/**
 * Picks the sidebar for the current product mode.
 *  - `erp` - existing `Sidebar` (Team / Attendance / Salary / …).
 *  - `connect` - `ConnectModuleNav` (Feed / Network / Profile / …).
 *  - `account` - account-level surface at `/account/*` (Profile, Security,
 *    Billing, Devices). Product-neutral; the page-level `AccountShell`
 *    provides its own sub-nav inside the content area, so this returns
 *    `null` and `DashboardLayout` simply omits the sidebar rail.
 */
export type AppMode = 'erp' | 'connect' | 'account';

interface ModeSidebarProps {
  mode: AppMode;
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function ModeSidebar({ mode, ...rest }: ModeSidebarProps) {
  if (mode === 'account') return null;
  // Connect product removed (2026-07-04): the connect mode can no longer occur.
  if (mode === 'connect') return null;
  return <Sidebar {...rest} />;
}
