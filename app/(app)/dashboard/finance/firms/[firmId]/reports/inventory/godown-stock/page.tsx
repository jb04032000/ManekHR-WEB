'use client';
// Godown-wise Stock report. i18n via finance.reports (inventory.godownStock.*).
// Cross-link: header from ReportToolbar; data from financeReportsApi.godownStock.
import { useState } from 'react';
import { Alert, Select, Skeleton, Table } from 'antd';
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
import type { GodownStockRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function GodownStockPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<GodownStockRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');
  const [godownId, setGodownId] = useState<string | undefined>();

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.godownStock(ws._id, firmId, godownId);
      setRows(data.rows);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const grandTotal = rows.reduce((s, r) => s + r.valuationPaise, 0);

  const columns = [
    { title: t('inventory.godownStock.godown'), dataIndex: 'godownName', key: 'godownName' },
    { title: t('common.itemName'), dataIndex: 'itemName', key: 'itemName' },
    {
      title: t('inventory.godownStock.qtyOnHand'),
      dataIndex: 'qtyOnHand',
      key: 'qtyOnHand',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('inventory.godownStock.value'),
      dataIndex: 'valuationPaise',
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
        {t('common.grandTotal')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(grandTotal)}</span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('inventory.godownStock.title')}
        category={t('inventory.godownStock.category')}
        categoryPath="inventory"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            <Select
              aria-label={t('common.filterGodown')}
              placeholder={t('inventory.godownStock.allGodowns')}
              style={{ minWidth: 200 }}
              allowClear
              value={godownId}
              onChange={setGodownId}
            />
            <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
              {t('common.runReport')}
            </DsButton>
          </div>
        </DsCard>

        {state === 'success' && (
          <ReportTable<GodownStockRow>
            dataSource={rows}
            columns={columns}
            rowKey={(r) => `${r.godownId}-${r.itemId}`}
            summary={tableSummary}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('inventory.godownStock.error')} />}
      </div>
    </div>
  );
}
