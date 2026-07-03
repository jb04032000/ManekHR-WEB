import { redirect } from 'next/navigation';

/**
 * `/account/billing` is folded into the unified account Subscription hub
 * (Overview + Plans + Add-Ons + Credits + Invoices + Billing Info + Payment
 * Method + Refunds + History all live as tabs under /account/subscription/*).
 * This used to be a separate "current plan + history" page that overlapped the
 * Subscription overview; it now permanently redirects there so existing
 * links/bookmarks keep working. The "Billing" left-nav item was removed
 * (see components/account/AccountShell.tsx).
 *
 * Server component: redirect() runs before any client render, so the user lands
 * straight on the hub with no flash.
 */
export default function AccountBillingRedirect() {
  redirect('/account/subscription');
}
