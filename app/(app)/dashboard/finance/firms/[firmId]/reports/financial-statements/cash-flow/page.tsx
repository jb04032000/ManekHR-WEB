'use client';
// Cash Flow Statement (Ind AS 7 indirect method). i18n via finance.reports
// (financialStatements.cashFlow.*). Cross-link: header/filters/empty from
// ReportToolbar + ReportFilterBar + ReportEmptyState. Watch: section labels are
// API-driven; only the "Net {section}" prefix and the net-change row are translated.
import { use, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { CashFlowReport, CashFlowSection } from '@/types';

function CashFlowSectionTable({
  section,
  netLabel,
}: {
  section: CashFlowSection;
  netLabel: string;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4
        style={{
          fontWeight: 700,
          fontSize: 13,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          color: 'var(--cr-text-3)',
          marginBottom: 8,
        }}
      >
        {section.label}
      </h4>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {section.items.map((item, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 8px', color: 'var(--cr-text)' }}>{item.label}</td>
              <td
                style={{
                  padding: '4px 8px',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  color: item.amountPaise < 0 ? 'var(--cr-error)' : 'var(--cr-text)',
                }}
              >
                {fmtPaise(item.amountPaise)}
              </td>
            </tr>
          ))}
          <tr style={{ borderTop: '1px solid var(--cr-border)', fontWeight: 700 }}>
            <td style={{ padding: '6px 8px' }}>{netLabel}</td>
            <td
              style={{
                padding: '6px 8px',
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: section.totalPaise < 0 ? 'var(--cr-error)' : 'var(--cr-success)',
              }}
            >
              {fmtPaise(section.totalPaise)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function CashFlowPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [report, setReport] = useState<CashFlowReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.cashFlow(ws._id, firmId, dateFrom, dateTo);
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
        reportName={t('financialStatements.cashFlow.title')}
        category={t('financialStatements.cashFlow.category')}
        categoryPath="financial-statements"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && report && (
          <>
            {report.isIndicative && (
              <Alert
                type="info"
                title={t('financialStatements.cashFlow.indicative')}
                style={{ marginBottom: 16 }}
              />
            )}
            <CashFlowSectionTable
              section={report.operating}
              netLabel={t('financialStatements.cashFlow.netSection', {
                section: report.operating.label,
              })}
            />
            <CashFlowSectionTable
              section={report.investing}
              netLabel={t('financialStatements.cashFlow.netSection', {
                section: report.investing.label,
              })}
            />
            <CashFlowSectionTable
              section={report.financing}
              netLabel={t('financialStatements.cashFlow.netSection', {
                section: report.financing.label,
              })}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                padding: '10px 16px',
                background: 'var(--cr-surface-2)',
                borderTop: '2px solid var(--cr-text)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{t('financialStatements.cashFlow.netChange')}</span>
              <span
                style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: report.netChangePaise >= 0 ? 'var(--cr-success)' : 'var(--cr-error)',
                }}
              >
                {fmtPaise(report.netChangePaise)}
              </span>
            </div>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('financialStatements.cashFlow.error')} />
        )}
      </div>
    </div>
  );
}
