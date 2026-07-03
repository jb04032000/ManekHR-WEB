'use client';
// Voucher Registers report (sales/purchases/payments/journals tabs). i18n via finance.reports
// (shared common.* + partyLedger.registers.*). Cross-link: header from ReportToolbar; filter from
// ReportFilterBar. Watch: REGISTER_TYPES keys drive the API call; only tab labels are translated.
import { use, useState } from 'react';
import { Alert, Skeleton, Tabs, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { usePersistedState } from '@/hooks/usePersistedState';
import { fmtPaise } from '@/lib/utils';
import type { RegisterRow } from '@/types';

// Tab labels resolved inside the component via i18n (labelKey -> t()).
const REGISTER_TYPES = [
  { key: 'sales', labelKey: 'tabSales' },
  { key: 'purchases', labelKey: 'tabPurchases' },
  { key: 'payments-in', labelKey: 'tabPaymentsIn' },
  { key: 'payments-out', labelKey: 'tabPaymentsOut' },
  { key: 'journals', labelKey: 'tabJournals' },
];

export default function VoucherRegistersPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  // Persist the chosen register type (tab) per-firm so it survives navigation/reload (platform-bar
  // "remember per-firm filter defaults"). Cross-link: usePersistedState (localStorage-backed).
  const [activeTab, setActiveTab] = usePersistedState<string>(
    `finance:reports:registers:type:${firmId}`,
    'sales',
  );
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.register(ws._id, firmId, activeTab, dateFrom, dateTo);
      setRows(data.rows);
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
      render: (_: unknown, r: RegisterRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={r.sourceVoucherId}
          sourceVoucherType={r.sourceVoucherType}
          label={r.voucherNumber || '-'}
        />
      ),
    },
    {
      title: t('common.type'),
      dataIndex: 'voucherType',
      key: 'type',
      render: (v: string) => <Tag>{v.replace(/_/g, ' ')}</Tag>,
    },
    { title: t('common.narration'), dataIndex: 'narration', key: 'narration', ellipsis: true },
    {
      title: t('common.debit'),
      dataIndex: 'totalDebitPaise',
      key: 'dr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('common.credit'),
      dataIndex: 'totalCreditPaise',
      key: 'cr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
  ];

  const tabItems = REGISTER_TYPES.map((rt) => ({
    key: rt.key,
    label: t(`partyLedger.registers.${rt.labelKey}`),
    children: (
      <div>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />
        {state === 'success' && (
          <ReportTable<RegisterRow>
            dataSource={rows}
            columns={columns}
            rowKey={(_, i) => i!.toString()}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('partyLedger.registers.error')} />}
      </div>
    ),
  }));

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('partyLedger.registers.title')}
        category={t('partyLedger.registers.category')}
        categoryPath="party-ledger"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <Tabs
          type="line"
          items={tabItems}
          activeKey={activeTab}
          onChange={(k) => {
            setActiveTab(k);
            setState('idle');
            setRows([]);
          }}
        />
      </div>
    </div>
  );
}
