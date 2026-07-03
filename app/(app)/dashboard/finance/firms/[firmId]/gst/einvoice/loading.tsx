// Route loading skeleton for the e-Invoice page (header + session badge + status tabs table).
// Cross-link: stands in for app/.../gst/einvoice/page.tsx while it mounts and loads the IRP session + tabs.
// Watch: the page leads with a header + tabbed DsTable; the shared list skeleton mirrors it closely.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={2} />;
}
