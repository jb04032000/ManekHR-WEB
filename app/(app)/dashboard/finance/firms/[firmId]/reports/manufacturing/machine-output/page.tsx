'use client';
// Machine Output report (production qty + utilization per machine). i18n via finance.reports
// (manufacturing.machineOutput.*). Cross-link: header/filters from ReportToolbar + ReportFilterBar.
// Watch: moduleMessage is API-driven (not translated).
import { useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import type { MachineOutputRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function MachineOutputPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<MachineOutputRow[]>([]);
  const [moduleMessage, setModuleMessage] = useState<string | null>(null);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.machineOutput(ws._id, firmId, dateFrom, dateTo);
      setModuleMessage(data.message ?? null);
      setRows(data.rows);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    { title: t('manufacturing.machineOutput.machineName'), dataIndex: 'machineName', key: 'name' },
    {
      title: t('manufacturing.machineOutput.totalQtyProduced'),
      dataIndex: 'totalQtyProduced',
      key: 'qty',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('manufacturing.machineOutput.totalMvs'),
      dataIndex: 'totalMvs',
      key: 'mvs',
      align: 'right' as const,
      render: (v: number) => v.toLocaleString('en-IN'),
    },
    {
      title: t('manufacturing.machineOutput.avgCycleTime'),
      dataIndex: 'avgCycleTimeMins',
      key: 'cycleTime',
      align: 'right' as const,
      render: (v: number) => v.toFixed(1),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('manufacturing.machineOutput.title')}
        category={t('manufacturing.machineOutput.category')}
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
          <ReportTable<MachineOutputRow> dataSource={rows} columns={columns} rowKey="machineId" />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && !moduleMessage && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('manufacturing.machineOutput.error')} />}
      </div>
    </div>
  );
}
