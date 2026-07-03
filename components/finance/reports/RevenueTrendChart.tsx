'use client';
import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Segmented } from 'antd';
import DsCard from '@/components/ui/DsCard';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise, fmtPaiseCompact } from '@/lib/utils';
import type { RevenueTrendMonth } from '@/types';

interface Props {
  wsId: string;
  firmId: string;
}

export function RevenueTrendChart({ wsId, firmId }: Props) {
  const [mode, setMode] = useState<'current_fy' | 'last_12_months'>('current_fy');
  const [months, setMonths] = useState<RevenueTrendMonth[]>([]);

  useEffect(() => {
    if (!wsId || !firmId) return;
    financeReportsApi
      .revenueTrend(wsId, firmId, mode)
      .then((r) => setMonths(r.months))
      .catch(() => {});
  }, [wsId, firmId, mode]);

  const data = months.map((m) => ({
    month: m.month,
    revenue: m.revenuePaise / 100,
    collected: m.collectedPaise / 100,
  }));

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
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          Revenue - This Financial Year
        </span>
        <Segmented
          options={[
            { label: 'Current FY', value: 'current_fy' },
            { label: 'Last 12 months', value: 'last_12_months' },
          ]}
          value={mode}
          onChange={(v) => setMode(v as 'current_fy' | 'last_12_months')}
        />
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ top: 10, right: 16, left: 16, bottom: 5 }}>
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
              name === 'revenue' ? 'Revenue' : 'Collected',
            ]}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="revenue" name="Revenue" fill="var(--cr-primary)" radius={[4, 4, 0, 0]} />
          <Bar
            dataKey="collected"
            name="Collected"
            fill="var(--cr-success-500)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </DsCard>
  );
}
