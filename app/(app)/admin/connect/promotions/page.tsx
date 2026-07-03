import type { Metadata } from 'next';
import ConnectPromotionsConsole from '@/features/connect/promotions/ConnectPromotionsConsole';
import { listCreditDrops } from '@/features/connect/promotions/promotions-admin.actions';
import { adminListCoupons, getAdminPlans } from '@/lib/actions';

export const metadata: Metadata = { title: 'Promotions & Sales' };

/**
 * Connect promotions & sales admin (M3.2). Server component: loads the credit
 * drop history, the Connect-scoped coupons, and the Connect plan list, then
 * hands them to the client console. Each fetch degrades gracefully so one slow
 * dependency never blanks the page.
 */
export default async function AdminConnectPromotionsPage() {
  const [dropsRes, plans, couponsRes] = await Promise.all([
    listCreditDrops(),
    getAdminPlans().catch(() => []),
    adminListCoupons({ limit: 200 }).catch(() => ({ items: [], total: 0, limit: 200, offset: 0 })),
  ]);

  const drops = dropsRes.ok ? dropsRes.data : [];

  const connectPlans = (plans ?? [])
    .filter((p) => p.product === 'connect' || p.product === 'bundle')
    .map((p) => ({ _id: p._id, name: p.name, tier: p.tier }));

  const connectIds = new Set(connectPlans.map((p) => p._id));
  const coupons = (couponsRes.items ?? []).filter((c) =>
    c.applicablePlanIds.some((id) => connectIds.has(id)),
  );

  return (
    <ConnectPromotionsConsole
      initialDrops={drops}
      initialCoupons={coupons}
      connectPlans={connectPlans}
    />
  );
}
