// Route loading skeleton for the machines resource-scopes list.
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors resource-scopes/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="list" />;
}
