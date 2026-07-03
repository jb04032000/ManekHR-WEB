// Route folded into the unified tabbed attendance Data page.
import { redirect } from 'next/navigation';

export default function StatutoryRedirect() {
  redirect('/dashboard/attendance/data?tab=statutory');
}
