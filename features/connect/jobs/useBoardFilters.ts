'use client';

/**
 * useBoardFilters - the client engine behind the Jobs "Open" tab. Owns the board
 * filter state (the canonical BoardFilters), keeps it in sync with the URL, and
 * fetches BOTH the paged results (listJobBoard) and the facet counts
 * (getJobBoardFacets) whenever the filters change.
 *
 * Cross-module links:
 * - features/connect/jobs/jobs.actions.ts -> listJobBoard / getJobBoardFacets
 *   (the server actions wrapping BE GET /connect/jobs/board[/facets]).
 * - features/connect/jobs/JobBoard.tsx consumes everything this returns; the
 *   role strip + JobFilterRail read `facets`, the result list reads `results`.
 * - app/connect/jobs/page.tsx SSR-seeds initialResults/initialFacets/filters so
 *   the first paint needs no client round-trip.
 *
 * Why history.replaceState (not router.replace): the App Router has NO shallow
 * routing - router.replace re-runs the server component (a full SSR fetch) and
 * resets scroll on every keystroke/toggle. We instead fetch through the server
 * actions and write the URL with window.history.replaceState so the address bar
 * stays shareable/back-forward-restorable WITHOUT a server round-trip per tap.
 *
 * Stale-response guard: a fast multi-toggle can fire several overlapping fetches;
 * a slow earlier one must never overwrite a newer result. Each fetch bumps a
 * monotonic request-id (reqIdRef) and aborts the prior one via AbortController.
 * On resolve we drop the response unless its id is still the latest. (The actions
 * are server actions and ignore the AbortSignal, so the request-id is the real
 * correctness mechanism; the controller is kept for future client-fetch parity
 * and to stop dangling work.) Debounced ~250ms so a burst of toggles fires ONE
 * aggregation, not one per tap.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { track } from '@/lib/analytics';
import { getJobBoardFacets, listJobBoard } from './jobs.actions';
import type { BoardFacets, BoardFilters, Job } from './jobs.types';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 250;

/** Build the `?...` query string for the address bar from the active filters.
 *  Arrays serialize to csv; empty/default values are omitted. Keep the keys in
 *  sync with parseBoardFiltersFromParams (page.tsx) so the round-trip is lossless. */
function filtersToSearch(filters: BoardFilters): string {
  const p = new URLSearchParams();
  const csv = (arr?: string[]) => (arr && arr.length ? arr.join(',') : '');
  if (filters.q) p.set('q', filters.q);
  if (filters.category) p.set('category', filters.category);
  if (filters.role) p.set('role', filters.role);
  if (filters.wageType) p.set('wageType', filters.wageType);
  if (filters.district) p.set('district', filters.district);
  if (csv(filters.districts)) p.set('districts', csv(filters.districts));
  if (csv(filters.roles)) p.set('roles', csv(filters.roles));
  if (csv(filters.employmentTypes)) p.set('employmentTypes', csv(filters.employmentTypes));
  if (csv(filters.machineTypes)) p.set('machineTypes', csv(filters.machineTypes));
  if (filters.skills) p.set('skills', filters.skills);
  if (filters.payMin != null) p.set('payMin', String(filters.payMin));
  if (filters.payMax != null) p.set('payMax', String(filters.payMax));
  if (filters.postedWithinDays != null) p.set('posted', String(filters.postedWithinDays));
  if (filters.sort && filters.sort !== 'recent') p.set('sort', filters.sort);
  if (filters.view && filters.view !== 'list') p.set('view', filters.view);
  return p.toString();
}

/** Signature of the fetch-relevant filters, excluding the given layout-only keys,
 *  so a list/grid (view) toggle or a sort change is not mistaken for a filter
 *  change (view never refetches; sort refetches results but is not a filter_applied). */
function sigExcluding(filters: BoardFilters, keys: Array<keyof BoardFilters>): string {
  const f: BoardFilters = { ...filters };
  for (const k of keys) delete f[k];
  return filtersToSearch(f);
}

/** Count the active "facet groups" for analytics: each independent filter axis the
 *  user has narrowed by (location, role, pay type, employment type, machine type,
 *  skills, posted-window, open-only, text query). View/sort are layout, not filters,
 *  so they are excluded. Used by the connect.jobs.filter_applied event below. */
function activeFacetGroupCount(f: BoardFilters): number {
  let n = 0;
  if ((f.districts?.length ?? 0) > 0 || f.district) n++;
  if ((f.roles?.length ?? 0) > 0 || f.role) n++;
  if (f.wageType) n++;
  if ((f.employmentTypes?.length ?? 0) > 0) n++;
  if ((f.machineTypes?.length ?? 0) > 0) n++;
  if (f.skills && f.skills.split(',').filter(Boolean).length > 0) n++;
  if (f.category) n++;
  if (f.payMin != null || f.payMax != null) n++;
  if (f.postedWithinDays != null) n++;
  if (f.includeFilled != null) n++;
  if (f.q?.trim()) n++;
  return n;
}

