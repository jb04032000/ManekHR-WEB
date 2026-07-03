// Route loading skeleton for the machines list (header + filter + table).
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors machines/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="list" />;
}
