import type { ReactNode } from 'react';
import { SalaryWorkspaceNav } from './components/salary/SalaryWorkspaceNav';

export default function SalaryLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <SalaryWorkspaceNav />
      {children}
    </div>
  );
}