export interface UseBoardFiltersResult {
  filters: BoardFilters;
  facets: BoardFacets | null;
  results: Job[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  /** Merge a partial change into the filters (resets paging + refetches). */
  setFilter: (patch: Partial<BoardFilters>) => void;
  /** Reset to a bare board (keeps view), refetch. */
  clearAll: () => void;
  /** Append the next page of results (does NOT refetch facets). */
  loadMore: () => void;
  /** Retry the main results+facets fetch after a failure. */
  retry: () => void;
}

export function useBoardFilters(
  initialFilters: BoardFilters,
  initialResults: Job[],
  initialFacets: BoardFacets | null,
): UseBoardFiltersResult {
  const [filters, setFilters] = useState<BoardFilters>(initialFilters);
  const [results, setResults] = useState<Job[]>(initialResults);
  const [facets, setFacets] = useState<BoardFacets | null>(initialFacets);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(initialResults.length >= PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Monotonic request-id + the in-flight controller for the stale-response guard.
  const reqIdRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True only for the very first effect run, where we already have SSR data and
  // must NOT refetch (avoids a redundant round-trip + set-state churn on mount).
  const seededRef = useRef(true);
  // Last committed filters, to diff view/sort (layout) vs real filter changes.
  const prevFiltersRef = useRef<BoardFilters>(initialFilters);

  const runFetch = useCallback((next: BoardFilters, emitAnalytics = true) => {
    const reqId = ++reqIdRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    // Analytics: a filter/facet change has been committed (once per committed set,
    // not per tap). Gated by `emitAnalytics` so a sort change / retry (which still
    // refetch) do NOT count as a filter_applied. View (layout) never reaches here.
    // { hasFilters, facetGroups } = how narrowed the view is. Pairs with the
    // per-facet connect.jobs.facet_toggled fired from the rail.
    if (emitAnalytics) {
      const facetGroups = activeFacetGroupCount(next);
      track('connect.jobs.filter_applied', { hasFilters: facetGroups > 0, facetGroups });
    }
    void Promise.all([
      listJobBoard({ ...next, limit: PAGE_SIZE, skip: 0 }),
      getJobBoardFacets(next),
    ]).then(([resultsRes, facetsRes]) => {
      // Ignore everything if a newer request started while we were waiting.
      if (reqId !== reqIdRef.current) return;
      setLoading(false);
      if (!resultsRes.ok) {
        setError(resultsRes.error);
        return;
      }
      setResults(resultsRes.data);
      // Prefer the authoritative facet total for hasMore; fall back to page-size
      // heuristic only when facets failed (avoids a dead "Load more" on an exact
      // multiple of PAGE_SIZE).
      const total = facetsRes.ok ? facetsRes.data.total : null;
      setHasMore(
        total != null ? resultsRes.data.length < total : resultsRes.data.length >= PAGE_SIZE,
      );
      if (facetsRes.ok) setFacets(facetsRes.data);
    });
  }, []);

  // Refetch (debounced) whenever the filters change, but skip the seeded mount.
  useEffect(() => {
    if (seededRef.current) {
      seededRef.current = false;
      prevFiltersRef.current = filters;
      return;
    }
    const prev = prevFiltersRef.current;
    prevFiltersRef.current = filters;

    // Mirror the change into the address bar immediately (no server round-trip),
    // incl. view/sort so the URL stays shareable.
    const qs = filtersToSearch(filters);
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', url);

    // A list/grid (view) toggle is layout-only: never refetch the board. Sort
    // changes result order so it still refetches, but it is not a filter_applied.
    const fetchChanged = sigExcluding(filters, ['view']) !== sigExcluding(prev, ['view']);
    if (!fetchChanged) return;
    const isFilterChange =
      sigExcluding(filters, ['view', 'sort']) !== sigExcluding(prev, ['view', 'sort']);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runFetch(filters, isFilterChange), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filters, runFetch]);

  const setFilter = useCallback((patch: Partial<BoardFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearAll = useCallback(() => {
    // Clear filters but keep the user's chosen sort + view (they are not filters).
    setFilters((prev) => ({ sort: prev.sort ?? 'recent', view: prev.view }));
  }, []);

  const retry = useCallback(() => runFetch(filters), [filters, runFetch]);

  const loadMore = useCallback(() => {
    // Capture the current request-id: if the filter set changes mid-flight
    // (runFetch bumps reqIdRef), discard this page so we never append rows from
    // the old filters onto the new result set.
    const reqId = reqIdRef.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    const skip = results.length;
    void listJobBoard({ ...filters, limit: PAGE_SIZE, skip }).then((res) => {
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
