'use client';

import { useCallback, useEffect, useMemo, useState, startTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowRightOutlined,
  BankOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  GiftOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LockOutlined,
  MailOutlined,
  RightOutlined,
  TeamOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Button, DatePicker, Empty, Skeleton, Tooltip } from 'antd';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useShallow } from 'zustand/react/shallow';
import { DsCard, DsPageHeader } from '@/components/ui';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useWorkspaceStore } from '@/lib/store';
import { salaryApi } from '@/lib/api';
import { listTeam } from '@/lib/actions';
import { isPayrollReady, getPayrollMissing } from '@/lib/member-readiness';
import type { PayrollMissingItem } from '@/lib/member-readiness';
import { PayrollReadinessModal } from '@/components/dashboard/PayrollReadinessModal';
import { PayslipEmailsDrawer } from '@/components/dashboard/PayslipEmailsDrawer';
import { LockedRecordsDrawer } from '@/components/dashboard/LockedRecordsDrawer';
import MySalary from '@/components/dashboard/salary/MySalary';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type {
  GratuitySummary,
  MonthlyTaskStatusResponse,
  PayrollOverviewResponse,
  ShiftPayrollSummary,
} from '@/types';
import { buildPayrollRouteHref, getPayrollRoutePeriod } from './utils/payroll-route.utils';

function formatShiftTime12(value?: string) {
  if (!value) return '';

  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return value;

  const rawHours = Number(match[1]);
  const minutes = match[2];
  if (Number.isNaN(rawHours) || rawHours < 0 || rawHours > 23) return value;

  const suffix = rawHours >= 12 ? 'PM' : 'AM';
  const normalizedHours = rawHours % 12 || 12;
  return `${normalizedHours}:${minutes} ${suffix}`;
}

// i18n: shift-window labels are passed a `salary.shift` translator (the inline
// English strings were not localized). `t` resolves timingNotSet / starts / ends.
function formatShiftWindow(
  t: (key: string, values?: Record<string, string>) => string,
  start?: string,
  end?: string,
) {
  if (!start && !end) return t('timingNotSet');
  if (start && end) return `${formatShiftTime12(start)} - ${formatShiftTime12(end)}`;
  if (start) return t('starts', { time: formatShiftTime12(start) });
  return t('ends', { time: formatShiftTime12(end) });
}

function formatServiceDurationLabel(years = 0, months = 0) {
  return `${years}y ${months}m`;
}

function OverviewMetricCard({
  label,
  value,
  sub,
  tone,
  icon,
  onClick,
  infoTooltip,
  compact = false,
}: {
  label: string;
  value: string;
  sub: string;
  tone: 'primary' | 'success' | 'warning' | 'danger';
  icon: React.ReactNode;
  onClick?: () => void;
  infoTooltip?: string;
  /** Compact variant for the secondary reference strip: tighter padding, smaller
   *  value + icon so these read as context, not hero metrics. */
  compact?: boolean;
}) {
  const toneStyles = {
    primary: {
      background: 'var(--cr-indigo-50)',
      borderColor: 'rgba(30,64,175,0.14)',
      valueColor: 'var(--cr-info-700)',
      iconBackground: 'rgba(30,64,175,0.12)',
      iconColor: 'var(--cr-info-700)',
    },
    success: {
      background: 'var(--cr-success-50)',
      borderColor: 'rgba(16,185,129,0.14)',
      valueColor: 'var(--cr-success-700)',
      iconBackground: 'rgba(16,185,129,0.12)',
      iconColor: 'var(--cr-success-700)',
    },
    warning: {
      background: 'var(--cr-warning-bg, var(--cr-warning-50))',
      borderColor: 'rgba(245,158,11,0.18)',
      valueColor: 'var(--cr-warning, var(--cr-warning-700))',
      iconBackground: 'rgba(245,158,11,0.12)',
      iconColor: 'var(--cr-warning, var(--cr-warning-700))',
    },
    danger: {
      background: 'var(--cr-error-bg, var(--cr-danger-50))',
      borderColor: 'rgba(239,68,68,0.18)',
      valueColor: 'var(--cr-error, var(--cr-danger-700))',
      iconBackground: 'rgba(239,68,68,0.12)',
      iconColor: 'var(--cr-error, var(--cr-danger-700))',
    },
  } as const;

  const style = toneStyles[tone];

  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full border text-left ${compact ? 'rounded-[18px] px-4 py-3' : 'rounded-[24px] px-5 py-4'}${onClick ? 'cursor-pointer transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1' : ''}`}
      style={{ background: style.background, borderColor: style.borderColor }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 flex items-center gap-1 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
            <span className="truncate">{label}</span>
            {infoTooltip ? (
              <Tooltip title={infoTooltip} placement="top">
                <InfoCircleOutlined
                  className="cursor-help text-[10px] opacity-60 hover:opacity-100"
                  aria-label={label}
                />
              </Tooltip>
            ) : null}
          </p>
          <p
            className={`m-0 truncate leading-none font-bold ${compact ? 'mt-2 text-[20px]' : 'mt-3 text-[34px]'}`}
            style={{ color: style.valueColor }}
            title={value}
          >
            {value}
          </p>
          <p className={`m-0 mt-2 truncate text-muted ${compact ? 'text-[12px]' : 'text-[13px]'}`}>
            {sub}
          </p>
        </div>
        <div
          className={`flex shrink-0 items-center justify-center ${compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'}`}
          style={{ background: style.iconBackground, color: style.iconColor }}
        >
          <span className={`leading-none ${compact ? 'text-[15px]' : 'text-[18px]'}`}>{icon}</span>
        </div>
      </div>
    </Tag>
  );
}

