// Route loading skeleton for the Manufacturing Voucher Register report. Server-only per the
// binding loading.tsx rule. Cross-link: ./page.tsx + components/finance/ListPageSkeleton.
import { ListPageSkeleton } from '@/components/finance/ListPageSkeleton';

export default function MvRegisterLoading() {
  return <ListPageSkeleton filters={1} />;
}
