import type { Metadata } from 'next';
import ConnectEntitlementsManager from '@/features/connect/admin/entitlements/ConnectEntitlementsManager';

/**
 * /admin/connect/entitlements - per-user Connect custom limits console.
 *
 * Guarded by AdminLayout (client isAdmin redirect) + the backend IsAdminGuard on
 * admin-connect-entitlements.controller.ts. Static shell; the client manager owns
 * search + data fetching. Linked from the Connect admin hub (ConnectAdminHome).
 */
export const metadata: Metadata = { title: 'Connect custom limits' };

export default function AdminConnectEntitlementsPage() {
  return (
    <div>
      <header style={{ marginBottom: 'var(--cr-space-lg)' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
          Custom limits
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--cr-text-3)' }}>
          Find a person to see their plan limits, per-user overrides, effective limits, and live
          usage side by side. Every change is audited.
        </p>
      </header>
      <ConnectEntitlementsManager />
    </div>
  );
}
