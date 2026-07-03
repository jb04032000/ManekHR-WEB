'use client';
// Item-wise Profitability report. i18n via finance.reports (shared common.* +
// inventory.itemProfitability.*). Cross-link: header/filters from ReportToolbar + ReportFilterBar.
import { useState } from 'react';
import { Alert, Skeleton, Table } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { ItemProfitabilityRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

function marginColor(pct: number): string {
  if (pct > 20) return 'var(--cr-success)';
  if (pct >= 10) return 'var(--cr-warning)';
  return 'var(--cr-error)';
}

export default function ItemProfitabilityPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<ItemProfitabilityRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.itemProfitability(ws._id, firmId, dateFrom, dateTo);
      const sorted = [...data.rows].sort((a, b) => b.grossProfitPaise - a.grossProfitPaise);
      setRows(sorted);
      setState(sorted.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const totalRevenue = rows.reduce((s, r) => s + r.revenuePaise, 0);
  const totalCogs = rows.reduce((s, r) => s + r.cogsPaise, 0);
  const totalGp = rows.reduce((s, r) => s + r.grossProfitPaise, 0);
  const blendedMargin = totalRevenue > 0 ? (totalGp / totalRevenue) * 100 : 0;

  const columns = [
    { title: t('common.itemName'), dataIndex: 'itemName', key: 'itemName' },
    { title: t('common.hsn'), dataIndex: 'hsn', key: 'hsn', width: 100 },
    {
      title: t('inventory.itemProfitability.qtyIn'),
      dataIndex: 'qtyIn',
      key: 'qtyIn',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('inventory.itemProfitability.qtySold'),
      dataIndex: 'qtySold',
      key: 'qtySold',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('inventory.itemProfitability.revenue'),
      dataIndex: 'revenuePaise',
      key: 'revenue',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('inventory.itemProfitability.cogs'),
      dataIndex: 'cogsPaise',
      key: 'cogs',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('inventory.itemProfitability.grossProfit'),
      dataIndex: 'grossProfitPaise',
      key: 'gp',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('inventory.itemProfitability.marginPct'),
      dataIndex: 'grossMarginPct',
      key: 'margin',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: marginColor(v), fontWeight: 600 }}>{v.toFixed(1)}%</span>
      ),
    },
  ];

  const tableSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={4}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalRevenue)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={5} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalCogs)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={6} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalGp)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={7} align="right">
        <span style={{ color: marginColor(blendedMargin), fontWeight: 600 }}>
          {blendedMargin.toFixed(1)}%
        </span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('inventory.itemProfitability.title')}
        category={t('inventory.itemProfitability.category')}
        categoryPath="inventory"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && (
          <ReportTable<ItemProfitabilityRow>
            dataSource={rows}
            columns={columns}
            rowKey="itemId"
            summary={tableSummary}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('inventory.itemProfitability.error')} />}
      </div>
    </div>
  );
}
