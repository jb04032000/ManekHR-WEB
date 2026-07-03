// Route loading skeleton for the Chart of Accounts page (header + stat tiles +
// search/type-filter row + grouped outline table). Mirrors accounts/page.tsx via the
// shared finance ListPageSkeleton (search + type filter => filters=2).
// Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function AccountsLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={2} />
    </div>
  );
}
