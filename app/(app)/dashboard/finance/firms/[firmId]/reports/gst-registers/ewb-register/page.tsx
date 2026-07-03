'use client';
// E-Way Bill Register report. i18n via finance.reports (shared common.* +
// gstRegisters.ewbRegister.*). Cross-link: header/filters from ReportToolbar + ReportFilterBar.
// Watch: status filter values (active/expired/cancelled) drive logic; only labels are translated.
import { useState } from 'react';
import { Alert, Select, Skeleton, Tag } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { EwbRegisterRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

const STATUS_COLORS: Record<EwbRegisterRow['status'], string> = {
  active: 'green',
  expired: 'orange',
  cancelled: 'red',
};

export default function EwbRegisterPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  // Maps a raw status to its translated label for the Tag (logic unchanged).
  const statusLabel = (s: EwbRegisterRow['status']): string =>
    s === 'active'
      ? t('gstRegisters.ewbRegister.statusActive')
      : s === 'expired'
        ? t('gstRegisters.ewbRegister.statusExpired')
        : t('gstRegisters.ewbRegister.statusCancelled');

  const [allRows, setAllRows] = useState<EwbRegisterRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');
  // Persist the status filter per-firm so it survives navigation/reload (platform-bar
  // "remember per-firm filter defaults"). Cross-link: usePersistedState (localStorage-backed).
  // Note: this is a client-side filter over already-fetched rows, so no re-fetch is triggered.
  const [statusFilter, setStatusFilter] = usePersistedState<string | undefined>(
    `finance:reports:ewbRegister:status:${firmId}`,
    undefined,
  );

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.ewbRegister(ws._id, firmId, dateFrom, dateTo);
      setAllRows(data);
      setState(data.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  // Client-side status filter - no re-fetch needed
  const rows = statusFilter ? allRows.filter((r) => r.status === statusFilter) : allRows;

  const columns = [
    {
      title: t('common.date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    { title: t('gstRegisters.ewbRegister.ewbNo'), dataIndex: 'ewbNumber', key: 'ewb', width: 150 },
    {
      title: t('common.voucherNo'),
      dataIndex: 'voucherNumber',
      key: 'voucherNo',
      render: (v: string, row: EwbRegisterRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={row.sourceVoucherId}
          sourceVoucherType="sale_invoice"
          label={v}
        />
      ),
    },
    { title: t('gstRegisters.ewbRegister.partyName'), dataIndex: 'partyName', key: 'party' },
    {
      title: t('gstRegisters.ewbRegister.fromPlace'),
      dataIndex: 'fromPlace',
      key: 'from',
      width: 120,
    },
    { title: t('gstRegisters.ewbRegister.toPlace'), dataIndex: 'toPlace', key: 'to', width: 120 },
    {
      title: t('gstRegisters.ewbRegister.vehicleNo'),
      dataIndex: 'vehicleNumber',
      key: 'vehicle',
      width: 110,
    },
    {
      title: t('gstRegisters.ewbRegister.validUpto'),
      dataIndex: 'validUpto',
      key: 'validUpto',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('gstRegisters.ewbRegister.status'),
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: EwbRegisterRow['status']) => <Tag color={STATUS_COLORS[v]}>{statusLabel(v)}</Tag>,
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('gstRegisters.ewbRegister.title')}
        category={t('gstRegisters.ewbRegister.category')}
        categoryPath="gst-registers"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && (
          <>
            <div style={{ marginBottom: 12 }}>
              <Select
                placeholder={t('gstRegisters.ewbRegister.filterStatus')}
                allowClear
                style={{ width: 180 }}
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'active', label: t('gstRegisters.ewbRegister.statusActive') },
                  { value: 'expired', label: t('gstRegisters.ewbRegister.statusExpired') },
                  { value: 'cancelled', label: t('gstRegisters.ewbRegister.statusCancelled') },
                ]}
              />
            </div>
            <ReportTable<EwbRegisterRow>
              dataSource={rows}
              columns={columns}
              rowKey={(_, i) => String(i)}
            />
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('gstRegisters.ewbRegister.error')} />}
      </div>
    </div>
  );
}
