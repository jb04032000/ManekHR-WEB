'use client';
// BalanceSheetCompositionChart — side-by-side bars comparing Total Assets vs
// Total Liabilities + Capital, with a balanced / out-of-balance indicator. Kept
// deliberately simple: the accounting equation (Assets = Liabilities + Capital)
// is the headline; deeper composition lives in the standalone balance-sheet
// report. Presentational — AccountingInsights passes the already-fetched block.
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Tag } from 'antd';
import { CheckCircleOutlined, WarningOutlined } from '@ant-design/icons';
import DsCard from '@/components/ui/DsCard';
import { fmtPaise, fmtPaiseCompact } from '@/lib/utils';
import type { AccountingDashboardBalanceSheet } from '@/types';

interface Props {
  data: AccountingDashboardBalanceSheet;
}

export function BalanceSheetCompositionChart({ data }: Props) {
  // paise → rupees inside the chart data map only (allowed exception). Two bars so
  // a visual mismatch in height instantly signals an unbalanced sheet.
  const chartData = [
    {
      name: 'Assets',
      valueRupees: (data?.totalAssetsPaise ?? 0) / 100,
      color: 'var(--cr-primary)',
    },
    {
      name: 'Liab. + Capital',
      valueRupees: (data?.totalLiabilitiesCapitalPaise ?? 0) / 100,
      color: 'var(--cr-indigo-400)',
    },
  ];

  const balanced = !!data?.isBalanced;

  return (
    <DsCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>
          Balance Sheet
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {data?.isUnaudited && <Tag color="warning">Unaudited</Tag>}
          <Tag
            icon={balanced ? <CheckCircleOutlined /> : <WarningOutlined />}
            color={balanced ? 'success' : 'error'}
          >
            {balanced ? 'Balanced' : 'Out of balance'}
          </Tag>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} margin={{ top: 10, right: 16, left: 16, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
          <XAxis
            dataKey="name"
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
            formatter={(v: unknown) => [fmtPaise((v as number) * 100), 'Total']}
            contentStyle={{ borderRadius: 8, border: '1px solid var(--cr-border)', fontSize: 12 }}
          />
          <Bar dataKey="valueRupees" name="Total" radius={[4, 4, 0, 0]} maxBarSize={96}>
            {/* Per-bar colour so Assets vs Liab+Capital are visually distinct;
                the balanced Tag in the header carries the status meaning. */}
            {chartData.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {data?.asOfDate && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--cr-text-4)' }}>
          As of {data.asOfDate}
        </p>
      )}
    </DsCard>
  );
}

export default BalanceSheetCompositionChart;
