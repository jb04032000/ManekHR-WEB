// Co-located loading skeleton for this finance list route (header + table). Mirrors the
// real page via the shared ListPageSkeleton, per the binding loading.tsx rule.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={0} />;
}
