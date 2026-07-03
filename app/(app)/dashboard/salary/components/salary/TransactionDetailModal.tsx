'use client';

import { Modal } from 'antd';
import { BankOutlined, MobileOutlined, WalletOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { LedgerTransaction } from '../../types/salary-page.types';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

interface TransactionDetailModalProps {
  transaction: LedgerTransaction | null;
  onClose: () => void;
}

export function TransactionDetailModal({ transaction, onClose }: TransactionDetailModalProps) {
  const currencyFmt = useCurrencyFormatter();
  const formatCurrencyFull = currencyFmt.full;

  return (
    <Modal
      open={!!transaction}
      onCancel={onClose}
      footer={null}
      title={<span className="font-display">Transaction Details</span>}
      width={480}
      destroyOnHidden
    >
      {transaction &&
        (() => {
          const t = transaction;
          const methodColors: Record<string, { bg: string; text: string; label: string }> = {
            cash: { bg: 'var(--cr-warning-50)', text: 'var(--cr-warning-700)', label: 'CASH' },
            upi: { bg: 'var(--cr-info-50)', text: 'var(--cr-info-700)', label: 'UPI' },
            bank: { bg: 'var(--cr-indigo-50)', text: 'var(--cr-primary-hover)', label: 'BANK' },
            bank_transfer: {
              bg: 'var(--cr-indigo-50)',
              text: 'var(--cr-primary-hover)',
              label: 'BANK',
            },
            cheque: { bg: 'var(--cr-neutral-100)', text: 'var(--cr-text-3)', label: 'CHEQUE' },
            split: { bg: 'var(--cr-border-light)', text: 'var(--cr-text-4)', label: 'SPLIT' },
          };
          const mc = methodColors[t.method] ?? {
            bg: 'var(--cr-neutral-100)',
            text: 'var(--cr-text-3)',
            label: t.method.toUpperCase(),
          };
          const methodIcon =
            t.method === 'bank' || t.method === 'bank_transfer' ? (
              <BankOutlined />
            ) : t.method === 'upi' ? (
              <MobileOutlined />
            ) : t.method === 'split' ? (
              <WalletOutlined />
            ) : (
              <WalletOutlined />
            );

          const row = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
            <div
              className="flex items-start gap-3 rounded-[10px] p-3"
              style={{ background: 'var(--cr-surface-secondary, var(--cr-bg))' }}
            >
              <span className="mt-0.5 flex-shrink-0 text-[16px] text-subtle">{icon}</span>
              <div className="min-w-0">
                <p className="m-0 mb-0.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                  {label}
                </p>
                <div className="text-[13px] font-medium text-heading">{value}</div>
              </div>
            </div>
          );

          const proofUrls: string[] = t.proofUrls?.length
            ? t.proofUrls
            : t.proofUrl
              ? [t.proofUrl]
              : [];

          return (
            <div className="flex flex-col gap-3 pt-1">
              <div className="flex items-center justify-between px-1">
                <p className="m-0 text-[28px] font-bold text-heading">
                  {formatCurrencyFull(t.amount)}
                </p>
                <span
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold"
                  style={{ background: mc.bg, color: mc.text }}
                >
                  {methodIcon} {mc.label}
                </span>
              </div>

              <p className="m-0 px-1 text-[11px] font-bold tracking-widest text-subtle uppercase">
                Transaction Info
              </p>

              {row('📅', 'Date & Time', dayjs(t.dateTime).format('DD MMM YYYY, HH:mm'))}

              {row(
                '👤',
                'Payment Made By',
                <>
                  <span>{t.paidBy || '-'}</span>
                  {t.recordedBy && (
                    <p className="m-0 mt-0.5 text-[11px] text-subtle">Logged by: {t.recordedBy}</p>
                  )}
                </>,
              )}

              {!!t.commission &&
                row(
                  '💼',
                  'Commission Included',
                  <>
                    <span>{formatCurrencyFull(t.commission)}</span>
                    {t.commissionNote && (
                      <p className="m-0 mt-0.5 text-[11px] text-subtle">{t.commissionNote}</p>
                    )}
                  </>,
                )}

              {!!t.paymentFrom && row('🏢', 'Source Account', t.paymentFrom)}

              {!!t.referenceNo && row('⚡', 'Reference / UTR', t.referenceNo)}

              {(!!t.upiDebitedAccount || !!t.bankFromAccount) &&
                row(
                  '🏦',
                  'Debited From (Auto)',
                  <div className="flex flex-col gap-1">
                    {!!t.upiDebitedAccount && (
                      <div>
                        <span>
                          {t.upiDebitedAccount.bankName} •••• {t.upiDebitedAccount.accountNumber}
                        </span>
                        {t.upiDebitedAccount.upiRef && (
                          <span> · UPI Ref: {t.upiDebitedAccount.upiRef}</span>
                        )}
                      </div>
                    )}
                    {!!t.bankFromAccount && (
                      <span>
                        {t.bankFromAccount.bankName} •••• {t.bankFromAccount.accountNumber}
                      </span>
                    )}
                  </div>,
                )}

              {t.method === 'split' && t.splitLines && t.splitLines.length > 0 && (
                <div
                  className="overflow-hidden rounded-[10px]"
                  style={{ border: '1px solid var(--cr-border)' }}
                >
                  <div className="px-3 py-2" style={{ background: 'var(--cr-border-light)' }}>
                    <p className="m-0 text-[11px] font-bold tracking-wider text-subtle uppercase">
                      Split Payment
                    </p>
                  </div>
                  {t.splitLines.map((line, idx) => {
                    const lc = methodColors[line.method] ?? {
                      bg: 'var(--cr-neutral-100)',
                      text: 'var(--cr-text-3)',
                      label: line.method.toUpperCase(),
                    };
                    return (
                      <div
                        key={idx}
                        className="flex flex-col gap-1 px-3 py-2.5"
                        style={{
                          borderTop: idx > 0 ? '1px solid var(--cr-border)' : undefined,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-subtle">
                              PART {idx + 1}
                            </span>
                            <span
                              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                              style={{ background: lc.bg, color: lc.text }}
                            >
                              {lc.label}
                            </span>
                          </div>
                          <span className="text-[13px] font-bold text-heading">
                            {formatCurrencyFull(line.amount)}
                          </span>
                        </div>
                        <div className="mt-1 grid grid-cols-2 gap-1.5">
                          <div
                            className="rounded-[8px] p-2"
                            style={{
                              background: 'var(--cr-surface-secondary, var(--cr-bg))',
                            }}
                          >
                            <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                              Date
                            </p>
                            <p className="m-0 text-[12px] font-medium text-heading">
                              {dayjs(line.dateTime || t.dateTime).format('DD MMM YYYY')}
                            </p>
                          </div>
                          <div
                            className="rounded-[8px] p-2"
                            style={{
                              background: 'var(--cr-surface-secondary, var(--cr-bg))',
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
                              background: 'var(--cr-surface-secondary, var(--cr-bg))',
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
                              background: 'var(--cr-surface-secondary, var(--cr-bg))',
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
                              background: 'var(--cr-surface-secondary, var(--cr-bg))',
                            }}
                          >
                            <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                              Note
                            </p>
                            <p className="m-0 text-[12px] font-medium text-heading">{line.note}</p>
                          </div>
                        )}
                        {line.proofUrls && line.proofUrls.length > 0 && (
                          <div
                            className="mt-0.5 rounded-[8px] p-2"
                            style={{
                              background: 'var(--cr-surface-secondary, var(--cr-bg))',
                            }}
                          >
                            <p className="m-0 text-[10px] tracking-wider text-subtle uppercase">
                              Proof
                            </p>
                            <div className="mt-0.5 flex flex-col gap-1">
                              {line.proofUrls.map((url, i) => (
                                <a
                                  key={i}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[12px] font-medium"
                                  style={{
                                    color: 'var(--cr-primary, var(--cr-info-700))',
                                  }}
                                >
                                  View Receipt {line.proofUrls!.length > 1 ? i + 1 : ''} →
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!!t.note && t.method !== 'split' && row('📝', 'Note', t.note)}

              {(t.proofAttached || proofUrls.length > 0) && (
                <div
                  className="flex items-start gap-3 rounded-[10px] p-3"
                  style={{
                    background: 'var(--cr-surface-secondary, var(--cr-bg))',
                  }}
                >
                  <span className="mt-0.5 text-[16px] text-subtle">📎</span>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 mb-1.5 text-[10px] font-semibold tracking-wider text-subtle uppercase">
                      Payment Proof
                    </p>
                    {proofUrls.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        {proofUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[13px] font-medium"
                            style={{ color: 'var(--cr-primary, var(--cr-info-700))' }}
                          >
                            View Receipt {proofUrls.length > 1 ? idx + 1 : ''} →
                          </a>
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
              )}
            </div>
          );
        })()}
    </Modal>
  );
}
