// Route loading skeleton for the P&L Month-wise Comparison report. Server-only per the
// binding loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function ProfitLossComparisonLoading() {
  return <ListPageSkeleton filters={1} />;
}
