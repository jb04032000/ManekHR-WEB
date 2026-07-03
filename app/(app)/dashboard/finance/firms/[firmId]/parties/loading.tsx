// Route loading skeleton for the Parties list (header + 2 filter chips + table).
// Mirrors parties/page.tsx layout via the shared finance ListPageSkeleton (segment +
// GSTIN filters => filters=2). Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function PartiesLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={2} />
    </div>
  );
}
