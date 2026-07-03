'use client';
// Payables Aging report (vendor outstanding buckets, mirror of receivables). i18n via
// finance.reports (partyLedger.payablesAging.* + shared common.aging.*). Cross-link: AgingBucketSummary; header from ReportToolbar.
import { use, useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { AgingBucketSummary } from '@/components/finance/reports/AgingBucketSummary';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import type { AgingReport } from '@/types';

export default function PayablesAgingPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const router = useRouter();
  const [report, setReport] = useState<AgingReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.payablesAging(ws._id, firmId);
      setReport(data);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const handlePartyClick = (partyId: string) => {
    router.push(
      `/dashboard/finance/firms/${firmId}/reports/party-ledger/party-statement?partyId=${partyId}`,
    );
  };

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('partyLedger.payablesAging.title')}
        category={t('partyLedger.payablesAging.category')}
        categoryPath="party-ledger"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={handleRun}
            disabled={state === 'loading'}
            style={{
              padding: '8px 24px',
              background: 'var(--cr-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            {state === 'loading' ? t('common.loading') : t('common.runReport')}
          </button>
        </div>
        {state === 'success' && report && (
          <AgingBucketSummary
            rows={report.rows}
            summary={report.summary}
            onPartyClick={handlePartyClick}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('partyLedger.payablesAging.error')} />}
      </div>
    </div>
  );
}
