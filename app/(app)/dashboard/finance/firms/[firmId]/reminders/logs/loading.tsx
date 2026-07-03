// Route loading skeleton for the Reminder Logs list (header + 3 filters + table).
// Mirrors logs/page.tsx (date range + channel + status filters => filters=3) via the
// shared finance ListPageSkeleton. Cross-link: components/finance/ListPageSkeleton.tsx.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function ReminderLogsLoading() {
  return (
    <div style={{ padding: 24 }}>
      <ListPageSkeleton filters={3} />
    </div>
  );
}
