// Route loading skeleton for the Godown-wise Stock report. Server-only per the binding
// loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function GodownStockLoading() {
  return <ListPageSkeleton filters={1} />;
}
