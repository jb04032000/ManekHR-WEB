'use client';

/**
 * Shared client hook for the traction-based boost nudges
 * (GET /me/connect/boost-nudges).
 *
 * Why this exists: mirrors useConnectUsage -- ONE fetch per page shared across
 * any mounted nudge slot, cached for a short TTL so a tab-switch / remount on the
 * same page reuses it. A surface mounts at most one slot, so in practice this is
 * one request that powers it.
 *
 * Cross-module links:
 *  - data source: features/connect/boost-nudges.actions.ts (getBoostNudges)
 *  - consumer: components/connect/BoostNudgeSlot.tsx
 *
 * Watch: the cache is module-level, so tests that change the mocked candidates
 * between cases MUST call __resetBoostNudgesCache() in beforeEach. `removeLocal`
 * drops a dismissed candidate from the warm cache so the card hides instantly
 * without a refetch.
 */

import { useEffect, useState } from 'react';
import { getBoostNudges } from './boost-nudges.actions';
import type { BoostNudgeCandidate } from './boost-nudges.types';

/** How long a resolved candidate list stays warm before the next consumer refetches. */
const CACHE_TTL_MS = 30_000;

interface CacheEntry {
  candidates: BoostNudgeCandidate[];
  at: number;
}

let cached: CacheEntry | null = null;
let inFlight: Promise<BoostNudgeCandidate[]> | null = null;

/**
 * Fetch the candidates, sharing one network trip across concurrent callers and
 * reusing a warm cache within the TTL. Never throws -- a failed fetch resolves
 * to [] so a slot simply renders nothing.
 */
function loadNudges(): Promise<BoostNudgeCandidate[]> {
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  if (cached && now - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.candidates);
  }
  if (inFlight) return inFlight;

  inFlight = getBoostNudges()
    .then((res) => {
      const candidates = res.ok ? res.data : [];
      cached = { candidates, at: now };
      return candidates;
    })
    .catch(() => [])
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Clear the module cache + in-flight handle. Test-only seam. */
export function __resetBoostNudgesCache(): void {
  cached = null;
  inFlight = null;
}

export interface UseBoostNudgesResult {
  candidates: BoostNudgeCandidate[] | null;
  loading: boolean;
  /** Drop one candidate from the warm cache (after a dismiss) so it hides now. */
  removeLocal: (entityId: string) => void;
}

export function useBoostNudges(): UseBoostNudgesResult {
  const [candidates, setCandidates] = useState<BoostNudgeCandidate[] | null>(
    cached ? cached.candidates : null,
  );
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    let active = true;
    void loadNudges().then((c) => {
      if (!active) return;
      setCandidates(c);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const removeLocal = (entityId: string) => {
    if (cached) {
      cached = { ...cached, candidates: cached.candidates.filter((c) => c.entityId !== entityId) };
    }
    setCandidates((prev) => (prev ? prev.filter((c) => c.entityId !== entityId) : prev));
  };

  return { candidates, loading, removeLocal };
}
