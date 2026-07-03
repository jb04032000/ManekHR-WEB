'use client';
// Account Ledger report (full ledger for a Chart-of-Accounts entry). i18n via finance.reports
// (shared common.* + partyLedger.accountLedger.*). Cross-link: header/filters from
// ReportToolbar + ReportFilterBar. Watch: drOrCr suffix + voucherType replace are data transforms.
import { use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Alert, Tag, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { ReportToolbar } from '@/components/finance/reports/ReportToolbar';
import { ReportFilterBar } from '@/components/finance/reports/ReportFilterBar';
import { ReportTable } from '@/components/finance/reports/ReportTable';
import { ReportEmptyState } from '@/components/finance/reports/ReportEmptyState';
import { DrillLink } from '@/components/finance/reports/DrillLink';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { listAccounts } from '@/lib/actions/finance.actions';
import { fmtPaise } from '@/lib/utils';
import type { Account } from '@/types';

interface AccountLedgerRow {
  entryDate: string;
  voucherNumber: string;
  voucherType: string;
  narration: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  drOrCr: 'Dr' | 'Cr';
  sourceVoucherId: string;
  sourceVoucherType: string;
}

interface AccountLedgerReport {
  accountName: string;
  openingBalancePaise: number;
  rows: AccountLedgerRow[];
  closingBalancePaise: number;
}

export default function AccountLedgerPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.reports');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const searchParams = useSearchParams();
  // Deep-link target from the Chart of Accounts "View ledger" action (?accountCode=5003).
  const deepLinkCode = searchParams.get('accountCode') ?? undefined;
  const [report, setReport] = useState<AccountLedgerReport | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'empty' | 'error'>('idle');
  // This firm's chart of accounts, used to populate the account picker. Without
  // this fetch the picker stayed empty ("No data") so the report could never run.
  // Cross-link: same listAccounts action backs the Chart of Accounts page.
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    if (!ws?._id) return;
    listAccounts(ws._id, firmId)
      .then((a) => setAccounts(a ?? []))
      .catch(() => setAccounts([]));
  }, [ws?._id, firmId]);

  const handleRun = async ({
    dateFrom,
    dateTo,
    accountCode,
  }: {
    dateFrom: string;
    dateTo: string;
    accountCode?: string;
  }) => {
    if (!ws?._id || !accountCode) return;
    setState('loading');
    try {
      const data = await financeReportsApi.accountLedger(
        ws._id,
        firmId,
        accountCode,
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
      render: (_: unknown, r: AccountLedgerRow) => (
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
      render: (_: unknown, r: AccountLedgerRow) => (
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
        reportName={t('partyLedger.accountLedger.title')}
        category={t('partyLedger.accountLedger.category')}
        categoryPath="party-ledger"
        dataLoaded={state === 'success'}
        onExportPdf={() => {}}
        onExportExcel={() => {}}
      />
      <div style={{ padding: 24 }}>
        <ReportFilterBar
          onRun={handleRun}
          loading={state === 'loading'}
          config={{ showAccount: true }}
          accounts={accounts}
          initialAccountCode={deepLinkCode}
          // Auto-run once the workspace is ready AND a deep-link account is present,
          // so "View ledger" lands on the report instead of an empty filter form.
          autoRunKey={ws?._id && deepLinkCode ? `${ws._id}:${deepLinkCode}` : undefined}
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
              {t('common.openingBalanceValue', { value: fmtPaise(report.openingBalancePaise) })}
            </div>
            <ReportTable<AccountLedgerRow>
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
              {t('common.closingBalanceValue', { value: fmtPaise(report.closingBalancePaise) })}
            </div>
          </>
        )}
        {state === 'loading' && <Skeleton active />}
        {state === 'empty' && <ReportEmptyState />}
        {state === 'idle' && <ReportEmptyState mode="idle" />}
        {state === 'error' && <Alert type="error" title={t('partyLedger.accountLedger.error')} />}
      </div>
    </div>
  );
}
