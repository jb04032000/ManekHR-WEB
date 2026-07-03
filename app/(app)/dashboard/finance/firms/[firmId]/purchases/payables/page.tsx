'use client';
// Payables Aging report. Polish slot: i18n via finance.purchases (payables.* + payablesCol.*)
// and DsPageHeader. Read-only aging buckets per vendor sourced from getPayablesAging; the
// total card reuses getPayablesSummary. Error/retry copy reuses finance.sales.listCommon
// (already in all locales). Cross-link: components/finance/ListErrorState.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Typography, Skeleton } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getPayablesAging, getPayablesSummary } from '@/lib/actions/finance-purchases.actions';
import DsTable from '@/components/ui/DsTable';
import DsCard from '@/components/ui/DsCard';
import { DsPageHeader } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { PayablesAgingBucket } from '@/types';

const formatRupees = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

function BucketCell({ value }: { value: number }) {
  const color =
    value > 50000000
      ? 'var(--cr-danger-500)'
      : value > 10000000
        ? 'var(--cr-warning-500)'
        : value > 0
          ? 'var(--cr-primary)'
          : undefined;
  return (
    <span style={{ color, fontWeight: value > 0 ? 600 : undefined }}>{formatRupees(value)}</span>
  );
}

export default function PayablesAgingPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.purchases');
  const tErr = useTranslations('finance.sales.listCommon'); // shared error/retry copy
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [buckets, setBuckets] = useState<PayablesAgingBucket[]>([]);
  const [totalOutstanding, setTotalOutstanding] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from an empty report
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    Promise.all([getPayablesAging(wsId, firmId), getPayablesSummary(wsId, firmId)])
      .then(([aging, summary]) => {
        setBuckets(Array.isArray(aging) ? aging : []);
        setTotalOutstanding(summary.totalOutstandingPaise);
      })
      .catch(() => {
        setBuckets([]);
        setTotalOutstanding(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, reloadKey]);

  const columns = [
    {
      title: t('payablesCol.vendor'),
      dataIndex: 'partyName',
      key: 'partyName',
    },
    {
      title: t('payablesCol.current'),
      dataIndex: 'current',
      key: 'current',
      align: 'right' as const,
      render: (v: number) => <BucketCell value={v} />,
    },
    {
      title: t('payablesCol.b0_30'),
      dataIndex: 'b0_30',
      key: 'b0_30',
      align: 'right' as const,
      render: (v: number) => <BucketCell value={v} />,
    },
    {
      title: t('payablesCol.b31_60'),
      dataIndex: 'b31_60',
      key: 'b31_60',
      align: 'right' as const,
      render: (v: number) => <BucketCell value={v} />,
    },
    {
      title: t('payablesCol.b61_90'),
      dataIndex: 'b61_90',
      key: 'b61_90',
      align: 'right' as const,
      render: (v: number) => <BucketCell value={v} />,
    },
    {
      title: t('payablesCol.b90plus'),
      dataIndex: 'b90plus',
      key: 'b90plus',
      align: 'right' as const,
      render: (v: number) => <BucketCell value={v} />,
    },
    {
      title: t('payablesCol.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => <strong>{formatRupees(v)}</strong>,
    },
  ];

  if (!isHydrated) return <Skeleton active style={{ padding: 24 }} />;

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('payables.title')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 16 }}
      />

      {error ? (
        <ListErrorState
          title={tErr('errorTitle')}
          body={tErr('errorBody')}
          retryLabel={tErr('retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <>
          {totalOutstanding !== null && (
            <DsCard style={{ marginBottom: 24, display: 'inline-block' }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {t('payables.totalOutstanding')}
              </Typography.Text>
              <Typography.Title level={2} style={{ margin: 0 }}>
                {formatRupees(totalOutstanding)}
              </Typography.Title>
            </DsCard>
          )}

          <DsTable
            dataSource={buckets}
            columns={columns}
            rowKey="partyId"
            loading={loading}
            size="small"
            scrollX={800}
          />
        </>
      )}
    </div>
  );
}
