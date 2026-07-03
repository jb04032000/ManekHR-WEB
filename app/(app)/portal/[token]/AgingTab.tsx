'use client';
import { useEffect, useState, startTransition } from 'react';
import { Empty, Skeleton } from 'antd';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';
import { portalClient, formatINRPaise } from './portal-client-api';

interface AgingRow {
  partyId: string;
  partyName: string;
  current: number;
  b0_30: number;
  b31_60: number;
  b61_90: number;
  b90plus: number;
  total: number;
}

// Bucket data keys + their i18n label key under finance.portal.aging.
const BUCKETS: Array<{ labelKey: string; key: keyof AgingRow }> = [
  { labelKey: 'bucketCurrent', key: 'current' },
  { labelKey: 'bucket0_30', key: 'b0_30' },
  { labelKey: 'bucket31_60', key: 'b31_60' },
  { labelKey: 'bucket61_90', key: 'b61_90' },
  { labelKey: 'bucket90plus', key: 'b90plus' },
];

export default function AgingTab({ token }: { token: string }) {
  const t = useTranslations('finance.portal');
  const [row, setRow] = useState<AgingRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    startTransition(() => {
      setLoading(true);
    });
    portalClient
      .aging(token)
      .then((d) => {
        if (active) setRow(d as AgingRow);
      })
      .catch(() => {
        if (active) setRow(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  if (loading) return <Skeleton active paragraph={{ rows: 4 }} />;
  if (!row) return <Empty description={t('aging.empty')} />;

  const chartData = BUCKETS.map((b) => ({
    bucket: t(`aging.${b.labelKey}`),
    valuePaise: Number(row[b.key] ?? 0),
    valueRupees: Number(row[b.key] ?? 0) / 100,
  }));

  const allZero = chartData.every((d) => d.valuePaise === 0);
  if (allZero) {
    return <Empty description={t('aging.emptyNoBalance')} />;
  }

  return (
    <div>
      <div style={{ width: '100%', height: 240 }} className="mb-4">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 16, bottom: 10, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatINRPaise(v * 100)} />
            <YAxis type="category" dataKey="bucket" width={100} />
            <Tooltip
              formatter={(value) => {
                const n = typeof value === 'number' ? value : Number(value ?? 0);
                return [formatINRPaise(n * 100), t('aging.tooltipOutstanding')];
              }}
            />
            <Bar
              dataKey="valueRupees"
              fill="var(--cr-primary, var(--cr-primary))"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: 'var(--cr-text-3)' }} className="text-xs uppercase">
            <th className="py-2 text-left">{t('aging.colBucket')}</th>
            <th className="py-2 text-right">{t('aging.colOutstanding')}</th>
          </tr>
        </thead>
        <tbody>
          {BUCKETS.map((b) => (
            <tr key={b.key} style={{ borderTop: '1px solid var(--cr-border, var(--cr-border))' }}>
              <td className="py-2">{t(`aging.${b.labelKey}`)}</td>
              <td className="py-2 text-right">{formatINRPaise(Number(row[b.key] ?? 0))}</td>
            </tr>
          ))}
          <tr
            style={{ borderTop: '1px solid var(--cr-border, var(--cr-border))', fontWeight: 700 }}
          >
            <td className="py-2">{t('aging.total')}</td>
            <td className="py-2 text-right">{formatINRPaise(row.total ?? 0)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
