'use client';
// GST Output Register report. i18n via finance.reports (shared common.* + gstRegisters.outputRegister.*).
// Cross-link: header/filters/empty from ReportToolbar + ReportFilterBar + ReportEmptyState.
import { use, useState } from 'react';
import { Alert, Skeleton, Statistic, Row, Col } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { GstOutputRegisterRow } from '@/types';

export default function GstOutputRegisterPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [rows, setRows] = useState<GstOutputRegisterRow[]>([]);
  const [totals, setTotals] = useState<Record<string, number>>({});
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.gstOutputRegister(ws._id, firmId, dateFrom, dateTo);
      setRows(data.rows);
      setTotals(data.totals);
      setState(data.rows.length > 0 ? 'success' : 'empty');
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
      render: (_: unknown, r: GstOutputRegisterRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={r.sourceVoucherId}
          sourceVoucherType="sale_invoice"
          label={r.voucherNumber}
        />
      ),
    },
    { title: t('common.party'), dataIndex: 'partyName', key: 'party', ellipsis: true },
    { title: t('common.gstin'), dataIndex: 'partyGstin', key: 'gstin', width: 160 },
    { title: t('common.hsn'), dataIndex: 'hsnCode', key: 'hsn', width: 80 },
    {
      title: t('common.taxable'),
      dataIndex: 'taxableAmountPaise',
      key: 'tax',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('common.igst'),
      dataIndex: 'igstPaise',
      key: 'igst',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : '-'),
    },
    {
      title: t('common.cgst'),
      dataIndex: 'cgstPaise',
      key: 'cgst',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : '-'),
    },
    {
      title: t('common.sgst'),
      dataIndex: 'sgstPaise',
      key: 'sgst',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : '-'),
    },
    {
      title: t('common.totalGst'),
      dataIndex: 'totalGstPaise',
      key: 'totalgst',
      align: 'right' as const,
      render: (v: number) => <b>{fmtPaise(v)}</b>,
    },
    {
      title: t('common.invoiceTotal'),
      dataIndex: 'totalPaise',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.outputRegister.title')}
        category={t('gstRegisters.outputRegister.category')}
        categoryPath="gst-registers"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />
        {state === 'success' && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col>
                <Statistic
                  title={t('common.totalTaxable')}
                  value={fmtPaise(totals.taxableAmountPaise ?? 0)}
                />
              </Col>
              <Col>
                <Statistic title={t('common.totalIgst')} value={fmtPaise(totals.igstPaise ?? 0)} />
              </Col>
              <Col>
                <Statistic title={t('common.totalCgst')} value={fmtPaise(totals.cgstPaise ?? 0)} />
              </Col>
              <Col>
                <Statistic title={t('common.totalSgst')} value={fmtPaise(totals.sgstPaise ?? 0)} />
              </Col>
              <Col>
                <Statistic
                  title={t('common.totalGstLabel')}
                  value={fmtPaise(totals.totalGstPaise ?? 0)}
                />
              </Col>
            </Row>
            <ReportTable<GstOutputRegisterRow>
              dataSource={rows}
              columns={columns}
              rowKey={(r, i) => `${r.voucherNumber}-${i}`}
            />
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('gstRegisters.outputRegister.error')} />}
      </div>
    </div>
  );
}
