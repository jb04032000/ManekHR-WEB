import type { Metadata } from 'next';
import AdminLayout from '@/components/layout/AdminLayout';

export const metadata: Metadata = {
  title: { default: 'Admin Panel', template: '%s | Admin · ManekHR' },
  description: 'ManekHR platform administration - users, workspaces, plans, billing, and settings.',
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AdminLayout>{children}</AdminLayout>;
}
