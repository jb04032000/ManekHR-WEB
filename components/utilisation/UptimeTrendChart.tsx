'use client';

/**
 * Phase 25 / Plan 25-12 - Uptime trend chart (per-machine drilldown).
 *
 * Recharts AreaChart with a target reference line. Y axis = uptime % (0..100).
 */
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useTranslations } from 'next-intl';
import DsCard from '@/components/ui/DsCard';
import type { TrendPoint } from '@/types';

interface UptimeTrendChartProps {
  data: TrendPoint[];
}

export function UptimeTrendChart({ data }: UptimeTrendChartProps) {
  const t = useTranslations('dashboard-production-utilisation');

  const series = data.map((p) => ({
    period: p.period,
    uptimePct: p.uptimePct,
  }));

  const target = data[0]?.targetPct ?? 85;

  return (
    <DsCard>
      <div style={{ marginBottom: 12 }}>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            color: 'var(--cr-text)',
          }}
        >
          {t('trend.uptimeTitle')}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={series} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="uptimeFill" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--cr-primary, var(--cr-info-500))"
                stopOpacity={0.35}
              />
              <stop
                offset="100%"
                stopColor="var(--cr-primary, var(--cr-info-500))"
                stopOpacity={0.02}
              />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
          <XAxis
            dataKey="period"
            tick={{ fontSize: 11, fill: 'var(--cr-text-3)' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            tick={{ fontSize: 11, fill: 'var(--cr-text-3)' }}
            axisLine={false}
            tickLine={false}
            width={48}
          />
          <Tooltip
            formatter={(v: unknown) => [`${Number(v).toFixed(1)}%`, t('trend.uptimeTitle')]}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid var(--cr-border)',
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={target}
            stroke="var(--cr-warning, var(--cr-warning-700))"
            strokeDasharray="4 4"
            label={{
              value: t('trend.targetReferenceLabel', { pct: target }),
              fontSize: 11,
              fill: 'var(--cr-warning, var(--cr-warning-700))',
              position: 'insideTopRight',
            }}
          />
          <Area
            type="monotone"
            dataKey="uptimePct"
            stroke="var(--cr-primary, var(--cr-info-500))"
            fill="url(#uptimeFill)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </DsCard>
  );
}

export default UptimeTrendChart;