function ShiftSnapshotRow({ shift }: { shift: ShiftPayrollSummary }) {
  const currencyFmt = useCurrencyFormatter();
  const tShift = useTranslations('salary.shift');

  return (
    <div
      className="grid gap-5 rounded-[24px] border px-5 py-5 transition-colors duration-200 hover:border-[rgba(30,64,175,0.18)] lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.95fr)] lg:items-center"
      style={{
        borderColor: 'var(--cr-border, var(--cr-border))',
        background: 'var(--cr-surface, var(--cr-surface))',
      }}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h3 className="m-0 text-[20px] font-semibold text-heading">{shift.shiftName}</h3>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cr-primary,var(--cr-info-500))] px-2.5 py-1 text-[11px] font-semibold text-white">
            <TeamOutlined className="text-[11px]" />
            {shift.employeeCount}
          </span>
        </div>
        <p className="m-0 mt-2 text-[13px] text-muted">
          {formatShiftWindow(tShift, shift.shiftStartTime, shift.shiftEndTime)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {shift.pendingCount > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              Pending {shift.pendingCount}
            </span>
          )}
          {shift.overpaidCount > 0 && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
              Overpaid {shift.overpaidCount}
            </span>
          )}
          {shift.notGeneratedCount > 0 && (
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
              Not generated {shift.notGeneratedCount}
            </span>
          )}
          {shift.salaryNotSetCount > 0 && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              No base salary {shift.salaryNotSetCount}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left lg:text-right">
          <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
            Payable
          </p>
          <p className="m-0 mt-2 text-[24px] font-bold text-heading">
            {currencyFmt.full(shift.totalPayable)}
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-left lg:text-right">
          <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-emerald-700 uppercase">
            Paid
          </p>
          <p className="m-0 mt-2 text-[24px] font-bold text-emerald-700">
            {currencyFmt.full(shift.totalPaid)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-left lg:text-right">
          <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-amber-700 uppercase">
            Due
          </p>
          <p className="m-0 mt-2 text-[24px] font-bold text-amber-700">
            {currencyFmt.full(shift.totalDue)}
          </p>
        </div>
      </div>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
  currencyFmt,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string }>;
  label?: string;
  currencyFmt: ReturnType<typeof useCurrencyFormatter>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const payable = Number(payload.find((entry) => entry.name === 'Payable')?.value ?? 0);
  const paid = Number(payload.find((entry) => entry.name === 'Paid')?.value ?? 0);
  const gap = payable - paid;
  const balanceLabel = gap > 0 ? 'Outstanding' : gap < 0 ? 'Overpaid' : 'Balanced';

  return (
    <div
      className="min-w-[220px] rounded-[18px] border bg-white px-4 py-3 shadow-[var(--cr-shadow-card)]"
      style={{ borderColor: 'var(--cr-border,var(--cr-border))' }}
    >
      <p className="m-0 text-[13px] font-semibold text-heading">{label ?? 'Selected month'}</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="font-medium text-[var(--cr-text-2,var(--cr-text-5))]">Payable</span>
          <span className="font-semibold text-[var(--cr-info-700)]">
            {currencyFmt.full(payable)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="font-medium text-[var(--cr-text-2,var(--cr-text-5))]">Paid</span>
          <span className="font-semibold text-[var(--cr-success-700)]">
            {currencyFmt.full(paid)}
          </span>
        </div>
        {gap !== 0 ? (
          <div className="border-t border-[var(--cr-border,var(--cr-border))] pt-2">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[var(--cr-text-2,var(--cr-text-5))]">
                {balanceLabel}
              </span>
              <span className={`font-semibold ${gap > 0 ? 'text-amber-700' : 'text-rose-600'}`}>
                {currencyFmt.full(Math.abs(gap))}
              </span>
            </div>
          </div>
        ) : (
          <div className="border-t border-[var(--cr-border,var(--cr-border))] pt-2">
            <div className="flex items-center justify-between gap-3 text-[13px]">
              <span className="font-medium text-[var(--cr-text-2,var(--cr-text-5))]">
                {balanceLabel}
              </span>
              <span className="font-semibold text-emerald-700">Fully settled</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SalaryOverviewPage() {
  const { loading, data, can } = useMyPermissions();
  if (loading || !data) {
    return (
      <div className="p-6">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }
  // Scope-gate (mirrors attendance/page.tsx): a self-scoped member sees their
  // own salary; managers/owner get the console. Salary uses the legacy
  // module/action model, so gate on can('salary','view','all'), not canPath.
  const selfScoped = !data.isOwner && !can('salary', 'view', 'all');
  if (selfScoped) return <MySalary />;
  return <SalaryOverviewConsole />;
}

function SalaryOverviewConsole() {
  const t = useTranslations('salary.overview');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { month, year } = getPayrollRoutePeriod(searchParams);
  const selectedMonthLabel = useMemo(
    () => dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY'),
    [month, year],
  );

  const { currentWorkspaceId, currentWorkspace, isHydrated } = useWorkspaceStore(
    useShallow((state) => ({
      currentWorkspaceId: state.currentWorkspaceId,
      currentWorkspace: state.currentWorkspace,
      isHydrated: state.isHydrated,
    })),
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overview, setOverview] = useState<PayrollOverviewResponse | null>(null);
  const [gratuitySummary, setGratuitySummary] = useState<GratuitySummary | null>(null);
  const [readinessModalOpen, setReadinessModalOpen] = useState(false);
  const [incompleteMembers, setIncompleteMembers] = useState<PayrollMissingItem[]>([]);
  const [payrollEligibleCount, setPayrollEligibleCount] = useState(0);
  const [readinessChecking, setReadinessChecking] = useState(false);
  const [monthlyTaskStatus, setMonthlyTaskStatus] = useState<MonthlyTaskStatusResponse | null>(
    null,
  );
  const [payslipEmailsDrawerOpen, setPayslipEmailsDrawerOpen] = useState(false);
  const [lockedRecordsDrawerOpen, setLockedRecordsDrawerOpen] = useState(false);
  const currencyFmt = useCurrencyFormatter();
  const features = useSalaryFeatures();
  const { loading: permissionsLoading, can: canPermission } = useMyPermissions();
  const canViewSalaryAll = canPermission('salary', 'view', 'all');
  const canViewGratuityTracking = features.gratuityTracking.enabled;
  const canEditSalary = features.editSalary?.enabled ?? true;

  const replacePeriod = useCallback(
    (nextMonth: number, nextYear: number) => {
      router.replace(
        buildPayrollRouteHref(pathname, searchParams, {
          month: String(nextMonth),
          year: String(nextYear),
        }),
        { scroll: false },
      );
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const queryMonth = searchParams.get('month');
    const queryYear = searchParams.get('year');

    if (!queryMonth || !queryYear) {
      replacePeriod(month, year);
    }
  }, [month, replacePeriod, searchParams, year]);

  const loadOverview = useCallback(async () => {
    if (!currentWorkspaceId || !isHydrated) {
      return;
    }

    startTransition(() => {
      setLoading(true);
    });
    try {
      const [overviewData, gratuityData] = await Promise.all([
        salaryApi.getOverview(currentWorkspaceId, { month, year }),
        canViewGratuityTracking
          ? salaryApi.getGratuitySummary(currentWorkspaceId)
          : Promise.resolve(null),
      ]);
      startTransition(() => {
        setOverview(overviewData);
        setGratuitySummary(gratuityData);
        setError(null);
      });
    } catch (err) {
      startTransition(() => {
        setError(parseApiError(err));
      });
    } finally {
      startTransition(() => {
        setLoading(false);
      });
    }
  }, [canViewGratuityTracking, currentWorkspaceId, isHydrated, month, year]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const fetchMonthlyTaskStatus = useCallback(async () => {
    if (!currentWorkspaceId || !isHydrated) return;
    try {
      const status = await salaryApi.getMonthlyTaskStatus(currentWorkspaceId, month, year);
      startTransition(() => {
        setMonthlyTaskStatus(status);
      });
    } catch {
      /* non-critical */
    }
  }, [currentWorkspaceId, isHydrated, month, year]);

  useEffect(() => {
    void fetchMonthlyTaskStatus();
  }, [fetchMonthlyTaskStatus]);

  const runPayrollHref = useMemo(
    () =>
      buildPayrollRouteHref('/dashboard/salary/run-payroll', searchParams, {
        month: String(month),
        year: String(year),
      }),
    [month, searchParams, year],
  );

  const handleRunPayroll = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setReadinessChecking(true);
    try {
      const res = await listTeam(currentWorkspaceId, { status: 'active', limit: 1000 });
      const members = res.members;
      const incomplete: PayrollMissingItem[] = members
        .filter((m) => !isPayrollReady(m))
        .map((m) => ({ id: m.id, name: m.name, missing: getPayrollMissing(m) }));
      if (incomplete.length > 0) {
        setIncompleteMembers(incomplete);
        setPayrollEligibleCount(members.length - incomplete.length);
        setReadinessModalOpen(true);
      } else {
        router.push(runPayrollHref);
      }
    } catch {
      router.push(runPayrollHref);
    } finally {
      setReadinessChecking(false);
    }
  }, [currentWorkspaceId, router, runPayrollHref]);

  const pendingHref = useMemo(
    () =>
      buildPayrollRouteHref('/dashboard/salary/run-payroll', searchParams, {
        month: String(month),
        year: String(year),
        status: 'pending',
      }),
    [month, searchParams, year],
  );

  const paymentsHref = useMemo(
    () =>
      buildPayrollRouteHref('/dashboard/salary/payments', searchParams, {
        month: String(month),
        year: String(year),
      }),
    [month, searchParams, year],
  );

  const trendData = overview?.trend ?? [];
  const actionNeededCount =
    (overview?.summary.pendingCount ?? 0) + (overview?.summary.partialCount ?? 0);
  // TIER 1 - hero money story (the three numbers that define the month: cost -> paid
  // -> outstanding). Rendered prominently. Overpaid used to be a 4th card; it now lives
  // in the "What needs attention" watchlist below (it is an exception, not a core flow
  // number). See the Overview reorg (hierarchy: money -> action -> reference).
  const heroCards = overview
    ? [
        {
          key: 'payable',
          label: 'Payroll cost',
          value: currencyFmt.full(overview.summary.totalPayable),
          sub: `${overview.summary.employeesCount} employees · ${selectedMonthLabel}`,
          tone: 'primary' as const,
          icon: <RupeeOutlined />,
          infoTooltip: 'Total salary payable to all employees this month, before any payments.',
        },
        {
          key: 'paid',
          label: 'Paid this month',
          value: currencyFmt.full(overview.summary.totalPaid),
          sub: `${overview.summary.paidCount} payroll rows fully settled`,
          tone: 'success' as const,
          icon: <CheckCircleOutlined />,
          infoTooltip: 'Total already paid out to employees this month.',
        },
        {
          key: 'pending',
          label: 'Outstanding',
          value: currencyFmt.full(overview.summary.totalPending),
          sub: `${actionNeededCount} rows still need payment action`,
          tone: 'warning' as const,
          icon: <WarningOutlined />,
          infoTooltip: 'Amount still to be paid this month - rows that need a payment action.',
        },
      ]
    : [];

  // TIER 3 - programs & operational reference (advances / loans / bonus / payslip
  // emails / locked records). Rendered as a compact low-density strip, NOT hero cards -
  // these are context, not daily decisions.
  const secondaryStats = overview
    ? [
        ...(overview.summary.advancesLoansBonus
          ? [
              {
                key: 'outstanding-advances',
                label: t('kpiOutstandingAdvances'),
                value: currencyFmt.full(
                  overview.summary.advancesLoansBonus.totalOutstandingAdvances,
                ),
                sub: t('kpiOutstandingAdvancesSub'),
                tone: 'warning' as const,
                icon: <WarningOutlined />,
                infoTooltip: t('kpiOutstandingAdvancesInfo'),
              },
              {
                key: 'active-loans',
                label: t('kpiActiveLoans'),
                value: String(overview.summary.advancesLoansBonus.totalActiveLoans),
                sub: t('kpiActiveLoansSub', {
                  count: overview.summary.advancesLoansBonus.totalActiveLoans,
                  principal: currencyFmt.full(
                    overview.summary.advancesLoansBonus.totalOutstandingLoanPrincipal,
                  ),
                }),
                tone: 'primary' as const,
                icon: <BankOutlined />,
                infoTooltip: t('kpiActiveLoansInfo'),
              },
              {
                key: 'bonus-commission',
                label: t('kpiBonusCommission'),
                value: currencyFmt.full(
                  overview.summary.advancesLoansBonus.totalBonus +
                    overview.summary.advancesLoansBonus.totalCommission +
                    overview.summary.advancesLoansBonus.totalIncentive,
                ),
                sub: t('kpiBonusCommissionSub', {
                  bonus: currencyFmt.full(overview.summary.advancesLoansBonus.totalBonus),
                  commission: currencyFmt.full(
                    overview.summary.advancesLoansBonus.totalCommission +
                      overview.summary.advancesLoansBonus.totalIncentive,
                  ),
                }),
                tone: 'success' as const,
                icon: <GiftOutlined />,
                infoTooltip: t('kpiBonusCommissionInfo'),
              },
            ]
          : []),
        ...(monthlyTaskStatus
          ? [
              {
                key: 'payslip-emails',
                label: 'Payslip Emails',
                value: `${monthlyTaskStatus.payslipEmails.sent}/${monthlyTaskStatus.payslipEmails.total}`,
                sub: 'View recipients',
                tone: 'primary' as const,
                icon: <MailOutlined />,
                onClick: () => setPayslipEmailsDrawerOpen(true),
                infoTooltip:
                  'Payslip emails sent vs the total for this month. Click to view recipients.',
              },
              {
                key: 'locked-records',
                label: 'Locked Records',
                value: String(monthlyTaskStatus.payslipEmails.locked),
                sub: 'View & unlock',
                tone: 'warning' as const,
                icon: <LockOutlined />,
                onClick: () => setLockedRecordsDrawerOpen(true),
                infoTooltip:
                  'Payroll rows locked after payout or period close. Click to view or unlock.',
              },
            ]
          : []),
      ]
    : [];

  const eligibleGratuityLedgers = useMemo(
    () => (gratuitySummary?.ledgers ?? []).filter((ledger) => ledger.isEligible),
    [gratuitySummary],
  );

  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return (
      <div className="space-y-8">
        <DsCard className="overflow-hidden rounded-[28px]" styles={{ body: { padding: 28 } }}>
          <Skeleton active paragraph={{ rows: 4 }} />
        </DsCard>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <DsCard
              key={`salary-perm-skeleton-${index}`}
              className="rounded-[24px]"
              styles={{ body: { padding: 20 } }}
            >
              <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
            </DsCard>
          ))}
        </div>
      </div>
    );
  }
  if (!canViewSalaryAll) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <DsCard className="max-w-[480px] rounded-[24px]" styles={{ body: { padding: 32 } }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <span className="block text-[15px] font-semibold text-heading">
                  <LockOutlined /> Access Denied
                </span>
                <span className="mt-1 block text-[13px] text-muted">
                  You do not have permission to view the payroll overview. Contact your workspace
                  owner to request access.
                </span>
              </span>
            }
          />
        </DsCard>
      </div>
    );
  }

  return (
    <>
      <DsPageHeader
        title={t('pageTitle')}
        sub={[
          currentWorkspace?.name,
          t('contextEmployees', { count: overview?.summary.employeesCount ?? 0 }),
          t('contextActionNeeded', { count: actionNeededCount }),
        ]
          .filter(Boolean)
          .join(' . ')}
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              icon={<LeftOutlined />}
              aria-label={t('prevMonth')}
              onClick={() => {
                const next = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).subtract(
                  1,
                  'month',
                );
                replacePeriod(next.month() + 1, next.year());
              }}
            />
            <DatePicker
              picker="month"
              allowClear={false}
              aria-label={t('selectMonth')}
              value={dayjs(`${year}-${String(month).padStart(2, '0')}-01`)}
              format="MMMM YYYY"
              onChange={(value) => {
                if (!value) return;
                replacePeriod(value.month() + 1, value.year());
              }}
            />
            <Button
              icon={<RightOutlined />}
              aria-label={t('nextMonth')}
              onClick={() => {
                const next = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).add(1, 'month');
                replacePeriod(next.month() + 1, next.year());
              }}
            />
            <Button
              icon={<CalendarOutlined />}
              onClick={() => {
                const today = dayjs();
                replacePeriod(today.month() + 1, today.year());
              }}
            >
              {t('thisMonth')}
            </Button>
            <Button
              type="primary"
              icon={<RupeeOutlined />}
              loading={readinessChecking}
              onClick={() => void handleRunPayroll()}
            >
              {t('runPayroll')}
            </Button>
            <Button onClick={() => router.push(pendingHref)}>{t('reviewPending')}</Button>
          </div>
        }
      />
      <div className="space-y-8">
        <section className="flex flex-col gap-8">
          {loading && !overview ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <DsCard
                  key={`overview-kpi-skeleton-${index}`}
                  className="rounded-[24px]"
                  styles={{ body: { padding: 20 } }}
                >
                  <Skeleton active paragraph={{ rows: 2 }} title={{ width: '40%' }} />
                </DsCard>
              ))}
            </div>
          ) : overview ? (
            // TIER 1 hero: the three money numbers, 3-across and prominent.
            <div className="grid gap-4 sm:grid-cols-3">
              {heroCards.map((card) => (
                <OverviewMetricCard
                  key={card.key}
                  label={card.label}
                  value={card.value}
                  sub={card.sub}
                  tone={card.tone}
                  icon={card.icon}
                  infoTooltip={card.infoTooltip}
                />
              ))}
            </div>
          ) : null}
        </section>

        {loading && !overview ? (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
            <DsCard className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
              <Skeleton active paragraph={{ rows: 10 }} />
            </DsCard>
            <DsCard className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
              <Skeleton active paragraph={{ rows: 7 }} />
            </DsCard>
          </div>
        ) : error ? (
          <DsCard className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={() => void loadOverview()}>
                Retry payroll overview
              </Button>
            </Empty>
          </DsCard>
        ) : overview ? (
          <>
            {/* items-start: don't force-stretch the chart card to the taller
                watchlist card's height (that left ~110px of dead space at the chart
                card's bottom). Each card now sizes to its own content; the fixed
                chart height below is tuned to sit close to the neighbor's height. */}
            <div className="!mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
              <DsCard className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                      Payroll trend
                    </p>
                    <h2 className="m-0 mt-1 text-[24px] font-bold text-heading">Payable vs paid</h2>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-600">
                    Last 6 months
                  </span>
                </div>
                <div className="w-full">
                  {/* Explicit pixel `height` (not "100%") so ResponsiveContainer never
                      measures an auto-height parent pre-layout - that returns -1 under
                      StrictMode and spams "width(-1) height(-1)" warnings. 400 fills the
                      card to roughly the height of the watchlist card beside it, so the
                      chart uses the space instead of leaving a bottom gap. */}
                  <ResponsiveContainer width="100%" height={400} minWidth={0}>
                    {/* bottom margin 0: the XAxis already reserves its own label band,
                        so the default 5px chart margin just widened the gap under the
                        plot. */}
                    <BarChart
                      data={trendData}
                      barGap={8}
                      margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(148,163,184,0.18)"
                      />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        axisLine={false}
                        // height + tickMargin pull the month labels up close to the plot
                        // so the bottom gap matches how tight the Y labels sit (default
                        // XAxis height 30 + margin left the X labels floating lower).
                        height={22}
                        tickMargin={6}
                        tick={{ fill: 'var(--cr-text-5)', fontSize: 12 }}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        // 56 fits the widest compact label (~"₹200.00L") while cutting the
                        // ~28px of dead left gutter the old width=84 left for small "₹0-₹4"
                        // ticks. Keep in sync with formatCurrency's compact output.
                        width={56}
                        tick={{ fill: 'var(--cr-text-5)', fontSize: 12 }}
                        tickFormatter={(value: number) => currencyFmt.currency(Number(value ?? 0))}
                      />
                      <RechartsTooltip
                        cursor={{ fill: 'rgba(15,23,42,0.04)' }}
                        content={<TrendTooltip currencyFmt={currencyFmt} />}
                      />
                      <Bar
                        dataKey="totalPayable"
                        name="Payable"
                        fill="var(--cr-primary-border)"
                        radius={[10, 10, 0, 0]}
                      />
                      <Bar
                        dataKey="totalPaid"
                        name="Paid"
                        fill="var(--cr-success-500)"
                        radius={[10, 10, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </DsCard>

              <DsCard className="rounded-[24px]" styles={{ body: { padding: 24 } }}>
                <div>
                  <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                    Operational watchlist
                  </p>
                  <h2 className="m-0 mt-1 text-[24px] font-bold text-heading">
                    What needs attention
                  </h2>
                  <p className="m-0 mt-2 text-[14px] leading-6 text-muted">
                    Keep the payroll run page focused on action. Use these counters to decide which
                    queue needs attention first.
                  </p>
                </div>

                {/* Counter grid uses a CONTAINER query (@container), not viewport
                    breakpoints: the collapsible sidebar changes this card's real width
                    without changing the viewport size, so 4 fixed viewport columns went
                    cramped when the sidebar was open. @2xl (~672px of available card
                    width) is where 4 columns fit the longest label ("No base salary")
                    on one line; below that we drop to 2 wide columns. Keep in sync with
                    the "Programs & operational" strip if that grid is ever tightened. */}
                <div className="@container mt-5">
                  <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
                    <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4">
                      {/* Icon is inline (trails the text), not a flex item: when a long
                          label wraps it stays attached to the last word instead of
                          floating mid-height on the right. min-h reserves 2 lines so the
                          big numbers stay aligned across all four cards. */}
                      <p className="m-0 flex min-h-[2.4em] items-start text-[11px] leading-tight font-semibold tracking-[0.08em] text-amber-700 uppercase">
                        <span>
                          Pending{' '}
                          <Tooltip
                            title="Payroll generated but not yet fully paid."
                            placement="top"
                          >
                            <InfoCircleOutlined
                              className="cursor-help align-[-1px] text-[10px] opacity-60 hover:opacity-100"
                              aria-label="About Pending"
                            />
                          </Tooltip>
                        </span>
                      </p>
                      <p className="m-0 mt-1 text-[32px] leading-none font-bold text-amber-700">
                        {overview.summary.pendingCount}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                      <p className="m-0 flex min-h-[2.4em] items-start text-[11px] leading-tight font-semibold tracking-[0.08em] text-slate-600 uppercase">
                        <span>
                          Not generated{' '}
                          <Tooltip
                            title="Employees whose payroll hasn't been generated yet this month."
                            placement="top"
                          >
                            <InfoCircleOutlined
                              className="cursor-help align-[-1px] text-[10px] opacity-60 hover:opacity-100"
                              aria-label="About Not generated"
                            />
                          </Tooltip>
                        </span>
                      </p>
                      <p className="m-0 mt-1 text-[32px] leading-none font-bold text-slate-900">
                        {overview.summary.notGeneratedCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-4">
                      <p className="m-0 flex min-h-[2.4em] items-start text-[11px] leading-tight font-semibold tracking-[0.08em] text-red-700 uppercase">
                        <span>
                          No base salary{' '}
                          <Tooltip
                            title="Employees with no base salary set - payroll can't be generated for them."
                            placement="top"
                          >
                            <InfoCircleOutlined
                              className="cursor-help align-[-1px] text-[10px] opacity-60 hover:opacity-100"
                              aria-label="About No base salary"
                            />
                          </Tooltip>
                        </span>
                      </p>
                      <p className="m-0 mt-1 text-[32px] leading-none font-bold text-red-700">
                        {overview.summary.salaryNotSetCount}
                      </p>
                    </div>
                    {/* Overpaid folded in here (was a separate hero card) - it is an
                        exception to action on, not a core money number. Count matches the
                        counter pattern; the ₹ amount is in the tooltip. */}
                    <div className="rounded-[20px] border border-indigo-200 bg-indigo-50 px-4 py-4">
                      <p className="m-0 flex min-h-[2.4em] items-start text-[11px] leading-tight font-semibold tracking-[0.08em] text-indigo-700 uppercase">
                        <span>
                          Overpaid{' '}
                          <Tooltip
                            title={`Rows paid more than the net salary due. ${currencyFmt.full(overview.summary.totalOverpaid)} overpaid in total.`}
                            placement="top"
                          >
                            <InfoCircleOutlined
                              className="cursor-help align-[-1px] text-[10px] opacity-60 hover:opacity-100"
                              aria-label="About Overpaid"
                            />
                          </Tooltip>
                        </span>
                      </p>
                      <p className="m-0 mt-1 text-[32px] leading-none font-bold text-indigo-700">
                        {overview.summary.advanceCount}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 space-y-3 rounded-[24px] border border-dashed border-[var(--cr-border,var(--cr-border))] bg-slate-50 px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-[13px] font-semibold text-heading">
                        Jump back into execution
                      </p>
                      <p className="m-0 mt-1 text-[12px] leading-5 text-muted">
                        The overview is intentionally read-first. Move into payroll execution or
                        payment reconciliation only when you are ready to act.
                      </p>
                    </div>
                    <ArrowRightOutlined className="mt-1 text-[var(--cr-primary,var(--cr-info-500))]" />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                      block
                      loading={readinessChecking}
                      onClick={() => void handleRunPayroll()}
                    >
                      Open Run Payroll
                    </Button>
                    <Button block onClick={() => router.push(paymentsHref)}>
                      Open Payments Register
                    </Button>
                  </div>
                </div>
              </DsCard>
            </div>

            {/* TIER 3 - programs & operational reference, compact + de-emphasized so it
                reads as context below the money story and the action watchlist. */}
            {secondaryStats.length > 0 && (
              <DsCard className="!mt-5 rounded-[24px]" styles={{ body: { padding: 24 } }}>
                <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                  Programs &amp; operational
                </p>
                <p className="m-0 mt-1 text-[13px] text-muted">
                  Advances, loans, bonus and task status - reference, not this month&rsquo;s action.
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {secondaryStats.map((card) => (
                    <OverviewMetricCard
                      key={card.key}
                      label={card.label}
                      value={card.value}
                      sub={card.sub}
                      tone={card.tone}
                      icon={card.icon}
                      compact
                      onClick={'onClick' in card ? card.onClick : undefined}
                      infoTooltip={'infoTooltip' in card ? card.infoTooltip : undefined}
                    />
                  ))}
                </div>
              </DsCard>
            )}

            <DsCard className="!mt-5 rounded-[24px]" styles={{ body: { padding: 24 } }}>
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                    Shift snapshot
                  </p>
                  <h2 className="m-0 mt-1 text-[24px] font-bold text-heading">
                    Where payroll is sitting by shift
                  </h2>
                  <p className="m-0 mt-2 text-[14px] leading-6 text-muted">
                    A compact shift-first view of the month so you can spot where dues or
                    overpayments are clustering before drilling into the detailed payroll worklist.
                  </p>
                </div>
                <Button
                  type="primary"
                  size="large"
                  className="min-w-[220px]"
                  onClick={() =>
                    router.push(
                      buildPayrollRouteHref('/dashboard/salary/run-payroll', searchParams, {
                        month: String(month),
                        year: String(year),
                        view: 'shift',
                      }),
                    )
                  }
                >
                  Open shift worklist
                </Button>
              </div>

              {overview.shiftSnapshot.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No shift payroll snapshot is available for this month yet."
                />
              ) : (
                <div className="space-y-3">
                  {overview.shiftSnapshot.map((shift) => (
                    <ShiftSnapshotRow key={shift.shiftId ?? 'unassigned'} shift={shift} />
                  ))}
                </div>
              )}
            </DsCard>

            {canViewGratuityTracking && (
              <DsCard className="!mt-5 rounded-[24px]" styles={{ body: { padding: 24 } }}>
                <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="m-0 text-[11px] font-semibold tracking-[0.1em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                      Employer Liability
                    </p>
                    <h2 className="m-0 mt-1 text-[24px] font-bold text-heading">
                      Gratuity Liability
                    </h2>
                    <p className="m-0 mt-2 text-[14px] leading-6 text-muted">
                      Track long-service gratuity exposure across the workspace. This is employer
                      liability only and is never deducted from employee net salary.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 px-5 py-4">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-emerald-700 uppercase">
                      Eligible Employees
                    </p>
                    <p className="m-0 mt-2 text-[32px] leading-none font-bold text-emerald-700">
                      {gratuitySummary?.totalEligibleEmployees ?? 0}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-blue-200 bg-blue-50 px-5 py-4">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-blue-700 uppercase">
                      Total Gratuity Liability
                    </p>
                    <p className="m-0 mt-2 text-[32px] leading-none font-bold text-blue-700">
                      {currencyFmt.full(gratuitySummary?.totalGratuityLiability ?? 0)}
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4">
                    <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-amber-700 uppercase">
                      Nearing Eligibility (4th year)
                    </p>
                    <p className="m-0 mt-2 text-[32px] leading-none font-bold text-amber-700">
                      {gratuitySummary?.nearingEligibility ?? 0}
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  {eligibleGratuityLedgers.length === 0 ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="No employees have crossed 5 years of service yet."
                    />
                  ) : (
                    <div className="overflow-x-auto rounded-[20px] border border-[var(--cr-border,var(--cr-border))]">
                      <div className="grid grid-cols-[minmax(0,1.4fr)_140px_140px_160px_130px] gap-4 bg-[var(--cr-surface-2,var(--cr-bg))] px-4 py-3 text-[11px] font-semibold tracking-[0.08em] text-[var(--cr-text-3,var(--cr-text-3))] uppercase">
                        <span>Employee</span>
                        <span>Service Duration</span>
                        <span>Basic Salary</span>
                        <span>Gratuity Amount</span>
                        <span>Status</span>
                      </div>
                      {eligibleGratuityLedgers.map((ledger) => (
                        <div
                          key={`${ledger.teamMemberId}-${ledger.lastCalculatedYear}-${ledger.lastCalculatedMonth}`}
                          className="grid grid-cols-[minmax(0,1.4fr)_140px_140px_160px_130px] gap-4 border-t border-[var(--cr-border,var(--cr-border))] px-4 py-3 text-[13px]"
                        >
                          <span className="font-medium text-heading">
                            {ledger.employeeName || ledger.teamMemberId}
                          </span>
                          <span className="text-muted">
                            {formatServiceDurationLabel(
                              ledger.completedYears,
                              ledger.completedMonths,
                            )}
                          </span>
                          <span className="text-heading">
                            {currencyFmt.full(ledger.lastBasicSalary)}
                          </span>
                          <span className="font-semibold text-emerald-700">
                            {currencyFmt.full(ledger.gratuityAmount)}
                          </span>
                          <span>
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                              Eligible
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </DsCard>
            )}
          </>
        ) : null}
      </div>

      <PayrollReadinessModal
        open={readinessModalOpen}
        onClose={() => setReadinessModalOpen(false)}
        incompleteMembers={incompleteMembers}
        eligibleCount={payrollEligibleCount}
        onSkip={() => {
          setReadinessModalOpen(false);
          router.push(runPayrollHref);
        }}
        onComplete={() => {
          setReadinessModalOpen(false);
          router.push('/dashboard/team');
        }}
      />
      <PayslipEmailsDrawer
        open={payslipEmailsDrawerOpen}
        onClose={() => setPayslipEmailsDrawerOpen(false)}
        data={monthlyTaskStatus}
        month={month}
        year={year}
        workspaceId={currentWorkspaceId ?? ''}
        onRefetch={fetchMonthlyTaskStatus}
      />
      <LockedRecordsDrawer
        open={lockedRecordsDrawerOpen}
        onClose={() => setLockedRecordsDrawerOpen(false)}
        data={monthlyTaskStatus}
        month={month}
        year={year}
        workspaceId={currentWorkspaceId ?? ''}
        canEdit={canEditSalary}
        onRefetch={fetchMonthlyTaskStatus}
      />
    </>
  );
}
