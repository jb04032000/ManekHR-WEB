// Co-located loading skeleton for the loans list route (header + loan card grid).
// Mirrors the real page via the shared ListPageSkeleton, per the binding loading.tsx rule.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={0} rows={6} />;
}
