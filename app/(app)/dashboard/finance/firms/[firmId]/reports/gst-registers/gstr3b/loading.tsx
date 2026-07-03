// Route loading skeleton for the GSTR-3B Summary report. Server-only per the binding
// loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Gstr3bLoading() {
  return <ListPageSkeleton filters={1} />;
}
