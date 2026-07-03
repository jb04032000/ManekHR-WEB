'use client';
// Finance polish (inventory): i18n via finance.inventory namespace; DsPageHeader for the
// page title; InfoTooltip explainers for reorder + stock valuation. Cross-link:
// app/.../sales/invoices/page.tsx (reference list pattern). No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input, Select, Spin, Switch } from 'antd';
import {
  BarChartOutlined,
  InboxOutlined,
  WarningOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { DsStatCard } from '@/components/ui/DsCard';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { EmptyStateLayout } from '@/components/ui/EmptyStateLayout';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listStockSummary, listGodowns } from '@/lib/actions/inventory.actions';
import type { StockSummaryRow, StockSummaryResponse, Godown } from '@/types';
import { StockSummaryTable } from '@/components/finance/inventory/StockSummaryTable';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const EMPTY_KPI: StockSummaryResponse['kpi'] = {
  totalSkus: 0,
  totalStockValuePaise: 0,
  itemsBelowReorder: 0,
  lotsExpiringSoon: 0,
};

export default function StockSummaryPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');

  const [rows, setRows] = useState<StockSummaryRow[]>([]);
  const [kpi, setKpi] = useState<StockSummaryResponse['kpi']>(EMPTY_KPI);
  const [godowns, setGodowns] = useState<Godown[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // Per-firm saved primary filter (platform bar): the godown filter persists across reloads.
  // Cross-link: hooks/usePersistedState.ts. Category/search stay session-only.
  const [godownFilter, setGodownFilter] = usePersistedState<string | undefined>(
    `finance:inventory:stock:godown:${firmId}`,
    undefined,
  );
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>();
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [trackBatchOnly, setTrackBatchOnly] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!wsId || !firmId || inventoryAccess.isLocked) return;
    listGodowns(wsId, firmId)
      .then(setGodowns)
      .catch(() => setGodowns([]));
  }, [wsId, firmId, inventoryAccess.isLocked]);

  useEffect(() => {
    if (!wsId || !firmId || inventoryAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listStockSummary(wsId, firmId, {
      godownId: godownFilter,
      category: categoryFilter,
      lowStockOnly,
      trackBatchOnly,
      q: search,
    })
      .then((res) => {
        // listStockSummary returns the full { kpi, rows } envelope from the backend.
        // MUST destructure - never assign res directly to a row state array.
        const { kpi, rows } = res;
        setKpi(kpi);
        setRows(rows);
      })
      .catch(() => {
        setKpi(EMPTY_KPI);
        setRows([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [
    wsId,
    firmId,
    godownFilter,
    categoryFilter,
    lowStockOnly,
    trackBatchOnly,
    search,
    inventoryAccess.isLocked,
    reloadKey,
  ]);

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
        title={t('stock.title')}
        icon={<BarChartOutlined />}
        titleAside={<InfoTooltip text={t('stock.valuationTip')} />}
        style={{ marginBottom: 16 }}
      />

      {/* KPI strip - Pattern C - values come directly from server-computed kpi block.
          Do NOT recompute from rows: server enforces correct semantics for "items below reorder"
          (reorderQty > 0 && onHand < reorderQty) and "lots expiring soon" (within 30 days). */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <DsStatCard
          icon={<InboxOutlined />}
          label={t('stock.kpiTotalSkus')}
          value={String(kpi.totalSkus)}
          gradient="blue"
          style={{ flex: 1 }}
        />
        <DsStatCard
          icon={<BarChartOutlined />}
          label={t('stock.kpiStockValue')}
          value={`₹${(kpi.totalStockValuePaise / 100).toLocaleString('en-IN')}`}
          gradient="green"
          style={{ flex: 1 }}
        />
        <DsStatCard
          icon={<WarningOutlined />}
          label={t('stock.kpiBelowReorder')}
          value={String(kpi.itemsBelowReorder)}
          gradient={kpi.itemsBelowReorder > 0 ? 'amber' : undefined}
          style={{ flex: 1 }}
        />
        <DsStatCard
          icon={<FieldTimeOutlined />}
          label={t('stock.kpiExpiring')}
          value={String(kpi.lotsExpiringSoon)}
          gradient={kpi.lotsExpiringSoon > 0 ? 'amber' : undefined}
          style={{ flex: 1 }}
        />
      </div>

      {/* Filter row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <Select
          allowClear
          placeholder={t('listCommon.allGodowns')}
          aria-label={t('stock.filterGodown')}
          style={{ minWidth: 200 }}
          value={godownFilter}
          onChange={setGodownFilter}
          options={godowns.map((g) => ({ value: g._id, label: `${g.name} (${g.code})` }))}
        />
        <Select
          allowClear
          placeholder={t('stock.allCategories')}
          aria-label={t('stock.filterCategory')}
          style={{ minWidth: 180 }}
          value={categoryFilter}
          onChange={setCategoryFilter}
          options={[]} // TODO: load distinct categories
        />
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Switch
            checked={lowStockOnly}
            onChange={setLowStockOnly}
            aria-label={t('stock.lowStockOnlyAria')}
          />{' '}
          {t('stock.lowStockOnly')}
          <InfoTooltip text={t('stock.reorderTip')} />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Switch
            checked={trackBatchOnly}
            onChange={setTrackBatchOnly}
            aria-label={t('stock.trackBatchOnlyAria')}
          />{' '}
          {t('stock.trackBatchOnly')}
        </label>
        <Input.Search
          allowClear
          placeholder={t('stock.search')}
          aria-label={t('stock.searchAria')}
          style={{ minWidth: 240, marginLeft: 'auto' }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
          icon={<InboxOutlined />}
          title={t('stock.emptyTitle')}
          description={t('stock.emptyBody')}
        />
      ) : (
        <StockSummaryTable
          workspaceId={wsId}
          firmId={firmId}
          rows={rows}
          loading={loading}
          onPrintLabels={(itemId) =>
            router.push(`/dashboard/finance/firms/${firmId}/items/${itemId}/labels`)
          }
          onViewMovements={(itemId) =>
            router.push(`/dashboard/finance/firms/${firmId}/inventory/movements?itemId=${itemId}`)
          }
          onRecordWastage={(itemId) =>
            router.push(`/dashboard/finance/firms/${firmId}/inventory/wastage/new?itemId=${itemId}`)
          }
        />
      )}
    </div>
  );
}
