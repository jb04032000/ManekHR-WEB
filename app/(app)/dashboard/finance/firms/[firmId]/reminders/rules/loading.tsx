// Route loading skeleton for the Reminder Rules list (header + table, no filter bar).
// Mirrors rules/page.tsx via the shared finance ListPageSkeleton (filters=0).
// Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function ReminderRulesLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={0} />
    </div>
  );
}
