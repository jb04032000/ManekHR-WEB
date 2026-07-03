'use client';
// Finance polish (inventory): i18n via finance.inventory.wastage; DsPageHeader title +
// Record action + InfoTooltip on the wastage concept. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Select, Spin } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listWastageEntries } from '@/lib/actions/inventory.actions';
import type { WastageEntry } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function WastageListPage() {
  const params = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [rows, setRows] = useState<WastageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // Per-firm saved primary filter (platform bar): the status filter persists across reloads.
  // Cross-link: hooks/usePersistedState.ts.
  const [statusFilter, setStatusFilter] = usePersistedState<string | undefined>(
    `finance:inventory:wastage:status:${params.firmId}`,
    undefined,
  );

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listWastageEntries(wsId, params.firmId, { status: statusFilter })
      .then(setRows)
      .catch(() => {
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, params.firmId, statusFilter, inventoryAccess.isLocked, reloadKey]);

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
        title={t('wastage.title')}
        icon={<DeleteOutlined />}
        titleAside={<InfoTooltip text={t('wastage.tip')} />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${params.firmId}/inventory/wastage/new`)
            }
          >
            {t('wastage.record')}
          </DsButton>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Select
          aria-label={t('wastage.filterStatusAria')}
          allowClear
          placeholder={t('listCommon.allStatuses')}
          style={{ minWidth: 180 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'draft', label: t('listCommon.draft') },
            { value: 'posted', label: t('listCommon.posted') },
          ]}
        />
      </div>
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && rows.length === 0 ? (
        <EmptyStateLayout
          icon={<DeleteOutlined />}
          title={t('wastage.emptyTitle')}
          description={t('wastage.emptyBody')}
          iconBgColor="bg-amber-50"
        />
      ) : (
        <DsTable
          columns={[
            {
              title: t('listCommon.voucherNo'),
              dataIndex: 'voucherNo',
              render: (v: string, r: WastageEntry) => (
                <a
                  onClick={() =>
                    router.push(
                      `/dashboard/finance/firms/${params.firmId}/inventory/wastage/${r._id}`,
                    )
                  }
                >
                  {v}
                </a>
              ),
            },
            {
              title: t('listCommon.date'),
              dataIndex: 'date',
              render: (v: string) => new Date(v).toLocaleDateString(),
            },
            { title: t('wastage.colGodown'), dataIndex: 'godownId' },
            {
              title: t('wastage.colLines'),
              key: 'lines',
              render: (_: unknown, r: WastageEntry) => r.lines.length,
            },
            {
              title: t('wastage.colTotalCost'),
              dataIndex: 'totalCostPaise',
              render: (v: number) =>
                (v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 }),
            },
            {
              title: t('listCommon.status'),
              dataIndex: 'status',
              render: (v: string) => (
                <Tag color={v === 'posted' ? 'green' : 'gold'}>{v.toUpperCase()}</Tag>
              ),
            },
          ]}
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{ defaultPageSize: 15, showSizeChanger: true }}
        />
      )}
    </div>
  );
}
