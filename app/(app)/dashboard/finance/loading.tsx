// Suspense-level skeleton for the Billing & Accounts dashboard route.
// Server Component (no 'use client'). Shown on navigation into /dashboard/finance
// before the client page mounts; the page reuses the same skeleton for its
// data-fetch state so the loading frame is seamless.
import { FinanceDashboardSkeleton } from '@/components/finance/FinanceDashboardSkeleton';

export default function FinanceDashboardLoading() {
  return <FinanceDashboardSkeleton />;
}
