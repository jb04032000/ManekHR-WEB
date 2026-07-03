import { create } from 'zustand';
import { meApi } from '@/lib/api/modules/me.api';
import type {
  MyPermissionsResponse,
  MyPermissionRow,
  PermissionScope,
} from '@/lib/api/modules/me.api';

/**
 * Wave 1+2 RBAC - per-workspace permission cache.
 *
 * Lazily fetches `GET /workspaces/:wsId/me/permissions` once per workspace
 * and caches the response. Workspace switch invalidates by workspaceId.
 * Owners short-circuit to `isOwner: true` server-side; the empty
 * `permissions[]` is intentional - the consuming `<Can>` component handles
 * the owner case explicitly (always grants).
 *
 * Why a custom store instead of TanStack Query / SWR? The web app uses
 * Zustand throughout (auth / workspace / subscription stores) and adding a
 * second data-fetching paradigm for one endpoint isn't worth the bundle
 * cost or developer overhead.
 */

type CacheEntry =
  | { status: 'loading'; data: null; error: null; promise: Promise<void>; fetchedAt: null }
  | {
      status: 'loaded';
      data: MyPermissionsResponse;
      error: null;
      promise: null;
      /** Wall-clock ms of the fetch that produced `data`. Used by
       *  `revalidate` to skip thundering-herd refetches under the freshness
       *  window. */
      fetchedAt: number;
    }
  | { status: 'error'; data: null; error: string; promise: null; fetchedAt: null };

/** Skip background revalidation if the cached entry was fetched within this
 *  window. Tuned for "user alt-tabs in/out" - we want freshness on real
 *  returns but no thundering herd on every focus event. */
const REVALIDATE_FRESHNESS_MS = 30_000;

interface PermissionsState {
  cache: Record<string, CacheEntry>;
  /**
   * Phase 2.3 - per-workspace last-seen `X-Permission-Version` value.
   * Populated after a successful `ensure()` fetch (from the
   * `data.permissionVersion` field) and updated by the API-client response
   * interceptor on every subsequent workspace-scoped response header.
   */
  lastSeenVersion: Record<string, string>;
  /**
   * Fetch + cache permissions for a workspace. Returns the cached entry
   * synchronously when available; otherwise kicks off a fetch and returns
   * the in-flight loading entry. Callers re-render via Zustand subscription.
   */
  ensure: (workspaceId: string) => Promise<MyPermissionsResponse | null>;
  /**
   * Stale-while-revalidate refresh. Unlike `invalidate`, this keeps the
   * current `data` visible while a background fetch swaps it in. Skips the
   * network call if the cached entry is fresh (within
   * `REVALIDATE_FRESHNESS_MS`). Use for opportunistic refreshes (window
   * focus, route navigation) - anywhere you want freshness without a
   * loading-state flash.
   */
  revalidate: (workspaceId: string) => Promise<void>;
  /**
   * Hard refresh - clears the cache entry so the next `ensure` re-fetches
   * from scratch. Use after a destructive change that may have removed the
   * caller's access (workspace switch, role revocation).
   */
  invalidate: (workspaceId: string) => void;
  invalidateAll: () => void;
  /**
   * Phase 2.3 - called by the API-client response interceptor and the
   * TopHeader notification handler whenever a new `X-Permission-Version` value
   * arrives for a workspace. Compares against `lastSeenVersion[workspaceId]`:
   *
   * - Same version → no-op (idempotent; no spurious refetches).
   * - First time seen (no prior version) → records the version, no invalidate
   *   (the initial `ensure()` fetch already reflected the server state).
   * - Changed version → records the new version and calls `invalidate(wsId)`
   *   so the next `ensure()` re-fetches with the updated permissions.
   */
  noticeVersion: (workspaceId: string, version: string) => void;
}

// 2026-05-22: prevents an infinite invalidate + refetch + re-render loop when
// the BE permission-version hash drifts on the same underlying data (mostly
// happens on freshly-invited members whose role doc has legacy fields that
// hash differently across endpoints). We rate-limit invalidate via
// noticeVersion to once per 30s. The cache still invalidates on genuine
// permission edits (the dispatcher pushes a notification that the FE catches
// independently), this only blocks the heartbeat-header-driven loop.
const NOTICE_INVALIDATE_MIN_INTERVAL_MS = 30_000;
const lastInvalidateAt: Record<string, number> = {};

