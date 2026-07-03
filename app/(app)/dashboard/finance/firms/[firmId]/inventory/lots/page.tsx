'use client';
// Finance polish (inventory): i18n via finance.inventory.lots; DsPageHeader title +
// InfoTooltip on the lot concept. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input, Select, InputNumber, Spin } from 'antd';
import { TagsOutlined } from '@ant-design/icons';
import { DsTable } from '@/components/ui/DsTable';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listLots, listGodowns } from '@/lib/actions/inventory.actions';
import type { Lot, Godown } from '@/types';
import { ExpiryBadge } from '@/components/finance/inventory/ExpiryBadge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const expiryDays = (date?: string): number | null => {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
};

const expiryRowClass = (lot: Lot): string => {
  const d = expiryDays(lot.expiryDate);
  if (d === null) return '';
  if (d < 0) return 'cr-row-expired';
  if (d < 7) return 'cr-row-expiring-soon';
  if (d <= 30) return 'cr-row-expiring-30';
  return '';
};

export default function LotsPage() {
  const params = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [lots, setLots] = useState<Lot[]>([]);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [search, setSearch] = useState('');
  // Per-firm saved primary filter (platform bar): godown persists; search/expiry stay session-only.
  // Cross-link: hooks/usePersistedState.ts.
  const [godownFilter, setGodownFilter] = usePersistedState<string | undefined>(
    `finance:inventory:lots:godown:${params.firmId}`,
    undefined,
  );
  const [expiringInDays, setExpiringInDays] = useState<number | undefined>();

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    listGodowns(wsId, params.firmId).then(setGodowns);
  }, [wsId, params.firmId, inventoryAccess.isLocked]);

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listLots(wsId, params.firmId, { godownId: godownFilter, expiringInDays, q: search })
      .then(setLots)
      .catch(() => {
        setLots([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [
    wsId,
    params.firmId,
    godownFilter,
    expiringInDays,
    search,
    inventoryAccess.isLocked,
    reloadKey,
  ]);

  const columns = [
    {
      title: t('lots.colLotNo'),
      dataIndex: 'lotNo',
      key: 'lotNo',
      render: (v: string, row: Lot) => (
        <a
          onClick={() =>
            router.push(`/dashboard/finance/firms/${params.firmId}/inventory/lots/${row._id}`)
          }
        >
          {v}
        </a>
      ),
    },
    {
      title: t('lots.colItem'),
      dataIndex: 'itemId',
      key: 'itemId',
    },
    {
      title: t('lots.colInwardDate'),
      dataIndex: 'inwardDate',
      key: 'inwardDate',
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
    {
      title: t('lots.colExpiry'),
      key: 'expiry',
      render: (_: unknown, row: Lot) => <ExpiryBadge expiryDate={row.expiryDate} />,
    },
    {
      title: t('lots.colQtyInward'),
      dataIndex: 'qtyInward',
      align: 'right' as const,
      key: 'qtyInward',
    },
    {
      title: t('lots.colQtyRemaining'),
      dataIndex: 'qtyRemaining',
      align: 'right' as const,
      key: 'qtyRemaining',
      render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: t('lots.colGodown'),
      dataIndex: 'godownId',
      key: 'godownId',
      render: (gId: string) => godowns.find((g) => g._id === gId)?.name ?? gId,
    },
    {
      title: t('lots.colAge'),
      key: 'age',
      render: (_: unknown, row: Lot) =>
        Math.floor((Date.now() - new Date(row.inwardDate).getTime()) / (24 * 60 * 60 * 1000)),
    },
  ];

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
        title={t('lots.title')}
        icon={<TagsOutlined />}
        titleAside={<InfoTooltip text={t('lots.tip')} />}
        style={{ marginBottom: 16 }}
      />
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Input.Search
          aria-label={t('lots.searchAria')}
          allowClear
          placeholder={t('lots.search')}
          style={{ minWidth: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t('lots.filterGodownAria')}
          allowClear
          placeholder={t('listCommon.allGodowns')}
          style={{ minWidth: 200 }}
          value={godownFilter}
          onChange={setGodownFilter}
          options={godowns.map((g) => ({ value: g._id, label: g.name }))}
        />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {t('lots.expiringIn')}
          <InputNumber
            min={0}
            max={365}
            value={expiringInDays}
            onChange={(v) => setExpiringInDays(v ?? undefined)}
            placeholder={t('lots.expiringInPlaceholder')}
            style={{ width: 80 }}
          />
          {t('lots.days')}
        </span>
      </div>
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && lots.length === 0 ? (
        <EmptyStateLayout
          icon={<TagsOutlined />}
          title={t('lots.emptyTitle')}
          description={t('lots.emptyBody')}
        />
      ) : (
        <DsTable
          columns={columns}
          dataSource={lots}
          rowKey="_id"
          loading={loading}
          rowClassName={expiryRowClass}
          pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        />
      )}
      <style jsx global>{`
        .cr-row-expiring-soon,
        .cr-row-expired {
          background: var(--cr-error-bg) !important;
        }
        .cr-row-expiring-30 {
          background: var(--cr-warning-bg) !important;
        }
      `}</style>
    </div>
  );
}
