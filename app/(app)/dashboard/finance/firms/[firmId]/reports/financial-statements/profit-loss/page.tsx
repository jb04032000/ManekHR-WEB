'use client';
// Profit & Loss report. i18n via finance.reports (financialStatements.profitLoss.*).
// Cross-link: section tables = FinancialStatementTable; header/filters = ReportToolbar + ReportFilterBar.
import { use, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { ProfitLossTable } from '@/components/finance/reports/FinancialStatementTable';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { ProfitLossReport } from '@/types';

export default function ProfitLossPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.profitLoss(ws._id, firmId, dateFrom, dateTo);
      setReport(data);
      setState(data.tradingAccount.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('financialStatements.profitLoss.title')}
        category={t('financialStatements.profitLoss.category')}
        categoryPath="financial-statements"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && report && (
          <>
            {report.isLoss ? (
              <Alert
                type="warning"
                title={t('financialStatements.profitLoss.netLoss', {
                  amount: fmtPaise(Math.abs(report.netProfitPaise)),
                })}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                type="success"
                title={t('financialStatements.profitLoss.netProfit', {
                  amount: fmtPaise(report.netProfitPaise),
                })}
                style={{ marginBottom: 16 }}
              />
            )}
            <ProfitLossTable
              sections={report.tradingAccount}
              title={t('financialStatements.profitLoss.tradingAccount')}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                padding: '8px 16px',
                background: 'var(--cr-surface-2)',
                margin: '8px 0',
                color: report.grossProfitPaise >= 0 ? 'var(--cr-success)' : 'var(--cr-error)',
              }}
            >
              {t('financialStatements.profitLoss.grossProfit', {
                amount: fmtPaise(Math.abs(report.grossProfitPaise)),
              })}
            </div>
            <ProfitLossTable
              sections={report.indirectItems}
              title={t('financialStatements.profitLoss.indirectExpenses')}
            />
            <ProfitLossTable
              sections={report.otherIncome}
              title={t('financialStatements.profitLoss.otherIncome')}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: 16,
                padding: '12px 16px',
                background: 'var(--cr-surface-2)',
                marginTop: 8,
                color: report.netProfitPaise >= 0 ? 'var(--cr-success)' : 'var(--cr-error)',
              }}
            >
              {report.isLoss
                ? t('financialStatements.profitLoss.netLossLabel', {
                    amount: fmtPaise(Math.abs(report.netProfitPaise)),
                  })
                : t('financialStatements.profitLoss.netProfitLabel', {
                    amount: fmtPaise(Math.abs(report.netProfitPaise)),
                  })}
            </div>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('financialStatements.profitLoss.error')} />
        )}
      </div>
    </div>
  );
}
