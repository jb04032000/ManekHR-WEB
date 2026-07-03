import type { Metadata } from 'next';
import { listContentReports } from '@/lib/actions/content-reports.actions';
import AdminContentModeration from '@/features/connect/moderation/AdminContentModeration';

/**
 * /admin/connect/moderation - platform-admin content moderation queue.
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard.
 * Loads the open content-report queue; a read failure degrades to an empty
 * queue rather than erroring the page (mirrors the marketplace review console).
 */

export const metadata: Metadata = { title: 'Content Moderation' };

export default async function AdminConnectModerationPage() {
  const res = await listContentReports();
  const reports = res.ok ? res.data : [];

  return <AdminContentModeration reports={reports} />;
}
