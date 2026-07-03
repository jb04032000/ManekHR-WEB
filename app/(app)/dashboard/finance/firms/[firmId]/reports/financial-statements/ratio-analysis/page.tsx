'use client';
// Ratio Analysis report. i18n via finance.reports (financialStatements.ratioAnalysis.*).
// Cross-link: header/filters/empty from ReportToolbar + ReportFilterBar + ReportEmptyState.
import { use, useState } from 'react';
import { Alert, Skeleton, Statistic, Row, Col } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { RatioAnalysisReport } from '@/types';

export default function RatioAnalysisPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [report, setReport] = useState<RatioAnalysisReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.ratioAnalysis(ws._id, firmId, dateFrom, dateTo);
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
        reportName={t('financialStatements.ratioAnalysis.title')}
        category={t('financialStatements.ratioAnalysis.category')}
        categoryPath="financial-statements"
        info={t('financialStatements.ratioAnalysis.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && report && (
          <>
            {report.currentRatio < 1.0 && (
              <Alert
                type="warning"
                title={t('financialStatements.ratioAnalysis.currentRatioWarning')}
                style={{ marginBottom: 16 }}
              />
            )}
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('financialStatements.ratioAnalysis.gpPct')}
                  value={report.gpPct.toFixed(2)}
                  suffix="%"
                  styles={{
                    content: {
                      color:
                        report.gpPct > 20
                          ? 'var(--cr-success)'
                          : report.gpPct > 10
                            ? 'var(--cr-warning)'
                            : 'var(--cr-error)',
                    },
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('financialStatements.ratioAnalysis.npPct')}
                  value={report.npPct.toFixed(2)}
                  suffix="%"
                  styles={{
                    content: {
                      color:
                        report.npPct > 10
                          ? 'var(--cr-success)'
                          : report.npPct > 5
                            ? 'var(--cr-warning)'
                            : 'var(--cr-error)',
                    },
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('financialStatements.ratioAnalysis.currentRatio')}
                  value={report.currentRatio.toFixed(2)}
                  styles={{
                    content: {
                      color: report.currentRatio >= 1 ? 'var(--cr-success)' : 'var(--cr-error)',
                    },
                  }}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('financialStatements.ratioAnalysis.debtEquity')}
                  value={report.debtEquity.toFixed(2)}
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('financialStatements.ratioAnalysis.returnOnEquity')}
                  value={report.returnOnEquity.toFixed(2)}
                  suffix="%"
                />
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Statistic
                  title={t('financialStatements.ratioAnalysis.workingCapital')}
                  value={fmtPaise(report.workingCapitalPaise)}
                />
              </Col>
            </Row>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('financialStatements.ratioAnalysis.error')} />
        )}
      </div>
    </div>
  );
}
