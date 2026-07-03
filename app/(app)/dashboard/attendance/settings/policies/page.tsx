// Route folded into the unified tabbed attendance settings page.
import { redirect } from 'next/navigation';

export default function PoliciesSettingsRedirect() {
  redirect('/dashboard/attendance/settings?tab=policies');
}
