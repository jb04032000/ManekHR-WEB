// Route folded into the unified tabbed attendance Devices page.
import { redirect } from 'next/navigation';

export default function KioskSetupRedirect() {
  redirect('/dashboard/attendance/devices?tab=kiosk');
}
