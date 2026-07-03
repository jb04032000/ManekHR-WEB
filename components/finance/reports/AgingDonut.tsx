'use client';
// AgingDonut — donut breakdown of the 5 aging buckets (Current / 0-30 / 31-60 /
// 61-90 / 90+) from an AgingReport.summary (Record<string,number> of paise).
// Reused for BOTH receivables and payables via the `title` prop. Presentational:
// AccountingInsights passes the already-fetched summary. Bucket keys must match
// the backend AgingReport.summary keys (current,b0_30,b31_60,b61_90,b90plus).
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { Empty } from 'antd';
import DsCard from '@/components/ui/DsCard';
import { fmtPaise } from '@/lib/utils';

interface Props {
  summary: Record<string, number>;
  title: string;
}

// Bucket key → human label + slice colour. Five distinct --cr-* tokens, ordered
// least-aged (calm primary) to most-aged (danger red) so the chart reads as a
// risk gradient.
const BUCKETS: Array<{ key: string; label: string; color: string }> = [
  { key: 'current', label: 'Current', color: 'var(--cr-primary)' },
  { key: 'b0_30', label: '0-30', color: 'var(--cr-info-500)' },
  { key: 'b31_60', label: '31-60', color: 'var(--cr-gold-500)' },
  { key: 'b61_90', label: '61-90', color: 'var(--cr-warning-500)' },
  { key: 'b90plus', label: '90+', color: 'var(--cr-danger-500)' },
];

export function AgingDonut({ summary, title }: Props) {
  // paise → rupees inside the chart data map only (allowed exception); tooltip
  // re-multiplies by 100 via fmtPaise so display stays paise-accurate.
  const data = BUCKETS.map((b) => ({
    name: b.label,
    color: b.color,
    valueRupees: Number(summary?.[b.key] ?? 0) / 100,
  }));

  const allZero = data.every((d) => d.valueRupees === 0);

  return (
    <DsCard>
      <div style={{ marginBottom: 16 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          {title}
        </span>
      </div>
      {allZero ? (
        <Empty description="No outstanding balance" style={{ padding: '32px 0' }} />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={data}
              dataKey="valueRupees"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={86}
              paddingAngle={2}
              stroke="var(--cr-surface)"
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown, name: unknown) => [
                fmtPaise((v as number) * 100),
                String(name ?? ''),
              ]}
              contentStyle={{ borderRadius: 8, border: '1px solid var(--cr-border)', fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </DsCard>
  );
}

export default AgingDonut;
