'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { Row, Col, Skeleton, Spin, Typography, Select, Input, Space } from 'antd';
import { BankOutlined, PlusOutlined, AppstoreOutlined, SafetyOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listFixedAssets } from '@/lib/actions/finance-fixed-assets.actions';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import FixedAssetRegisterTable from '@/components/finance/fixed-assets/FixedAssetRegisterTable';
import FixedAssetDetailDrawer from '@/components/finance/fixed-assets/FixedAssetDetailDrawer';
import DisposalWorkflowModal from '@/components/finance/fixed-assets/DisposalWorkflowModal';
import TransferAssetModal from '@/components/finance/fixed-assets/TransferAssetModal';
import type { FixedAsset } from '@/types';
import { formatCurrencyFull } from '@/lib/utils';

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

interface KpiData {
  totalAssets: number;
  totalNbvPaise: number;
  depreciationYtdPaise: number;
  awaitingVerification: number;
}

export default function FixedAssetsPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.fixedAssets.register');
  const tStatus = useTranslations('finance.fixedAssets.status');
  const tShared = useTranslations('finance.sales'); // shared list-page labels (error state)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);
  const financeAccess = useFeatureAccess('finance');

  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed KPI fetch from a genuinely empty register
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  // Per-firm saved primary filter (platform bar): the status filter persists across reloads.
  // Cross-link: hooks/usePersistedState.ts. Category/FY/search stay session-only.
  const [statusFilter, setStatusFilter] = usePersistedState<string | undefined>(
    `finance:fixedAssets:register:status:${firmId}`,
    undefined,
  );

  const [filters, setFilters] = useState<{
    categoryId?: string;
    financialYear?: string;
    search?: string;
  }>({});

  // The register table consumes status alongside the session-only filters; status comes from
  // the persisted value so it survives reloads while the rest reset.
  const tableFilters = { ...filters, status: statusFilter };

  const [drawerAssetId, setDrawerAssetId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [disposeAsset, setDisposeAsset] = useState<FixedAsset | null>(null);
  const [transferAsset, setTransferAsset] = useState<FixedAsset | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!wsId || !isHydrated || financeAccess.isLocked) return;
    startTransition(() => {
      setKpiLoading(true);
      setError(false);
    });
    listFixedAssets(wsId, firmId, { limit: 1 })
      .then((data) => {
        const result = data as { items: FixedAsset[]; total: number };
        const items = Array.isArray(result.items) ? result.items : [];
        setKpi({
          totalAssets: result.total ?? items.length,
          totalNbvPaise: items.reduce((s, a) => s + a.nbvPaise, 0),
          depreciationYtdPaise: items.reduce((s, a) => s + a.accumulatedDepreciationPaise, 0),
          awaitingVerification: items.filter((a) => !a.lastVerifiedAt).length,
        });
      })
      .catch(() => {
        setKpi(null);
        setError(true);
      })
      .finally(() => setKpiLoading(false));
  }, [wsId, isHydrated, firmId, refreshKey, reloadKey, financeAccess.isLocked]);

  if (!isHydrated) return <Skeleton active style={{ padding: 24 }} />;
  if (financeAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (financeAccess.isLocked) {
    return <ModuleLockedPage module="finance" />;
  }

  const base = `/dashboard/finance/firms/${firmId}/fixed-assets`;

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <Typography.Title level={1} style={{ margin: 0, fontSize: 22 }}>
          {t('title')}
        </Typography.Title>
        <Space>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={() => router.push(`${base}/categories`)}>
            {t('btnCategories')}
          </DsButton>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            onClick={() => router.push(`${base}/depreciation`)}
          >
            {t('btnDepreciation')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            icon={<PlusOutlined />}
            onClick={() => router.push(`${base}/new`)}
          >
            {t('btnAddAsset')}
          </DsButton>
        </Space>
      </div>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <>
          {/* KPI tiles */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} sm={12} lg={6}>
              <DsCard loading={kpiLoading}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AppstoreOutlined style={{ fontSize: 28, color: 'var(--cr-primary)' }} />
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--cr-text-3)',
                      }}
                    >
                      {t('kpi.totalAssets')}
                    </h2>
                    <div
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--cr-text-1)',
                      }}
                      aria-label={`${t('kpi.totalAssets')}: ${kpi?.totalAssets ?? '-'}`}
                    >
                      {kpi?.totalAssets ?? '-'}
                    </div>
                  </div>
                </div>
              </DsCard>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <DsCard loading={kpiLoading}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <BankOutlined style={{ fontSize: 28, color: 'var(--cr-success-500)' }} />
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--cr-text-3)',
                      }}
                    >
                      {t('kpi.totalNbv')}
                    </h2>
                    <div
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--cr-text-1)',
                      }}
                      aria-label={`${t('kpi.totalNbv')}: ${kpi ? formatPaise(kpi.totalNbvPaise) : '-'}`}
                    >
                      {kpi ? formatPaise(kpi.totalNbvPaise) : '-'}
                    </div>
                  </div>
                </div>
              </DsCard>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <DsCard loading={kpiLoading}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <BankOutlined style={{ fontSize: 28, color: 'var(--cr-warning-500)' }} />
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--cr-text-3)',
                      }}
                    >
                      {t('kpi.accDepreciation')}
                    </h2>
                    <div
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--cr-text-1)',
                      }}
                      aria-label={`${t('kpi.accDepreciation')}: ${kpi ? formatPaise(kpi.depreciationYtdPaise) : '-'}`}
                    >
                      {kpi ? formatPaise(kpi.depreciationYtdPaise) : '-'}
                    </div>
                  </div>
                </div>
              </DsCard>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <DsCard loading={kpiLoading}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <SafetyOutlined style={{ fontSize: 28, color: 'var(--cr-danger-500)' }} />
                  <div>
                    <h2
                      style={{
                        margin: 0,
                        fontSize: 12,
                        fontWeight: 400,
                        color: 'var(--cr-text-3)',
                      }}
                    >
                      {t('kpi.needsVerification')}
                    </h2>
                    <div
                      style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--cr-text-1)',
                      }}
                      aria-label={`${t('kpi.needsVerification')}: ${kpi?.awaitingVerification ?? '-'}`}
                    >
                      {kpi?.awaitingVerification ?? '-'}
                    </div>
                  </div>
                </div>
              </DsCard>
            </Col>
          </Row>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <Input.Search
              aria-label={t('searchAria')}
              placeholder={t('searchPlaceholder')}
              style={{ width: 220 }}
              onSearch={(v) => setFilters((f) => ({ ...f, search: v || undefined }))}
              allowClear
            />
            <Select
              aria-label={t('statusAria')}
              placeholder={t('statusPlaceholder')}
              style={{ width: 140 }}
              allowClear
              options={[
                { value: 'active', label: tStatus('active') },
                { value: 'disposed', label: tStatus('disposed') },
                { value: 'scrapped', label: tStatus('scrapped') },
                { value: 'transferred', label: tStatus('transferred') },
              ]}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v)}
            />
            <Select
              aria-label={t('fyAria')}
              placeholder={t('fyPlaceholder')}
              style={{ width: 140 }}
              allowClear
              options={[
                { value: '2024-25', label: '2024-25' },
                { value: '2025-26', label: '2025-26' },
                { value: '2026-27', label: '2026-27' },
              ]}
              onChange={(v) => setFilters((f) => ({ ...f, financialYear: v }))}
            />
          </div>

          <FixedAssetRegisterTable
            firmId={firmId}
            filters={tableFilters}
            onRowClick={(asset) => {
              setDrawerAssetId(asset._id);
              setDrawerOpen(true);
            }}
            onAction={(asset, action) => {
              if (action === 'view') {
                setDrawerAssetId(asset._id);
                setDrawerOpen(true);
              } else if (action === 'dispose') {
                setDisposeAsset(asset);
              } else if (action === 'transfer') {
                setTransferAsset(asset);
              }
            }}
          />
        </>
      )}

      <FixedAssetDetailDrawer
        assetId={drawerAssetId}
        firmId={firmId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onRefresh={() => setRefreshKey((k) => k + 1)}
      />

      {disposeAsset && (
        <DisposalWorkflowModal
          asset={disposeAsset}
          open={!!disposeAsset}
          onClose={() => setDisposeAsset(null)}
          onComplete={() => {
            setDisposeAsset(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {transferAsset && (
        <TransferAssetModal
          asset={transferAsset}
          open={!!transferAsset}
          onClose={() => setTransferAsset(null)}
          onComplete={() => {
            setTransferAsset(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
