// Route loading skeleton for the Sale Orders list (3 filters: date range, party, status).
// Server-only per the binding
// loading.tsx rule. Cross-link: app/.../sales/orders/page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function OrdersLoading() {
  return <ListPageSkeleton filters={3} />;
}
