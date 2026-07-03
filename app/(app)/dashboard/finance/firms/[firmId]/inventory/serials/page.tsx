'use client';
// Finance polish (inventory): i18n via finance.inventory.serials; DsPageHeader title +
// InfoTooltip explaining serial tracking. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input, Select, Tag, Popconfirm, Modal, Form, message, Spin } from 'antd';
import { ScanOutlined } from '@ant-design/icons';
import { DsTable } from '@/components/ui/DsTable';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listSerials, listGodowns, updateSerial } from '@/lib/actions/inventory.actions';
import type { Serial, SerialStatus, Godown } from '@/types';
import { GodownSelector } from '@/components/finance/inventory/GodownSelector';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const statusColor: Record<SerialStatus, string> = {
  in_stock: 'green',
  sold: 'blue',
  sample_out: 'orange',
  returned: 'cyan',
  scrapped: 'red',
};

export default function SerialsPage() {
  const params = useParams<{ firmId: string }>();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [rows, setRows] = useState<Serial[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // Per-firm saved primary filter (platform bar): status persists; search stays session-only.
  // Cross-link: hooks/usePersistedState.ts.
  const [statusFilter, setStatusFilter] = usePersistedState<SerialStatus | undefined>(
    `finance:inventory:serials:status:${params.firmId}`,
    undefined,
  );
  const [search, setSearch] = useState('');
  const [reassignOpen, setReassignOpen] = useState<Serial | null>(null);
  const [reassignGodown, setReassignGodown] = useState<string | undefined>();

  const reload = () => {
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listSerials(wsId, params.firmId, { status: statusFilter, q: search })
      .then(setRows)
      .catch(() => {
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    listGodowns(wsId, params.firmId).then(setGodowns);
  }, [wsId, params.firmId, inventoryAccess.isLocked]);

  useEffect(() => {
    if (wsId && !inventoryAccess.isLocked) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, params.firmId, statusFilter, search, inventoryAccess.isLocked, reloadKey]);

  const handleScrap = async (s: Serial) => {
    try {
      await updateSerial(wsId, params.firmId, s.serialNo, { status: 'scrapped' });
      message.success(t('serials.scrapSuccess', { serial: s.serialNo }));
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('serials.scrapFailed');
      message.error(msg);
    }
  };

  const handleReassign = async () => {
    if (!reassignOpen || !reassignGodown) return;
    try {
      await updateSerial(wsId, params.firmId, reassignOpen.serialNo, {
        currentGodownId: reassignGodown,
      });
      message.success(t('serials.reassignSuccess', { serial: reassignOpen.serialNo }));
      setReassignOpen(null);
      setReassignGodown(undefined);
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t('serials.reassignFailed');
      message.error(msg);
    }
  };

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
        title={t('serials.title')}
        icon={<ScanOutlined />}
        titleAside={<InfoTooltip text={t('serials.tip')} />}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          aria-label={t('serials.searchAria')}
          allowClear
          placeholder={t('serials.search')}
          style={{ minWidth: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t('serials.filterStatusAria')}
          allowClear
          placeholder={t('listCommon.allStatuses')}
          style={{ minWidth: 180 }}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as SerialStatus | undefined)}
          options={[
            { value: 'in_stock', label: t('serials.stateInStock') },
            { value: 'sold', label: t('serials.stateSold') },
            { value: 'sample_out', label: t('serials.stateSampleOut') },
            { value: 'returned', label: t('serials.stateReturned') },
            { value: 'scrapped', label: t('serials.stateScrapped') },
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
          icon={<ScanOutlined />}
          title={t('serials.emptyTitle')}
          description={t('serials.emptyBody')}
        />
      ) : (
        <DsTable
          columns={[
            { title: t('serials.colSerialNo'), dataIndex: 'serialNo', key: 'serialNo' },
            { title: t('serials.colItem'), dataIndex: 'itemId', key: 'itemId' },
            {
              title: t('serials.colStatus'),
              dataIndex: 'status',
              key: 'status',
              render: (v: SerialStatus) => <Tag color={statusColor[v]}>{v.replace(/_/g, ' ')}</Tag>,
            },
            {
              title: t('serials.colGodown'),
              dataIndex: 'currentGodownId',
              key: 'currentGodownId',
              render: (gId?: string) => godowns.find((g) => g._id === gId)?.name ?? gId ?? '-',
            },
            { title: t('serials.colLot'), dataIndex: 'lotId', key: 'lotId' },
            {
              title: t('serials.colPurchased'),
              dataIndex: 'purchasedAt',
              key: 'purchasedAt',
              render: (v?: string) => (v ? new Date(v).toLocaleDateString() : '-'),
            },
            {
              title: t('serials.colSold'),
              dataIndex: 'soldAt',
              key: 'soldAt',
              render: (v?: string) => (v ? new Date(v).toLocaleDateString() : '-'),
            },
            {
              title: t('listCommon.actions'),
              key: 'actions',
              width: 240,
              render: (_: unknown, r: Serial) => (
                <span style={{ display: 'inline-flex', gap: 12 }}>
                  <a
                    onClick={() => {
                      setReassignOpen(r);
                      setReassignGodown(r.currentGodownId);
                    }}
                  >
                    {t('serials.reassignGodown')}
                  </a>
                  {r.status !== 'scrapped' && (
                    <Popconfirm
                      title={t('serials.scrapConfirmTitle', { serial: r.serialNo })}
                      description={t('serials.scrapConfirmDesc')}
                      okText={t('serials.scrapOk')}
                      cancelText={t('listCommon.cancel')}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleScrap(r)}
                    >
                      <a style={{ color: 'var(--cr-error)' }}>{t('serials.scrap')}</a>
                    </Popconfirm>
                  )}
                </span>
              ),
            },
          ]}
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
      )}
      <Modal
        title={t('serials.reassignTitle')}
        open={!!reassignOpen}
        onCancel={() => {
          setReassignOpen(null);
          setReassignGodown(undefined);
        }}
        onOk={handleReassign}
        okText={t('serials.reassignOk')}
      >
        <Form layout="vertical">
          <Form.Item label={t('serials.newGodown')}>
            <GodownSelector
              firmId={params.firmId}
              workspaceId={wsId}
              value={reassignGodown}
              onChange={setReassignGodown}
              defaultToFirmDefault={false}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
