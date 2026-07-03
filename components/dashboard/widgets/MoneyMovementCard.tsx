'use client';
/**
 * MoneyMovementCard — advances / loans / bonus snapshot on the workforce dashboard
 * (app/dashboard/page.tsx). Presentational: reads summary.advancesLoansBonus from
 * the PayrollOverviewResponse the page fetches once (shared with PayrollTrendCard).
 *
 * Cross-module: data from salaryApi.getOverview (BE salary service). Gated by
 * canSee('salary') in page.tsx. UNITS: these figures are RUPEES (NOT paise) — the
 * salary overview already normalises to rupees; use formatCurrency*.
 */
import { Skeleton, Empty } from 'antd';
import { useTranslations } from 'next-intl';
import { WalletOutlined, BankOutlined, GiftOutlined } from '@ant-design/icons';
import { formatCurrencyFull } from '@/lib/utils';
import type { PayrollOverviewResponse } from '@/types';
import { WidgetCard } from './WidgetCard';

interface Props {
  data: PayrollOverviewResponse | null;
  loading: boolean;
}

export function MoneyMovementCard({ data, loading }: Props) {
  const t = useTranslations('dashboard');
  const alb = data?.summary.advancesLoansBonus;

  const rows = alb
    ? [
        {
          icon: <WalletOutlined />,
          iconBg: 'var(--cr-warning-50)',
          iconColor: 'var(--cr-warning-700)',
          label: t('moneyMovement.advances'),
          value: formatCurrencyFull(alb.totalOutstandingAdvances),
          sub: t('moneyMovement.outstanding'),
        },
        {
          icon: <BankOutlined />,
          iconBg: 'var(--cr-info-50)',
          iconColor: 'var(--cr-info-700)',
          label: t('moneyMovement.loans'),
          value: formatCurrencyFull(alb.totalOutstandingLoanPrincipal),
          sub: t('moneyMovement.activeLoansCount', { count: alb.totalActiveLoans }),
        },
        {
          icon: <GiftOutlined />,
          iconBg: 'var(--cr-success-50)',
          iconColor: 'var(--cr-success-700)',
          label: t('moneyMovement.bonusIncentive'),
          value: formatCurrencyFull(alb.totalBonus + alb.totalCommission + alb.totalIncentive),
          sub: t('moneyMovement.thisMonth'),
        },
      ]
    : [];

  return (
    <WidgetCard
      title={t('moneyMovement.title')}
      iconColor="var(--cr-gold-500)"
      viewAllHref="/dashboard/salary"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 3 }} />
      ) : !alb ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('moneyMovement.empty')} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r) => (
            <div
              key={r.label}
              className="flex items-center gap-3 rounded-xl border border-border-light bg-surface px-3 py-2.5"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: r.iconBg, color: r.iconColor, fontSize: 16 }}
              >
                {r.icon}
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="m-0 text-[12px] font-semibold text-gray-700">{r.label}</p>
                <p className="m-0 text-[11px] text-faint">{r.sub}</p>
              </div>
              <span className="text-sm font-bold text-heading tabular-nums">{r.value}</span>
            </div>
          ))}
        </div>
      )}
    </WidgetCard>
  );
}

export default MoneyMovementCard;
