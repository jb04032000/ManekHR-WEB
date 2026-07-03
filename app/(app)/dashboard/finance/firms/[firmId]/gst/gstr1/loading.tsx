// Route loading skeleton for the GSTR-1 page (header + period/export controls + section table).
// Cross-link: stands in for app/.../gst/gstr1/page.tsx while it mounts and fetches via gst.actions.
// Watch: keep the filter count roughly aligned with the header controls (period + 2 buttons).
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={3} />;
}
