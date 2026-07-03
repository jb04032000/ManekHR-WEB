'use client';
// Daybook report (chronological journal of all vouchers). i18n via finance.reports
// (shared common.* + partyLedger.daybook.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar. Watch: voucherType Tag text is a data transform (kept as-is).
import { use, useState } from 'react';
import { Alert, Tag, Skeleton, Statistic, Row, Col } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { DaybookRow } from '@/types';

export default function DaybookPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [rows, setRows] = useState<DaybookRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalDebitPaise, setTotalDebitPaise] = useState(0);
  const [totalCreditPaise, setTotalCreditPaise] = useState(0);
  const [page, setPage] = useState(1);
  const [lastParams, setLastParams] = useState<{ dateFrom: string; dateTo: string } | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const fetchPage = async (dateFrom: string, dateTo: string, p: number) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.daybook(ws._id, firmId, dateFrom, dateTo, p);
      setRows(data.rows);
      setTotal(data.total);
      setTotalDebitPaise(data.totalDebitPaise);
      setTotalCreditPaise(data.totalCreditPaise);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    setPage(1);
    setLastParams({ dateFrom, dateTo });
    await fetchPage(dateFrom, dateTo, 1);
  };

  const handlePageChange = async (p: number) => {
    if (!lastParams) return;
    setPage(p);
    await fetchPage(lastParams.dateFrom, lastParams.dateTo, p);
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
      title: t('common.voucherHash'),
      key: 'voucher',
      render: (_: unknown, r: DaybookRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={r.sourceVoucherId}
          sourceVoucherType={r.sourceVoucherType}
          label={r.voucherNumber || '-'}
        />
      ),
    },
    {
      title: t('common.type'),
      dataIndex: 'voucherType',
      key: 'type',
      render: (v: string) => <Tag>{v.replace(/_/g, ' ')}</Tag>,
    },
    { title: t('common.narration'), dataIndex: 'narration', key: 'narration', ellipsis: true },
    {
      title: t('common.debit'),
      dataIndex: 'totalDebitPaise',
      key: 'dr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('common.credit'),
      dataIndex: 'totalCreditPaise',
      key: 'cr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('partyLedger.daybook.title')}
        category={t('partyLedger.daybook.category')}
        categoryPath="party-ledger"
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
                <Statistic title={t('common.totalDebit')} value={fmtPaise(totalDebitPaise)} />
              </Col>
              <Col>
                <Statistic title={t('common.totalCredit')} value={fmtPaise(totalCreditPaise)} />
              </Col>
              <Col>
                <Statistic title={t('partyLedger.daybook.totalVouchers')} value={total} />
              </Col>
            </Row>
            <ReportTable<DaybookRow>
              dataSource={rows}
              columns={columns}
              rowKey={(r, i) => `${r.sourceVoucherId}-${i}`}
              pagination={{
                current: page,
                total,
                pageSize: 100,
                showSizeChanger: false,
                onChange: handlePageChange,
              }}
            />
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('partyLedger.daybook.error')} />}
      </div>
    </div>
  );
}
