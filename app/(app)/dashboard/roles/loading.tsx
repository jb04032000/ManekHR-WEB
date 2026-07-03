// Co-located loading skeleton for the Roles route (binding loading.tsx rule).
// Delegates to the shared RolesPageSkeleton (skeleton.tsx) which page.tsx also
// uses for its in-page loading states, so the two can never drift apart.
import { RolesPageSkeleton } from './skeleton';

export default function RolesLoading() {
  return <RolesPageSkeleton />;
}
