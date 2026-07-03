'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Spin, Dropdown, Tooltip } from 'antd';
import type { MenuProps } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  BankOutlined,
  CrownOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ArrowLeftOutlined,
  TranslationOutlined,
  UserOutlined,
  SettingOutlined,
  TagsOutlined,
  AppstoreOutlined,
  CreditCardOutlined,
  ShopOutlined,
  CommentOutlined,
  ExperimentOutlined,
  GiftOutlined,
  FileProtectOutlined,
  SolutionOutlined,
  ClockCircleOutlined,
  FlagOutlined,
  PictureOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { DsAvatar } from '@/components/ui';
import { LockOverlay } from '@/components/auth/LockOverlay';
import { useAppLock } from '@/hooks/useAppLock';
import { useLogout } from '@/hooks/useLogout';

const { Sider, Header, Content } = Layout;

const NAV = [
  { key: '/admin', icon: <DashboardOutlined />, label: 'Overview' },
  { key: '/admin/users', icon: <TeamOutlined />, label: 'Users' },
  // DPDP self-serve deletion support: pending accounts + admin-mediated restore.
  { key: '/admin/pending-deletions', icon: <ClockCircleOutlined />, label: 'Pending Deletions' },
  { key: '/admin/workspaces', icon: <BankOutlined />, label: 'Workspaces' },
  { key: '/admin/plans', icon: <CrownOutlined />, label: 'Plans' },
  { key: '/admin/tiers', icon: <TagsOutlined />, label: 'Tiers' },
  { key: '/admin/subscriptions', icon: <FileTextOutlined />, label: 'Subscriptions' },
  {
    key: '/admin/custom-plan-requests',
    icon: <SolutionOutlined />,
    label: 'Custom Plan Requests',
  },
  { key: '/admin/billing', icon: <CreditCardOutlined />, label: 'Billing Ops' },
  { key: '/admin/add-ons', icon: <AppstoreOutlined />, label: 'Add-Ons' },
  { key: '/admin/connect', icon: <ShopOutlined />, label: 'Connect' },
  { key: '/admin/connect/demo', icon: <ExperimentOutlined />, label: 'Demo Manager' },
  { key: '/admin/connect/referrals', icon: <GiftOutlined />, label: 'Referrals' },
  { key: '/admin/connect/moderation', icon: <FlagOutlined />, label: 'Content Moderation' },
  { key: '/admin/connect/banners', icon: <PictureOutlined />, label: 'Feed Banners' },
  { key: '/admin/feedback', icon: <CommentOutlined />, label: 'Feedback' },
  { key: '/admin/legal-pages', icon: <FileProtectOutlined />, label: 'Legal Pages' },
  { key: '/admin/localization', icon: <TranslationOutlined />, label: 'Localization' },
  { key: '/admin/settings', icon: <SettingOutlined />, label: 'Settings' },
];

const BREADCRUMB_MAP: Record<string, string> = {
  '/admin': 'Overview',
  '/admin/users': 'Users',
  '/admin/pending-deletions': 'Pending Deletions',
  '/admin/workspaces': 'Workspaces',
  '/admin/plans': 'Plans',
  '/admin/tiers': 'Tiers',
  '/admin/legal-pages': 'Legal Pages',
  '/admin/subscriptions': 'Subscriptions',
  '/admin/billing': 'Billing Ops',
  '/admin/billing/refunds': 'Refund Queue',
  '/admin/billing/coupons': 'Coupons',
  '/admin/billing/payment-links': 'Payment Links',
  '/admin/billing/policy': 'Policies',
  '/admin/billing/audit': 'Audit Log',
  '/admin/billing/payments': 'Payments',
  '/admin/communications/cost-margin': 'SMS Cost & Margin',
  '/admin/communications/marketing': 'Marketing Campaigns',
  '/admin/communications/msg91-balance': 'MSG91 Wallet',
  '/admin/communications/pricing': 'MSG91 / AiSensy Pricing',
  '/admin/add-ons': 'Add-Ons',
  '/admin/connect': 'Connect',
  '/admin/connect/marketplace/review': 'Marketplace Review',
  '/admin/connect/ads/review': 'Ad Review',
  '/admin/connect/promotions': 'Promotions & Sales',
  '/admin/connect/revenue': 'Revenue',
  '/admin/connect/entitlements': 'Custom Limits',
  '/admin/connect/demo': 'Demo Manager',
  '/admin/connect/referrals': 'Referrals',
  '/admin/connect/moderation': 'Content Moderation',
  '/admin/connect/banners': 'Feed Banners',
  '/admin/feedback': 'Feedback',
  '/admin/custom-plan-requests': 'Custom Plan Requests',
  '/admin/localization': 'Localization',
  '/admin/settings': 'Settings',
};

