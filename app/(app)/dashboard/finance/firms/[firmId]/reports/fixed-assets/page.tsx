'use client';
// Fixed Assets report (Asset Register + Depreciation Schedule tabs). i18n via finance.reports
// (fixedAssets.*). Cross-link: header from ReportToolbar; data from financeReportsApi.
import { useState } from 'react';
import { Alert, Skeleton, Table, Tabs } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { FixedAssetRegisterRow, DepreciationScheduleRow } from '@/types';

type TabKey = 'register' | 'depreciation';
type LoadState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function FixedAssetsReportPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [activeTab, setActiveTab] = useState<TabKey>('register');

  // Asset Register state
  const [registerRows, setRegisterRows] = useState<FixedAssetRegisterRow[]>([]);
  const [registerState, setRegisterState] = useState<LoadState>('idle');

  // Depreciation Schedule state
  const [deprRows, setDeprRows] = useState<DepreciationScheduleRow[]>([]);
  const [deprState, setDeprState] = useState<LoadState>('idle');

  const handleRunRegister = async () => {
    if (!ws?._id) return;
    setRegisterState('loading');
    try {
      const data = await financeReportsApi.fixedAssetRegister(ws._id, firmId);
      setRegisterRows(data.rows);
      setRegisterState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setRegisterState('error');
    }
  };

  const handleRunDepreciation = async () => {
    if (!ws?._id) return;
    setDeprState('loading');
    try {
      const data = await financeReportsApi.depreciationSchedule(ws._id, firmId);
      setDeprRows(data.rows);
      setDeprState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setDeprState('error');
    }
  };

  // Register totals
  const totalCost = registerRows.reduce((s, r) => s + r.purchaseCostPaise, 0);
  const totalAccumDepr = registerRows.reduce((s, r) => s + r.accumulatedDepreciationPaise, 0);
  const totalNbv = registerRows.reduce((s, r) => s + r.netBookValuePaise, 0);

  // Depreciation schedule totals
  const totalOpenNbv = deprRows.reduce((s, r) => s + r.openingNbvPaise, 0);
  const totalDepr = deprRows.reduce((s, r) => s + r.depreciationPaise, 0);
  const totalCloseNbv = deprRows.reduce((s, r) => s + r.closingNbvPaise, 0);

  const registerColumns = [
    { title: t('fixedAssets.assetName'), dataIndex: 'assetName', key: 'name' },
    { title: t('fixedAssets.assetCategory'), dataIndex: 'category', key: 'category', width: 120 },
    {
      title: t('fixedAssets.purchaseDate'),
      dataIndex: 'purchaseDate',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('fixedAssets.cost'),
      dataIndex: 'purchaseCostPaise',
      key: 'cost',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('fixedAssets.accumDepreciation'),
      dataIndex: 'accumulatedDepreciationPaise',
      key: 'accumDepr',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('fixedAssets.nbv'),
      dataIndex: 'netBookValuePaise',
      key: 'nbv',
      align: 'right' as const,
      render: (v: number, row: FixedAssetRegisterRow) => {
        const pct = row.purchaseCostPaise > 0 ? (v / row.purchaseCostPaise) * 100 : 100;
        return (
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              color: pct < 20 ? 'var(--cr-warning)' : undefined,
            }}
          >
            {fmtPaise(v)}
          </span>
        );
      },
    },
    { title: t('fixedAssets.method'), dataIndex: 'depreciationMethod', key: 'method', width: 80 },
    {
      title: t('fixedAssets.ratePct'),
      dataIndex: 'depreciationRate',
      key: 'rate',
      align: 'right' as const,
      render: (v: number) => `${v}%`,
    },
  ];

  const registerSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={3}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalCost)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalAccumDepr)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={5} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalNbv)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={6} />
      <Table.Summary.Cell index={7} />
    </Table.Summary.Row>
  );

  const deprColumns = [
    { title: t('fixedAssets.assetName'), dataIndex: 'assetName', key: 'name' },
    { title: t('fixedAssets.period'), dataIndex: 'period', key: 'period', width: 100 },
    {
      title: t('fixedAssets.openingNbv'),
      dataIndex: 'openingNbvPaise',
      key: 'openNbv',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('fixedAssets.depreciation'),
      dataIndex: 'depreciationPaise',
      key: 'depr',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('fixedAssets.closingNbv'),
      dataIndex: 'closingNbvPaise',
      key: 'closeNbv',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
  ];

  const deprSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={2}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={2} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalOpenNbv)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalDepr)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalCloseNbv)}</span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  const isDataLoaded =
    (activeTab === 'register' && registerState === 'success') ||
    (activeTab === 'depreciation' && deprState === 'success');

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('fixedAssets.title')}
        category={t('fixedAssets.category')}
        categoryPath="fixed-assets"
        dataLoaded={isDataLoaded}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(k) => setActiveTab(k as TabKey)}
          items={[
            {
              key: 'register',
              label: t('fixedAssets.tabRegister'),
              children: (
                <>
                  <DsCard style={{ marginBottom: 16, padding: 16 }}>
                    <DsButton
                      dsVariant="primary"
                      onClick={handleRunRegister}
                      loading={registerState === 'loading'}
                    >
                      {t('common.runReport')}
                    </DsButton>
                  </DsCard>
                  {registerState === 'success' && (
                    <ReportTable<FixedAssetRegisterRow>
                      dataSource={registerRows}
                      columns={registerColumns}
                      rowKey="assetId"
                      summary={registerSummary}
                    />
                  )}
                  {registerState === 'loading' && <Skeleton active />}
                  {registerState === 'empty' && <ReportEmptyState />}
                  {registerState === 'idle' && <ReportEmptyState mode="idle" />}
                  {registerState === 'error' && (
                    <Alert type="error" title={t('fixedAssets.errorRegister')} />
                  )}
                </>
              ),
            },
            {
              key: 'depreciation',
              label: t('fixedAssets.tabDepreciation'),
              children: (
                <>
                  <DsCard style={{ marginBottom: 16, padding: 16 }}>
                    <DsButton
                      dsVariant="primary"
                      onClick={handleRunDepreciation}
                      loading={deprState === 'loading'}
                    >
                      {t('common.runReport')}
                    </DsButton>
                  </DsCard>
                  {deprState === 'success' && (
                    <ReportTable<DepreciationScheduleRow>
                      dataSource={deprRows}
                      columns={deprColumns}
                      rowKey={(r, i) => `${r.assetId}-${i}`}
                      summary={deprSummary}
                    />
                  )}
                  {deprState === 'loading' && <Skeleton active />}
                  {deprState === 'empty' && <ReportEmptyState />}
                  {deprState === 'idle' && <ReportEmptyState mode="idle" />}
                  {deprState === 'error' && (
                    <Alert type="error" title={t('fixedAssets.errorDepreciation')} />
                  )}
                </>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
