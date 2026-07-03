'use client';
// Capital Goods ITC Schedule report (60-month release per Section 16(3)). i18n via
// finance.reports (gstRegisters.capitalGoodsItc.*). Cross-link: header from ReportToolbar.
import { useState } from 'react';
import { Alert, Skeleton } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import DsCard from '@/components/ui/DsCard';
import DsButton from '@/components/ui/DsButton';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { CapitalGoodsItcRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function CapitalGoodsItcPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<CapitalGoodsItcRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async () => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.capitalGoodsItc(ws._id, firmId);
      setRows(data.schedule);
      setState(data.schedule.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const columns = [
    { title: t('gstRegisters.capitalGoodsItc.assetName'), dataIndex: 'assetName', key: 'name' },
    {
      title: t('gstRegisters.capitalGoodsItc.purchaseDate'),
      dataIndex: 'purchaseDate',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('gstRegisters.capitalGoodsItc.totalItc'),
      dataIndex: 'totalItcPaise',
      key: 'total',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('gstRegisters.capitalGoodsItc.monthsElapsed'),
      dataIndex: 'monthsElapsed',
      key: 'months',
      align: 'right' as const,
      render: (v: number) => `${v} / 60`,
    },
    {
      title: t('gstRegisters.capitalGoodsItc.itcClaimed'),
      dataIndex: 'itcClaimedPaise',
      key: 'claimed',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('gstRegisters.capitalGoodsItc.itcBalance'),
      dataIndex: 'itcBalancePaise',
      key: 'balance',
      align: 'right' as const,
      render: (v: number) => (
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: v > 0 ? 'var(--cr-success)' : undefined,
            fontWeight: v > 0 ? 600 : undefined,
          }}
        >
          {fmtPaise(v)}
        </span>
      ),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.capitalGoodsItc.title')}
        category={t('gstRegisters.capitalGoodsItc.category')}
        categoryPath="gst-registers"
        info={t('gstRegisters.capitalGoodsItc.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <Alert
          type="info"
          title={t('gstRegisters.capitalGoodsItc.intro')}
          style={{ marginBottom: 16 }}
        />

        <DsCard style={{ marginBottom: 16, padding: 16 }}>
          <DsButton dsVariant="primary" onClick={handleRun} loading={state === 'loading'}>
            {t('common.runReport')}
          </DsButton>
        </DsCard>

        {state === 'success' && (
          <ReportTable<CapitalGoodsItcRow>
            dataSource={rows}
            columns={columns}
            rowKey={(_, i) => String(i)}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('gstRegisters.capitalGoodsItc.error')} />
        )}
      </div>
    </div>
  );
}
