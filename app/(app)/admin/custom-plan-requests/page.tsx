import type { Metadata } from 'next';
import { listCustomPlanRequests } from '@/features/admin/custom-plan-requests/custom-plan-requests.actions';
import AdminCustomPlanConsole from '@/features/admin/custom-plan-requests/AdminCustomPlanConsole';

// /admin/custom-plan-requests - triage plan leads and set status (new -> contacted
// -> closed). Two kinds share this queue (flagged in the Type column): 'custom'
// (the tailored-plan request form) and 'plan' (a Subscribe click on a predefined
// paid plan while online payments are off). Guarded by AdminLayout (client
// redirect) + IsAdminGuard (BE). Backed by admin/custom-plan-requests
// (AdminCustomPlanRequestsController). Static shell that pre-fetches the first
// page; the client console owns the filters + status updates.
export const metadata: Metadata = { title: 'Plan Requests' };

export default async function AdminCustomPlanRequestsPage() {
  const res = await listCustomPlanRequests({ limit: 100, offset: 0 });
  const initial = res.ok
    ? { items: res.data.items, total: res.data.total }
    : { items: [], total: 0 };
  return (
    <div>
      <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
          Plan Requests
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cr-text-3)' }}>
          Leads from the plans page: custom-plan enquiries and Subscribe clicks on a paid plan
          (while online payments are off). Call them on the mobile they shared, then set status to
          track follow-up.
        </p>
      </header>
      <AdminCustomPlanConsole initial={initial} />
    </div>
  );
}
