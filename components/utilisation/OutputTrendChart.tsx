'use client';

/**
 * Phase 25 / Plan 25-12 - Output trend chart (per-machine drilldown).
 *
 * Recharts LineChart wrapped in ResponsiveContainer. X = period, Y = output.
 * Title and metric label come in via i18n at the page level - chart itself
 * stays presentational so it can be reused.
 */
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTranslations } from 'next-intl';
import DsCard from '@/components/ui/DsCard';
import type { TrendPoint } from '@/types';

interface OutputTrendChartProps {
  data: TrendPoint[];
  metric: string;
}

export function OutputTrendChart({ data, metric }: OutputTrendChartProps) {
  const t = useTranslations('dashboard-production-utilisation');

  const series = data.map((p) => ({
    period: p.period,
    output: p.output,
  }));

  return (
    <DsCard>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--cr-text)',
          }}
        >
          {t('trend.outputTitle')}
        </span>
        <span style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>{metric}</span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: 'var(--cr-text-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--cr-text-3)' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--cr-border)',
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="output"
            name={metric}
            stroke="var(--cr-primary, var(--cr-info-500))"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </DsCard>
  );
}

export default OutputTrendChart;
