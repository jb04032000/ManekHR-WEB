'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Spin } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { DsStatCard } from '@/components/ui/DsCard';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaiseCompact } from '@/lib/utils';
import type { DashboardKpiResponse } from '@/types';

interface KpiDashboardProps {
  wsId: string;
  firmId: string;
}

const ZERO_KPIS: DashboardKpiResponse = {
  revenue: { valuePaise: 0, trendPct: null },
  outstanding: { valuePaise: 0, trendPct: null },
  payables: { valuePaise: 0, trendPct: null },
  cashPosition: { valuePaise: 0, trendPct: null },
  bankPosition: { valuePaise: 0, trendPct: null },
  gstLiability: { valuePaise: 0, trendPct: null },
  // R7 additions
  stockValue: { valuePaise: 0, trendPct: null },
  brokerCommissionDue: { valuePaise: 0, trendPct: null },
  topOverdueParties: [],
  takasAtJobWorker: { count: 0, oldestDays: null },
};

export function KpiDashboard({ wsId, firmId }: KpiDashboardProps) {
  const [kpis, setKpis] = useState<DashboardKpiResponse>(ZERO_KPIS);
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!wsId || !firmId) return;

    const fetchKpis = () => {
      abortRef.current?.abort();
      abortRef.current = new AbortController();
      financeReportsApi
        .dashboardKpis(wsId, firmId)
        .then((data) => setKpis(data))
        .catch(() => {}) // silent fail - keep previous values
        .finally(() => setLoading(false));
    };

    fetchKpis();
    const interval = setInterval(fetchKpis, 30_000);
    return () => {
      clearInterval(interval);
      abortRef.current?.abort();
    };
  }, [wsId, firmId]);

  // D25: each KPI tile drills into the report that explains it (was static).
  const base = `/dashboard/finance/firms/${firmId}`;
  // Only the single-value (KpiValue) tiles go in this grid; the top-overdue list and the takas
  // warning render below as their own panels (R7).
  type StatKey =
    | 'revenue'
    | 'outstanding'
    | 'payables'
    | 'cashPosition'
    | 'bankPosition'
    | 'gstLiability'
    | 'stockValue'
    | 'brokerCommissionDue';
  const cards: Array<{
    key: StatKey;
    label: string;
    gradient: 'blue' | 'amber' | 'red' | 'green' | 'indigo' | 'purple';
    href: string;
  }> = [
    { key: 'revenue', label: 'REVENUE - THIS MONTH', gradient: 'blue', href: `${base}/reports` },
    {
      key: 'outstanding',
      label: 'OUTSTANDING RECEIVABLES',
      gradient: 'amber',
      href: `${base}/receivables`,
    },
    { key: 'payables', label: 'PAYABLES DUE', gradient: 'red', href: `${base}/purchases` },
    { key: 'cashPosition', label: 'CASH POSITION', gradient: 'green', href: `${base}/payments` },
    { key: 'bankPosition', label: 'BANK POSITION', gradient: 'indigo', href: `${base}/reports` },
    {
      key: 'gstLiability',
      label: 'GST LIABILITY - THIS MONTH',
      gradient: 'purple',
      href: `${base}/gst`,
    },
    // R7: stock value drills into the inventory report; broker commission into the reports hub
    // (R-25 Broker Commission Register).
    { key: 'stockValue', label: 'STOCK VALUE', gradient: 'green', href: `${base}/inventory` },
    {
      key: 'brokerCommissionDue',
      label: 'BROKER COMMISSION DUE',
      gradient: 'indigo',
      href: `${base}/reports`,
    },
  ];

  return (
    <div>
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
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--cr-text-3)',
          }}
        >
          Financial Position
        </span>
        <span style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>
          <SyncOutlined style={{ marginRight: 4, opacity: 0.5 }} spin />
          Refreshes every 30s
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 16,
        }}
        className="lg:grid-cols-3 xl:grid-cols-4"
      >
        {cards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="no-underline"
            style={{ display: 'block' }}
          >
            <DsStatCard
              label={card.label}
              value={loading ? '...' : fmtPaiseCompact(kpis[card.key].valuePaise)}
              gradient={card.gradient}
              sub={loading ? undefined : undefined}
              style={loading ? { opacity: 0.6 } : undefined}
            />
          </Link>
        ))}
      </div>

      {/* R7: deemed-supply early warning - lots still at a job worker past 9 months. Shown only
          when there is something to act on; links to the job-work module. */}
      {!loading && kpis.takasAtJobWorker.count > 0 && (
        <Link href={`${base}/job-work`} className="no-underline">
          <div
            style={{
              marginTop: 16,
              padding: '12px 16px',
              borderRadius: 8,
              border: '1px solid var(--cr-warning-300, #f0c36d)',
              background: 'var(--cr-warning-50, #fff8e6)',
              color: 'var(--cr-warning-800, #7a5b00)',
              fontSize: 13,
            }}
          >
            <strong>{kpis.takasAtJobWorker.count}</strong> lot
            {kpis.takasAtJobWorker.count === 1 ? '' : 's'} have been at a job worker for over 9
            months
            {kpis.takasAtJobWorker.oldestDays != null
              ? ` (oldest ${kpis.takasAtJobWorker.oldestDays} days)`
              : ''}
            . Return or settle them before the 1-year deemed-supply limit.
          </div>
        </Link>
      )}

      {/* R7: worst 5 receivable parties. Each row drills into the receivables report. */}
      {!loading && kpis.topOverdueParties.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--cr-text-3)',
              marginBottom: 8,
            }}
          >
            Top overdue parties
          </div>
          <div
            style={{
              border: '1px solid var(--cr-border, var(--cr-border-light))',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--cr-surface, #fff)',
            }}
          >
            {kpis.topOverdueParties.map((p, i) => (
              <Link
                key={p.partyId || i}
                href={`${base}/receivables`}
                className="no-underline"
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  borderTop: i === 0 ? 'none' : '1px solid var(--cr-border-light)',
                  color: 'var(--cr-text-1)',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{p.name || '(unnamed)'}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--cr-danger-700)' }}>
                  {fmtPaiseCompact(p.overduePaise)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
