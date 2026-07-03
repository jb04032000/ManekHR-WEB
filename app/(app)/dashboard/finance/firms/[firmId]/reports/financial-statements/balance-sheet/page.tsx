'use client';
// Balance Sheet report (Schedule III vertical format). i18n via finance.reports
// (financialStatements.balanceSheet.*). Cross-link: ProfitLossTable for section rows;
// header from ReportToolbar; custom as-of DatePicker + Run inline.
import { use, useState } from 'react';
import { Alert, DatePicker, Row, Col, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs, { Dayjs } from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import {
  ProfitLossTable,
  bsEntryToPlSection,
} from '@/components/finance/reports/FinancialStatementTable';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { BalanceSheetReport } from '@/types';

export default function BalanceSheetPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [report, setReport] = useState<BalanceSheetReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [asOfDate, setAsOfDate] = useState<Dayjs>(dayjs());

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.balanceSheet(ws._id, firmId, asOfDate.toISOString());
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
        reportName={t('financialStatements.balanceSheet.title')}
        category={t('financialStatements.balanceSheet.category')}
        categoryPath="financial-statements"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DatePicker value={asOfDate} onChange={(d) => d && setAsOfDate(d)} allowClear={false} />
            <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
              {t('common.runReport')}
            </DsButton>
          </div>
        </DsCard>

        {state === 'success' && report && (
          <>
            {report.isUnaudited && (
              <Alert
                type="warning"
                title={t('financialStatements.balanceSheet.unaudited')}
                style={{ marginBottom: 12 }}
              />
            )}
            {report.isBalanced ? (
              <Alert
                type="success"
                title={t('financialStatements.balanceSheet.balances', {
                  amount: fmtPaise(report.totalAssetsPaise),
                })}
                style={{ marginBottom: 16 }}
              />
            ) : (
              <Alert
                type="error"
                title={t('financialStatements.balanceSheet.notBalanced')}
                style={{ marginBottom: 16 }}
              />
            )}
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <ProfitLossTable
                  sections={report.liabilities.map(bsEntryToPlSection)}
                  title={t('financialStatements.balanceSheet.equityLiabilities')}
                />
                <ProfitLossTable
                  sections={report.capital.map(bsEntryToPlSection)}
                  title={t('financialStatements.balanceSheet.capitalReserves')}
                />
                <div
                  style={{
                    fontWeight: 700,
                    padding: '8px 16px',
                    background: 'var(--cr-surface-2)',
                    marginTop: 8,
                  }}
                >
                  {t('financialStatements.balanceSheet.totalEquityLiabilities', {
                    amount: fmtPaise(report.totalLiabilitiesCapitalPaise),
                  })}
                </div>
              </Col>
              <Col xs={24} md={12}>
                <ProfitLossTable
                  sections={report.assets.map(bsEntryToPlSection)}
                  title={t('financialStatements.balanceSheet.assets')}
                />
                <div
                  style={{
                    fontWeight: 700,
                    padding: '8px 16px',
                    background: 'var(--cr-surface-2)',
                    marginTop: 8,
                  }}
                >
                  {t('financialStatements.balanceSheet.totalAssets', {
                    amount: fmtPaise(report.totalAssetsPaise),
                  })}
                </div>
              </Col>
            </Row>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('financialStatements.balanceSheet.error')} />
        )}
      </div>
    </div>
  );
}
