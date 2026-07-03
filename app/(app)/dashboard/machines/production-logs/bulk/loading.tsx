// Route loading skeleton for the bulk production-log entry page (grid of shifts).
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors production-logs/bulk/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="list" />;
}
