'use client';
// Finance polish (inventory): i18n via finance.inventory.samples; DsPageHeader title + Send
// action + InfoTooltip explaining samples/consignments. Status option labels moved into the
// component so they can use the translator. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Select, Spin } from 'antd';
import { GiftOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listSampleVouchers } from '@/lib/actions/inventory.actions';
import type { SampleVoucher, SampleVoucherStatus } from '@/types';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLORS: Record<SampleVoucherStatus, string> = {
  draft: 'gold',
  sent: 'blue',
  partially_accepted: 'cyan',
  fully_accepted: 'green',
  rejected_returned: 'default',
  overdue: 'red',
};

export default function SamplesListPage() {
  const params = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [rows, setRows] = useState<SampleVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // Per-firm saved primary filter (platform bar): the status filter persists across reloads.
  // Cross-link: hooks/usePersistedState.ts.
  const [statusFilter, setStatusFilter] = usePersistedState<string | undefined>(
    `finance:inventory:samples:status:${params.firmId}`,
    undefined,
  );
  const [now] = useState(() => Date.now());

  // Status filter options (labels localised here so the translator is in scope).
  const STATUS_OPTIONS: { value: SampleVoucherStatus; label: string }[] = [
    { value: 'draft', label: t('samples.stateDraft') },
    { value: 'sent', label: t('samples.stateSent') },
    { value: 'partially_accepted', label: t('samples.statePartiallyAccepted') },
    { value: 'fully_accepted', label: t('samples.stateFullyAccepted') },
    { value: 'rejected_returned', label: t('samples.stateRejectedReturned') },
    { value: 'overdue', label: t('samples.stateOverdue') },
  ];

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listSampleVouchers(wsId, params.firmId, { status: statusFilter })
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
      <style>{`.cr-row-overdue { background: var(--cr-error-bg) !important; }`}</style>
      <DsPageHeader
        title={t('samples.title')}
        icon={<GiftOutlined />}
        titleAside={<InfoTooltip text={t('samples.tip')} />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${params.firmId}/inventory/samples/new`)
            }
          >
            {t('samples.send')}
          </DsButton>
        }
      />
      <div style={{ marginBottom: 16 }}>
        <Select
          aria-label={t('samples.filterStatusAria')}
          allowClear
          placeholder={t('listCommon.allStatuses')}
          style={{ minWidth: 220 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={STATUS_OPTIONS}
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
          icon={<GiftOutlined />}
          title={t('samples.emptyTitle')}
          description={t('samples.emptyBody')}
        />
      ) : (
        <DsTable
          rowClassName={(r: SampleVoucher) => (r.status === 'overdue' ? 'cr-row-overdue' : '')}
          columns={[
            {
              title: t('listCommon.voucherNo'),
              dataIndex: 'voucherNo',
              render: (v: string, r: SampleVoucher) => (
                <a
                  onClick={() =>
                    router.push(
                      `/dashboard/finance/firms/${params.firmId}/inventory/samples/${r._id}`,
                    )
                  }
                >
                  {v}
                </a>
              ),
            },
            {
              title: t('samples.colType'),
              dataIndex: 'sampleType',
              render: (v: string) => (
                <Tag color={v === 'consignment' ? 'purple' : 'blue'}>
                  {v === 'consignment' ? t('samples.typeConsignment') : t('samples.typeSample')}
                </Tag>
              ),
            },
            { title: t('samples.colParty'), dataIndex: 'partyId' },
            {
              title: t('samples.colDateSent'),
              dataIndex: 'date',
              render: (v: string) => new Date(v).toLocaleDateString(),
            },
            {
              title: t('samples.colExpectedReturn'),
              dataIndex: 'expectedReturnDate',
              render: (v: string) => new Date(v).toLocaleDateString(),
            },
            {
              title: t('listCommon.status'),
              dataIndex: 'status',
              render: (v: SampleVoucherStatus) => (
                <Tag color={STATUS_COLORS[v]}>{v.replace(/_/g, ' ').toUpperCase()}</Tag>
              ),
            },
            {
              title: t('samples.colDaysOverdue'),
              key: 'daysOverdue',
              render: (_: unknown, r: SampleVoucher) => {
                if (r.status !== 'overdue') return null;
                const days = Math.floor(
                  (now - new Date(r.expectedReturnDate).getTime()) / (24 * 60 * 60 * 1000),
                );
                return <span style={{ color: 'var(--cr-error)', fontWeight: 700 }}>{days}d</span>;
              },
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
