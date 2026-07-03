// Route folded into the unified tabbed attendance Reports page.
import { redirect } from 'next/navigation';

export default function OvertimeReportRedirect() {
  redirect('/dashboard/attendance/reports?tab=overtime');
}
