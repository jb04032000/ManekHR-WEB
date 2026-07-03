'use client';
// EBITDA Summary report (waterfall + monthly trend). i18n via finance.reports
// (financialStatements.ebitda.*). Cross-link: header/filters from ReportToolbar + ReportFilterBar.
import { useState } from 'react';
import { Alert, Descriptions, Skeleton } from 'antd';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsCard from '@/components/ui/DsCard';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { EbitdaReport } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function EbitdaPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [report, setReport] = useState<EbitdaReport | null>(null);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.ebitda(ws._id, firmId, dateFrom, dateTo);
      setReport(data);
      setState('success');
    } catch {
      setState('error');
    }
  };

  const chartData =
    report?.monthlyTrend?.map((m) => ({
      month: m.month,
      ebitdaPaise: m.ebitdaPaise,
    })) ?? [];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('financialStatements.ebitda.title')}
        category={t('financialStatements.ebitda.category')}
        categoryPath="financial-statements"
        info={t('financialStatements.ebitda.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && report && (
          <>
            {/* EBITDA waterfall Descriptions card */}
            <DsCard style={{ marginBottom: 24 }}>
              <Descriptions
                bordered
                column={1}
                size="small"
                labelStyle={{ fontWeight: 600, width: 240 }}
              >
                <Descriptions.Item label={t('financialStatements.ebitda.revenue')}>
                  {fmtPaise(report.revenuePaise)}
                </Descriptions.Item>
                <Descriptions.Item label={t('financialStatements.ebitda.cogs')}>
                  {fmtPaise(report.cogsPaise)}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <span style={{ fontWeight: 700 }}>
                      {t('financialStatements.ebitda.grossProfit')}
                    </span>
                  }
                >
                  <span style={{ fontWeight: 700 }}>{fmtPaise(report.grossProfitPaise)}</span>
                </Descriptions.Item>
                <Descriptions.Item label={t('financialStatements.ebitda.operatingExpenses')}>
                  {fmtPaise(report.operatingExpensesPaise)}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <span style={{ fontWeight: 700, color: 'var(--cr-primary)', fontSize: 16 }}>
                      {t('financialStatements.ebitda.ebitda')}
                    </span>
                  }
                >
                  <span style={{ fontWeight: 700, color: 'var(--cr-primary)', fontSize: 16 }}>
                    {fmtPaise(report.ebitdaPaise)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label={t('financialStatements.ebitda.ebitdaMargin')}>
                  {report.ebitdaMarginPct.toFixed(2)}%
                </Descriptions.Item>
                <Descriptions.Item label={t('financialStatements.ebitda.depreciation')}>
                  {fmtPaise(report.depreciationPaise)}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <span style={{ fontWeight: 700 }}>{t('financialStatements.ebitda.ebit')}</span>
                  }
                >
                  <span style={{ fontWeight: 700 }}>{fmtPaise(report.ebitPaise)}</span>
                </Descriptions.Item>
                <Descriptions.Item label={t('financialStatements.ebitda.interest')}>
                  {fmtPaise(report.interestPaise)}
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <span style={{ fontWeight: 700 }}>{t('financialStatements.ebitda.ebt')}</span>
                  }
                >
                  <span style={{ fontWeight: 700 }}>{fmtPaise(report.ebtPaise)}</span>
                </Descriptions.Item>
                <Descriptions.Item
                  label={
                    <span style={{ fontWeight: 700 }}>
                      {t('financialStatements.ebitda.netProfit')}
                    </span>
                  }
                >
                  <span
                    style={{
                      fontWeight: 700,
                      color: report.netProfitPaise >= 0 ? 'var(--cr-success)' : 'var(--cr-error)',
                    }}
                  >
                    {fmtPaise(report.netProfitPaise)}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </DsCard>

            {/* EBITDA monthly trend chart */}
            {chartData.length > 0 && (
              <DsCard>
                <p
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 14,
                    marginBottom: 12,
                  }}
                >
                  {t('financialStatements.ebitda.monthlyTrend')}
                </p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 16, bottom: 5 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--cr-border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={{ fontSize: 12, fill: 'var(--cr-text-3)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => fmtPaise(v)}
                      tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                      axisLine={false}
                      tickLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={(v: unknown) => [
                        fmtPaise(v as number),
                        t('financialStatements.ebitda.ebitda'),
                      ]}
                      labelStyle={{ fontWeight: 600 }}
                    />
                    <Bar dataKey="ebitdaPaise" fill="var(--cr-primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </DsCard>
            )}
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('financialStatements.ebitda.error')} />}
      </div>
    </div>
  );
}
