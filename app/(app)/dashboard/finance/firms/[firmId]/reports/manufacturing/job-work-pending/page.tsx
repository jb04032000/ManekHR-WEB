'use client';
// Job-Work Pending report (material sent to karigar, overdue highlight). i18n via
// finance.reports (manufacturing.jobWorkPending.*). Cross-link: header from ReportToolbar.
// Watch: moduleMessage is API-driven (not translated).
import { useState } from 'react';
import { Alert, Skeleton, Tag } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import type { JobWorkPendingRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function JobWorkPendingPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<JobWorkPendingRow[]>([]);
  const [moduleMessage, setModuleMessage] = useState<string | null>(null);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.jobWorkPending(ws._id, firmId);
      setModuleMessage(data.message ?? null);
      const sorted = [...data.rows].sort((a, b) => b.daysOverdue - a.daysOverdue);
      setRows(sorted);
      setState(sorted.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    { title: t('manufacturing.jobWorkPending.lotNo'), dataIndex: 'lotNumber', key: 'lot' },
    { title: t('manufacturing.jobWorkPending.karigar'), dataIndex: 'karigarName', key: 'karigar' },
    { title: t('manufacturing.jobWorkPending.itemSent'), dataIndex: 'itemSent', key: 'item' },
    {
      title: t('manufacturing.jobWorkPending.qty'),
      dataIndex: 'qtySent',
      key: 'qty',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('manufacturing.jobWorkPending.sentDate'),
      dataIndex: 'sentDate',
      key: 'sentDate',
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('manufacturing.jobWorkPending.expectedReturn'),
      dataIndex: 'expectedReturnDate',
      key: 'expected',
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('manufacturing.jobWorkPending.daysOverdueCol'),
      dataIndex: 'daysOverdue',
      key: 'overdue',
      align: 'right' as const,
      render: (v: number) =>
        v > 0 ? (
          <Tag color="red">{t('manufacturing.jobWorkPending.daysOverdue', { count: v })}</Tag>
        ) : (
          <Tag color="green">{t('manufacturing.jobWorkPending.pending')}</Tag>
        ),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('manufacturing.jobWorkPending.title')}
        category={t('manufacturing.jobWorkPending.category')}
        categoryPath="manufacturing"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
            {t('common.runReport')}
          </DsButton>
        </DsCard>

        {/* F-11 module not active banner */}
        {moduleMessage && <Alert type="info" title={moduleMessage} style={{ marginBottom: 16 }} />}

        {state === 'success' && !moduleMessage && (
          <ReportTable<JobWorkPendingRow> dataSource={rows} columns={columns} rowKey="lotNumber" />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && !moduleMessage && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('manufacturing.jobWorkPending.error')} />
        )}
      </div>
    </div>
  );
}
