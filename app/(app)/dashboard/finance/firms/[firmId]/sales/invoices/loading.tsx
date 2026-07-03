// Route loading skeleton for the Tax Invoices list (5 filters). Server-only per the binding
// loading.tsx rule. Cross-link: app/.../sales/invoices/page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function InvoicesLoading() {
  return <ListPageSkeleton filters={5} />;
}
