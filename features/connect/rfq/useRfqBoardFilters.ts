'use client';

/**
 * useRfqBoardFilters - the client engine behind the RFQ "Open board" tab.
 * Direct adaptation of the jobs useBoardFilters (keep the two in sync if either
 * mechanism changes): owns the BoardFilters state, mirrors it into the URL via
 * history.replaceState (the App Router has no shallow routing - router.replace
 * would re-run the server component per keystroke), and refetches BOTH the
 * paged results (listRfqBoard) and the facet counts (getRfqBoardFacets) when a
 * filter changes (debounced ~250ms).
 *
 * Cross-module links:
 * - features/connect/rfq/rfq.actions.ts -> listRfqBoard / getRfqBoardFacets.
 * - features/connect/rfq/RfqBoard.tsx consumes everything this returns.
 * - app/connect/rfq/page.tsx SSR-seeds initial filters/results/facets; keep its
 *   parseBoardFilters keys in sync with filtersToSearch below.
 *
 * Stale-response guard: a monotonic request-id; a resolved fetch is dropped
 * unless its id is still the latest (fast multi-toggles never go backwards).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { getRfqBoardFacets, listRfqBoard } from './rfq.actions';
import type { BoardFacets, BoardFilters, Rfq } from './rfq.types';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 250;

/** Filters -> the `?...` string for the address bar. Arrays csv-join; defaults
 *  are omitted. Keep keys in sync with parseBoardFilters (page.tsx). */
export function filtersToSearch(filters: BoardFilters): string {
  const p = new URLSearchParams();
  const csv = (arr?: string[]) => (arr && arr.length ? arr.join(',') : '');
  if (filters.q) p.set('q', filters.q);
  if (filters.category) p.set('category', filters.category);
  if (csv(filters.districts)) p.set('districts', csv(filters.districts));
  if (csv(filters.statuses)) p.set('statuses', csv(filters.statuses));
  if (filters.budgetMin != null) p.set('budgetMin', String(filters.budgetMin));
  if (filters.budgetMax != null) p.set('budgetMax', String(filters.budgetMax));
  if (filters.includeNegotiable) p.set('negotiable', '1');
  if (filters.matchedToMyWork) p.set('matched', '1');
  if (filters.notQuotedByMe) p.set('noQuote', '1');
  if (filters.postedWithinDays != null) p.set('posted', String(filters.postedWithinDays));
  if (filters.sort && filters.sort !== 'recent') p.set('sort', filters.sort);
  return p.toString();
}

/** Signature minus layout-only keys, to tell a sort change from a filter change. */
function sigExcluding(filters: BoardFilters, keys: Array<keyof BoardFilters>): string {
  const f: BoardFilters = { ...filters };
  for (const k of keys) delete f[k];
  return filtersToSearch(f);
}

/** Active filter-axis count for the connect.rfq.filter_applied analytics event. */
function activeFacetGroupCount(f: BoardFilters): number {
  let n = 0;
  if ((f.districts?.length ?? 0) > 0) n++;
  if ((f.statuses?.length ?? 0) > 0) n++;
  if (f.category) n++;
  if (f.budgetMin != null || f.budgetMax != null) n++;
  if (f.matchedToMyWork) n++;
  if (f.notQuotedByMe) n++;
  if (f.postedWithinDays != null) n++;
  if (f.q?.trim()) n++;
  return n;
}

export interface UseRfqBoardFiltersResult {
  filters: BoardFilters;
  facets: BoardFacets | null;
  results: Rfq[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  setFilter: (patch: Partial<BoardFilters>) => void;
  clearAll: () => void;
  loadMore: () => void;
  retry: () => void;
}

export function useRfqBoardFilters(
  initialFilters: BoardFilters,
  initialResults: Rfq[],
  initialFacets: BoardFacets | null,
  /** Mirror filters into the address bar. Pass false while a non-board tab is
   *  active: this hook writes the board FILTER querystring, which is empty for
   *  My-requests / My-quotes, so it would overwrite their `?tab=` param with a
   *  bare `/connect/rfq` (clobbering the active tab on mount - Strict Mode runs
   *  the effect twice, slipping past the seeded guard). Keep in sync with the
   *  `tab === 'board'` flag RfqBoard passes. */
  syncUrl = true,
): UseRfqBoardFiltersResult {
  const [filters, setFilters] = useState<BoardFilters>(initialFilters);
  const [results, setResults] = useState<Rfq[]>(initialResults);
  const [facets, setFacets] = useState<BoardFacets | null>(initialFacets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialResults.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const reqIdRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // First effect run already has SSR data; do not refetch on mount.
  const seededRef = useRef(true);
  const prevFiltersRef = useRef<BoardFilters>(initialFilters);

  const runFetch = useCallback((next: BoardFilters, emitAnalytics = true) => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    if (emitAnalytics) {
      const facetGroups = activeFacetGroupCount(next);
      track('connect.rfq.filter_applied', { hasFilters: facetGroups > 0, facetGroups });
    }
    void Promise.all([
      listRfqBoard({ ...next, limit: PAGE_SIZE, skip: 0 }),
      getRfqBoardFacets(next),
    ]).then(([resultsRes, facetsRes]) => {
      if (reqId !== reqIdRef.current) return;
      setLoading(false);
      if (!resultsRes.ok) {
        setError(resultsRes.error);
        return;
      }
      setResults(resultsRes.data);
      const total = facetsRes.ok ? facetsRes.data.total : null;
      setHasMore(
        total != null ? resultsRes.data.length < total : resultsRes.data.length >= PAGE_SIZE,
      );
      if (facetsRes.ok) setFacets(facetsRes.data);
    });
  }, []);

  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      prevFiltersRef.current = filters;
      return;
    }
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = filters;

    // URL mirror (shareable / back-forward) without a server round-trip. Only
    // when the board tab is active - else this empties a non-board tab's `?tab=`.
    if (syncUrl) {
      const qs = filtersToSearch(filters);
      const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
      window.history.replaceState(window.history.state, '', url);
    }

    const fetchChanged = filtersToSearch(filters) !== filtersToSearch(prev);
    if (!fetchChanged) return;
    // Sort refetches but is layout, not a filter_applied.
    const isFilterChange = sigExcluding(filters, ['sort']) !== sigExcluding(prev, ['sort']);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runFetch(filters, isFilterChange), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, runFetch, syncUrl]);

  const setFilter = useCallback((patch: Partial<BoardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearAll = useCallback(() => {
    setFilters((prev) => ({ sort: prev.sort ?? 'recent' }));
  }, []);

  const retry = useCallback(() => runFetch(filters), [filters, runFetch]);

  const loadMore = useCallback(() => {
    // If the filter set changes mid-flight (runFetch bumps reqIdRef), this page
    // is discarded so rows from old filters never land on the new result set.
    const reqId = reqIdRef.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    const skip = results.length;
    void listRfqBoard({ ...filters, limit: PAGE_SIZE, skip }).then((res) => {
      if (reqId !== reqIdRef.current) return;
      setLoadingMore(false);
      if (!res.ok) {
        setLoadMoreError(res.error);
        return;
      }
      setResults((prev) => [...prev, ...res.data]);
      const total = facets?.total ?? null;
      const newLen = skip + res.data.length;
      setHasMore(total != null ? newLen < total : res.data.length >= PAGE_SIZE);
    });
  }, [filters, results.length, facets]);

  return {
    filters,
    facets,
    results,
    total: facets?.total ?? results.length,
    loading,
    error,
    hasMore,
    loadingMore,
    loadMoreError,
    setFilter,
    clearAll,
    loadMore,
    retry,
  };
}
