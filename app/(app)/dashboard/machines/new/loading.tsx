// Route loading skeleton for the create-machine form.
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors machines/new/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="form" />;
}
