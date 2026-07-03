'use client';
// GSTR-1 Output Register report. i18n via finance.reports (gstRegisters.gstr1.*).
// Cross-link: header from ReportToolbar; data from financeReportsApi.gstr1 (Gstr1Service).
import { use, useState } from 'react';
import { Alert, DatePicker, Skeleton, Statistic, Row, Col } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import DsTable from '@/components/ui/DsTable';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';

export default function Gstr1Page({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [period, setPeriod] = useState<Dayjs>(dayjs());
  const [report, setReport] = useState<any>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      // F-12-01: period format is MMYYYY per STATE.md decision (backend DTO enforces /^\d{6}$/)
      const data = await financeReportsApi.gstr1(ws._id, firmId, period.format('MMYYYY'));
      setReport(data);
      setState('success');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.gstr1.title')}
        category={t('gstRegisters.gstr1.category')}
        categoryPath="gst-registers"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DatePicker
              picker="month"
              value={period}
              onChange={(d) => d && setPeriod(d)}
              allowClear={false}
              placeholder={t('gstRegisters.gstr1.selectPeriod')}
            />
            <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
              {t('common.runReport')}
            </DsButton>
          </div>
        </DsCard>

        {state === 'success' && report && (
          <div>
            <Alert
              type="info"
              title={t('gstRegisters.gstr1.computedFor', { period: period.format('MMMM YYYY') })}
              style={{ marginBottom: 16 }}
            />
            {/* B2B Section */}
            {report.b2b && (
              <DsCard style={{ marginBottom: 16 }}>
                <h4 style={{ fontWeight: 700, marginBottom: 8 }}>
                  {t('gstRegisters.gstr1.b2bInvoices')}
                </h4>
                <DsTable
                  size="small"
                  dataSource={report.b2b}
                  rowKey={(_: any, i: any) => i.toString()}
                  columns={[
                    { title: t('gstRegisters.gstr1.colGstin'), dataIndex: 'gstin', key: 'gstin' },
                    {
                      title: t('gstRegisters.gstr1.colInvoiceNo'),
                      dataIndex: 'invoiceNumber',
                      key: 'inv',
                    },
                    {
                      title: t('gstRegisters.gstr1.colDate'),
                      dataIndex: 'invoiceDate',
                      key: 'date',
                    },
                    {
                      title: t('gstRegisters.gstr1.colValue'),
                      dataIndex: 'invoiceValue',
                      key: 'val',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v),
                    },
                    {
                      title: t('gstRegisters.gstr1.colTaxable'),
                      dataIndex: 'taxableValue',
                      key: 'tax',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v),
                    },
                    {
                      title: t('gstRegisters.gstr1.colIgst'),
                      dataIndex: 'igst',
                      key: 'igst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v ?? 0),
                    },
                    {
                      title: t('gstRegisters.gstr1.colCgst'),
                      dataIndex: 'cgst',
                      key: 'cgst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v ?? 0),
                    },
                    {
                      title: t('gstRegisters.gstr1.colSgst'),
                      dataIndex: 'sgst',
                      key: 'sgst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v ?? 0),
                    },
                  ]}
                  pagination={{ pageSize: 50 }}
                  scrollX="max-content"
                />
              </DsCard>
            )}
            {/* B2C Section */}
            {report.b2c && (
              <DsCard style={{ marginBottom: 16 }}>
                <h4 style={{ fontWeight: 700, marginBottom: 8 }}>
                  {t('gstRegisters.gstr1.b2cInvoices')}
                </h4>
                <DsTable
                  size="small"
                  dataSource={report.b2c}
                  rowKey={(_: any, i: any) => i.toString()}
                  columns={[
                    {
                      title: t('gstRegisters.gstr1.colStateCode'),
                      dataIndex: 'stateCode',
                      key: 'state',
                    },
                    {
                      title: t('gstRegisters.gstr1.colTaxable'),
                      dataIndex: 'taxableValue',
                      key: 'tax',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v),
                    },
                    {
                      title: t('gstRegisters.gstr1.colIgst'),
                      dataIndex: 'igst',
                      key: 'igst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v ?? 0),
                    },
                    {
                      title: t('gstRegisters.gstr1.colCgst'),
                      dataIndex: 'cgst',
                      key: 'cgst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v ?? 0),
                    },
                    {
                      title: t('gstRegisters.gstr1.colSgst'),
                      dataIndex: 'sgst',
                      key: 'sgst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v ?? 0),
                    },
                  ]}
                  pagination={false}
                  scrollX="max-content"
                />
              </DsCard>
            )}
            {/* HSN Summary */}
            {report.hsn && (
              <DsCard style={{ marginBottom: 16 }}>
                <h4 style={{ fontWeight: 700, marginBottom: 8 }}>
                  {t('gstRegisters.gstr1.hsnSummary')}
                </h4>
                <DsTable
                  size="small"
                  dataSource={report.hsn}
                  rowKey={(_: any, i: any) => i.toString()}
                  columns={[
                    { title: t('gstRegisters.gstr1.colHsn'), dataIndex: 'hsn', key: 'hsn' },
                    {
                      title: t('gstRegisters.gstr1.colDescription'),
                      dataIndex: 'description',
                      key: 'desc',
                      ellipsis: true,
                    },
                    { title: t('gstRegisters.gstr1.colUqc'), dataIndex: 'uqc', key: 'uqc' },
                    {
                      title: t('gstRegisters.gstr1.colQty'),
                      dataIndex: 'qty',
                      key: 'qty',
                      align: 'right' as const,
                    },
                    {
                      title: t('gstRegisters.gstr1.colTaxable'),
                      dataIndex: 'taxableValue',
                      key: 'tax',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v),
                    },
                    {
                      title: t('gstRegisters.gstr1.colTotalGst'),
                      dataIndex: 'totalGst',
                      key: 'gst',
                      align: 'right' as const,
                      render: (v: number) => fmtPaise(v),
                    },
                  ]}
                  pagination={false}
                  scrollX="max-content"
                />
              </DsCard>
            )}
            {/* Totals */}
            {report.totals && (
              <Row gutter={16}>
                <Col>
                  <Statistic
                    title={t('gstRegisters.gstr1.totalTaxableValue')}
                    value={fmtPaise(report.totals.taxableValue ?? 0)}
                  />
                </Col>
                <Col>
                  <Statistic
                    title={t('gstRegisters.gstr1.totalIgst')}
                    value={fmtPaise(report.totals.igst ?? 0)}
                  />
                </Col>
                <Col>
                  <Statistic
                    title={t('gstRegisters.gstr1.totalCgst')}
                    value={fmtPaise(report.totals.cgst ?? 0)}
                  />
                </Col>
                <Col>
                  <Statistic
                    title={t('gstRegisters.gstr1.totalSgst')}
                    value={fmtPaise(report.totals.sgst ?? 0)}
                  />
                </Col>
              </Row>
            )}
          </div>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('gstRegisters.gstr1.error')} />}
      </div>
    </div>
  );
}
