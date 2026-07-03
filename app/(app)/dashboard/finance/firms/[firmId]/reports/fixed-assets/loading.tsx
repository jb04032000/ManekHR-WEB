// Route loading skeleton for the Fixed Assets report. Server-only per the binding
// loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function FixedAssetsLoading() {
  return <ListPageSkeleton filters={1} />;
}
