import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMyPermissions } from './useMyPermissions';
import { useWorkspaceStore } from '@/lib/store';
import { usePermissionsStore } from '@/lib/stores/permissions-store';

/**
 * App-Lock fix (2026-06-20): the `/me/permissions` fetch must be GATED until the
 * session is unlocked. That endpoint is PIN-guarded; firing it during PIN setup
 * (a no-PIN user crossing Connect -> ERP) returns 423, the shared axios
 * interceptor parks the request forever, and the permissions cache sticks in
 * 'loading' so DashboardLayout's loader never clears (only a hard refresh, which
 * resets the non-persisted cache, recovered). The hook now takes `enabled`;
 * DashboardLayout passes the same readiness gate it uses for `bootstrap`. These
 * tests lock that contract so it cannot silently regress.
 */
describe('useMyPermissions - enabled gate (App-Lock 423-park prevention)', () => {
  let ensureSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ensureSpy = vi.fn().mockResolvedValue(null);
    // Empty cache + a spy `ensure` so we can assert whether a fetch is kicked off.
    usePermissionsStore.setState({ cache: {}, ensure: ensureSpy as never });
    useWorkspaceStore.setState({ currentWorkspaceId: 'ws1' });
  });

  it('does NOT fetch while disabled (PIN/lock state still unresolved)', async () => {
    renderHook(() => useMyPermissions({ enabled: false }));
    await new Promise((r) => setTimeout(r, 10));
    expect(ensureSpy).not.toHaveBeenCalled();
  });

  it('fetches once enabled with a current workspace', async () => {
    renderHook(() => useMyPermissions({ enabled: true }));
    await waitFor(() => expect(ensureSpy).toHaveBeenCalledWith('ws1'));
  });

  it('defaults to enabled (backward compatible) and fetches', async () => {
    renderHook(() => useMyPermissions());
    await waitFor(() => expect(ensureSpy).toHaveBeenCalledWith('ws1'));
  });

  it('does not fetch without a current workspace, even when enabled', async () => {
    useWorkspaceStore.setState({ currentWorkspaceId: null });
    renderHook(() => useMyPermissions({ enabled: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(ensureSpy).not.toHaveBeenCalled();
  });
});
