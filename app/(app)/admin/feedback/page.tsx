import type { Metadata } from 'next';
import { listFeedback } from '@/features/admin/feedback/feedback.actions';
import AdminFeedbackConsole from '@/features/admin/feedback/AdminFeedbackConsole';

// /admin/feedback - read user feedback (message, mood, scope, photos, context)
// and set status. Guarded by AdminLayout (client redirect) + IsAdminGuard (BE).
// Backed by admin/feedback (feedback-admin.controller.ts). Static shell that
// pre-fetches the first page; the client console owns filters + status updates.
export const metadata: Metadata = { title: 'Feedback' };

export default async function AdminFeedbackPage() {
  const res = await listFeedback({ page: 1, limit: 20 });
  const initial = res.ok
    ? { items: res.data.items, total: res.data.total }
    : { items: [], total: 0 };
  return (
    <div>
      <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
          Feedback
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cr-text-3)' }}>
          User feedback across the app — with photos, page and device context. Set status to track
          it.
        </p>
      </header>
      <AdminFeedbackConsole initial={initial} />
    </div>
  );
}
