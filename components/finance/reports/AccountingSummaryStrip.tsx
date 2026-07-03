'use client';
// AccountingSummaryStrip — compact accounting KPI strip for the MAIN workforce
// dashboard (app/dashboard/page.tsx). Self-contained + permission-safe:
//   1. gated by the 'finance' entitlement (useFeatureAccess) — renders nothing
//      while loading or when the module is locked, so non-finance users never
//      see it or trigger a 403;
//   2. resolves the firm via getCurrentFirm (returns null on lock/failure) and
//      bails out if there's no firm;
//   3. fetches the LIGHT dashboardKpis endpoint (NOT the full accounting
//      dashboard) and shows 4 compact tiles linking to /dashboard/finance.
// Cross-module: mirrors the finance dashboard's KpiDashboard but trimmed to the
// 4 headline figures. Keep KPI keys in sync with DashboardKpiResponse.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DsStatCard } from '@/components/ui/DsCard';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { getCurrentFirm } from '@/lib/actions/finance.actions';
import { financeReportsApi } from '@/lib/api/modules/finance-reports.api';
import { fmtPaiseCompact } from '@/lib/utils';
import type { DashboardKpiResponse, Firm } from '@/types';

interface Props {
  wsId: string;
}

export function AccountingSummaryStrip({ wsId }: Props) {
  const finance = useFeatureAccess('finance');
  const [firm, setFirm] = useState<Firm | null>(null);
  const [kpis, setKpis] = useState<DashboardKpiResponse | null>(null);

  // Only resolve the firm + fetch KPIs once finance is unlocked. The guards below
  // mean this effect no-ops (and the component renders null) for locked/loading
  // entitlements, so a user without finance never fires a finance request.
  const unlocked = !finance.isLoading && !finance.isLocked;

  useEffect(() => {
    if (!wsId || !unlocked) return;
    let active = true;
    getCurrentFirm(wsId)
      .then((f) => {
        if (!active) return;
        setFirm(f ?? null);
        if (f) {
          financeReportsApi
            .dashboardKpis(wsId, f._id)
            .then((d) => {
              if (active) setKpis(d);
            })
            .catch(() => {}); // silent — strip simply stays hidden on failure
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [wsId, unlocked]);

  // Permission-safe render gates: hide entirely unless finance is unlocked, a firm
  // exists, and KPIs have loaded. Never errors for non-finance users.
  if (!unlocked || !firm || !kpis) return null;

  const tiles: Array<{
    label: string;
    value: string;
    gradient: 'blue' | 'amber' | 'red' | 'green';
  }> = [
    { label: 'Revenue (MTD)', value: fmtPaiseCompact(kpis.revenue.valuePaise), gradient: 'blue' },
    {
      label: 'Receivables',
      value: fmtPaiseCompact(kpis.outstanding.valuePaise),
      gradient: 'amber',
    },
    { label: 'Payables', value: fmtPaiseCompact(kpis.payables.valuePaise), gradient: 'red' },
    {
      label: 'Cash Position',
      value: fmtPaiseCompact(kpis.cashPosition.valuePaise),
      gradient: 'green',
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--cr-text-3)',
          }}
        >
          Accounts at a glance
        </span>
        <Link
          href="/dashboard/finance"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-primary)' }}
        >
          View accounts →
        </Link>
      </div>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}
        className="md:grid-cols-4"
      >
        {tiles.map((t) => (
          <Link key={t.label} href="/dashboard/finance" style={{ textDecoration: 'none' }}>
            <DsStatCard label={t.label} value={t.value} gradient={t.gradient} />
          </Link>
        ))}
      </div>
    </div>
  );
}

export default AccountingSummaryStrip;
