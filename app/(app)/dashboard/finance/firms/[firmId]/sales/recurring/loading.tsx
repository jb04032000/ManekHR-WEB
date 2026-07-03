// Route loading skeleton for the Recurring Invoices list (2 filters). Server-only per the
// binding loading.tsx rule. Cross-link: app/.../sales/recurring/page.tsx + ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function RecurringLoading() {
  return <ListPageSkeleton filters={2} />;
}
