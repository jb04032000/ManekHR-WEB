import type { Metadata } from 'next';
import ConnectDemoManager from '@/features/connect/admin/demo/ConnectDemoManager';

/**
 * /admin/connect/demo — manage the seeded Connect demo accounts.
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard on
 * admin-connect-demo.controller.ts. Static shell; the client manager owns the
 * list + actions.
 */
export const metadata: Metadata = { title: 'Connect demo manager' };

export default function AdminConnectDemoPage() {
  return (
    <div>
      <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
          Demo manager
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cr-text-3)' }}>
          List the seeded Connect demo accounts, post as them, and remove them (one or all) once
          real users arrive. Real accounts are never affected.
        </p>
      </header>
      <ConnectDemoManager />
    </div>
  );
}
