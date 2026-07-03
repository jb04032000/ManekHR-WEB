// Route folded into the unified tabbed attendance Reports page.
import { redirect } from 'next/navigation';

export default function PatternsReportRedirect() {
  redirect('/dashboard/attendance/reports?tab=patterns');
}
