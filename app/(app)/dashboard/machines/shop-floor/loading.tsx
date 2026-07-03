// Route loading skeleton for the Shop Floor control board (chips + KPI grid + tabs).
// Cross-link: components/machines/MachinesSkeleton.tsx; mirrors shop-floor/page.tsx.
import { MachinesSkeleton } from '@/components/machines/MachinesSkeleton';

export default function Loading() {
  return <MachinesSkeleton variant="board" />;
}
