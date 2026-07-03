'use client';

import { Drawer, Input, Select, Collapse, Tooltip } from 'antd';
import {
  BankOutlined,
  MobileOutlined,
  WalletOutlined,
  AuditOutlined,
  SearchOutlined,
  UpOutlined,
  DownOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DsAvatar } from '@/components/ui';
import { ExportButton } from '@/components/export';
import type { LedgerRecord, LedgerMonth, LedgerTransaction } from '../../types/salary-page.types';
import { HISTORY_DATE_RANGE_LABELS } from '../../constants/salary-page.constants';

interface SettlementMeta {
  statusBg: string;
  statusColor: string;
  statusLabel: string;
  balanceLabel: string;
  balanceValue: number;
  balanceColor: string;
}

interface FullHistoryDrawerProps {
  open: boolean;
  ledgerData: LedgerRecord | null;
  isLedgerLoading: boolean;
  canExport: boolean;
  exportRows: unknown[];
  exportFilename: string;
  exportFilterSummary: string | undefined;
  getExportData: () => Promise<unknown[]>;
  historySearch: string;
  setHistorySearch: (v: string) => void;
  historyMethodFilter: Set<string>;
  setHistoryMethodFilter: (v: Set<string>) => void;
  historyDateRange: 'all' | '3m' | '6m' | '1y';
  setHistoryDateRange: (v: 'all' | '3m' | '6m' | '1y') => void;
  historyAccountFilter: Set<string>;
  setHistoryAccountFilter: (v: Set<string>) => void;
  ledgerAccounts: string[];
  expandedSplits: Set<string>;
  onClose: () => void;
  onToggleSplit: (id: string) => void;
  onSelectTransaction: (t: LedgerTransaction) => void;
  getSettlementMeta: (salary: number, paid: number) => SettlementMeta;
  formatCurrencyFull: (amount: number) => string;
}

