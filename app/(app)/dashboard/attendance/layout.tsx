import type { ReactNode } from 'react';
import { AttendanceWorkspaceNav } from '@/components/dashboard/attendance/AttendanceWorkspaceNav';

export default function AttendanceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <AttendanceWorkspaceNav />
      {children}
    </div>
  );
}
