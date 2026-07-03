'use client';

// Default attendance landing - Overview is the right first impression for
// a manager opening the module (the analytics + Member Breakdown answers
// the "how are we doing" question that frames everything else). The
// marking console lives at /dashboard/attendance/mark; Live, Muster and
// all the other lenses each get their own route accessed from the
// AttendanceWorkspaceNav.
//
// Self-scoped members (Karigar / scope=self) never have org-wide view, so
// Overview is meaningless for them - they get the same MyAttendance
// surface that used to live here. Permissions resolve before any
// navigation happens so a self-scoped user never sees a redirect flash.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Skeleton } from 'antd';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { MyAttendance } from '@/components/dashboard/attendance/MyAttendance';

export default function AttendancePage() {
  const router = useRouter();
  const { canPath, data, loading } = useMyPermissions();
  // Admin console (Overview) iff the caller holds the org-wide analytics view;
  // everyone else (incl. record.view@all without analytics) gets the
  // self-service MyAttendance surface.
  const selfScoped = !!data && !data.isOwner && !canPath('attendance.analytics.view');

  // Manager / owner → Overview is the canonical landing. router.replace
  // (not push) keeps Back behaviour sane - bouncing off /attendance and
  // landing on /attendance/overview shouldn't add a history entry.
  useEffect(() => {
    if (loading || !data) return;
    if (selfScoped) return;
    router.replace('/dashboard/attendance/overview');
  }, [loading, data, selfScoped, router]);

  if (loading || !data) return <AttendanceRouteSkeleton />;
  if (selfScoped) return <MyAttendance />;
  // While the replace() above resolves, show a skeleton to avoid a blank
  // flash. The redirect typically completes within one tick.
  return <AttendanceRouteSkeleton />;
}

function AttendanceRouteSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton active paragraph={{ rows: 1 }} />
      <Skeleton active paragraph={{ rows: 8 }} />
    </div>
  );
}
