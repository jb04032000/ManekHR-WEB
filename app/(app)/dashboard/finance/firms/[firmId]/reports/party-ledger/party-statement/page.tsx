'use client';
// Party Statement report (running balance per party with drill-down). i18n via finance.reports
// (shared common.* + partyLedger.partyStatement.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar. Watch: drOrCr suffix + voucherType replace are data transforms.
import { use, useEffect, useState } from 'react';
import { Alert, Tag, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { listParties } from '@/lib/actions/finance.actions';
import { fmtPaise } from '@/lib/utils';
import type { Party, PartyStatementReport, PartyStatementRow } from '@/types';

export default function PartyStatementPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [report, setReport] = useState<PartyStatementReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  // Parties for the picker. Without this the picker stayed empty ("No data") and,
  // since requireParty disables Run until one is chosen, the report was unrunnable.
  // Cross-link: same listParties action backs the finance parties + expenses pages.
  const [parties, setParties] = useState<Party[]>([]);

  useEffect(() => {
    if (!ws?._id) return;
    listParties(ws._id, firmId, { pageSize: 100 })
      .then((r) => setParties(r?.items ?? []))
      .catch(() => setParties([]));
  }, [ws?._id, firmId]);

  const handleRun = async ({
    dateFrom,
    dateTo,
    partyId,
  }: {
    dateFrom: string;
    dateTo: string;
    partyId?: string;
  }) => {
    if (!ws?._id || !partyId) return;
    setState('loading');
    try {
      const data = await financeReportsApi.partyStatement(
        ws._id,
        firmId,
        partyId,
        dateFrom,
        dateTo,
      );
      setReport(data);
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
      render: (_: unknown, r: PartyStatementRow) => (
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
      dataIndex: 'debitPaise',
      key: 'dr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('common.credit'),
      dataIndex: 'creditPaise',
      key: 'cr',
      align: 'right' as const,
      render: (v: number) => (v > 0 ? fmtPaise(v) : ''),
    },
    {
      title: t('common.balance'),
      key: 'balance',
      align: 'right' as const,
      render: (_: unknown, r: PartyStatementRow) => (
        <b
          style={{
            color: r.drOrCr === 'Cr' ? 'var(--cr-success)' : 'var(--cr-error)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {fmtPaise(r.runningBalancePaise)} {r.drOrCr}
        </b>
      ),
    },
  ];

  return (
    <div>
      <ReportToolbar
        firmId={firmId}
        reportName={t('partyLedger.partyStatement.title')}
        category={t('partyLedger.partyStatement.category')}
        categoryPath="party-ledger"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar
          onRun={handleRun}
          loading={state === 'loading'}
          config={{ showParty: true, requireParty: true }}
          parties={parties}
        />
        {state === 'success' && report && (
          <>
            <div
              style={{
                padding: '8px 16px',
                background: 'var(--cr-surface-2)',
                marginBottom: 8,
                fontWeight: 700,
                textAlign: 'right',
              }}
            >
              {t('common.openingBalanceLabel')}{' '}
              <span
                style={{
                  color: report.openingDrOrCr === 'Cr' ? 'var(--cr-success)' : 'var(--cr-error)',
                }}
              >
                {fmtPaise(report.openingBalancePaise)} {report.openingDrOrCr}
              </span>
            </div>
            <ReportTable<PartyStatementRow>
              dataSource={report.rows}
              columns={columns}
              rowKey={(r, i) => `${r.sourceVoucherId}-${i}`}
            />
            <div
              style={{
                padding: '8px 16px',
                background: 'var(--cr-surface-2)',
                marginTop: 8,
                fontWeight: 700,
                textAlign: 'right',
              }}
            >
              {t('common.closingBalanceLabel')}{' '}
              <span
                style={{
                  color: report.closingDrOrCr === 'Cr' ? 'var(--cr-success)' : 'var(--cr-error)',
                }}
              >
                {fmtPaise(report.closingBalancePaise)} {report.closingDrOrCr}
              </span>
            </div>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('partyLedger.partyStatement.error')} />}
      </div>
    </div>
  );
}
