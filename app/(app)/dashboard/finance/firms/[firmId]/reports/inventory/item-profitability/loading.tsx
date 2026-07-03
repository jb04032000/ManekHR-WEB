// Route loading skeleton for the Item-wise Profitability report. Server-only per the
// binding loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function ItemProfitabilityLoading() {
  return <ListPageSkeleton filters={1} />;
}
