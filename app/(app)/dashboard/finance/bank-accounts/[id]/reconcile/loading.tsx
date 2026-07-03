// Co-located loading skeleton for the bank reconciliation hub route (header + KPI row + sessions).
// Mirrors the real page via the shared ListPageSkeleton, per the binding loading.tsx rule.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={4} rows={4} />;
}
