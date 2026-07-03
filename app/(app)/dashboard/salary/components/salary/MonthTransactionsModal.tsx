'use client';

import { Button } from 'antd';
import {
  BankOutlined,
  MobileOutlined,
  WalletOutlined,
  AuditOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  UpOutlined,
  DownOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import Image from 'next/image';
import dayjs from 'dayjs';
import { DsModal, DsAvatar, DsTag } from '@/components/ui';
import { ExportButton } from '@/components/export';
import type { SalaryRecord, LedgerMonth, LedgerTransaction } from '../../types/salary-page.types';

interface SettlementMeta {
  statusBg: string;
  statusColor: string;
  statusLabel: string;
  balanceLabel: string;
  balanceValue: number;
  balanceColor: string;
}

interface MonthTransactionsModalProps {
  open: boolean;
  data: { record: SalaryRecord; monthData: LedgerMonth | null } | null;
  isLedgerLoading: boolean;
  ledgerError: string | null;
  expandedSplits: Set<string>;
  canExport: boolean;
  exportRows: unknown[];
  exportFilename: string;
  exportFilterSummary: string | undefined;
  getExportData: () => Promise<unknown[]>;
  onClose: () => void;
  onToggleSplit: (id: string) => void;
  onOpenLedger: (rec: SalaryRecord) => void;
  onLoadFullLedger: (rec: SalaryRecord) => void;
  onShowFullHistory: () => void;
  onSetMonthTransactionsModal: (
    data: { record: SalaryRecord; monthData: LedgerMonth | null } | null,
  ) => void;
  onSetReversePaymentTarget: (t: LedgerTransaction | null) => void;
  onResetReversePaymentForm: () => void;
  reversePaymentAccess?: { enabled: boolean };
  getSettlementMeta: (salary: number, paid: number) => SettlementMeta;
  formatCurrencyFull: (amount: number) => string;
}

export function MonthTransactionsModal({
  open,
  data,
  isLedgerLoading,
  ledgerError,
  expandedSplits,
  canExport,
  exportRows,
  exportFilename,
  exportFilterSummary,
  getExportData,
  onClose,
  onToggleSplit,
  onOpenLedger,
  onLoadFullLedger,
  onShowFullHistory,
  onSetMonthTransactionsModal,
  onSetReversePaymentTarget,
  onResetReversePaymentForm,
  reversePaymentAccess,
  getSettlementMeta,
  formatCurrencyFull: fmtCurrencyFull,
}: MonthTransactionsModalProps) {
  const methodColors: Record<string, { bg: string; text: string }> = {
    cash: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)' },
    upi: { bg: 'var(--cr-info-50)', text: 'var(--cr-info-700)' },
    bank: { bg: 'var(--cr-indigo-50)', text: 'var(--cr-primary-hover)' },
    bank_transfer: { bg: 'var(--cr-indigo-50)', text: 'var(--cr-primary-hover)' },
    cheque: { bg: 'var(--cr-neutral-100)', text: 'var(--cr-text-3)' },
    split: { bg: 'var(--cr-border-light)', text: 'var(--cr-text-4)' },
  };

  const getMethodInfo = (method: string) => {
    const methodIcon =
      method === 'bank' ? (
        <BankOutlined />
      ) : method === 'upi' ? (
        <MobileOutlined />
      ) : method === 'split' ? (
        <BankOutlined />
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
    <DsModal
      open={open}
      onCancel={onClose}
      title={
        <span className="font-display">
          {data?.monthData ? `Payment Ledger - ${data.monthData.monthLabel}` : 'Payment Ledger'}
        </span>
      }
      footer={null}
      width={700}
      scrollHeight="calc(100vh - 200px)"
    >
      {data &&
        (() => {
          const { record, monthData } = data;

          if (!monthData && isLedgerLoading) {
            return (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <span className="inline-block h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
                <p className="m-0 text-[14px] text-subtle">Loading payment history…</p>
              </div>
            );
          }

          if (!monthData && ledgerError) {
            return (
              <div className="py-12 text-center">
                <ExclamationCircleOutlined
                  className="mb-3 block text-[48px]"
                  style={{ color: 'var(--cr-error)' }}
                />
                <p className="m-0 text-[15px] font-semibold text-secondary">
                  Failed to load history
                </p>
                <p className="mt-1 mb-4 text-[13px] text-subtle">{ledgerError}</p>
                <Button type="primary" onClick={() => onOpenLedger(record)}>
                  Retry
                </Button>
              </div>
            );
          }

          if (!monthData) {
            return (
              <div className="py-12 text-center">
                <InboxOutlined className="mb-3 block text-[48px] text-subtle" />
                <p className="m-0 text-[15px] font-semibold text-secondary">
                  No payment history yet
                </p>
                <p className="m-0 text-[13px] text-subtle">
                  Payments will appear here once recorded.
                </p>
              </div>
            );
          }

          const settlementMeta = getSettlementMeta(monthData.salary, monthData.paid);

          return (
            <div className="flex flex-col gap-4">
              <div className="flex justify-end">
                <ExportButton
                  fields={[]}
                  getExportData={getExportData}
                  title="Payment Ledger"
                  filename={exportFilename}
                  filterSummary={exportFilterSummary}
                  disabled={exportRows.length === 0 || !canExport}
                />
              </div>

              <div className="bg-surface-secondary flex items-center gap-3 rounded-[10px] p-3">
                <DsAvatar
                  name={record.teamMember?.name || 'Unknown'}
                  size={40}
                  src={record.teamMember?.avatar}
                />
                <div>
                  <p className="m-0 text-[14px] font-semibold text-heading">
                    {record.teamMember?.name || 'Unknown'}
                  </p>
                  <p className="m-0 text-[12px] text-subtle">
                    {record.teamMember?.designation || '-'}
                  </p>
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
                    value: monthData.salary,
                    color: 'var(--cr-text)',
                  },
                  {
                    label: 'PAID',
                    value: monthData.paid,
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

              {monthData.transactions.length === 0 ? (
                <p className="m-0 py-6 text-center text-subtle">No payments recorded this month</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {monthData.transactions.map((t) => {
                    const { methodIcon, methodLabel } = getMethodInfo(t.method);
                    const mc = methodColors[t.method] ?? {
                      bg: 'var(--cr-neutral-100)',
                      text: 'var(--cr-text-3)',
                    };
                    const proofUrls: string[] = t.proofUrls?.length
                      ? t.proofUrls
                      : t.proofUrl
                        ? [t.proofUrl]
                        : [];

                    const isExpanded = expandedSplits.has(t.id);
                    const isReversedPayment = t.status === 'reversed';

                    return (
                      <div
                        key={t.id}
                        className="overflow-hidden rounded-[10px]"
                        style={{
                          border: isReversedPayment
                            ? '1px solid var(--cr-border)'
                            : '1px solid var(--cr-border)',
                          background: isReversedPayment
                            ? 'var(--cr-bg)'
                            : 'var(--cr-surface, #fff)',
                          opacity: isReversedPayment ? 0.7 : 1,
                        }}
                      >
                        <div
                          className="flex cursor-pointer items-center justify-between p-3 transition-colors"
                          style={{
                            background: isExpanded
                              ? 'var(--cr-surface-secondary, var(--cr-bg))'
                              : 'transparent',
                          }}
                          onClick={() => onToggleSplit(t.id)}
                          onMouseEnter={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.background =
                                'var(--cr-surface-secondary, var(--cr-bg))';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isExpanded) {
                              e.currentTarget.style.background = 'transparent';
                            }
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[15px]"
                              style={{ background: mc.bg, color: mc.text }}
                            >
                              {methodIcon}
                            </span>
                            <div>
                              <p
                                className={`m-0 text-[13px] font-bold ${
                                  isReversedPayment ? 'text-subtle line-through' : 'text-heading'
                                }`}
                              >
                                {fmtCurrencyFull(t.amount)}
                              </p>
                              <p className="m-0 text-[11px] text-subtle">
                                {methodLabel}
                                {t.paidBy ? ` · ${t.paidBy}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2 text-right">
                            <div>
                              <p className="m-0 text-[12px] font-semibold text-heading">
                                {dayjs(t.dateTime).format('DD MMM YYYY')}
                              </p>
                              {t.proofAttached && (
                                <p
                                  className="m-0 mt-0.5 text-[10px]"
                                  style={{ color: 'var(--cr-success)' }}
                                >
                                  Proof attached
                                </p>
                              )}
                            </div>
                            <span className="text-[12px] text-subtle">
                              {isExpanded ? <UpOutlined /> : <DownOutlined />}
                            </span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="flex flex-col gap-3 pt-1 pb-2">
                            <div
                              className="border-t px-3 pt-3 pb-2"
                              style={{ borderColor: 'var(--cr-border)' }}
                            >
                              <div className="grid grid-cols-2 gap-2">
                                <div
                                  className="flex items-start gap-2 rounded-[10px] p-3"
                                  style={{
                                    background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                  }}
                                >
                                  <span className="mt-0.5 flex-shrink-0 text-[14px] text-subtle">
                                    📅
                                  </span>
                                  <div className="min-w-0">
                                    <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                      Date & Time
                                    </p>
                                    <div className="text-[12px] font-medium text-heading">
                                      {dayjs(t.dateTime).format('DD MMM YYYY, hh:mm A')}
                                    </div>
                                  </div>
                                </div>

                                <div
                                  className="flex items-start gap-2 rounded-[10px] p-3"
                                  style={{
                                    background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                  }}
                                >
                                  <span className="mt-0.5 flex-shrink-0 text-[14px] text-subtle">
                                    👤
                                  </span>
                                  <div className="min-w-0">
                                    <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                      Payment Made By
                                    </p>
                                    <div className="text-[12px] font-medium text-heading">
                                      {t.paidBy || '-'}
                                    </div>
                                    {t.recordedBy && (
                                      <p className="m-0 mt-0.5 text-[10px] text-subtle">
                                        Logged by: {t.recordedBy}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {(!!t.paymentFrom || !!t.referenceNo) && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {!!t.paymentFrom && (
                                    <div
                                      className="flex items-start gap-2 rounded-[10px] p-3"
                                      style={{
                                        background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                      }}
                                    >
                                      <span className="mt-0.5 flex-shrink-0 text-[14px] text-subtle">
                                        🏢
                                      </span>
                                      <div className="min-w-0">
                                        <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                          Source Account
                                        </p>
                                        <div className="text-[12px] font-medium text-heading">
                                          {t.paymentFrom}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {!!t.referenceNo && (
                                    <div
                                      className="flex items-start gap-2 rounded-[10px] p-3"
                                      style={{
                                        background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                      }}
                                    >
                                      <span className="mt-0.5 flex-shrink-0 text-[14px] text-subtle">
                                        ⚡
                                      </span>
                                      <div className="min-w-0">
                                        <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                          Reference / UTR
                                        </p>
                                        <div className="text-[12px] font-medium text-heading">
                                          {t.referenceNo}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}

                              {t.method === 'split' && t.splitLines && t.splitLines.length > 0 && (
                                <div className="mt-2">
                                  <div
                                    className="overflow-hidden rounded-[10px]"
                                    style={{
                                      border: '1px solid var(--cr-border)',
                                    }}
                                  >
                                    <div
                                      className="px-3 py-2"
                                      style={{ background: 'var(--cr-border-light)' }}
                                    >
                                      <p className="m-0 text-[11px] font-bold tracking-wider text-subtle uppercase">
                                        Split Payment
                                      </p>
                                    </div>
                                    {t.splitLines.map((line, idx) => {
                                      const lc = methodColors[line.method] ?? {
                                        bg: 'var(--cr-neutral-100)',
                                        text: 'var(--cr-text-3)',
                                      };
                                      return (
                                        <div
                                          key={idx}
                                          className="flex flex-col gap-1 px-3 py-2.5"
                                          style={{
                                            borderTop:
                                              idx > 0 ? '1px solid var(--cr-border)' : undefined,
                                          }}
                                        >
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <span className="text-[11px] font-bold text-subtle">
                                                PART {idx + 1}
                                              </span>
                                              <span
                                                className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                                                style={{
                                                  background: lc.bg,
                                                  color: lc.text,
                                                }}
                                              >
                                                {line.method.toUpperCase()}
                                              </span>
                                            </div>
                                            <span className="text-[13px] font-bold text-heading">
                                              {fmtCurrencyFull(line.amount)}
                                            </span>
                                          </div>
                                          <div className="mt-1 grid grid-cols-2 gap-1.5">
                                            <div
                                              className="rounded-[8px] p-2"
                                              style={{
                                                background:
                                                  'var(--cr-surface-secondary, var(--cr-bg))',
                                              }}
                                            >
                                              <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                                                Date & Time
                                              </p>
                                              <p className="m-0 text-[12px] font-medium text-heading">
                                                {dayjs(line.dateTime || t.dateTime).format(
                                                  'DD MMM YYYY, hh:mm A',
                                                )}
                                              </p>
                                            </div>
                                            <div
                                              className="rounded-[8px] p-2"
                                              style={{
                                                background:
                                                  'var(--cr-surface-secondary, var(--cr-bg))',
                                              }}
                                            >
                                              <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                                                Paid By
                                              </p>
                                              <p className="m-0 text-[12px] font-medium text-heading">
                                                {line.paidBy || t.paidBy || '-'}
                                              </p>
                                            </div>
                                          </div>
                                          {!!line.referenceNo && (
                                            <div
                                              className="mt-0.5 rounded-[8px] p-2"
                                              style={{
                                                background:
                                                  'var(--cr-surface-secondary, var(--cr-bg))',
                                              }}
                                            >
                                              <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                                                Reference / UTR
                                              </p>
                                              <p className="m-0 text-[12px] font-medium text-heading">
                                                {line.referenceNo}
                                              </p>
                                            </div>
                                          )}
                                          {!!line.paymentFrom && (
                                            <div
                                              className="mt-0.5 rounded-[8px] p-2"
                                              style={{
                                                background:
                                                  'var(--cr-surface-secondary, var(--cr-bg))',
                                              }}
                                            >
                                              <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                                                From Account
                                              </p>
                                              <p className="m-0 text-[12px] font-medium text-heading">
                                                {line.paymentFrom}
                                              </p>
                                            </div>
                                          )}
                                          {!!line.note && (
                                            <div
                                              className="mt-0.5 rounded-[8px] p-2"
                                              style={{
                                                background:
                                                  'var(--cr-surface-secondary, var(--cr-bg))',
                                              }}
                                            >
                                              <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                                                Note
                                              </p>
                                              <p className="m-0 text-[12px] font-medium text-heading">
                                                {line.note}
                                              </p>
                                            </div>
                                          )}
                                          {line.proofUrls && line.proofUrls.length > 0 && (
                                            <div
                                              className="mt-0.5 rounded-[8px] p-2"
                                              style={{
                                                background:
                                                  'var(--cr-surface-secondary, var(--cr-bg))',
                                              }}
                                            >
                                              <p className="m-0 mb-1.5 text-[10px] tracking-wider text-subtle uppercase">
                                                Attached Proofs
                                              </p>
                                              <div className="flex flex-col gap-1.5">
                                                {line.proofUrls.map((url, pIdx) => (
                                                  <div
                                                    key={pIdx}
                                                    className="flex items-center gap-2"
                                                  >
                                                    <Image
                                                      src={url}
                                                      alt={`Proof ${pIdx + 1}`}
                                                      width={48}
                                                      height={48}
                                                      style={{
                                                        objectFit: 'cover',
                                                        borderColor: 'var(--cr-border)',
                                                      }}
                                                      className="h-12 w-12 rounded border"
                                                    />
                                                    <div className="flex-1">
                                                      <p className="m-0 text-[11px] font-medium text-heading">
                                                        Receipt {pIdx + 1}
                                                      </p>
                                                      <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-[10px]"
                                                        style={{
                                                          color:
                                                            'var(--cr-primary, var(--cr-info-700))',
                                                        }}
                                                      >
                                                        View Full Image →
                                                      </a>
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {!!t.note && t.method !== 'split' && (
                                <div className="mt-2">
                                  <div
                                    className="flex items-start gap-2 rounded-[10px] p-3"
                                    style={{
                                      background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                    }}
                                  >
                                    <span className="mt-0.5 flex-shrink-0 text-[14px] text-subtle">
                                      📝
                                    </span>
                                    <div className="min-w-0">
                                      <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                        Note
                                      </p>
                                      <div className="text-[12px] font-medium text-heading">
                                        {t.note}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {(t.proofAttached || proofUrls.length > 0) && (
                                <div className="mt-2">
                                  <div
                                    className="flex items-start gap-2 rounded-[10px] p-3"
                                    style={{
                                      background: 'var(--cr-surface-secondary, var(--cr-bg))',
                                    }}
                                  >
                                    <span className="mt-0.5 flex-shrink-0 text-[14px] text-subtle">
                                      📎
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p className="m-0 mb-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                        Payment Proof
                                      </p>
                                      {proofUrls.length > 0 ? (
                                        <div className="flex flex-col gap-2">
                                          {proofUrls.map((url, idx) => (
                                            <div key={idx} className="flex items-center gap-2">
                                              <Image
                                                src={url}
                                                alt={`Proof ${idx + 1}`}
                                                width={64}
                                                height={64}
                                                style={{
                                                  objectFit: 'cover',
                                                  borderColor: 'var(--cr-border)',
                                                }}
                                                className="h-16 w-16 rounded border"
                                              />
                                              <div className="flex-1">
                                                <p className="m-0 text-[12px] font-medium text-heading">
                                                  Receipt {proofUrls.length > 1 ? idx + 1 : ''}
                                                </p>
                                                <a
                                                  href={url}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="text-[11px] font-medium"
                                                  style={{
                                                    color: 'var(--cr-primary, var(--cr-info-700))',
                                                  }}
                                                >
                                                  View Full Image →
                                                </a>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <span
                                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold"
                                          style={{
                                            background: 'var(--cr-success-50)',
                                            color: 'var(--cr-success-700)',
                                          }}
                                        >
                                          ✓ Proof Attached
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                              {isReversedPayment && t.reversalReason && (
                                <div
                                  className="mx-3 flex items-start gap-3 rounded-[10px] p-3"
                                  style={{
                                    background: 'var(--cr-danger-50)',
                                    border: '1px solid var(--cr-danger-50)',
                                  }}
                                >
                                  <span className="mt-0.5 flex-shrink-0 text-[14px]">⚠️</span>
                                  <div className="min-w-0">
                                    <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                                      Reversal Reason
                                    </p>
                                    <p
                                      className="m-0 text-[12px] font-medium"
                                      style={{ color: 'var(--cr-danger-700)' }}
                                    >
                                      {t.reversalReason}
                                    </p>
                                    {t.reversedAt && (
                                      <p className="m-0 mt-1 text-[11px] text-subtle">
                                        Reversed on{' '}
                                        {dayjs(t.reversedAt).format('DD MMM YYYY, hh:mm A')}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {!isReversedPayment && (
                                <div className="px-3 pt-1 pb-1">
                                  <Button
                                    danger
                                    size="small"
                                    type="text"
                                    className="text-[12px]"
                                    icon={<CloseCircleOutlined />}
                                    disabled={!reversePaymentAccess?.enabled}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onSetReversePaymentTarget(t);
                                      onResetReversePaymentForm();
                                    }}
                                  >
                                    Reverse Payment
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <button
                onClick={() => {
                  onSetMonthTransactionsModal(null);
                  onLoadFullLedger(record);
                  onShowFullHistory();
                }}
                className="mt-1 w-full rounded-lg py-2 text-center text-[13px] font-semibold"
                style={{
                  color: 'var(--cr-primary, var(--cr-info-700))',
                  background: 'var(--cr-surface-secondary, var(--cr-bg))',
                  border: '1px solid var(--cr-border)',
                  cursor: 'pointer',
                }}
              >
                View Full Payment Ledger →
              </button>
            </div>
          );
        })()}
    </DsModal>
  );
}
