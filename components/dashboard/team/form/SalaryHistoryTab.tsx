'use client';
import { Card, Empty, Skeleton, Spin, Tag } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import type { LedgerRecord, GratuityLedger } from '@/types';
import { formatCurrencyFull } from '@/lib/utils';
import { useMemberFormOptions } from './useMemberFormOptions';

interface SalaryHistoryTabProps {
  ledger: LedgerRecord | null;
  ledgerLoading: boolean;
  gratuityLedger: GratuityLedger | null;
  gratuityLoading: boolean;
  gratuityLoaded: boolean;
  canViewGratuityTracking: boolean;
}

export default function SalaryHistoryTab({
  ledger,
  ledgerLoading,
  gratuityLedger,
  gratuityLoading,
  gratuityLoaded,
  canViewGratuityTracking,
}: SalaryHistoryTabProps) {
  const t = useTranslations('team');
  const { formatServiceDuration } = useMemberFormOptions();
  const renderGratuityStatusCard = () => {
    if (!canViewGratuityTracking) return null;

    if (gratuityLoading && !gratuityLoaded) {
      return (
        <Card size="small" className="rounded-xl">
          <Skeleton active paragraph={{ rows: 2 }} title={false} />
        </Card>
      );
    }

    if (!gratuityLedger) return null;

    const totalMonths = gratuityLedger.completedYears * 12 + gratuityLedger.completedMonths;
    const remainingMonths = Math.max(5 * 12 - totalMonths, 0);
    const isNearingEligibility = !gratuityLedger.isEligible && gratuityLedger.completedYears === 4;
    const borderColor = gratuityLedger.isEligible
      ? 'var(--cr-success-700)'
      : isNearingEligibility
        ? 'var(--cr-warning-500)'
        : 'var(--cr-neutral-300)';
    const background = gratuityLedger.isEligible
      ? 'var(--cr-success-50)'
      : isNearingEligibility
        ? 'var(--cr-warning-50)'
        : 'var(--cr-bg)';

    return (
      <Card size="small" className="rounded-xl" style={{ borderColor, background }}>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="m-0 text-[14px] font-semibold text-primary">
                {t('salaryHistGratuityStatus')}
              </p>
              {gratuityLedger.isEligible ? (
                <Tag color="success" className="m-0">
                  {t('salaryHistEligible')}
                </Tag>
              ) : isNearingEligibility ? (
                <Tag color="warning" className="m-0">
                  {t('salaryHistNearingEligibility')}
                </Tag>
              ) : null}
            </div>
            <p className="text-text-muted m-0 mt-2 text-[13px]">
              {t('salaryHistServiceDuration')}{' '}
              <span className="font-medium text-primary">
                {formatServiceDuration(
                  gratuityLedger.completedYears,
                  gratuityLedger.completedMonths,
                )}
              </span>
            </p>
            <p className="text-text-muted m-0 mt-1 text-[13px]">
              {t('salaryHistStatus')}{' '}
              <span className="font-medium text-primary">
                {gratuityLedger.isEligible
                  ? t('salaryHistEligible')
                  : t('salaryHistNotYetEligible')}
              </span>
            </p>
          </div>

          <div className="text-left md:text-right">
            {gratuityLedger.isEligible ? (
              <>
                <p className="text-text-muted m-0 text-[11px] tracking-[0.08em] uppercase">
                  {t('salaryHistCurrentLiability')}
                </p>
                <p className="m-0 mt-1 text-[20px] font-bold text-primary">
                  {formatCurrencyFull(gratuityLedger.gratuityAmount)}
                </p>
              </>
            ) : (
              <>
                <p className="text-text-muted m-0 text-[11px] tracking-[0.08em] uppercase">
                  {t('salaryHistEligibleIn')}
                </p>
                <p className="m-0 mt-1 text-[20px] font-bold text-primary">
                  {t('salaryHistMonthsRemaining', { count: remainingMonths })}
                </p>
              </>
            )}
          </div>
        </div>
      </Card>
    );
  };

  if (ledgerLoading) {
    return (
      <div className="flex justify-center p-10">
        <Spin />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {renderGratuityStatusCard()}
      {!ledger || ledger.months.length === 0 ? (
        <Empty description={t('salaryHistNoRecords')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <>
          <div className="bg-surface-secondary flex items-center justify-between rounded-lg p-3">
            <div>
              <p className="m-0 text-[13px] font-semibold text-primary">{ledger.employeeName}</p>
              <p className="text-text-muted m-0 text-[11px]">{ledger.employeeCode || '-'}</p>
            </div>
            <div className="text-right">
              <p className="m-0 text-[14px] font-bold text-primary">
                {formatCurrencyFull(ledger.totalPaid)}
              </p>
              <p className="text-text-muted m-0 text-[10px]">{t('salaryHistTotalPaid')}</p>
            </div>
          </div>
          {ledger.months.map((m) => (
            <div
              key={m.monthKey}
              className="bg-surface-secondary rounded-xl border border-border p-4"
            >
              <div className="mb-2 flex justify-between">
                <span className="font-display text-[15px] font-bold text-primary">
                  {m.monthLabel}
                </span>
                <span className="text-text-muted text-[12px]">
                  {formatCurrencyFull(m.paid)} / {formatCurrencyFull(m.salary)}
                </span>
              </div>
              {m.transactions.length === 0 ? (
                <p className="text-text-muted text-xs">{t('salaryHistNoPayments')}</p>
              ) : (
                <div className="space-y-2">
                  {m.transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-primary">
                          {formatCurrencyFull(tx.amount)}
                        </span>
                        <span className="text-text-muted ml-2">
                          {tx.method || t('salaryHistDefaultMethodCash')}
                          {tx.referenceNo ? ` · ${tx.referenceNo}` : ''}
                        </span>
                      </div>
                      <span className="text-text-muted">
                        {dayjs(tx.dateTime).format('DD MMM YYYY')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
