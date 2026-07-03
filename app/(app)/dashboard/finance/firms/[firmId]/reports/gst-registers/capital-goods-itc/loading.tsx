// Route loading skeleton for the Capital Goods ITC Schedule report. Server-only per the
// binding loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function CapitalGoodsItcLoading() {
  return <ListPageSkeleton filters={1} />;
}
