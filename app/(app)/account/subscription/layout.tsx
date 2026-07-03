import { SubscriptionNavTabs } from '@/components/subscription/SubscriptionNavTabs';

/**
 * Layout for the account Subscription hub. Renders the tab bar (client
 * component, handles usePathname/useRouter/useTranslations) then the active
 * tab's page as children. Kept as a Server Component so the routing shell does
 * not introduce a `'use client'` layout boundary — that boundary pattern can
 * cause Next.js 16's SSR recovery to render DashboardLayout without the
 * NextIntlClientProvider context, surfacing a spurious "context not found"
 * error overlay.
 *
 * The tab pages were relocated here from `/dashboard/subscription/*` (ERP-gated);
 * old links 301 here via next.config. Cross-module links: each tab is its own
 * page under app/account/subscription/*; the Overview tab is the index page.
 * Tab keys must stay in sync with the route folder names in SubscriptionNavTabs.
 */
export default function AccountSubscriptionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubscriptionNavTabs />
      <div className="animate-fade-in mt-4">{children}</div>
    </div>
  );
}