function resolveBreadcrumb(pathname: string): string {
  const exact = BREADCRUMB_MAP[pathname];
  if (exact) return exact;
  if (pathname.startsWith('/admin/workspaces/')) return 'Workspace Detail';
  if (pathname.startsWith('/admin/billing/coupons/')) return 'Coupon Detail';
  if (pathname.startsWith('/admin/billing/payments/')) return 'Payment Detail';
  return 'Admin';
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Pillar 4 (auth-hardening): narrow selectors so the pin-touch heartbeat
  // (`unlockExpiresAt` updates) does not re-render the whole admin shell.
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  // Shared sign-out teardown - the single correct logout path (revoke session,
  // clear state, hard-reload to /auth). See hooks/useLogout.ts.
  const handleLogout = useLogout();
  const [collapsed, setCollapsed] = useState(false);

  // App Lock (Quick PIN) - the admin panel is subject to the same backend
  // PinUnlockGuard as the dashboard (idle admins get 423'd), but DashboardLayout
  // skips all lock handling for admins. This drives the idle lock, pin-status
  // resolution, and PIN-setup redirect for the admin shell.
  const { isAppLocked, pinSetupRequired, pinStateResolved } = useAppLock(!!user?.isAdmin);

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    if (!user.isAdmin) {
      router.replace('/dashboard');
    }
  }, [isHydrated, user, router]);

  // Hold the shell behind the loader until we know the lock state (so admin
  // pages don't fire API calls that 423 before the overlay mounts), and keep it
  // held while locked / redirecting to PIN setup. The LockOverlay sits on top
  // and captures the PIN entry. Mirrors DashboardLayout's showLoader gate.
  const lockGated = !pinStateResolved || isAppLocked || pinSetupRequired;

  if (!isHydrated || !user?.isAdmin || lockGated) {
    return (
      <>
        <div className="flex min-h-screen items-center justify-center bg-page">
          <Spin size="large" />
        </div>
        <LockOverlay open={isAppLocked} />
      </>
    );
  }

  const activeKey =
    NAV.find((n) => pathname === n.key || (n.key !== '/admin' && pathname.startsWith(n.key)))
      ?.key ?? '/admin';
  const pageTitle = resolveBreadcrumb(pathname);

  const userMenu: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'My Profile',
      icon: <UserOutlined />,
      onClick: () => router.push('/dashboard/profile'),
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
      onClick: () => router.push('/dashboard/settings'),
    },
    { type: 'divider' },
    {
      key: 'dashboard',
      label: 'Back to Dashboard',
      icon: <ArrowLeftOutlined />,
      onClick: () => router.push('/dashboard'),
    },
    { type: 'divider' },
    {
      key: 'logout',
      label: 'Sign out',
      icon: <LogoutOutlined style={{ color: 'var(--cr-error)' }} />,
      danger: true,
      onClick: handleLogout,
    },
  ];

  const navItems: MenuProps['items'] = NAV.map((item) => ({
    key: item.key,
    icon: item.icon,
    label: (
      <Link href={item.key} className="text-[13px] font-medium no-underline">
        {item.label}
      </Link>
    ),
  }));

  return (
    <Layout className="min-h-screen bg-page">
      {/* Sidebar - Light theme matching dashboard */}
      <Sider
        width={240}
        collapsedWidth={64}
        collapsed={collapsed}
        onCollapse={setCollapsed}
        style={{
          height: '100vh',
          position: 'sticky',
          top: 0,
          left: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--cr-surface)',
          borderRight: '1px solid var(--cr-border-light)',
          boxShadow: '2px 0 12px rgba(0,0,0,0.04)',
        }}
        className="cr-sidebar"
        breakpoint="md"
        onBreakpoint={(broken) => {
          if (broken) setCollapsed(true);
        }}
      >
        {/* Logo */}
        <div
          className={`flex h-16 items-center border-b border-border-light ${collapsed ? 'justify-center px-2' : 'justify-between px-4 py-4.5'}`}
        >
          <Link href="/admin" className="flex items-center gap-2.5 no-underline">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'var(--cr-grad-amber)' }}
            >
              <CrownOutlined style={{ fontSize: 16, color: 'white' }} />
            </div>
            {!collapsed && (
              <span className="font-display text-base font-extrabold text-heading">
                Admin Panel
              </span>
            )}
          </Link>
        </div>

        {/* Admin badge section */}
        <div className={`border-b border-border-light ${collapsed ? 'px-0 py-2' : 'p-3'}`}>
          {collapsed ? (
            <Tooltip title="Admin Mode" placement="right">
              <div
                className="mx-auto flex h-[36px] w-[36px] items-center justify-center rounded-[10px] text-sm font-bold text-warning select-none"
                style={{ background: 'var(--cr-warning-light)' }}
              >
                <CrownOutlined />
              </div>
            </Tooltip>
          ) : (
            <div className="bg-warning-light flex items-center justify-center gap-2 rounded-md border border-[var(--cr-warning-50)] px-2.5 py-2">
              <CrownOutlined style={{ color: 'var(--cr-warning)', fontSize: 14 }} />
              <span className="text-xs font-bold text-warning">Admin Mode</span>
            </div>
          )}
        </div>

        {/* Main nav */}
        <div className="flex-1 overflow-auto py-2">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1 py-1">
              {NAV.map((item) => {
                const isActive = activeKey === item.key;
                return (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    <Link href={item.key}>
                      <div
                        className="flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-[10px] text-[17px] transition-colors"
                        style={{
                          background: isActive ? 'var(--cr-primary-light)' : 'transparent',
                          color: isActive ? 'var(--cr-primary)' : 'var(--cr-text-3)',
                        }}
                      >
                        {item.icon}
                      </div>
                    </Link>
                  </Tooltip>
                );
              })}
            </div>
          ) : (
            <Menu
              mode="inline"
              selectedKeys={[activeKey]}
              style={{ border: 'none', background: 'transparent' }}
              className="cr-sider-menu"
              items={navItems}
            />
          )}
        </div>
      </Sider>

      <Layout style={{ background: 'var(--cr-bg)' }} className="min-w-0">
        {/* Header */}
        <Header
          className="sticky top-0 border-b border-border-light bg-surface p-0 shadow-[0_1px_8px_rgba(0,0,0,0.04)]"
          style={{ zIndex: 'var(--z-header)' as unknown as number }}
        >
          <div className="flex h-16 items-center justify-between px-lg">
            {/* Left: menu toggle + page title */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCollapsed(!collapsed)}
                className="flex cursor-pointer items-center rounded-md border-none bg-transparent p-0.5 text-subtle transition-colors hover:bg-surface-2"
              >
                {collapsed ? (
                  <MenuUnfoldOutlined className="text-base" />
                ) : (
                  <MenuFoldOutlined className="text-base" />
                )}
              </button>
              <h1 className="page-header m-0 text-lg">{pageTitle}</h1>
            </div>

            {/* Right: user menu */}
            <div className="flex items-center gap-2.5">
              <Dropdown menu={{ items: userMenu }} trigger={['click']} placement="bottomRight">
                <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-surface-2">
                  <DsAvatar name={user?.name ?? ''} size={32} />
                  <span className="text-[13px] font-semibold text-heading">{user?.name}</span>
                </div>
              </Dropdown>
            </div>
          </div>

          {/* Breadcrumb strip - only on sub-pages */}
          {pathname !== '/admin' && (
            <div className="border-t border-border-light bg-surface-2 py-1.5">
              <div className="flex items-center gap-1.5 px-lg">
                <Link
                  href="/admin"
                  className="text-xs text-muted transition-colors hover:text-body"
                >
                  Admin
                </Link>
                <span className="text-xs text-faint">/</span>
                <span className="text-xs font-medium text-body">{pageTitle}</span>
              </div>
            </div>
          )}
        </Header>

        <Content className="px-lg pt-5 pb-lg">
          <div className="animate-fade-in mx-auto max-w-[1400px]">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}
