// Route loading skeleton for the Delivery Challans list (3 filters: date range, party, status).
// Server-only per the
// binding loading.tsx rule. Cross-link: app/.../sales/delivery-challans/page.tsx + ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function DeliveryChallansLoading() {
  return <ListPageSkeleton filters={3} />;
}
