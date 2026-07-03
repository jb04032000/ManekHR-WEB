// Route loading skeleton for the GSTR-1 Output Register report. Server-only per the
// binding loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function Gstr1Loading() {
  return <ListPageSkeleton filters={1} />;
}
