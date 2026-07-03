// Route loading skeleton for the machines locations list.
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors locations/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="list" />;
}
