// Route loading skeleton for the Verify-My-Data page (header + scan controls + findings table).
// Cross-link: stands in for app/.../gst/verify/page.tsx while it mounts and loads the latest scan.
// Watch: the page leads with a header then severity/category filters over a findings DsTable.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={4} />;
}
