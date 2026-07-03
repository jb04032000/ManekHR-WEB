'use client';
// Finance polish (inventory): i18n via finance.inventory.batches; DsPageHeader title +
// InfoTooltip explaining batches. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Spin } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { DsTable } from '@/components/ui/DsTable';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { useWorkspaceStore } from '@/lib/store';
import { listBatches } from '@/lib/actions/inventory.actions';
import type { Batch } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function BatchesPage() {
  const params = useParams<{ firmId: string }>();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [rows, setRows] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listBatches(wsId, params.firmId)
      .then(setRows)
      .catch(() => {
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, params.firmId, inventoryAccess.isLocked, reloadKey]);

  if (inventoryAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (inventoryAccess.isLocked) {
    return <ModuleLockedPage module="inventory" />;
  }

  return (
    <div className="p-6">
      <DsPageHeader
        title={t('batches.title')}
        icon={<AppstoreOutlined />}
        titleAside={<InfoTooltip text={t('batches.tip')} />}
        style={{ marginBottom: 16 }}
      />
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && rows.length === 0 ? (
        <EmptyStateLayout
          icon={<AppstoreOutlined />}
          title={t('batches.emptyTitle')}
          description={t('batches.emptyBody')}
        />
      ) : (
        <DsTable
          columns={[
            { title: t('batches.colBatchNo'), dataIndex: 'batchNo', key: 'batchNo' },
            { title: t('batches.colItem'), dataIndex: 'itemId', key: 'itemId' },
            {
              title: t('batches.colMfgDate'),
              dataIndex: 'mfgDate',
              key: 'mfgDate',
              render: (v?: string) => (v ? new Date(v).toLocaleDateString() : '-'),
            },
            {
              title: t('batches.colExpiry'),
              dataIndex: 'expiryDate',
              key: 'expiryDate',
              render: (v?: string) => (v ? new Date(v).toLocaleDateString() : '-'),
            },
            {
              title: t('batches.colQtyProduced'),
              dataIndex: 'qtyProduced',
              key: 'qtyProduced',
              align: 'right' as const,
            },
            {
              title: t('batches.colQtyRemaining'),
              dataIndex: 'qtyRemaining',
              key: 'qtyRemaining',
              align: 'right' as const,
              render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
            },
            { title: t('batches.colGodown'), dataIndex: 'godownId', key: 'godownId' },
          ]}
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{ defaultPageSize: 20 }}
        />
      )}
    </div>
  );
}
