import { useEffect, useMemo } from 'react';
import { useWorkspaceStore } from '@/lib/store';
import { usePermissionsStore, permissionsMatch } from '@/lib/stores/permissions-store';
import type { MyPermissionsResponse } from '@/lib/api/modules/me.api';
import type { PermissionScope } from '@/types/rbac-registry';
import { pathGrantSatisfies } from '@/lib/rbac/path-matcher';

/**
 * Wave 1+2 RBAC - read the calling user's permissions in the current
 * workspace. Returns the cached data + a derived `can(module, action,
 * scope?)` check. Auto-fetches on mount and on workspace switch.
 *
 * Owners always see `isOwner: true` + every `can()` call returns true.
 * Loading state surfaces as `data: null` + `loading: true`; consumers
 * decide whether to render-deny-by-default or render-loading.
 */
export function useMyPermissions(options?: { enabled?: boolean }): {
  data: MyPermissionsResponse | null;
  loading: boolean;
  error: string | null;
  can: (module: string, action: string, scope?: PermissionScope) => boolean;
  canPath: (path: string, scope?: PermissionScope) => boolean;
} {
  // `enabled` (default true) lets a caller HOLD the `/me/permissions` fetch until
  // it is safe to make this workspace-scoped, PIN-guarded request. App-Lock fix
  // (2026-06-20): firing it during PIN setup - a no-PIN user crossing Connect ->
  // ERP, before they set a PIN - returns 423, which the shared axios interceptor
  // (lib/api/client.ts) PARKS indefinitely. That left the permissions-store cache
  // stuck in 'loading', so DashboardLayout's loader (which waits on
  // `permissionsData == null && !permissionsError`) never cleared - only a hard
  // refresh recovered (the store is not persisted). DashboardLayout now passes the
  // same readiness gate it uses for `bootstrap`; other callers omit the option and
  // keep the original always-on behaviour.
  const enabled = options?.enabled ?? true;
  const { currentWorkspaceId } = useWorkspaceStore();
  const cache = usePermissionsStore((s) => s.cache);
  const ensure = usePermissionsStore((s) => s.ensure);

  useEffect(() => {
    if (!enabled) return;
    if (!currentWorkspaceId) return;
    const entry = cache[currentWorkspaceId];
    if (!entry) {
      void ensure(currentWorkspaceId);
    }
  }, [enabled, currentWorkspaceId, cache, ensure]);

  // The per-workspace cache slice. A STABLE reference until that workspace's
  // entry actually changes (Zustand only swaps the slice on a real update), so
  // it is the correct memo key below.
  const entry = currentWorkspaceId ? cache[currentWorkspaceId] : undefined;

  // PERF / LOOP FIX (2026-06-14): memoize the returned shape — including the
  // `can` / `canPath` closures — so this hook hands back a STABLE identity
  // across renders until `currentWorkspaceId` or the cached `entry` changes.
  //
  // Why this matters: previously every render produced brand-new `can`/`canPath`
  // arrow functions. Any effect that listed them in its dependency array re-ran
  // on EVERY render of its component. The Sidebar's two badge effects
  // (`getUnassignedPunches` + `listPendingForMe`, deps include `canPermission`)
  // were the worst offenders — they re-fired `GET .../attendance/unassigned-punches`
  // and `GET .../regularizations/pending-for-me` on each render in a tight loop,
  // flooding the backend and keeping the app perpetually "busy" (the never-
  // settling dev compile/activity indicator). Stabilizing the identity here
  // fixes every such consumer at the source; the permission LOGIC is unchanged.
  return useMemo(() => {
    if (!currentWorkspaceId) {
      return {
        data: null,
        loading: false,
        error: null,
        can: () => false,
        canPath: () => false,
      };
    }

    if (!entry || entry.status === 'loading') {
      return {
        data: null,
        loading: true,
        error: null,
        can: () => false,
        canPath: () => false,
      };
    }

    if (entry.status === 'error') {
      return {
        data: null,
        loading: false,
        error: entry.error,
        can: () => false,
        canPath: () => false,
      };
    }

    const data = entry.data;
    return {
      data,
      loading: false,
      error: null,
      can: (module: string, action: string, scope?: PermissionScope) => {
        if (data.isOwner) return true;
        return permissionsMatch(data.permissions, { module, action, scope });
      },
      canPath: (path: string, scope?: PermissionScope) => {
        if (data.isOwner) return true;
        return pathGrantSatisfies(data.paths ?? [], { path, scope });
      },
    };
  }, [currentWorkspaceId, entry]);
}
