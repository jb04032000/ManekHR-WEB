'use client';
// AccountingInsights — the PowerBI-style "Accounting Insights" section mounted on
// the finance dashboard (app/dashboard/finance/page.tsx). Fetches the aggregate
// accountingDashboard endpoint ONCE on mount and fans the result out to the
// presentational chart components (RatioGauges, PnlTrendChart, CashTrendChart,
// AgingDonut ×2, BalanceSheetCompositionChart). All money stays paise until the
// charts' own data maps. Guarded on wsId && firmId; silent-but-recoverable on error.
import { useEffect, useState, startTransition } from 'react';
import { Skeleton, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import DsCard from '@/components/ui/DsCard';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { RatioGauges } from './RatioGauges';
import { PnlTrendChart } from './PnlTrendChart';
import { CashTrendChart } from './CashTrendChart';
import { AgingDonut } from './AgingDonut';
import { BalanceSheetCompositionChart } from './BalanceSheetCompositionChart';
import type { AccountingDashboardResponse } from '@/types';

interface Props {
  wsId: string;
  firmId: string;
}

// Shared section-label style (matches the "Quick Access" label on the finance page).
const SECTION_LABEL: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--cr-text-3)',
  display: 'block',
  marginBottom: 12,
};

export function AccountingInsights({ wsId, firmId }: Props) {
  const [data, setData] = useState<AccountingDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Retry counter: incrementing it re-runs the fetch effect. Kept out of the
  // effect's setState path so the lint rule (no synchronous setState in effect)
  // is satisfied — the effect owns all setState calls, the button just bumps a dep.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!wsId || !firmId) return;
    let active = true;
    // startTransition keeps the synchronous loading/error reset out of the
    // effect's render-blocking path (mirrors app/dashboard/finance/page.tsx and
    // satisfies the react-hooks/set-state-in-effect rule).
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    financeReportsApi
      .accountingDashboard(wsId, firmId)
      .then((res) => {
        if (active) setData(res);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [wsId, firmId, reloadKey]);

  return (
    <div>
      <span style={SECTION_LABEL}>Accounting Insights</span>

      {loading && (
        <DsCard>
          <Skeleton active paragraph={{ rows: 6 }} />
        </DsCard>
      )}

      {!loading && error && (
        <DsCard>
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <p style={{ margin: '0 0 12px', color: 'var(--cr-text-3)', fontSize: 13 }}>
              Couldn&apos;t load accounting insights.
            </p>
            <Button icon={<ReloadOutlined />} onClick={() => setReloadKey((k) => k + 1)}>
              Retry
            </Button>
          </div>
        </DsCard>
      )}

      {!loading && !error && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Ratios span full width as the headline KPI row. */}
          <RatioGauges ratios={data.ratios} />

          {/* Responsive 1-col (mobile) / 2-col (md+) grid for the charts. */}
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}
            className="md:grid-cols-2"
          >
            <PnlTrendChart data={data.pnlTrend} />
            <CashTrendChart data={data.cashTrend} />
            <AgingDonut summary={data.receivablesAging.summary} title="Receivables Aging" />
            <AgingDonut summary={data.payablesAging.summary} title="Payables Aging" />
            <BalanceSheetCompositionChart data={data.balanceSheet} />
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountingInsights;
