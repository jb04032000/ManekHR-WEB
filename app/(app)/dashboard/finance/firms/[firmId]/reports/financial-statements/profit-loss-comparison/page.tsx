'use client';
// P&L Month-wise Comparison report. i18n via finance.reports
// (financialStatements.profitLossComparison.*). Cross-link: header from ReportToolbar.
// Watch: month column labels are API-driven (month.label); metric labels are translated.
import { useState } from 'react';
import { Alert, Select, Skeleton } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import { usePersistedState } from '@/hooks/usePersistedState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { ProfitLossComparisonMonth } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

type MetricKey = 'revenuePaise' | 'grossProfitPaise' | 'netProfitPaise';

interface MetricRow {
  metric: MetricKey;
  label: string;
  total: number;
  // dynamic per-month fields keyed by `period` (MMYYYY) → paise value
  [periodKey: string]: number | string | MetricKey;
}

// Metric labels are resolved inside the component via i18n (labelKey -> t()).
const METRICS: { key: MetricKey; labelKey: string }[] = [
  { key: 'revenuePaise', labelKey: 'revenue' },
  { key: 'grossProfitPaise', labelKey: 'grossProfit' },
  { key: 'netProfitPaise', labelKey: 'netProfit' },
];

function getFyOptions(): { value: string; label: string }[] {
  const now = dayjs();
  const fyStart = now.month() >= 3 ? now.year() : now.year() - 1;
  return Array.from({ length: 3 }, (_, i) => {
    const y = fyStart - i;
    const label = `FY ${y}–${String(y + 1).slice(2)}`;
    const value = `${y}-04-01,${y + 1}-03-31`;
    return { value, label };
  });
}

export default function ProfitLossComparisonPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [months, setMonths] = useState<ProfitLossComparisonMonth[]>([]);
  const [state, setState] = useState<ReportState>('idle');

  const fyOptions = getFyOptions();
  // Persist the chosen financial year per-firm so it survives navigation/reload (platform-bar
  // "remember per-firm filter defaults"). Cross-link: usePersistedState (localStorage-backed).
  const [selectedFy, setSelectedFy] = usePersistedState<string>(
    `finance:reports:plComparison:fy:${firmId}`,
    fyOptions[0].value,
  );

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const [dateFrom, dateTo] = selectedFy.split(',');
      const data = await financeReportsApi.profitLossComparison(
        ws._id,
        firmId,
        `${dateFrom}T00:00:00.000Z`,
        `${dateTo}T23:59:59.999Z`,
      );
      setMonths(data.months);
      setState(data.months.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  // Build one row per metric; each month becomes a column keyed by `period` (MMYYYY).
  const dataSource: MetricRow[] = METRICS.map((m) => {
    const row: MetricRow = {
      metric: m.key,
      label: t(`financialStatements.profitLossComparison.${m.labelKey}`),
      total: 0,
    };
    for (const month of months) {
      row[month.period] = month[m.key];
      row.total = (row.total as number) + month[m.key];
    }
    return row;
  });

  const monthColumns: ColumnsType<MetricRow> = months.map((month) => ({
    title: month.label,
    key: month.period,
    align: 'right' as const,
    width: 110,
    render: (_: unknown, row: MetricRow) => {
      const v = (row[month.period] as number) ?? 0;
      const isNetProfit = row.metric === 'netProfitPaise';
      const isLoss = isNetProfit && v < 0;
      return (
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            display: 'block',
            backgroundColor: isLoss ? 'rgba(239,68,68,0.08)' : undefined,
            color: isNetProfit ? (v < 0 ? 'var(--cr-error)' : 'var(--cr-success)') : undefined,
            fontWeight: isNetProfit ? 700 : undefined,
          }}
        >
          {fmtPaise(v)}
        </span>
      );
    },
  }));

  const columns: ColumnsType<MetricRow> = [
    {
      title: t('financialStatements.profitLossComparison.metric'),
      dataIndex: 'label',
      key: 'metric',
      fixed: 'left' as const,
      width: 180,
      render: (v: string, row: MetricRow) => (
        <span style={{ fontWeight: row.metric === 'netProfitPaise' ? 700 : 600 }}>{v}</span>
      ),
    },
    ...monthColumns,
    {
      title: t('financialStatements.profitLossComparison.total'),
      dataIndex: 'total',
      key: 'total',
      align: 'right' as const,
      fixed: 'right' as const,
      width: 130,
      render: (v: number, row: MetricRow) => {
        const isNetProfit = row.metric === 'netProfitPaise';
        return (
          <span
            style={{
              fontVariantNumeric: 'tabular-nums',
              fontWeight: 700,
              color: isNetProfit ? (v < 0 ? 'var(--cr-error)' : 'var(--cr-success)') : undefined,
            }}
          >
            {fmtPaise(v)}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('financialStatements.profitLossComparison.title')}
        category={t('financialStatements.profitLossComparison.category')}
        categoryPath="financial-statements"
        info={t('financialStatements.profitLossComparison.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Select
              aria-label={t('financialStatements.profitLossComparison.fiscalYear')}
              value={selectedFy}
              onChange={setSelectedFy}
              style={{ width: 160 }}
              options={fyOptions}
            />
            <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
              {t('common.runReport')}
            </DsButton>
          </div>
        </DsCard>

        {state === 'success' && (
          <DsTable<MetricRow>
            dataSource={dataSource}
            columns={columns}
            rowKey={(r) => r.metric}
            scrollX="max-content"
            pagination={false}
            size="small"
            rowClassName={(row) => (row.metric === 'netProfitPaise' ? 'report-net-profit-row' : '')}
            onRow={(row) => {
              if (row.metric === 'netProfitPaise') {
                return { style: { background: 'var(--cr-surface-2)', fontWeight: 700 } };
              }
              return {};
            }}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('financialStatements.profitLossComparison.error')} />
        )}
      </div>
    </div>
  );
}