// TEMP DIAG (2026-05-22): pinpoint the continuous /me/permissions refetch
// loop reported in invited (non-owner) workspaces. Static analysis shows every
// store path is bounded (30s rate-limit, 30s freshness, module-Set dedup,
// stale-while-revalidate), so we instrument the live session to name the
// looping path unambiguously. Prod-safe: silent unless the operator opts in
// per-session via `localStorage.z360_perm_diag = '1'` then a hard reload.
// Each line carries a monotonic seq + ms-since-previous so a tight loop is
// obvious. REMOVE once the root cause is confirmed.
let __permDiagSeq = 0;
let __permDiagLast = 0;
function permDiag(label: string, detail?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || typeof console === 'undefined') return;
  try {
    if (window.localStorage?.getItem('z360_perm_diag') !== '1') return;
  } catch {
    return;
  }
  const now = Date.now();
  const delta = __permDiagLast ? now - __permDiagLast : 0;
  __permDiagLast = now;
  console.info(`[PERMDIAG #${(__permDiagSeq += 1)} +${delta}ms] ${label}`, detail ?? '');
}

export const usePermissionsStore = create<PermissionsState>((set, get) => ({
  cache: {},
  lastSeenVersion: {},

  noticeVersion: (workspaceId: string, version: string) => {
    const cur = get().lastSeenVersion[workspaceId];
    permDiag('noticeVersion:enter', {
      ws: workspaceId,
      cur,
      next: version,
      equal: cur === version,
    });
    if (cur === version) return; // unchanged - no-op

    // Record the new version first.
    set((state) => ({
      lastSeenVersion: { ...state.lastSeenVersion, [workspaceId]: version },
    }));

    // If we previously had a version and it changed, invalidate the cache so
    // the next `ensure()` call re-fetches updated permissions. Rate-limited
    // so a runaway BE hash drift cannot trigger an invalidate + refetch +
    // re-render storm.
    if (cur !== undefined && cur !== version) {
      const last = lastInvalidateAt[workspaceId] ?? 0;
      const now = Date.now();
      if (now - last < NOTICE_INVALIDATE_MIN_INTERVAL_MS) {
        permDiag('noticeVersion:drift-RATE-LIMITED', {
          ws: workspaceId,
          prev: cur,
          next: version,
          sinceLastInvalidateMs: now - last,
        });
        if (typeof console !== 'undefined') {
          console.warn(
            `[permissions-store] noticeVersion drift suppressed (rate-limit). ` +
              `workspace=${workspaceId} prev=${cur} next=${version}`,
          );
        }
        return;
      }
      permDiag('noticeVersion:drift-INVALIDATE', { ws: workspaceId, prev: cur, next: version });
      lastInvalidateAt[workspaceId] = now;
      get().invalidate(workspaceId);
    }
  },

  ensure: async (workspaceId: string) => {
    const existing = get().cache[workspaceId];
    permDiag('ensure:enter', { ws: workspaceId, status: existing?.status ?? 'none' });
    if (existing?.status === 'loaded') return existing.data;
    if (existing?.status === 'loading') {
      await existing.promise;
      const after = get().cache[workspaceId];
      return after?.status === 'loaded' ? after.data : null;
    }

    permDiag('ensure:FETCH-network', { ws: workspaceId });
    const promise = meApi
      .permissions(workspaceId)
      .then((data) => {
        // Phase 2.3 - stamp lastSeenVersion from the fetch response so the
        // first call's version is recorded. Subsequent API responses update it
        // via the axios response interceptor's header read.
        if (data.permissionVersion) {
          set((state) => ({
            lastSeenVersion: {
              ...state.lastSeenVersion,
              [workspaceId]: data.permissionVersion!,
            },
          }));
        }
        set((state) => ({
          cache: {
            ...state.cache,
            [workspaceId]: {
              status: 'loaded',
              data,
              error: null,
              promise: null,
              fetchedAt: Date.now(),
            },
          },
        }));
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unknown error';
        set((state) => ({
          cache: {
            ...state.cache,
            [workspaceId]: {
              status: 'error',
              data: null,
              error: message,
              promise: null,
              fetchedAt: null,
            },
          },
        }));
      });

    set((state) => ({
      cache: {
        ...state.cache,
        [workspaceId]: {
          status: 'loading',
          data: null,
          error: null,
          promise,
          fetchedAt: null,
        },
      },
    }));

    await promise;
    const after = get().cache[workspaceId];
    return after?.status === 'loaded' ? after.data : null;
  },

  revalidate: async (workspaceId: string) => {
    const existing = get().cache[workspaceId];
    permDiag('revalidate:enter', {
      ws: workspaceId,
      status: existing?.status ?? 'none',
      ageMs: existing?.status === 'loaded' ? Date.now() - existing.fetchedAt : null,
    });
    // No cache yet → defer to `ensure`, which surfaces a loading state.
    if (!existing)
      return get()
        .ensure(workspaceId)
        .then(() => undefined);
    // Fetch in flight → reuse it; don't duplicate the network call.
    if (existing.status === 'loading') return existing.promise;
    // Freshness window - skip the network call. Avoids thundering-herd
    // refetches on rapid focus events (Alt-Tab, devtools open, HMR).
    if (existing.status === 'loaded' && Date.now() - existing.fetchedAt < REVALIDATE_FRESHNESS_MS) {
      permDiag('revalidate:fresh-skip', { ws: workspaceId });
      return;
    }
    permDiag('revalidate:FETCH-network', { ws: workspaceId });
    // Background fetch - keep current data visible until the new one
    // arrives (stale-while-revalidate). Note: we deliberately do NOT
    // toggle status to 'loading' here, so consumers don't render a
    // loading-state flash mid-session.
    try {
      const data = await meApi.permissions(workspaceId);
      set((state) => ({
        cache: {
          ...state.cache,
          [workspaceId]: {
            status: 'loaded',
            data,
            error: null,
            promise: null,
            fetchedAt: Date.now(),
          },
        },
      }));
    } catch {
      // Background refetch failure is silent - the previously-loaded data
      // is still visible. A genuine error path is reserved for `ensure`,
      // which surfaces it to the dashboard error screen.
    }
  },

  invalidate: (workspaceId: string) => {
    const existing = get().cache[workspaceId];
    permDiag('invalidate:enter', { ws: workspaceId, status: existing?.status ?? 'none' });
    // Drop the recorded version so the refetch's response header is not
    // re-flagged as drift by the API-client interceptor (prevents a
    // noticeVersion → invalidate echo).
    set((state) => {
      const nextVersions = { ...state.lastSeenVersion };
      delete nextVersions[workspaceId];
      return { lastSeenVersion: nextVersions };
    });

    // No usable cached data yet → defer to `ensure`, which surfaces a single
    // loading state. There is nothing stale to keep.
    if (!existing || existing.status !== 'loaded') {
      permDiag('invalidate:defer-ensure', { ws: workspaceId });
      void get().ensure(workspaceId);
      return;
    }
    permDiag('invalidate:FETCH-network', { ws: workspaceId });

    // 2026-05-22 loop fix: STALE-WHILE-REVALIDATE. Previously invalidate
    // DELETED the cache entry outright → `permissionsData` went null →
    // DashboardLayout's `showLoader` flipped true → the whole shell (incl.
    // TopHeader) UNMOUNTED then remounted → TopHeader re-ran
    // `loadNotifications` → re-fired `invalidate` on the still-unread
    // PERMISSIONS_UPDATED notification → infinite remount loop (only members
    // with a permission-grant notification waiting). We now KEEP the loaded
    // data visible and force a background refetch; the shell never unmounts,
    // so the loop cannot form no matter how often invalidate is called. The
    // new permission set replaces the stale one in place once it arrives
    // (~one round-trip) - still effectively immediate, just no loader flash.
    void meApi
      .permissions(workspaceId)
      .then((data) => {
        set((state) => ({
          cache: {
            ...state.cache,
            [workspaceId]: {
              status: 'loaded',
              data,
              error: null,
              promise: null,
              fetchedAt: Date.now(),
            },
          },
          lastSeenVersion: data.permissionVersion
            ? { ...state.lastSeenVersion, [workspaceId]: data.permissionVersion }
            : state.lastSeenVersion,
        }));
      })
      .catch(() => {
        // Background refetch failure is silent - stale data stays visible,
        // same posture as `revalidate`. `ensure` owns the hard error path.
      });
  },

  invalidateAll: () => set({ cache: {}, lastSeenVersion: {} }),
}));

/**
 * Match logic mirroring the BE `permissionsSatisfy` helper. Required-scope
 * undefined matches any granted scope (legacy behaviour). Required `'self'`
 * accepts granted `'self'` OR `'all'` (`'all'` is a strict superset).
 */
export function permissionsMatch(
  permissions: MyPermissionRow[],
  required: { module: string; action: string; scope?: PermissionScope },
): boolean {
  return permissions.some((p) => {
    if (p.module !== required.module) return false;
    const idx = p.actions.indexOf(required.action);
    if (idx < 0) return false;
    if (!required.scope) return true;
    // Mirror the BE `permissionsSatisfy` least-privilege default: a granted
    // action with no explicit scope falls back to `'self'` (fail-closed),
    // not `'all'` (fail-open).
    const grantedScope: PermissionScope = p.actionScopes?.[idx] ?? 'self';
    if (required.scope === 'self') {
      return grantedScope === 'self' || grantedScope === 'all';
    }
    return grantedScope === 'all';
  });
}
