import type { Metadata } from 'next';
import ConnectAdminHome from '@/features/connect/admin/ConnectAdminHome';

/**
 * /admin/connect - the consolidated Connect admin hub (M3.1).
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard
 * on each linked surface. A static landing; the linked pages own their data.
 */
export const metadata: Metadata = { title: 'Connect' };

export default function AdminConnectPage() {
  return <ConnectAdminHome />;
}
