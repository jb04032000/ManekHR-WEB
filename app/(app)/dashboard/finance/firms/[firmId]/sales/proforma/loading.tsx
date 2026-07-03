// Route loading skeleton for the Proforma Invoices list (3 filters: date range, party, status).
// Server-only per the
// binding loading.tsx rule. Cross-link: app/.../sales/proforma/page.tsx + ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function ProformaLoading() {
  return <ListPageSkeleton filters={3} />;
}
