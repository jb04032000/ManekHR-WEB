'use client';
/**
 * PayrollTrendCard — last-6-months payroll trend (payable vs paid) as a recharts
 * bar chart on the workforce dashboard (app/dashboard/page.tsx). Presentational:
 * consumes the PayrollOverviewResponse the page fetches once (shared with
 * MoneyMovementCard) so the dashboard never calls the salary overview twice.
 *
 * Cross-module: data from salaryApi.getOverview (BE salary service). Gated by
 * canSee('salary') in page.tsx. UNITS: salary overview figures are RUPEES — use
 * formatCurrency*, never paise helpers.
 */
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Skeleton, Empty } from 'antd';
import { useTranslations } from 'next-intl';
import { formatCurrency, formatCurrencyFull } from '@/lib/utils';
import type { PayrollOverviewResponse } from '@/types';
import { WidgetCard } from './WidgetCard';

interface Props {
  data: PayrollOverviewResponse | null;
  loading: boolean;
}

export function PayrollTrendCard({ data, loading }: Props) {
  const t = useTranslations('dashboard');
  const trend = data?.trend ?? [];
  const series = trend.map((m) => ({
    label: m.label,
    payable: m.totalPayable,
    paid: m.totalPaid,
  }));
  const hasData = series.some((s) => s.payable > 0 || s.paid > 0);

  return (
    <WidgetCard
      title={t('payrollTrend.title')}
      iconColor="var(--cr-gold-500)"
      viewAllHref="/dashboard/salary"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : !hasData ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('payrollTrend.empty')} />
      ) : (
        <>
          <div
            className="mb-2 flex flex-wrap gap-4 text-[11px]"
            style={{ color: 'var(--cr-text-3)' }}
          >
            <Legend color="var(--cr-primary)" label={t('payrollTrend.payable')} />
            <Legend color="var(--cr-success-500)" label={t('payrollTrend.paid')} />
          </div>
          <div
            style={{ width: '100%', height: 240 }}
            role="img"
            aria-label={t('payrollTrend.title')}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => formatCurrency(v)}
                  tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                  width={56}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid var(--cr-border)',
                    fontSize: 12,
                  }}
                  formatter={(v: unknown, name: unknown) => [
                    formatCurrencyFull(Number(v)),
                    name === 'payable' ? t('payrollTrend.payable') : t('payrollTrend.paid'),
                  ]}
                />
                <Bar
                  dataKey="payable"
                  name="payable"
                  fill="var(--cr-primary)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="paid"
                  name="paid"
                  fill="var(--cr-success-500)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </WidgetCard>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: color }} />
      {label}
    </span>
  );
}

export default PayrollTrendCard;
