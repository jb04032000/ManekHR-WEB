import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { LeaveWorkspaceNav } from '@/components/dashboard/leave/LeaveWorkspaceNav';

export const metadata: Metadata = {
  title: 'Leave',
};

export default function LeaveLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <LeaveWorkspaceNav />
      {children}
    </div>
  );
}
