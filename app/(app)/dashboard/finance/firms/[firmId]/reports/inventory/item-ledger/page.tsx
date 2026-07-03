'use client';
// Item Ledger report (per-item movement history). i18n via finance.reports
// (shared common.* + inventory.itemLedger.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar; item id text filter is page-local.
import { useState } from 'react';
import { Alert, Input, Skeleton, Table } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { ItemLedgerRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function ItemLedgerPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<ItemLedgerRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');
  const [itemId, setItemId] = useState('');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id || !itemId.trim()) return;
    setState('loading');
    try {
      const data = await financeReportsApi.itemLedger(
        ws._id,
        firmId,
        itemId.trim(),
        dateFrom,
        dateTo,
      );
      setRows(data.rows);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const totalIn = rows.reduce((s, r) => s + r.inQty, 0);
  const totalOut = rows.reduce((s, r) => s + r.outQty, 0);
  const totalValue = rows.reduce((s, r) => s + r.valuePaise, 0);

  const columns = [
    {
      title: t('common.date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('common.voucherNo'),
      dataIndex: 'voucherNumber',
      key: 'voucherNo',
      render: (v: string, row: ItemLedgerRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={row.sourceVoucherId}
          sourceVoucherType={row.sourceVoucherType}
          label={v}
        />
      ),
    },
    { title: t('common.type'), dataIndex: 'voucherType', key: 'type', width: 120 },
    {
      title: t('inventory.itemLedger.inQty'),
      dataIndex: 'inQty',
      key: 'inQty',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? v.toLocaleString('en-IN') : ''),
    },
    {
      title: t('inventory.itemLedger.outQty'),
      dataIndex: 'outQty',
      key: 'outQty',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? v.toLocaleString('en-IN') : ''),
    },
    {
      title: t('inventory.itemLedger.balanceQty'),
      dataIndex: 'balanceQty',
      key: 'balQty',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('inventory.itemLedger.rate'),
      dataIndex: 'ratePaise',
      key: 'rate',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('inventory.itemLedger.value'),
      dataIndex: 'valuePaise',
      key: 'value',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
  ];

  const tableSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={3}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        {totalIn.toLocaleString('en-IN')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        {totalOut.toLocaleString('en-IN')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={5} />
      <Table.Summary.Cell index={6} />
      <Table.Summary.Cell index={7} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalValue)}</span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('inventory.itemLedger.title')}
        category={t('inventory.itemLedger.category')}
        categoryPath="inventory"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 8 }}>
          <Input
            placeholder={t('inventory.itemLedger.enterItemId')}
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            style={{ maxWidth: 280 }}
            allowClear
          />
        </div>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && (
          <ReportTable<ItemLedgerRow>
            dataSource={rows}
            columns={columns}
            rowKey={(_, i) => String(i)}
            summary={tableSummary}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('inventory.itemLedger.error')} />}
      </div>
    </div>
  );
}
