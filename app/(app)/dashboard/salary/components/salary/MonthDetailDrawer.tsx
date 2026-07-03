'use client';

import { Drawer, Button } from 'antd';
import {
  BankOutlined,
  MobileOutlined,
  WalletOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  UpOutlined,
  DownOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { DsAvatar } from '@/components/ui';
import { formatCurrencyFull } from '@/lib/utils';
import type { SalaryRecord, LedgerRecord, LedgerTransaction } from '../../types/salary-page.types';

interface SettlementMeta {
  statusBg: string;
  statusColor: string;
  statusLabel: string;
  balanceLabel: string;
  balanceValue: number;
  balanceColor: string;
}

interface MonthDetailDrawerProps {
  open: boolean;
  ledgerRecord: SalaryRecord | null;
  ledgerData: LedgerRecord | null;
  ledgerError: string | null;
  isLedgerLoading: boolean;
  ledgerViewMonthKey: string | null;
  expandedSplits: Set<string>;
  onClose: () => void;
  onSetLedgerViewMonthKey: (key: string | null) => void;
  onToggleSplit: (id: string) => void;
  onSelectTransaction: (t: LedgerTransaction) => void;
  onShowFullHistory: () => void;
  onRetry: () => void;
  getSettlementMeta: (salary: number, paid: number) => SettlementMeta;
  formatCurrencyFull: (amount: number) => string;
}

export function MonthDetailDrawer({
  open,
  ledgerRecord,
  ledgerData,
  ledgerError,
  isLedgerLoading,
  ledgerViewMonthKey,
  expandedSplits,
  onClose,
  onSetLedgerViewMonthKey,
  onToggleSplit,
  onSelectTransaction,
  onShowFullHistory,
  onRetry,
  getSettlementMeta,
  formatCurrencyFull: fmtCurrencyFull,
}: MonthDetailDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={(() => {
        if (!ledgerRecord) return <span className="font-display">Payment Ledger</span>;
        const monthLabel =
          ledgerData?.months.find(
            (m) =>
              m.monthKey === `${ledgerRecord.year}-${String(ledgerRecord.month).padStart(2, '0')}`,
          )?.monthLabel ??
          `${dayjs()
            .month(ledgerRecord.month - 1)
            .format('MMM')} ${ledgerRecord.year}`;
        return <span className="font-display">Payment Ledger - {monthLabel}</span>;
      })()}
      footer={null}
      size="large"
      placement="right"
    >
      {isLedgerLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16">
          <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
          <p className="m-0 text-[14px] text-subtle">Loading payment history…</p>
        </div>
      ) : ledgerError ? (
        <div className="py-12 text-center">
          <ExclamationCircleOutlined
            className="mb-3 block text-[48px]"
            style={{ color: 'var(--cr-error)' }}
          />
          <p className="m-0 text-[15px] font-semibold text-secondary">Failed to load history</p>
          <p className="mt-1 mb-4 text-[13px] text-subtle">{ledgerError}</p>
          <Button type="primary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      ) : !ledgerData || ledgerData.months.length === 0 ? (
        <div className="py-12 text-center">
          <InboxOutlined className="mb-3 block text-[48px] text-subtle" />
          <p className="m-0 text-[15px] font-semibold text-secondary">No payment history yet</p>
          <p className="m-0 text-[13px] text-subtle">Payments will appear here once recorded.</p>
        </div>
      ) : (
        (() => {
          const activeMonthKey =
            ledgerViewMonthKey ??
            (ledgerRecord
              ? `${ledgerRecord.year}-${String(ledgerRecord.month).padStart(2, '0')}`
              : null);
          const sortedMonths = [...ledgerData.months].sort((a, b) =>
            b.monthKey.localeCompare(a.monthKey),
          );
          const currentMonthIdx = sortedMonths.findIndex((m) => m.monthKey === activeMonthKey);
          const currentMonth = sortedMonths[currentMonthIdx !== -1 ? currentMonthIdx : 0];
          const canGoPrev = currentMonthIdx < sortedMonths.length - 1;
          const canGoNext = currentMonthIdx > 0;
          const settlementMeta = getSettlementMeta(currentMonth.salary, currentMonth.paid);

          return (
            <div className="flex flex-col gap-4">
              {sortedMonths.length > 1 && (
                <div className="flex items-center justify-between">
                  <button
                    disabled={!canGoPrev}
                    onClick={() =>
                      onSetLedgerViewMonthKey(sortedMonths[currentMonthIdx + 1].monthKey)
                    }
                    className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold disabled:opacity-30"
                    style={{
                      background: 'var(--cr-surface-secondary, var(--cr-bg))',
                      border: '1px solid var(--cr-border)',
                      cursor: canGoPrev ? 'pointer' : 'default',
                    }}
                  >
                    <LeftOutlined style={{ fontSize: 11 }} /> Prev
                  </button>
                  <div className="text-center">
                    <p className="m-0 text-[14px] font-bold text-heading">
                      {currentMonth.monthLabel}
                    </p>
                    <button
                      onClick={() => onSetLedgerViewMonthKey(null)}
                      className="text-[11px] font-semibold"
                      style={{
                        color: 'var(--cr-primary, var(--cr-info-700))',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      This Month
                    </button>
                  </div>
                  <button
                    disabled={!canGoNext}
                    onClick={() =>
                      onSetLedgerViewMonthKey(sortedMonths[currentMonthIdx - 1].monthKey)
                    }
                    className="flex items-center gap-1 rounded-[8px] px-3 py-1.5 text-[13px] font-semibold disabled:opacity-30"
                    style={{
                      background: 'var(--cr-surface-secondary, var(--cr-bg))',
                      border: '1px solid var(--cr-border)',
                      cursor: canGoNext ? 'pointer' : 'default',
                    }}
                  >
                    Next <RightOutlined style={{ fontSize: 11 }} />
                  </button>
                </div>
              )}

              <div className="bg-surface-secondary flex items-center gap-3 rounded-[10px] p-3">
                <DsAvatar name={ledgerData.employeeName} size={40} src={ledgerData.employeePhoto} />
                <div>
                  <p className="m-0 text-[14px] font-semibold text-heading">
                    {ledgerData.employeeName}
                  </p>
                  <p className="m-0 text-[12px] text-subtle">{ledgerData.employeeCode || '-'}</p>
                </div>
                <span
                  className="ml-auto rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{
                    background: settlementMeta.statusBg,
                    color: settlementMeta.statusColor,
                  }}
                >
                  {settlementMeta.statusLabel}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    label: 'NET PAYABLE',
                    value: currentMonth.salary,
                    color: 'var(--cr-text)',
                  },
                  {
                    label: 'PAID',
                    value: currentMonth.paid,
                    color: 'var(--cr-success)',
                  },
                  {
                    label: settlementMeta.balanceLabel,
                    value: settlementMeta.balanceValue,
                    color: settlementMeta.balanceColor,
                  },
                ].map((col) => (
                  <div
                    key={col.label}
                    className="rounded-[8px] px-3 py-2.5 text-center"
                    style={{
                      background: 'var(--cr-surface-secondary, var(--cr-bg))',
                      border: '1px solid var(--cr-border)',
                    }}
                  >
                    <p className="m-0 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                      {col.label}
                    </p>
                    <p className="m-0 mt-0.5 text-[13px] font-bold" style={{ color: col.color }}>
                      {fmtCurrencyFull(col.value)}
                    </p>
                  </div>
                ))}
              </div>

              {currentMonth.transactions.length === 0 ? (
                <p className="m-0 py-6 text-center text-subtle">No payments recorded this month</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {currentMonth.transactions.map((t) => {
                    const methodIcon =
                      t.method === 'bank' ? (
                        <BankOutlined />
                      ) : t.method === 'upi' ? (
                        <MobileOutlined />
                      ) : t.method === 'cheque' ? (
                        <AuditOutlined />
                      ) : (
                        <WalletOutlined />
                      );
                    const methodLabel =
                      t.method === 'cash'
                        ? 'Cash'
                        : t.method === 'bank'
                          ? 'Bank Transfer'
                          : t.method === 'upi'
                            ? 'UPI'
                            : t.method === 'cheque'
                              ? 'Cheque'
                              : t.method === 'split'
                                ? 'Split Payment'
                                : 'Other';
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
                            t.method === 'split' ? onToggleSplit(t.id) : onSelectTransaction(t)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              t.method === 'split' ? onToggleSplit(t.id) : onSelectTransaction(t);
                            }
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(0.96)')}
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
                                <p className="m-0 mt-0.5 text-[10px] text-muted italic">{t.note}</p>
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
                                <p className="m-0 text-[10px] text-subtle">by {t.recordedBy}</p>
                              )}
                              {t.proofAttached && (
                                <p
                                  className="m-0 mt-0.5 text-[10px]"
                                  style={{ color: 'var(--cr-success)' }}
                                >
                                  Proof attached
                                </p>
                              )}
                            </div>
                            {t.method === 'split' && (
                              <span className="text-[12px] text-subtle">
                                {expandedSplits.has(t.id) ? <UpOutlined /> : <DownOutlined />}
                              </span>
                            )}
                          </div>
                        </div>

                        {t.method === 'split' &&
                          expandedSplits.has(t.id) &&
                          t.splitLines &&
                          t.splitLines.length > 0 && (
                            <div className="border-t" style={{ borderColor: 'var(--cr-border)' }}>
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
                                      borderTop: idx > 0 ? `1px solid var(--cr-border)` : undefined,
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
                  })}
                </div>
              )}

              {ledgerData.months.length > 1 && (
                <button
                  onClick={onShowFullHistory}
                  className="mt-1 w-full text-right text-[13px] font-semibold"
                  style={{
                    color: 'var(--cr-primary, var(--cr-info-700))',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  View full ledger history →
                </button>
              )}
            </div>
          );
        })()
      )}
    </Drawer>
  );
}
