import { ReactNode } from 'react';

interface SalesLayoutProps {
  children: ReactNode;
  params: Promise<{ firmId: string }>;
}

// Pass-through layout - future waves add breadcrumb / tab nav here.
export default function SalesLayout({ children }: SalesLayoutProps) {
  return <div className="space-y-4">{children}</div>;
}
