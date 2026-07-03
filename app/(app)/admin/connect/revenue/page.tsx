import type { Metadata } from 'next';
import ConnectRevenueDashboard from '@/features/connect/revenue/ConnectRevenueDashboard';
import { getConnectRevenue } from '@/features/connect/revenue/revenue-admin.actions';
import { getAdRevenue } from '@/features/connect/ads/ads-admin.actions';

export const metadata: Metadata = { title: 'Connect Revenue' };

/**
 * Connect revenue dashboard (M3.3). Server component: loads subscription
 * revenue + boost spend in parallel and hands them to the client dashboard.
 * Each fetch degrades gracefully so one slow source never blanks the page.
 */
export default async function AdminConnectRevenuePage() {
  const [revenueRes, adRevenueRes] = await Promise.all([getConnectRevenue(), getAdRevenue()]);

  const revenue = revenueRes.ok ? revenueRes.data : null;
  const boostCreditsSpent = adRevenueRes.ok ? adRevenueRes.data.revenue : 0;

  return <ConnectRevenueDashboard revenue={revenue} boostCreditsSpent={boostCreditsSpent} />;
}
