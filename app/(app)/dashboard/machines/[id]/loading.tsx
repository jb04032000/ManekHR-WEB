// Route loading skeleton for the machine detail page (header + KPI tiles + tabs).
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors machines/[id]/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="detail" />;
}
