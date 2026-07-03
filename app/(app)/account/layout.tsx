import type { Metadata } from 'next';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { AccountShell } from '@/components/account/AccountShell';

export const metadata: Metadata = {
  title: { template: '%s | ManekHR', default: 'Account' },
  description: 'Manage your ManekHR account settings.',
};

/**
 * Account-level layout - `/account/*` is product-neutral, hosting Profile,
 * Security, Billing and Devices. Renders the universal `DashboardLayout` in
 * `account` mode so:
 *  - the product sidebar (Connect / ERP) is hidden - `AccountShell` provides
 *    its own sub-nav inside the content;
 *  - no ERP `PolicyGate` runs (account is not gated by either product's
 *    terms - those are enforced when the user enters the product itself);
 *  - App Lock (Quick PIN) is NOT applied here. The account area is product-
 *    neutral (shared by ERP and Connect-only users), and App Lock is an ERP-
 *    only protection for payroll / finance / staff. Enforcing it here
 *    PIN-walled the shared profile page for Connect-only users (who have no
 *    PIN) and force-pushed them into PIN setup. The standard signed-in auth
 *    check still applies; the lock/PIN does not (see DashboardLayout
 *    `appLockEnabled = mode === 'erp'`, and the @SkipPinUnlock'd account
 *    endpoints on the backend).
 *
 * History: account pages originally lived under `/dashboard/settings/*`
 * which leaked the ERP shell + ERP policy gate for Connect-only users.
 * Moved to `/account/*` so the surface is genuinely neutral; the old paths
 * 301 to the new ones via `next.config.ts` so bookmarks keep working.
 */
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout mode="account">
      <AccountShell>{children}</AccountShell>
    </DashboardLayout>
  );
}
