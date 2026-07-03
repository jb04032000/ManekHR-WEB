// Live presence was retired as a standalone surface. Today's attendance
// (plus presence buckets derivable from check-in/out times) lives on the
// Mark page's Daily view; the dedicated 90s-poll Live route added more
// chrome than value and duplicated data already accessible elsewhere.
// Preserved as a redirect for old bookmarks.

import { redirect } from 'next/navigation';

export default function LegacyLivePage() {
  redirect('/dashboard/attendance/mark');
}
