// Muster register is now an embedded view on Overview (Member Breakdown
// → "Register" tab), so the standalone /grid route was retired. Old
// bookmarks land on Overview where the same content is reachable via the
// view toggle.

import { redirect } from 'next/navigation';

export default function LegacyGridPage() {
  redirect('/dashboard/attendance/overview');
}
