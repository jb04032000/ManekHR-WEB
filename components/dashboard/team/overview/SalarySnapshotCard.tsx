'use client';

import { Button, Skeleton } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { LedgerRecord } from '@/types';
import { StatTile } from '@/components/ui';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import { buildMemberSalaryHref } from '@/features/employee-hub/memberFocusHref';

export interface SalarySnapshotCardProps {
  memberId: string;
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  advancesOutstanding?: number | null;
  loanOutstanding?: number | null;
  advancesEnabled: boolean;
  loansEnabled: boolean;
  onViewSalary: () => void;
}

// ── Financial year helpers (Indian FY: April - March) ─────────────────────────

function currentFyStart(): number {
  const now = new Date();
  return now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
}

function fyBounds(startYear: number): { start: string; end: string } {
  return {
    start: `${startYear}-04`,
    end: `${startYear + 1}-03`,
  };
}

export function SalarySnapshotCard({
  memberId,
  ledger,
  ledgerLoading,
  advancesOutstanding,
  loanOutstanding,
  advancesEnabled,
  loansEnabled,
  onViewSalary,
}: SalarySnapshotCardProps) {
  const t = useTranslations('team');
  const fmt = useCurrencyFormatter();

  const now = dayjs();
  const currentMonthKey = now.format('YYYY-MM');

  const salaryHref = buildMemberSalaryHref(memberId);

  // ── Derive KPIs from ledger (no fetch) ─────────────────────────────────────
  const currentMonthEntry = ledger?.months.find((m) => m.monthKey === currentMonthKey) ?? null;

  const hasCurrentMonth = currentMonthEntry !== null;
  const netThisMonth = currentMonthEntry?.salary ?? 0;
  const paidThisMonth = currentMonthEntry?.paid ?? 0;
  const outstanding = currentMonthEntry?.remaining ?? 0;

  const ytdPaid = (() => {
    if (!ledger?.months.length) return 0;
    const { start, end } = fyBounds(currentFyStart());
    return ledger.months
      .filter((m) => m.monthKey >= start && m.monthKey <= end)
      .reduce((acc, m) => acc + m.paid, 0);
  })();

  const dash = '-';
  const fmtVal = (n: number) => fmt.full(n);

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-surface p-5">
      <h3 className="m-0 text-[13px] font-semibold tracking-[0.04em] text-muted uppercase">
        {t('overview.salaryTitle')}
      </h3>

      {ledgerLoading ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}
        >
          <StatTile
            label={t('overview.kpiNetThisMonth')}
            value={hasCurrentMonth ? fmtVal(netThisMonth) : dash}
            emphasis
          />
          <StatTile
            label={t('overview.kpiPaidThisMonth')}
            value={hasCurrentMonth ? fmtVal(paidThisMonth) : dash}
          />
          <StatTile
            label={t('overview.kpiOutstanding')}
            value={hasCurrentMonth ? fmtVal(outstanding) : dash}
            tone={outstanding > 0 ? 'danger' : 'neutral'}
          />
          <StatTile label={t('overview.kpiYtdPaid')} value={fmtVal(ytdPaid)} />
          {advancesEnabled && advancesOutstanding != null && (
            <StatTile
              label={t('overview.kpiAdvances')}
              value={fmtVal(advancesOutstanding)}
              tone={advancesOutstanding > 0 ? 'danger' : 'neutral'}
            />
          )}
          {loansEnabled && loanOutstanding != null && (
            <StatTile
              label={t('overview.kpiLoanBalance')}
              value={fmtVal(loanOutstanding)}
              tone={loanOutstanding > 0 ? 'danger' : 'neutral'}
            />
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--cr-border-subtle,rgba(0,0,0,0.06))] pt-3">
        <Button type="primary" size="small" onClick={onViewSalary}>
          {t('overview.viewSalary')}
        </Button>
        <Link
          href={salaryHref}
          className="inline-flex items-center gap-1 text-[13px] text-[var(--cr-primary,var(--cr-text-1))] hover:opacity-80"
        >
          {t('overview.openInPayroll')}
          <ArrowRightOutlined className="text-xs" />
        </Link>
      </div>
    </div>
  );
}
