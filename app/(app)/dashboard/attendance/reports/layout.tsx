import type { ReactNode } from 'react';
import type { Metadata } from 'next';

/**
 * Layout for the tabbed Attendance Reports page.
 *
 * `page.tsx` is a 'use client' component (it calls useSearchParams to seed
 * the active tab from the ?tab= deep-link param) and therefore cannot export
 * `metadata` itself - Next.js requires metadata to be exported from a Server
 * Component. This layout is that Server Component.
 *
 * The title template ('%s | ManekHR') is set by the root dashboard layout,
 * so we only supply the leaf title here.
 */
export const metadata: Metadata = {
  title: 'Attendance Reports',
  description:
    'Overtime analytics, attendance compliance, and absence-pattern reports for your workspace.',
  openGraph: {
    title: 'Attendance Reports - ManekHR',
    description:
      'Overtime analytics, attendance compliance, and absence-pattern reports for your workspace.',
  },
};

export default function AttendanceReportsLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
