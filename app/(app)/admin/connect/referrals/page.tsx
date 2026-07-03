import type { Metadata } from 'next';
import { getReferralConfig, listReferrals } from '@/features/connect/referrals/referrals.actions';
import AdminReferralEditor from '@/features/connect/referrals/AdminReferralEditor';
import ReferralLogTable from '@/features/connect/referrals/ReferralLogTable';

/**
 * /admin/connect/referrals - platform-admin referral program console.
 *
 * What: lets the platform admin tune the referral program levers (AdminReferralEditor)
 *   and browse / clawback the full referral log (ReferralLogTable).
 *
 * Cross-module links:
 *   - getReferralConfig -> GET /admin/connect/referrals/config (referral-admin.controller.ts)
 *   - listReferrals    -> GET /admin/connect/referrals (referral-admin.controller.ts)
 *   - Guarded by AdminLayout's client-side isAdmin redirect + backend IsAdminGuard on each
 *     endpoint -- no second auth layer needed here.
 *
 * Watch: any read failure degrades gracefully (null config hides the editor; empty log
 *   shows an empty table). Never throws on data errors.
 */

export const metadata: Metadata = { title: 'Referrals' };

export default async function AdminConnectReferralsPage() {
  const [configRes, logRes] = await Promise.all([
    getReferralConfig(),
    listReferrals({ page: 1, pageSize: 20 }),
  ]);

  // Null when the read fails; the editor section hides itself gracefully.
  const config = configRes.ok ? configRes.data : null;
  const initialPage = logRes.ok ? logRes.data : { items: [], total: 0 };

  return (
    <div className="flex flex-col gap-8">
      {config ? (
        <AdminReferralEditor initial={config} />
      ) : (
        <p className="text-sm text-muted">Could not load referral config. Try refreshing.</p>
      )}
      <ReferralLogTable initialPage={initialPage} />
    </div>
  );
}
