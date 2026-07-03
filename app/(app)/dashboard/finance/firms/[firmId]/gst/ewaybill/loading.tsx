// Route loading skeleton for the e-Way Bills page (header + status tabs table).
// Cross-link: stands in for app/.../gst/ewaybill/page.tsx while it mounts and loads EWBs by status.
// Watch: the page leads with a header then a tabbed DsTable; the shared list skeleton mirrors it.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={2} />;
}
