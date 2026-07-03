// Route loading skeleton for the party ledger page (back link + title + ledger table).
// Mirrors ledger/page.tsx layout via the shared finance ListPageSkeleton (no filter bar
// on this page, so filters=0). Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function PartyLedgerLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={0} />
    </div>
  );
}
