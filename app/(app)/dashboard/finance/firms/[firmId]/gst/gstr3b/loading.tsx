// Route loading skeleton for the GSTR-3B page (header + period/recompute/save/export + summary grid).
// Cross-link: stands in for app/.../gst/gstr3b/page.tsx while it mounts and fetches the merged report.
// Watch: the header carries the period picker plus three buttons; keep the filter count close.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={4} />;
}
