// Route loading skeleton for the Recycle Bin page (header + tabs + table).
// Mirrors recycle-bin/page.tsx via the shared finance ListPageSkeleton; the tab bar
// stands in for the filter row (filters=1). Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function RecycleBinLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={1} />
    </div>
  );
}
