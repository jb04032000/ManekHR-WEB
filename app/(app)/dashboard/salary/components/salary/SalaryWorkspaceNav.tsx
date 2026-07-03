'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  GiftOutlined,
  OrderedListOutlined,
  RiseOutlined,
  SettingOutlined,
  SolutionOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { buildPayrollRouteHref, getPayrollRoutePeriod } from '../../utils/payroll-route.utils';

type SalaryFeatureKey = keyof ReturnType<typeof useSalaryFeatures>;
type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  matches: (pathname: string) => boolean;
  featureKey?: SalaryFeatureKey;
  /** Only show to approvers (salary edit:all). Mirrors the route + BE approve guard. */
  requiresEditAll?: boolean;
  /**
   * Only show to HR/Owner (salary.sensitive_view). Mirrors the BE OQ-S1 gate:
   * TDS challans + statutory exports are HR-only (assertSalaryComplianceExportAllowed),
   * so a Manager who lacks sensitive_view should not see the TDS tab at all rather
   * than click through to a 403.
   */
  requiresSensitiveView?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  {
    key: 'overview',
    label: 'Overview',
    href: '/dashboard/salary',
    icon: <AppstoreOutlined />,
    matches: (pathname: string) => pathname === '/dashboard/salary',
  },
  {
    key: 'run-payroll',
    label: 'Run Payroll',
    href: '/dashboard/salary/run-payroll',
    icon: <RupeeOutlined />,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/run-payroll'),
  },
  {
    key: 'payments',
    label: 'Payments',
    href: '/dashboard/salary/payments',
    icon: <WalletOutlined />,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/payments'),
  },
  {
    // Worker advance approval queue. Gated on the advance-payments feature AND
    // salary edit:all (approver). Links: app/dashboard/salary/advance-requests.
    key: 'advance-requests',
    label: 'Advance requests',
    href: '/dashboard/salary/advance-requests',
    icon: <SolutionOutlined />,
    featureKey: 'advancePayments' as SalaryFeatureKey,
    requiresEditAll: true,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/advance-requests'),
  },
  {
    key: 'tds',
    label: 'TDS',
    href: '/dashboard/salary/tds',
    icon: <AuditOutlined />,
    featureKey: 'tdsManagement' as SalaryFeatureKey,
    // OQ-S1: TDS challans are HR+Owner only on the backend; hide the tab for
    // Managers who lack salary.sensitive_view so the UI matches the API.
    requiresSensitiveView: true,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/tds'),
  },
  {
    key: 'loans',
    label: 'Loans',
    href: '/dashboard/salary/loans',
    icon: <BankOutlined />,
    featureKey: 'loanManagement' as SalaryFeatureKey,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/loans'),
  },
  {
    key: 'commission',
    label: 'Commission',
    href: '/dashboard/salary/commission',
    icon: <RiseOutlined />,
    featureKey: 'commissionTracking' as SalaryFeatureKey,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/commission'),
  },
  {
    key: 'bonus',
    label: 'Bonus',
    href: '/dashboard/salary/bonus',
    icon: <GiftOutlined />,
    featureKey: 'bonusTracking' as SalaryFeatureKey,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/bonus'),
  },
  {
    key: 'ledger',
    label: 'Daily wages',
    href: '/dashboard/salary/ledger',
    icon: <OrderedListOutlined />,
    featureKey: 'dailyWageLedger' as SalaryFeatureKey,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/ledger'),
  },
  {
    key: 'settings',
    label: 'Settings',
    href: '/dashboard/salary/settings',
    icon: <SettingOutlined />,
    matches: (pathname: string) => pathname.startsWith('/dashboard/salary/settings'),
  },
] as const;

export function SalaryWorkspaceNav() {
  const t = useTranslations('salary.nav');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const features = useSalaryFeatures();
  const { loading: permissionsLoading, can, data: permissions } = useMyPermissions();
  const { month, year } = getPayrollRoutePeriod(searchParams);
  const canEditAll = can('salary', 'edit', 'all');
  // OQ-S1: owner OR salary.sensitive_view holder (the HR preset) — gates the
  // HR-only TDS tab so the FE mirrors the backend HR-only statutory gate.
  const canViewSensitive = !!permissions?.isOwner || can('salary', 'sensitive_view', 'all');
  const visibleNavItems = NAV_ITEMS.filter(
    (item) =>
      (!item.featureKey || features[item.featureKey].enabled) &&
      (!item.requiresEditAll || canEditAll) &&
      (!item.requiresSensitiveView || canViewSensitive),
  );

  // Self-scoped members get the MySalary surface, not the manager tab bar.
  if (permissionsLoading) return null;
  const selfScoped = !!permissions && !permissions.isOwner && !can('salary', 'view', 'all');
  if (selfScoped) return null;

  // Clean pill rail - mirrors AttendanceWorkspaceNav's outer container exactly.
  // No title/subtitle block; the rail IS the nav surface.
  return (
    <nav
      aria-label={t('ariaLabel')}
      className="salary-nav-rail inline-flex max-w-full min-w-0 items-center gap-2 overflow-x-auto rounded-[20px] border p-1.5"
      style={{
        borderColor: 'var(--cr-border)',
        background: 'var(--cr-surface)',
        boxShadow: 'var(--cr-shadow-card)',
      }}
    >
      {visibleNavItems.map((item) => {
        const active = item.matches(pathname);
        const href = buildPayrollRouteHref(item.href, searchParams, {
          month: String(month),
          year: String(year),
        });

        return (
          <Link
            key={item.key}
            href={href}
            aria-current={active ? 'page' : undefined}
            className="inline-flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-semibold whitespace-nowrap transition-all duration-200 select-none"
            style={{
              borderColor: active ? 'var(--cr-primary, var(--cr-info-500))' : 'transparent',
              background: active ? 'var(--cr-primary, var(--cr-info-500))' : 'transparent',
              color: active ? 'var(--cr-surface)' : 'var(--cr-text-2, var(--cr-text-4))',
              boxShadow: active ? '0 10px 24px rgba(22,119,255,0.16)' : 'none',
            }}
          >
            <span className="text-[15px] leading-none">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
