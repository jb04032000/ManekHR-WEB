// Route loading skeleton for the Receivables Aging page (header + aging buckets).
// Mirrors receivables/page.tsx via the shared finance ListPageSkeleton (no filter bar =>
// filters=0). Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function ReceivablesLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={0} />
    </div>
  );
}
