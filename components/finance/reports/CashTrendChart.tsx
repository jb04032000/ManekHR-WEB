'use client';
// CashTrendChart — monthly cash inflow vs outflow bars + a net-movement line.
// Outflow already INCLUDES payroll (computed backend-side), hence the title note
// so owners read the bars as true cash burn, not just AP. Presentational:
// AccountingInsights passes already-fetched CashMovementMonth[].
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
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
import type { CashMovementMonth } from '@/types';

interface Props {
  data: CashMovementMonth[];
}

export function CashTrendChart({ data }: Props) {
  // paise → rupees inside the chart data map only (allowed exception).
  const series = (data ?? []).map((m) => ({
    month: m.month,
    inflow: m.inflowPaise / 100,
    outflow: m.outflowPaise / 100,
    net: m.netPaise / 100,
  }));

  return (
    <DsCard>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          Cash Movement (incl. payroll)
        </span>
      </div>
      {series.length === 0 ? (
        <Empty description="No cash movement for this period" style={{ padding: '32px 0' }} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={series} margin={{ top: 10, right: 16, left: 16, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
            <XAxis
              dataKey="month"
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
                name === 'inflow' ? 'Inflow' : name === 'outflow' ? 'Outflow' : 'Net',
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--cr-border)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              dataKey="inflow"
              name="Inflow"
              fill="var(--cr-success-500)"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="outflow"
              name="Outflow"
              fill="var(--cr-danger-500)"
              radius={[4, 4, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="net"
              name="Net"
              stroke="var(--cr-primary)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </DsCard>
  );
}

export default CashTrendChart;
