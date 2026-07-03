'use client';
// E-Invoice Register report (IRN, QR, cancel status). i18n via finance.reports
// (shared common.* + gstRegisters.einvoiceRegister.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar. Watch: irnStatus values are raw API strings shown in a Tag.
import { use, useState } from 'react';
import { Alert, Skeleton, Tag, Tooltip } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { EinvoiceRegisterRow } from '@/types';

const IRN_STATUS_COLOR: Record<string, string> = {
  generated: 'blue',
  cancelled: 'red',
  pending: 'orange',
};

export default function EinvoiceRegisterPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [rows, setRows] = useState<EinvoiceRegisterRow[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.einvoiceRegister(ws._id, firmId, dateFrom, dateTo);
      setRows(data);
      setState(data.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    {
      title: t('common.date'),
      dataIndex: 'entryDate',
      key: 'date',
      width: 100,
      render: (v: string) => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: t('common.invoiceNo'),
      key: 'inv',
      render: (_: unknown, r: EinvoiceRegisterRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={r.sourceVoucherId}
          sourceVoucherType="sale_invoice"
          label={r.voucherNumber}
        />
      ),
    },
    { title: t('common.party'), dataIndex: 'partyName', key: 'party', ellipsis: true },
    {
      title: t('common.total'),
      dataIndex: 'grandTotalPaise',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.einvoiceRegister.irn'),
      dataIndex: 'irn',
      key: 'irn',
      render: (v: string) =>
        v ? (
          <Tooltip title={v}>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(0, 20)}…</span>
          </Tooltip>
        ) : (
          '-'
        ),
    },
    {
      title: t('gstRegisters.einvoiceRegister.irnStatus'),
      dataIndex: 'irnStatus',
      key: 'irnStatus',
      render: (v: string) => <Tag color={IRN_STATUS_COLOR[v] ?? 'default'}>{v || '-'}</Tag>,
    },
    {
      title: t('gstRegisters.einvoiceRegister.generatedAt'),
      dataIndex: 'irnGeneratedAt',
      key: 'genAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
    {
      title: t('gstRegisters.einvoiceRegister.cancelledAt'),
      dataIndex: 'cancelledAt',
      key: 'cancelAt',
      render: (v: string | null) => (v ? new Date(v).toLocaleDateString('en-IN') : '-'),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.einvoiceRegister.title')}
        category={t('gstRegisters.einvoiceRegister.category')}
        categoryPath="gst-registers"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />
        {state === 'success' && (
          <ReportTable<EinvoiceRegisterRow>
            dataSource={rows}
            columns={columns}
            rowKey={(r, i) => `${r.sourceVoucherId}-${i}`}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('gstRegisters.einvoiceRegister.error')} />
        )}
      </div>
    </div>
  );
}
