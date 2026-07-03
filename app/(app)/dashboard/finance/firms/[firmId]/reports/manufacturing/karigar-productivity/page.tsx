'use client';
// Karigar Productivity report (output, jobs, earnings per karigar). i18n via finance.reports
// (manufacturing.karigarProductivity.*). Cross-link: header/filters from ReportToolbar + ReportFilterBar.
// Watch: moduleMessage is API-driven (not translated).
import { useState } from 'react';
import { Alert, Skeleton, Statistic } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { KarigarProductivityRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function KarigarProductivityPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<KarigarProductivityRow[]>([]);
  const [moduleMessage, setModuleMessage] = useState<string | null>(null);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.karigarProductivity(ws._id, firmId, dateFrom, dateTo);
      setModuleMessage(data.message ?? null);
      const sorted = [...data.rows].sort((a, b) => b.totalAmountPaise - a.totalAmountPaise);
      setRows(sorted);
      setState(sorted.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const totalPieces = rows.reduce((s, r) => s + r.totalPiecesCompleted, 0);
  const totalEarnings = rows.reduce((s, r) => s + r.totalAmountPaise, 0);
  const totalJobs = rows.reduce((s, r) => s + r.jobCount, 0);

  const columns = [
    {
      title: t('manufacturing.karigarProductivity.karigarName'),
      dataIndex: 'karigarName',
      key: 'name',
    },
    {
      title: t('manufacturing.karigarProductivity.jobCount'),
      dataIndex: 'jobCount',
      key: 'jobs',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('manufacturing.karigarProductivity.piecesCompleted'),
      dataIndex: 'totalPiecesCompleted',
      key: 'pieces',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('manufacturing.karigarProductivity.earnings'),
      dataIndex: 'totalAmountPaise',
      key: 'earnings',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('manufacturing.karigarProductivity.title')}
        category={t('manufacturing.karigarProductivity.category')}
        categoryPath="manufacturing"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {/* F-11 module not active banner */}
        {moduleMessage && <Alert type="info" title={moduleMessage} style={{ marginBottom: 16 }} />}

        {state === 'success' && !moduleMessage && (
          <>
            <ReportTable<KarigarProductivityRow>
              dataSource={rows}
              columns={columns}
              rowKey="karigarId"
            />
            {/* Summary tiles */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 16,
                marginTop: 24,
              }}
            >
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--cr-surface)',
                  border: '1px solid var(--cr-border)',
                  borderRadius: 'var(--cr-radius-md)',
                }}
              >
                <Statistic
                  title={t('manufacturing.karigarProductivity.totalOutput')}
                  value={totalPieces.toLocaleString('en-IN')}
                  styles={{ content: { fontSize: 22 } }}
                />
              </div>
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--cr-surface)',
                  border: '1px solid var(--cr-border)',
                  borderRadius: 'var(--cr-radius-md)',
                }}
              >
                <Statistic
                  title={t('manufacturing.karigarProductivity.totalJobs')}
                  value={totalJobs.toLocaleString('en-IN')}
                  styles={{ content: { fontSize: 22 } }}
                />
              </div>
              <div
                style={{
                  padding: '16px 20px',
                  background: 'var(--cr-surface)',
                  border: '1px solid var(--cr-border)',
                  borderRadius: 'var(--cr-radius-md)',
                }}
              >
                <Statistic
                  title={t('manufacturing.karigarProductivity.totalEarnings')}
                  value={fmtPaise(totalEarnings)}
                  styles={{ content: { fontSize: 22 } }}
                />
              </div>
            </div>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && !moduleMessage && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('manufacturing.karigarProductivity.error')} />
        )}
      </div>
    </div>
  );
}
