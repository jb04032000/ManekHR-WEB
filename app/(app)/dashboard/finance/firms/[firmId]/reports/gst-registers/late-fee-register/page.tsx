'use client';
// Late Fee Register report (late fee income by party). i18n via finance.reports
// (shared common.* + gstRegisters.lateFeeRegister.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar.
import { use, useState } from 'react';
import { Alert, Skeleton, Statistic, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';

interface LateFeeRow {
  entryDate: string;
  voucherNumber: string;
  partyName: string;
  daysOverdue: number;
  lateFeePaise: number;
  narration: string;
  sourceVoucherId: string;
  sourceVoucherType: string;
}

export default function LateFeeRegisterPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [rows, setRows] = useState<LateFeeRow[]>([]);
  const [totalLateFeePaise, setTotalLateFeePaise] = useState(0);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.lateFeeRegister(ws._id, firmId, dateFrom, dateTo);
      setRows(data.rows as LateFeeRow[]);
      setTotalLateFeePaise(data.totalLateFeePaise);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    {
      title: t('common.date'),
      dataIndex: 'entryDate',
      key: 'date',
      width: 100,
      render: (v: string) => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: t('common.voucherHash'),
      key: 'voucher',
      render: (_: unknown, r: LateFeeRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={r.sourceVoucherId}
          sourceVoucherType={r.sourceVoucherType}
          label={r.voucherNumber || '-'}
        />
      ),
    },
    { title: t('common.party'), dataIndex: 'partyName', key: 'party', ellipsis: true },
    {
      title: t('gstRegisters.lateFeeRegister.daysOverdue'),
      dataIndex: 'daysOverdue',
      key: 'days',
      align: 'right' as const,
      render: (v: number) => (
        <span
          style={{ color: v > 90 ? 'var(--cr-error)' : v > 30 ? 'var(--cr-warning)' : undefined }}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('gstRegisters.lateFeeRegister.lateFee'),
      dataIndex: 'lateFeePaise',
      key: 'fee',
      align: 'right' as const,
      render: (v: number) => <b>{fmtPaise(v)}</b>,
    },
    { title: t('common.narration'), dataIndex: 'narration', key: 'narration', ellipsis: true },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.lateFeeRegister.title')}
        category={t('gstRegisters.lateFeeRegister.category')}
        categoryPath="gst-registers"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="blue">{t('gstRegisters.lateFeeRegister.exclusiveTag')}</Tag>
          <span style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>
            {t('gstRegisters.lateFeeRegister.exclusiveNote')}
          </span>
        </div>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />
        {state === 'success' && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Statistic
                title={t('gstRegisters.lateFeeRegister.totalCollected')}
                value={fmtPaise(totalLateFeePaise)}
              />
            </div>
            <ReportTable<LateFeeRow>
              dataSource={rows}
              columns={columns}
              rowKey={(r, i) => `${r.sourceVoucherId}-${i}`}
            />
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('gstRegisters.lateFeeRegister.error')} />
        )}
      </div>
    </div>
  );
}
