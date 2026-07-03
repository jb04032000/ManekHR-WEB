// Route loading skeleton for the Party Statement report. Server-only per the binding
// loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function PartyStatementLoading() {
  return <ListPageSkeleton filters={2} />;
}
