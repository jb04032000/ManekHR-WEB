'use client';
// PnlTrendChart — monthly Revenue / Gross Profit / Net Profit lines for the
// accounting dashboard's "Accounting Insights" section. Presentational only:
// receives ProfitLossComparisonMonth[] already fetched by AccountingInsights
// (no fetching here). Mirrors RevenueTrendChart's DsCard + Recharts pattern.
// Money is paise; chart data is divided by 100 like the reference chart, and
// axis/tooltip use fmtPaiseCompact / fmtPaise so the ×100 round-trips cleanly.
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Empty } from 'antd';
import DsCard from '@/components/ui/DsCard';
import { fmtPaise, fmtPaiseCompact } from '@/lib/utils';
import type { ProfitLossComparisonMonth } from '@/types';

interface Props {
  data: ProfitLossComparisonMonth[];
}

export function PnlTrendChart({ data }: Props) {
  // paise → rupees only inside the chart data map (allowed exception to the
  // "never hand-divide" rule, same as RevenueTrendChart).
  const series = (data ?? []).map((m) => ({
    label: m.label,
    revenue: m.revenuePaise / 100,
    grossProfit: m.grossProfitPaise / 100,
    netProfit: m.netProfitPaise / 100,
  }));

  return (
    <DsCard>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          Profit &amp; Loss Trend
        </span>
      </div>
      {series.length === 0 ? (
        <Empty description="No P&L data for this period" style={{ padding: '32px 0' }} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={series} margin={{ top: 10, right: 16, left: 16, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 12, fill: 'var(--cr-text-3)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => fmtPaiseCompact(v * 100)}
              tick={{ fontSize: 12, fill: 'var(--cr-text-4)' }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              formatter={(v: unknown, name: unknown) => [
                fmtPaise((v as number) * 100),
                name === 'revenue'
                  ? 'Revenue'
                  : name === 'grossProfit'
                    ? 'Gross Profit'
                    : 'Net Profit',
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--cr-border)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="var(--cr-primary)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="grossProfit"
              name="Gross Profit"
              stroke="var(--cr-success-500)"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="netProfit"
              name="Net Profit"
              stroke="var(--cr-indigo-400)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </DsCard>
  );
}

export default PnlTrendChart;
