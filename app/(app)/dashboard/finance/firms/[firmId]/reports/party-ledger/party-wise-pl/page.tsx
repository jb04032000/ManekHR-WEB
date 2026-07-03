'use client';
// Party-wise Profit & Loss report. i18n via finance.reports (partyLedger.partyWisePl.*).
// Cross-link: header/filters from ReportToolbar + ReportFilterBar. Watch: partyTypeFilter
// values (All/Customer/Vendor) drive logic; only labels are translated.
import { useState } from 'react';
import { Alert, Select, Skeleton, Table } from 'antd';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { usePersistedState } from '@/hooks/usePersistedState';
import { fmtPaise } from '@/lib/utils';
import type { PartyWisePlRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type PartyTypeFilter = 'All' | 'Customer' | 'Vendor';

export default function PartyWisePlPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<PartyWisePlRow[]>([]);
  const [state, setState] = useState<ReportState>('idle');
  // Persist the party-type filter per-firm so it survives navigation/reload (platform-bar
  // "remember per-firm filter defaults"). Cross-link: usePersistedState (localStorage-backed).
  const [partyTypeFilter, setPartyTypeFilter] = usePersistedState<PartyTypeFilter>(
    `finance:reports:partyWisePl:partyType:${firmId}`,
    'All',
  );

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const partyType = partyTypeFilter !== 'All' ? partyTypeFilter.toLowerCase() : undefined;
      const data = await financeReportsApi.partyWisePl(ws._id, firmId, dateFrom, dateTo, partyType);
      const sorted = [...data.rows].sort((a, b) => b.netPaise - a.netPaise);
      setRows(sorted);
      setState(sorted.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  const totalSales = rows.reduce((s, r) => s + r.salesPaise, 0);
  const totalPurchases = rows.reduce((s, r) => s + r.purchasesPaise, 0);
  const totalNet = rows.reduce((s, r) => s + r.netPaise, 0);

  const columns = [
    {
      title: t('common.party'),
      dataIndex: 'partyName',
      key: 'name',
      render: (name: string, row: PartyWisePlRow) => (
        <Link
          href={`/dashboard/reports/party-pnl/${row.partyId}`}
          title={t('partyLedger.partyWisePl.openPnlFor', { name })}
        >
          {name}
        </Link>
      ),
    },
    { title: t('common.type'), dataIndex: 'partyType', key: 'type', width: 100 },
    {
      title: t('partyLedger.partyWisePl.salesCol'),
      dataIndex: 'salesPaise',
      key: 'sales',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('partyLedger.partyWisePl.purchasesCol'),
      dataIndex: 'purchasesPaise',
      key: 'purchases',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    {
      title: t('partyLedger.partyWisePl.netCol'),
      dataIndex: 'netPaise',
      key: 'net',
      align: 'right' as const,
      render: (v: number) => (
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: v >= 0 ? 'var(--cr-success)' : 'var(--cr-error)',
          }}
        >
          {fmtPaise(v)}
        </span>
      ),
    },
  ];

  const tableSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={2}>
        {t('common.total')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={2} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalSales)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={3} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(totalPurchases)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        <span
          style={{
            fontVariantNumeric: 'tabular-nums',
            color: totalNet >= 0 ? 'var(--cr-success)' : 'var(--cr-error)',
          }}
        >
          {fmtPaise(totalNet)}
        </span>
      </Table.Summary.Cell>
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('partyLedger.partyWisePl.title')}
        category={t('partyLedger.partyWisePl.category')}
        categoryPath="party-ledger"
        info={t('partyLedger.partyWisePl.info')}
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <Select
            aria-label={t('partyLedger.partyWisePl.filterType')}
            value={partyTypeFilter}
            onChange={(v) => setPartyTypeFilter(v)}
            style={{ width: 160 }}
            options={[
              { value: 'All', label: t('partyLedger.partyWisePl.allParties') },
              { value: 'Customer', label: t('partyLedger.partyWisePl.customersOnly') },
              { value: 'Vendor', label: t('partyLedger.partyWisePl.vendorsOnly') },
            ]}
          />
        </div>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && (
          <ReportTable<PartyWisePlRow>
            dataSource={rows}
            columns={columns}
            rowKey="partyId"
            summary={tableSummary}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('partyLedger.partyWisePl.error')} />}
      </div>
    </div>
  );
}
