'use client';
import { useEffect, useState } from 'react';
import { Row, Col, Tooltip, Spin } from 'antd';
import { ArrowRightOutlined } from '@ant-design/icons';
import Link from 'next/link';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import { useWorkspaceStore } from '@/lib/store';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import type { SalesKpiSummary } from '@/types';

const ZERO_STATS: SalesKpiSummary = {
  totalInvoiced: 0,
  collected: 0,
  outstanding: 0,
  overdue: 0,
  topPending: [],
};

export function SalesKpiPanel({ firmId }: { firmId: string }) {
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [stats, setStats] = useState<SalesKpiSummary>(ZERO_STATS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ws?._id || !firmId) return;
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const monthEnd = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
    ).toISOString();

    // D-26: single aggregation request - server computes via $match + $group pipeline.
    // NO client-side reduce of invoice lists.
    financeSalesApi.invoices
      .kpiSummary(ws._id, firmId, monthStart, monthEnd)
      .then((summary) => setStats(summary))
      .catch(() => {
        /* keep zeros on error */
      })
      .finally(() => setLoading(false));
  }, [ws?._id, firmId]);

  const fmt = (p: number) => '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 0 });

  return (
    <DsCard style={{ padding: 16 }}>
      <div className="mb-4 flex items-center justify-between">
        <h2
          className="m-0 text-base font-bold"
          style={{ fontFamily: 'var(--font-display, inherit)' }}
        >
          Sales - This Month
        </h2>
        <Link href={`/dashboard/finance/firms/${firmId}/sales/invoices`}>
          <DsButton dsVariant="ghost" dsSize="sm">
            View Invoices <ArrowRightOutlined />
          </DsButton>
        </Link>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiTile label="Total Invoiced" value={fmt(stats.totalInvoiced)} loading={loading} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiTile
            label="Collected"
            value={fmt(stats.collected)}
            loading={loading}
            color="var(--cr-success-700)"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiTile label="Outstanding" value={fmt(stats.outstanding)} loading={loading} />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiTile
            label="Overdue"
            value={fmt(stats.overdue)}
            loading={loading}
            color="var(--cr-danger-700)"
          />
        </Col>
      </Row>

      {stats.topPending.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--cr-text-3)' }}>
            Pending parties:
          </span>
          {stats.topPending.map((p) => (
            <span
              key={p.partyName}
              className="rounded px-2 py-1 text-xs"
              style={{ background: 'var(--cr-surface-2, var(--cr-neutral-100))' }}
            >
              {p.partyName} {fmt(p.amountPaise)}
            </span>
          ))}
          <Tooltip title="Record payment feature coming soon">
            <DsButton dsVariant="ghost" dsSize="sm" disabled>
              Record Payment
            </DsButton>
          </Tooltip>
        </div>
      )}
    </DsCard>
  );
}

function KpiTile({
  label,
  value,
  loading,
  color,
}: {
  label: string;
  value: string;
  loading: boolean;
  color?: string;
}) {
  return (
    <DsCard style={{ padding: 16 }}>
      <div className="text-xs" style={{ color: 'var(--cr-text-3)' }}>
        {label}
      </div>
      <div
        className="mt-1"
        style={{
          fontFamily: 'var(--font-display, inherit)',
          fontSize: 20,
          fontWeight: 700,
          color: color ?? 'var(--cr-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {loading ? <Spin size="small" /> : value}
      </div>
    </DsCard>
  );
}
