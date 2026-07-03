'use client';
// ITC Reconciliation report (books vs GSTR-2B delta). i18n via finance.reports
// (gstRegisters.itcReconciliation.*). Cross-link: header/filters from ReportToolbar + ReportFilterBar.
import { use, useState } from 'react';
import { Alert, Skeleton, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { ItcReconciliationRow } from '@/types';

export default function ItcReconciliationPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [rows, setRows] = useState<ItcReconciliationRow[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.itcReconciliation(ws._id, firmId, dateFrom, dateTo);
      setRows(data);
      setState(data.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    {
      title: t('gstRegisters.itcReconciliation.period'),
      dataIndex: 'period',
      key: 'period',
      width: 90,
    },
    {
      title: t('gstRegisters.itcReconciliation.booksIgst'),
      dataIndex: 'booksIgstPaise',
      key: 'booksIgst',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.itcReconciliation.booksCgst'),
      dataIndex: 'booksCgstPaise',
      key: 'booksCgst',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.itcReconciliation.booksSgst'),
      dataIndex: 'booksSgstPaise',
      key: 'booksSgst',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.itcReconciliation.g3bIgst'),
      dataIndex: 'gstr3bIgstPaise',
      key: 'g3bIgst',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.itcReconciliation.g3bCgst'),
      dataIndex: 'gstr3bCgstPaise',
      key: 'g3bCgst',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.itcReconciliation.g3bSgst'),
      dataIndex: 'gstr3bSgstPaise',
      key: 'g3bSgst',
      align: 'right' as const,
      render: (v: number) => fmtPaise(v),
    },
    {
      title: t('gstRegisters.itcReconciliation.deltaIgst'),
      dataIndex: 'deltaIgstPaise',
      key: 'dIgst',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v !== 0 ? 'var(--cr-error)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('gstRegisters.itcReconciliation.deltaCgst'),
      dataIndex: 'deltaCgstPaise',
      key: 'dCgst',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v !== 0 ? 'var(--cr-error)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('gstRegisters.itcReconciliation.deltaSgst'),
      dataIndex: 'deltaSgstPaise',
      key: 'dSgst',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ color: v !== 0 ? 'var(--cr-error)' : undefined }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('gstRegisters.itcReconciliation.discrepancy'),
      dataIndex: 'hasDiscrepancy',
      key: 'disc',
      align: 'center' as const,
      render: (v: boolean) =>
        v ? (
          <Tag color="error">{t('gstRegisters.itcReconciliation.mismatch')}</Tag>
        ) : (
          <Tag color="success">{t('gstRegisters.itcReconciliation.ok')}</Tag>
        ),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.itcReconciliation.title')}
        category={t('gstRegisters.itcReconciliation.category')}
        categoryPath="gst-registers"
        info={t('gstRegisters.itcReconciliation.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />
        {state === 'success' && (
          <ReportTable<ItcReconciliationRow>
            dataSource={rows}
            columns={columns}
            rowKey={(r) => r.period}
            onRow={(r) => ({
              style: { background: r.hasDiscrepancy ? 'rgba(239,68,68,0.06)' : undefined },
            })}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('gstRegisters.itcReconciliation.error')} />
        )}
      </div>
    </div>
  );
}
