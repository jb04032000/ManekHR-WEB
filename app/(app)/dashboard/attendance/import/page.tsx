// Route folded into the unified tabbed attendance Data page.
import { redirect } from 'next/navigation';

export default function ImportRedirect() {
  redirect('/dashboard/attendance/data?tab=import');
}
