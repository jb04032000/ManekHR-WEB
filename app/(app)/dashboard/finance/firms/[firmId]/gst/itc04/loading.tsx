// Route loading skeleton for the ITC-04 page (header + FY/quarter controls + 4A/4B tables).
// Cross-link: stands in for app/.../gst/itc04/page.tsx while it mounts and fetches the report.
// Watch: header has FY + quarter selects and two buttons; keep the filter count close.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Loading() {
  return <ListPageSkeleton filters={4} />;
}
