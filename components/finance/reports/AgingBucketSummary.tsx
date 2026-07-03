'use client';
// Shared aging-bucket table + summary tiles for receivables/payables aging reports.
// i18n via finance.reports.common.aging.*. Cross-link: rendered by
// app/.../reports/party-ledger/{receivables,payables}-aging/page.tsx.
import { Statistic, Table } from 'antd';
import { useTranslations } from 'next-intl';
import type { ReceivableAgingBucket } from '@/types';
import { fmtPaise } from '@/lib/utils';

interface AgingBucketSummaryProps {
  rows: ReceivableAgingBucket[];
  summary: Record<string, number>;
  onPartyClick?: (partyId: string) => void;
}

export function AgingBucketSummary({ rows, summary, onPartyClick }: AgingBucketSummaryProps) {
  const t = useTranslations('finance.reports');
  const cols = [
    {
      title: t('common.aging.party'),
      dataIndex: 'partyName',
      key: 'partyName',
      render: (v: string, r: ReceivableAgingBucket) => (
        <span
          style={{
            cursor: onPartyClick ? 'pointer' : undefined,
            color: onPartyClick ? 'var(--cr-primary)' : undefined,
          }}
          onClick={() => onPartyClick?.(r.partyId)}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('common.aging.notYetDue'),
      dataIndex: 'current',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('common.aging.b0_30'),
      dataIndex: 'b0_30',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? 'var(--cr-warning)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('common.aging.b31_60'),
      dataIndex: 'b31_60',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? 'var(--cr-orange)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('common.aging.b61_90'),
      dataIndex: 'b61_90',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? 'var(--cr-orange)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('common.aging.b90plus'),
      dataIndex: 'b90plus',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v > 0 ? 'var(--cr-error)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('common.aging.total'),
      dataIndex: 'total',
      align: 'right' as const,
      render: (v: number) => <b>{fmtPaise(v)}</b>,
    },
  ];

  return (
    <div>
      {/* 5-bucket summary row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Statistic
          title={t('common.aging.notYetDue')}
          value={fmtPaise(summary.current ?? 0)}
          styles={{ content: { fontSize: 18 } }}
        />
        <Statistic
          title={t('common.aging.b0_30')}
          value={fmtPaise(summary.b0_30 ?? 0)}
          styles={{ content: { fontSize: 18, color: 'var(--cr-warning)' } }}
        />
        <Statistic
          title={t('common.aging.b31_60')}
          value={fmtPaise(summary.b31_60 ?? 0)}
          styles={{ content: { fontSize: 18, color: 'var(--cr-orange)' } }}
        />
        <Statistic
          title={t('common.aging.b61_90')}
          value={fmtPaise(summary.b61_90 ?? 0)}
          styles={{ content: { fontSize: 18, color: 'var(--cr-orange)' } }}
        />
        <Statistic
          title={t('common.aging.b90plus')}
          value={fmtPaise(summary.b90plus ?? 0)}
          styles={{ content: { fontSize: 18, color: 'var(--cr-error)' } }}
        />
      </div>
      <Table
        dataSource={rows}
        columns={cols}
        rowKey="partyId"
        size="small"
        pagination={{ pageSize: 50 }}
        scroll={{ x: 'max-content' }}
      />
    </div>
  );
}