export function FullHistoryDrawer({
  open,
  ledgerData,
  isLedgerLoading,
  canExport,
  exportRows,
  exportFilename,
  exportFilterSummary,
  getExportData,
  historySearch,
  setHistorySearch,
  historyMethodFilter,
  setHistoryMethodFilter,
  historyDateRange,
  setHistoryDateRange,
  historyAccountFilter,
  setHistoryAccountFilter,
  ledgerAccounts,
  expandedSplits,
  onClose,
  onToggleSplit,
  onSelectTransaction,
  getSettlementMeta,
  formatCurrencyFull: fmtCurrencyFull,
}: FullHistoryDrawerProps) {
  const filteredMonths = ledgerData?.months ?? [];

  const methodColors: Record<string, { bg: string; text: string; activeBg: string }> = {
    cash: {
      bg: 'var(--cr-warning-50)',
      text: 'var(--cr-warning-700)',
      activeBg: 'var(--cr-warning-50)',
    },
    upi: { bg: 'var(--cr-info-50)', text: 'var(--cr-info-700)', activeBg: 'var(--cr-info-50)' },
    bank: {
      bg: 'var(--cr-indigo-50)',
      text: 'var(--cr-primary-hover)',
      activeBg: 'var(--cr-indigo-50)',
    },
    split: { bg: 'var(--cr-bg)', text: 'var(--cr-text-4)', activeBg: 'var(--cr-border-light)' },
  };

  const getMethodInfo = (method: string) => {
    const methodIcon =
      method === 'bank' ? (
        <BankOutlined />
      ) : method === 'upi' ? (
        <MobileOutlined />
      ) : method === 'cheque' ? (
        <AuditOutlined />
      ) : (
        <WalletOutlined />
      );
    const methodLabel =
      method === 'cash'
        ? 'Cash'
        : method === 'bank'
          ? 'Bank Transfer'
          : method === 'upi'
            ? 'UPI'
            : method === 'cheque'
              ? 'Cheque'
              : method === 'split'
                ? 'Split Payment'
                : 'Other';
    return { methodIcon, methodLabel };
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="font-display">Payment Ledger - {ledgerData?.employeeName ?? ''}</span>
      }
      footer={null}
      size="large"
      placement="right"
    >
      {isLedgerLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="m-0 text-[14px] text-subtle">Loading full history…</p>
        </div>
      ) : (
        ledgerData &&
        (() => {
          return (
            <div className="flex flex-col gap-4">
              <div className="bg-surface-secondary flex items-center gap-3 rounded-[10px] p-3">
                <DsAvatar name={ledgerData.employeeName} size={40} src={ledgerData.employeePhoto} />
                <div>
                  <p className="m-0 text-[14px] font-semibold text-heading">
                    {ledgerData.employeeName}
                  </p>
                  <p className="m-0 text-[12px] text-subtle">{ledgerData.employeeCode || '-'}</p>
                </div>
                <div className="ml-auto flex gap-4 text-right">
                  <div>
                    <p className="m-0 text-[11px] tracking-wide text-subtle uppercase">
                      Total Paid
                    </p>
                    <p className="m-0 text-[13px] font-bold" style={{ color: 'var(--cr-success)' }}>
                      {fmtCurrencyFull(filteredMonths.reduce((s, m) => s + m.paid, 0))}
                    </p>
                  </div>
                  <div>
                    <p className="m-0 text-[11px] tracking-wide text-subtle uppercase">
                      Transactions
                    </p>
                    <p className="m-0 text-[13px] font-bold text-heading">
                      {filteredMonths.reduce((s, m) => s + m.transactions.length, 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Input
                  prefix={<SearchOutlined className="text-subtle" />}
                  placeholder="Search by amount, reference, note…"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  allowClear
                  size="middle"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    size="small"
                    style={{ width: 160 }}
                    value={historyDateRange}
                    onChange={(v) => setHistoryDateRange(v)}
                    options={[
                      { value: 'all', label: 'All Time' },
                      { value: '3m', label: 'Last 3 Months' },
                      { value: '6m', label: 'Last 6 Months' },
                      { value: '1y', label: 'Last 1 Year' },
                    ]}
                  />
                  {ledgerAccounts.length >= 1 && (
                    <Select
                      mode="multiple"
                      size="small"
                      allowClear
                      placeholder="All accounts"
                      style={{ minWidth: 160, maxWidth: 280 }}
                      value={[...historyAccountFilter]}
                      onChange={(vals) => setHistoryAccountFilter(new Set(vals))}
                      options={ledgerAccounts.map((account) => ({
                        value: account,
                        label: account,
                      }))}
                    />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(['cash', 'upi', 'bank', 'split'] as const).map((method) => {
                    const count = ledgerData.months.reduce(
                      (s, m) => s + m.transactions.filter((t) => t.method === method).length,
                      0,
                    );
                    if (count === 0) return null;
                    const isActive = historyMethodFilter.has(method);
                    const c = methodColors[method];
                    const label =
                      method === 'bank'
                        ? 'Bank'
                        : method === 'upi'
                          ? 'UPI'
                          : method.charAt(0).toUpperCase() + method.slice(1);
                    return (
                      <button
                        key={method}
                        onClick={() => {
                          const newSet = new Set(historyMethodFilter);
                          if (newSet.has(method)) newSet.delete(method);
                          else newSet.add(method);
                          setHistoryMethodFilter(newSet);
                        }}
                        className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-semibold"
                        style={{
                          background: isActive ? c.activeBg : c.bg,
                          color: c.text,
                          border: `1.5px solid ${isActive ? c.text : 'transparent'}`,
                          cursor: 'pointer',
                        }}
                      >
                        {label} <span className="text-[11px] opacity-70">{count}</span>
                      </button>
                    );
                  })}
                  {(historyMethodFilter.size > 0 ||
                    historySearch ||
                    historyDateRange !== 'all' ||
                    historyAccountFilter.size > 0) && (
                    <button
                      onClick={() => {
                        setHistoryMethodFilter(new Set());
                        setHistorySearch('');
                        setHistoryDateRange('all');
                        setHistoryAccountFilter(new Set());
                      }}
                      className="rounded-full px-2.5 py-1 text-[12px] font-semibold"
                      style={{
                        background: 'var(--cr-surface-secondary)',
                        border: '1px solid var(--cr-border)',
                        cursor: 'pointer',
                        color: 'var(--cr-error)',
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex justify-end">
                  {!canExport ? (
                    <Tooltip title="Upgrade to unlock export">
                      <span>
                        <ExportButton
                          fields={[]}
                          getExportData={getExportData}
                          title="Payment Ledger History"
                          filename={exportFilename}
                          filterSummary={exportFilterSummary}
                          disabled={exportRows.length === 0}
                        />
                      </span>
                    </Tooltip>
                  ) : (
                    <ExportButton
                      fields={[]}
                      getExportData={getExportData}
                      title="Payment Ledger History"
                      filename={exportFilename}
                      filterSummary={exportFilterSummary}
                      disabled={exportRows.length === 0 || !canExport}
                    />
                  )}
                </div>
              </div>

              {filteredMonths.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <p className="m-0 text-[14px] font-semibold text-heading">
                    No payment history found
                  </p>
                  <p className="m-0 text-[13px] text-subtle">
                    {historySearch ||
                    historyMethodFilter.size > 0 ||
                    historyDateRange !== 'all' ||
                    historyAccountFilter.size > 0
                      ? 'No transactions match the current filters.'
                      : 'No payment transactions have been recorded yet.'}
                  </p>
                </div>
              )}
              <Collapse
                ghost
                defaultActiveKey={undefined}
                items={filteredMonths.map((m: LedgerMonth) => {
                  const settlementMeta = getSettlementMeta(m.salary, m.paid);
                  return {
                    key: m.monthKey,
                    label: (
                      <div className="flex w-full items-center justify-between gap-2 pr-4">
                        <div>
                          <span className="font-semibold">{m.monthLabel}</span>
                          <p className="m-0 mt-0.5 text-[11px] text-subtle">
                            {m.transactions.length} transaction
                            {m.transactions.length !== 1 ? 's' : ''} · {fmtCurrencyFull(m.paid)}{' '}
                            paid
                            {m.remaining > 0 && (
                              <span style={{ color: 'var(--cr-error)' }}>
                                {' '}
                                · Pending: {fmtCurrencyFull(m.remaining)}
                              </span>
                            )}
                            {m.remaining < 0 && (
                              <span style={{ color: 'var(--cr-warning)' }}>
                                {' '}
                                · Advance: {fmtCurrencyFull(Math.abs(m.remaining))}
                              </span>
                            )}
                          </p>
                        </div>
                        <span
                          className="flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold"
                          style={{
                            background: settlementMeta.statusBg,
                            color: settlementMeta.statusColor,
                          }}
                        >
                          {settlementMeta.statusLabel}
                        </span>
                      </div>
                    ),
                    children: (
                      <div className="flex flex-col gap-2">
                        {m.transactions.length === 0 ? (
                          <p className="m-0 py-4 text-center text-subtle">
                            No payments recorded this month
                          </p>
                        ) : (
                          m.transactions.map((t) => {
                            const { methodIcon, methodLabel } = getMethodInfo(t.method);
                            return (
                              <div
                                key={t.id}
                                className="flex flex-col overflow-hidden rounded-[8px] transition-all"
                                style={{
                                  background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                  border: '1px solid var(--cr-border)',
                                }}
                              >
                                <div
                                  className="flex items-center justify-between p-3"
                                  role="button"
                                  tabIndex={0}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() =>
                                    t.method === 'split'
                                      ? onToggleSplit(t.id)
                                      : onSelectTransaction(t)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      t.method === 'split'
                                        ? onToggleSplit(t.id)
                                        : onSelectTransaction(t);
                                    }
                                  }}
                                  onMouseEnter={(e) =>
                                    (e.currentTarget.style.filter = 'brightness(0.96)')
                                  }
                                  onMouseLeave={(e) => (e.currentTarget.style.filter = '')}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <span
                                      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[15px]"
                                      style={{
                                        background:
                                          t.method === 'cash'
                                            ? 'var(--cr-warning-50)'
                                            : t.method === 'upi'
                                              ? 'var(--cr-info-50)'
                                              : t.method === 'split'
                                                ? 'var(--cr-border-light)'
                                                : 'var(--cr-indigo-50)',
                                        color:
                                          t.method === 'cash'
                                            ? 'var(--cr-warning-700)'
                                            : t.method === 'upi'
                                              ? 'var(--cr-info-700)'
                                              : t.method === 'split'
                                                ? 'var(--cr-text-4)'
                                                : 'var(--cr-primary-hover)',
                                      }}
                                    >
                                      {methodIcon}
                                    </span>
                                    <div>
                                      <p className="m-0 text-[13px] font-bold text-heading">
                                        {fmtCurrencyFull(t.amount)}
                                      </p>
                                      <p className="m-0 text-[11px] text-subtle">
                                        {methodLabel}
                                        {t.referenceNo ? ` · Ref: ${t.referenceNo}` : ''}
                                        {t.paidBy ? ` · ${t.paidBy}` : ''}
                                      </p>
                                      {t.note && (
                                        <p className="m-0 mt-0.5 text-[10px] text-muted italic">
                                          {t.note}
                                        </p>
                                      )}
                                      {(t.upiDebitedAccount || t.bankFromAccount) && (
                                        <p className="m-0 mt-0.5 text-[11px] text-subtle">
                                          Debited from:{' '}
                                          {t.upiDebitedAccount
                                            ? `${t.upiDebitedAccount.bankName} •••• ${t.upiDebitedAccount.accountNumber}`
                                            : `${t.bankFromAccount!.bankName} •••• ${t.bankFromAccount!.accountNumber}`}
                                        </p>
                                      )}
                                      {t.upiDebitedAccount?.upiRef && (
                                        <p className="m-0 mt-0.5 text-[11px] text-subtle">
                                          UTR: #{t.upiDebitedAccount.upiRef}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex flex-shrink-0 items-center gap-2 text-right">
                                    <div>
                                      <p className="m-0 text-[12px] font-semibold text-heading">
                                        {dayjs(t.dateTime).format('DD MMM YYYY')}
                                      </p>
                                      {t.recordedBy && (
                                        <p className="m-0 text-[10px] text-subtle">
                                          by {t.recordedBy}
                                        </p>
                                      )}
                                      {t.proofAttached && (
                                        <p
                                          className="m-0 mt-0.5 text-[10px]"
                                          style={{
                                            color: 'var(--cr-success)',
                                          }}
                                        >
                                          Proof attached
                                        </p>
                                      )}
                                    </div>
                                    {t.method === 'split' && (
                                      <span className="text-[12px] text-subtle">
                                        {expandedSplits.has(t.id) ? (
                                          <UpOutlined />
                                        ) : (
                                          <DownOutlined />
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {t.method === 'split' &&
                                  expandedSplits.has(t.id) &&
                                  t.splitLines &&
                                  t.splitLines.length > 0 && (
                                    <div
                                      className="border-t"
                                      style={{
                                        borderColor: 'var(--cr-border)',
                                      }}
                                    >
                                      {t.splitLines.map((line, idx) => {
                                        const lineBg =
                                          line.method === 'cash'
                                            ? 'var(--cr-warning-50)'
                                            : line.method === 'upi'
                                              ? 'var(--cr-info-50)'
                                              : 'var(--cr-indigo-50)';
                                        const lineColor =
                                          line.method === 'cash'
                                            ? 'var(--cr-warning-700)'
                                            : line.method === 'upi'
                                              ? 'var(--cr-info-700)'
                                              : 'var(--cr-primary-hover)';
                                        const lineLabel =
                                          line.method === 'cash'
                                            ? 'Cash'
                                            : line.method === 'upi'
                                              ? 'UPI'
                                              : 'Bank';
                                        return (
                                          <div
                                            key={idx}
                                            className="flex items-center justify-between px-3 py-2"
                                            style={{
                                              borderTop:
                                                idx > 0 ? `1px solid var(--cr-border)` : undefined,
                                              background: 'var(--cr-surface, #fff)',
                                            }}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-[10px] font-bold text-subtle">
                                                PART {idx + 1}
                                              </span>
                                              <span
                                                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                                                style={{
                                                  background: lineBg,
                                                  color: lineColor,
                                                }}
                                              >
                                                {lineLabel.toUpperCase()}
                                              </span>
                                              {line.paidBy && (
                                                <span className="text-[11px] text-subtle">
                                                  {line.paidBy}
                                                </span>
                                              )}
                                            </div>
                                            <span className="text-[13px] font-bold text-heading">
                                              {fmtCurrencyFull(line.amount)}
                                            </span>
                                          </div>
                                        );
                                      })}
                                      <button
                                        className="w-full py-2 text-center text-[12px] font-semibold"
                                        style={{
                                          background: 'none',
                                          border: 'none',
                                          borderTop: '1px solid var(--cr-border)',
                                          color: 'var(--cr-primary, var(--cr-info-700))',
                                          cursor: 'pointer',
                                        }}
                                        onClick={() => onSelectTransaction(t)}
                                      >
                                        View Full Details →
                                      </button>
                                    </div>
                                  )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    ),
                  };
                })}
              />

              {filteredMonths.length === 0 && (
                <div className="py-10 text-center">
                  <p className="m-0 text-[14px] font-semibold text-secondary">
                    No transactions found
                  </p>
                  <p className="m-0 mb-3 text-[12px] text-subtle">
                    Try adjusting your filters or search query
                  </p>
                  <button
                    onClick={() => {
                      setHistoryMethodFilter(new Set());
                      setHistorySearch('');
                    }}
                    className="text-[13px] font-semibold"
                    style={{
                      color: 'var(--cr-primary)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          );
        })()
      )}
    </Drawer>
  );
}
