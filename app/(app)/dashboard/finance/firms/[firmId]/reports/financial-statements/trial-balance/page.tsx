'use client';
// Trial Balance report. i18n via finance.reports (shared common.* + financialStatements.trialBalance.*).
// Cross-link: header/filters/empty come from ReportToolbar + ReportFilterBar + ReportEmptyState.
import { use, useState } from 'react';
import { Alert, Skeleton, Statistic, Row, Col } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { TrialBalanceReport, TrialBalanceRow } from '@/types';

export default function TrialBalancePage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.trialBalance(ws._id, firmId, dateFrom, dateTo);
      setReport(data);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    {
      title: t('financialStatements.trialBalance.colCode'),
      dataIndex: 'accountCode',
      key: 'code',
      width: 80,
    },
    {
      title: t('financialStatements.trialBalance.colAccount'),
      dataIndex: 'accountName',
      key: 'name',
    },
    {
      title: t('financialStatements.trialBalance.colType'),
      dataIndex: 'accountType',
      key: 'type',
      width: 100,
    },
    {
      title: t('financialStatements.trialBalance.colDebit'),
      dataIndex: 'totalDebitPaise',
      key: 'dr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('financialStatements.trialBalance.colCredit'),
      dataIndex: 'totalCreditPaise',
      key: 'cr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('financialStatements.trialBalance.colClosingDebit'),
      dataIndex: 'closingDebitPaise',
      key: 'cdr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('financialStatements.trialBalance.colClosingCredit'),
      dataIndex: 'closingCreditPaise',
      key: 'ccr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('financialStatements.trialBalance.title')}
        category={t('financialStatements.trialBalance.category')}
        categoryPath="financial-statements"
        info={t('financialStatements.trialBalance.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && report && (
          <>
            {report.isBalanced ? (
              <Alert
                type="success"
                title={t('financialStatements.trialBalance.agrees', {
                  debit: fmtPaise(report.totalDebitPaise),
                  credit: fmtPaise(report.totalCreditPaise),
                })}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                type="error"
                title={t('financialStatements.trialBalance.disagrees')}
                style={{ marginBottom: 16 }}
              />
            )}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col>
                <Statistic
                  title={t('common.totalDebit')}
                  value={fmtPaise(report.totalDebitPaise)}
                />
              </Col>
              <Col>
                <Statistic
                  title={t('common.totalCredit')}
                  value={fmtPaise(report.totalCreditPaise)}
                />
              </Col>
            </Row>
            <ReportTable<TrialBalanceRow>
              dataSource={report.rows}
              columns={columns}
              rowKey="accountCode"
            />
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('financialStatements.trialBalance.error')} />
        )}
      </div>
    </div>
  );
}
