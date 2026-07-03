// Route loading skeleton for the Call Todos list (header + status filter + table).
// Mirrors call-todos/page.tsx (single status filter => filters=1) via the shared finance
// ListPageSkeleton. Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function CallTodosLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={1} />
    </div>
  );
}
