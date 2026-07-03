// Route loading skeleton for the Quotations list (3 filters: date range, party, status).
// Server-only per the binding
// loading.tsx rule. Cross-link: app/.../sales/quotations/page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function QuotationsLoading() {
  return <ListPageSkeleton filters={3} />;
}
