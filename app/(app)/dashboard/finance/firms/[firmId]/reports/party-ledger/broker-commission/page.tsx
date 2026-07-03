'use client';
// Broker Commission Register report (commission payable per broker). i18n via finance.reports
// (shared common.* + partyLedger.brokerCommission.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar. Watch: per-broker subtotal labels use the broker name (data).
import { useState } from 'react';
import { Alert, Skeleton, Table } from 'antd';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaise } from '@/lib/utils';
import type { BrokerCommissionRow } from '@/types';

type ReportState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export default function BrokerCommissionPage() {
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;

  const [rows, setRows] = useState<BrokerCommissionRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);
  const [state, setState] = useState<ReportState>('idle');

  const handleRun = async ({ dateFrom, dateTo }: { dateFrom: string; dateTo: string }) => {
    if (!ws?._id) return;
    setState('loading');
    try {
      const data = await financeReportsApi.brokerCommission(ws._id, firmId, dateFrom, dateTo);
      setRows(data.rows);
      setGrandTotal(data.totalCommissionPaise);
      setState(data.rows.length > 0 ? 'success' : 'empty');
    } catch {
      setState('error');
    }
  };

  // Group by broker for subtotals
  const brokerSubtotals = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.brokerName] = (acc[r.brokerName] ?? 0) + r.commissionPaise;
    return acc;
  }, {});

  const columns = [
    {
      title: t('common.date'),
      dataIndex: 'date',
      key: 'date',
      width: 110,
      render: (v: string) => (v ? new Date(v).toLocaleDateString('en-IN') : ''),
    },
    {
      title: t('common.voucherNo'),
      dataIndex: 'voucherNumber',
      key: 'voucherNo',
      render: (v: string, row: BrokerCommissionRow) => (
        <DrillLink
          firmId={firmId}
          sourceVoucherId={row.sourceVoucherId}
          sourceVoucherType={row.sourceVoucherType}
          label={v}
        />
      ),
    },
    { title: t('partyLedger.brokerCommission.brokerName'), dataIndex: 'brokerName', key: 'broker' },
    {
      title: t('partyLedger.brokerCommission.relatedParty'),
      dataIndex: 'relatedParty',
      key: 'party',
    },
    {
      title: t('partyLedger.brokerCommission.commission'),
      dataIndex: 'commissionPaise',
      key: 'commission',
      align: 'right' as const,
      render: (v: number) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(v)}</span>
      ),
    },
    { title: t('common.narration'), dataIndex: 'narration', key: 'narration' },
  ];

  const tableSummary = () => (
    <Table.Summary.Row style={{ fontWeight: 700, background: 'var(--cr-surface-2)' }}>
      <Table.Summary.Cell index={0} colSpan={4}>
        {t('common.grandTotal')}
      </Table.Summary.Cell>
      <Table.Summary.Cell index={4} align="right">
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(grandTotal)}</span>
      </Table.Summary.Cell>
      <Table.Summary.Cell index={5} />
    </Table.Summary.Row>
  );

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('partyLedger.brokerCommission.title')}
        category={t('partyLedger.brokerCommission.category')}
        categoryPath="party-ledger"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar onRun={handleRun} loading={state === 'loading'} />

        {state === 'success' && Object.keys(brokerSubtotals).length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 16,
            }}
          >
            {Object.entries(brokerSubtotals).map(([broker, total]) => (
              <div
                key={broker}
                style={{
                  padding: '8px 14px',
                  background: 'var(--cr-surface)',
                  border: '1px solid var(--cr-border)',
                  borderRadius: 'var(--cr-radius-md)',
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 600 }}>{broker}:</span>{' '}
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPaise(total)}</span>
              </div>
            ))}
          </div>
        )}

        {state === 'success' && (
          <ReportTable<BrokerCommissionRow>
            dataSource={rows}
            columns={columns}
            rowKey={(_, i) => String(i)}
            summary={tableSummary}
          />
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && (
          <Alert type="error" title={t('partyLedger.brokerCommission.error')} />
        )}
      </div>
    </div>
  );
}
