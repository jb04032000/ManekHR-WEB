// Co-located loading skeleton for the expenses list route (header + 2 filters + table).
// Mirrors the real page via the shared ListPageSkeleton, per the binding loading.tsx rule.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={2} />;
}
