// Route folded into the unified tabbed attendance settings page.
import { redirect } from 'next/navigation';

export default function RegularizationSettingsRedirect() {
  redirect('/dashboard/attendance/settings?tab=regularization');
}
