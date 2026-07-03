import type { Metadata } from 'next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import PolicyGate from '@/components/policy/PolicyGate';
import { getErpEntryState } from '@/features/policy/policy.actions';

export const metadata: Metadata = {
  title: { template: '%s | ManekHR', default: 'Dashboard' },
  description: 'ManekHR - manage your crew, attendance, payroll and operations in one place.',
};

/**
 * ERP shell layout - the single chokepoint for every authenticated
 * `/dashboard/*` route. A user who has not accepted the ERP policy is held at
 * the full-screen `PolicyGate` before any ERP page renders.
 *
 * The gate FAILS OPEN: any error (App-Locked 423, signed-out 401, backend
 * unreachable) renders the shell and lets ERP's own client-side App-Lock /
 * auth handling take over - a transient policy-check failure must not
 * white-screen the whole ERP. The gate blocks ONLY on a clean backend
 * response that explicitly says the ERP policy is unaccepted.
 * See docs/connect/specs/2026-05-19-dual-policy-design.md §4.3.
 */
export default async function Layout({ children }: { children: React.ReactNode }) {
  const res = await getErpEntryState();
  if (res.ok && res.data.erpPolicyAccepted === false) {
    return <PolicyGate product="erp" />;
  }
  return <DashboardLayout mode="erp">{children}</DashboardLayout>;
}
