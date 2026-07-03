'use client';

/**
 * useLogout - the ONE correct sign-out teardown, shared by every logout entry
 * point (TopHeader, AdminLayout, LockOverlay sign-out, setup-workspace cancel).
 *
 * Why this exists: a naive "clear auth state, then `router.replace('/auth')`"
 * caused an error storm on every logout. `QueryProvider` lives in the root
 * layout, so a SOFT navigation keeps the authenticated tree (DashboardLayout +
 * NotificationProvider + every data hook + the app-lock heartbeat) mounted
 * during the transition. Clearing state there made the still-mounted queries
 * refetch with no token; each 401 hit the browser client interceptor
 * (lib/api/client.ts), which tried to refresh (no cookie left -> fail) and then
 * hard-redirected + logged - once per request, doubled by `retry: 1`.
 *
 * The fix has two halves, both owned here:
 *  - `beginLogout()` flips the API client into "logging out" mode so a 401 in
 *    the teardown window rejects quietly (no refresh/redirect/log).
 *  - A HARD navigation (`window.location.assign`) tears the whole authed tree
 *    down in one shot (no soft-transition refetch window) and gives /auth a
 *    clean JS context - which also discards the in-memory React Query cache, so
 *    the prior account's data can't survive into a re-login (the old
 *    `queryClient.clear()` security goal, now met by the reload itself).
 *
 * Cross-module: lib/api/client.ts (`beginLogout`), lib/actions auth `logout` +
 * `clearAuthCookie`, the auth/workspace/subscription Zustand stores. Keep in
 * sync with the browser interceptor's `isLoggingOut` guard.
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore, useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { logout as logoutAction } from '@/lib/actions';
import { clearAuthCookie } from '@/lib/actions/cookies';
import { beginLogout } from '@/lib/api/client';

export function useLogout(): () => Promise<void> {
  const storeLogout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();

  return useCallback(async () => {
    // 1. Silence the browser client's 401 amplifier for the teardown window. The
    //    hard reload at the end resets the flag (fresh module on the new page).
    beginLogout();
    // Abort in-flight queries so React Query stops retrying them into 401s while
    // the tree is being torn down (the reload below discards the cache entirely).
    void queryClient.cancelQueries();

    // 2. Revoke the session server-side (denylist via the httpOnly refresh
    //    cookie + BE-side cookie clear) with a tiny retry budget. The user can't
    //    retry logout, so we retry transient failures ourselves. 401 is
    //    non-retryable (token already dead); the BE self-heals the orphan row at
    //    next login. Best-effort: a failure must never strand the teardown.
    const attempts = [0, 100, 200];
    for (let i = 0; i < attempts.length; i++) {
      if (attempts[i] > 0) {
        await new Promise((r) => setTimeout(r, attempts[i]));
      }
      try {
        await logoutAction();
        break;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) break; // dead token - retry won't help
        if (i === attempts.length - 1) break; // budget exhausted
      }
    }

    // 3. Guaranteed local cookie clear, independent of BE health: the BE-side
    //    clear above only runs when the denylist call succeeds, so this is what
    //    makes logout work even when the backend is down (otherwise a still-valid
    //    access cookie would let the proxy bounce /auth straight back in).
    try {
      await clearAuthCookie();
    } catch {
      // Server-action cookie clear can fail if the BE is down; land on /auth anyway.
    }

    // 4. Clear persisted client state so the post-reload rehydrate starts signed
    //    out. `clearWorkspace` / `clearSubscription` are no-ops for shells that
    //    have neither (admin / onboarding), which is fine.
    try {
      storeLogout();
      useWorkspaceStore.getState().clearWorkspace();
      useSubscriptionStore.getState().clearSubscription();
    } catch {
      // store mutations never throw - defensive only
    }

    // 5. HARD navigation, called synchronously right after the store clear (no
    //    await in between) so the browser starts unloading before React can
    //    commit the `user === null` re-render whose layout guards would fire a
    //    competing soft `router.replace('/auth')`. Full document load => the
    //    whole authed tree unmounts at once and /auth boots clean.
    if (typeof window !== 'undefined') {
      window.location.assign('/auth');
    }
  }, [storeLogout, queryClient]);
}
