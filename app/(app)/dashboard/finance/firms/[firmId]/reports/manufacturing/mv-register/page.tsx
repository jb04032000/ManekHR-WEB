'use client';
// Manufacturing Voucher Register report (BOM + cost variance per production run). i18n via
// finance.reports (shared common.* + manufacturing.mvRegister.*). Cross-link: header/filters
// from ReportToolbar + ReportFilterBar. Watch: moduleMessage is API-driven (not translated).
import { useState } from 'react';
import { Alert, Skeleton, Table } from 'antd';
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
import type { MvRegisterRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function MvRegisterPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<MvRegisterRow[]>([]);
  const [moduleMessage, setModuleMessage] = useState<string | null>(null);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.mvRegister(ws._id, firmId, dateFrom, dateTo);
      setModuleMessage(data.message ?? null);
      setRows(data.rows);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const totalStdCost = rows.reduce((s, r) => s + r.standardCostPaise, 0);
  const totalActualCost = rows.reduce((s, r) => s + r.actualCostPaise, 0);
  const totalVariance = rows.reduce((s, r) => s + r.variancePaise, 0);

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
      render: (v: string, row: MvRegisterRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={row.sourceVoucherId}
          sourceVoucherType="manufacturing_voucher"
          label={v}
        />
      ),
    },
    {
      title: t('manufacturing.mvRegister.finishedItem'),
      dataIndex: 'finishedItemName',
      key: 'finishedItem',
    },
    {
      title: t('manufacturing.mvRegister.qtyProduced'),
      dataIndex: 'qtyProduced',
      key: 'qty',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    { title: t('manufacturing.mvRegister.bom'), dataIndex: 'bomId', key: 'bom', width: 100 },
    {
      title: t('manufacturing.mvRegister.standardCost'),
      dataIndex: 'standardCostPaise',
      key: 'stdCost',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('manufacturing.mvRegister.actualCost'),
      dataIndex: 'actualCostPaise',
      key: 'actualCost',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('manufacturing.mvRegister.variance'),
      dataIndex: 'variancePaise',
      key: 'variance',
      align: 'right' as const,
      render: (v: number) => (
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: v < 0 ? 'var(--cr-error)' : v > 0 ? 'var(--cr-success)' : undefined,
          }}
        >
          {fmtPaise(v)}
        </span>
      ),
    },
  ];

  const tableSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={5}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={5} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalStdCost)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={6} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalActualCost)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={7} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalVariance)}</span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('manufacturing.mvRegister.title')}
        category={t('manufacturing.mvRegister.category')}
        categoryPath="manufacturing"
        info={t('manufacturing.mvRegister.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {/* F-11 module not active banner */}
        {(state === 'empty' || state === 'success') && moduleMessage && (
          <Alert type="info" title={moduleMessage} className="mt-4" style={{ marginBottom: 16 }} />
        )}

        {state === 'success' && !moduleMessage && (
          <ReportTable<MvRegisterRow>
            dataSource={rows}
            columns={columns}
            rowKey={(_, i) => String(i)}
            summary={tableSummary}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && !moduleMessage && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('manufacturing.mvRegister.error')} />}
      </div>
    </div>
  );
}
