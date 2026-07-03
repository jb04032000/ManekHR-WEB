'use client';

/**
 * Shared client hook for the Connect usage roll-up (GET /me/connect/usage).
 *
 * Why this exists: a single manage page can mount several usage consumers at
 * once - an OverLimitBanner plus a header UsageMeter plus (on the profile) the
 * full ConnectLimitsCard. Without sharing, each would fire its own request. This
 * hook gives ONE fetch per page: concurrent callers share the in-flight promise,
 * and the result is cached for a short TTL so a tab-switch or a remount on the
 * same page reuses it instead of refetching.
 *
 * Cross-module links:
 *  - data source: features/connect/usage.actions.ts (getConnectUsage server action)
 *  - consumers: components/connect/ConnectUsageMeter.tsx,
 *    components/connect/OverLimitBanner.tsx,
 *    components/connect/ConnectLimitsCard.tsx
 *
 * Watch: the cache is module-level, so tests that change the mocked usage data
 * between cases MUST call __resetConnectUsageCache() in beforeEach (the meter /
 * banner / card test suites do). TTL is deliberately short - usage changes when
 * the owner adds/removes items, and the banner/meter only need rough freshness.
 */

import { useEffect, useState } from 'react';
import { getConnectUsage } from './usage.actions';
import type { ConnectUsageKind, ConnectUsageRow } from './usage.types';

/** How long a resolved roll-up stays warm before the next consumer refetches. */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  rows: ConnectUsageRow[];
  at: number;
}

// Module-level singletons: the warm result and the de-dupe handle for the
// request that is currently in flight (null when nothing is pending).
let cached: CacheEntry | null = null;
let inFlight: Promise<ConnectUsageRow[]> | null = null;

/**
 * Fetch the roll-up, sharing one network trip across concurrent callers and
 * reusing a warm cache within the TTL. Never throws - a failed fetch resolves
 * to [] so a meter/banner simply renders nothing rather than blocking the page.
 */
function loadUsage(): Promise<ConnectUsageRow[]> {
  // monotonic clock; avoids Date.now (banned in some sandboxes, fine in browser)
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.rows);
  }
  if (inFlight) return inFlight;

  inFlight = getConnectUsage()
    .then((res) => {
      const rows = res.ok ? res.data : [];
      cached = { rows, at: now };
      return rows;
    })
    .catch(() => [])
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Clear the module cache + in-flight handle. Test-only seam. */
export function __resetConnectUsageCache(): void {
  cached = null;
  inFlight = null;
}

export interface UseConnectUsageResult {
  rows: ConnectUsageRow[] | null;
  loading: boolean;
}

/** All usage rows, fetched once per page (shared + cached). */
export function useConnectUsage(): UseConnectUsageResult {
  const [rows, setRows] = useState<ConnectUsageRow[] | null>(cached ? cached.rows : null);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let active = true;
    void loadUsage().then((r) => {
      if (!active) return;
      setRows(r);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  return { rows, loading };
}

/** Convenience: the single row for one kind (or null), plus loading. */
export function useConnectUsageRow(kind: ConnectUsageKind): {
  row: ConnectUsageRow | null;
  loading: boolean;
} {
  const { rows, loading } = useConnectUsage();
  return { row: rows?.find((r) => r.kind === kind) ?? null, loading };
}
