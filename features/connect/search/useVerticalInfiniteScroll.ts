'use client';

/**
 * useVerticalInfiniteScroll - the shared load-on-scroll engine for the Connect
 * search results page (progressive-loading ADR). One focused vertical at a time
 * pages with it: the listings tab (Phase 1) and the people tab (Phase 2); the
 * blended `all` view stays a preview and does NOT use it.
 *
 * It mirrors the MarketplaceBrowseScreen pattern (IntersectionObserver sentinel
 * + hasMore + loadMore over limit/offset) and adds a never-ending-scroll
 * end-guard: `hasMore` derives from the leak-free `total` AND stops the moment a
 * fetched page comes back empty. That matters because `total` is a leak-free
 * LOWER BOUND (the federated layer subtracts only THIS page's block-filtered
 * rows), so later-page suppression can leave `loaded < total` with no real rows
 * left; the empty-page guard terminates the scroll instead of re-fetching the
 * empty tail forever.
 *
 * Cross-module: callers pass a `fetchMore(offset)` that re-runs the SAME
 * federated search (`searchConnectAll`) so the per-viewer block + author-active
 * gates re-run at hydration on every page (no FE leak surface).
 */

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

export interface UseVerticalInfiniteScrollOptions<T> {
  /** SSR page-1 rows for this vertical. */
  baseRows: T[];
  /** Leak-free full match count (the hasMore upper bound). */
  total: number;
  /** Changing this discards appended pages (a new query / filter / tab). */
  resetKey: string;
  /** True only when this vertical is the focused tab; otherwise the hook is inert. */
  enabled: boolean;
  /** Fetch the next page from `offset`; returns the next rows or an error. */
  fetchMore: (offset: number) => Promise<{ ok: true; rows: T[] } | { ok: false; error: string }>;
}

export interface VerticalInfiniteScroll<T> {
  /** baseRows + every appended page, in order. */
  rows: T[];
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: string | null;
  loadMore: () => Promise<void>;
  /** Clear the error and re-attempt the next page (the manual retry). */
  retry: () => void;
  /** Attach to the bottom sentinel element the IntersectionObserver watches. */
  sentinelRef: RefObject<HTMLDivElement | null>;
}

export function useVerticalInfiniteScroll<T>({
  baseRows,
  total,
  resetKey,
  enabled,
  fetchMore,
}: UseVerticalInfiniteScrollOptions<T>): VerticalInfiniteScroll<T> {
  const [extraRows, setExtraRows] = useState<T[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  // A fetched page came back empty -> the engine has no more rows even if `total`
  // (a leak-free lower bound) still exceeds the loaded count. Stops the scroll.
  const [reachedEnd, setReachedEnd] = useState(false);

  // Reset appended pages whenever the SSR result set changes (the previous-value
  // render pattern, same as MarketplaceBrowseScreen / the search bar draft sync).
  const [prevKey, setPrevKey] = useState(resetKey);
  if (resetKey !== prevKey) {
    setPrevKey(resetKey);
    setExtraRows([]);
    setLoadMoreError(null);
    setReachedEnd(false);
  }

  const rows = useMemo(() => [...baseRows, ...extraRows], [baseRows, extraRows]);
  const loadedCount = baseRows.length + extraRows.length;
  // hasMore stays true on an error so the sentinel can render its manual retry;
  // the IO effect below is what pauses auto-loading while an error is showing.
  const hasMore = enabled && !reachedEnd && loadedCount < total;

  const loadMore = useCallback(async () => {
    if (loadingMore || !enabled || reachedEnd) return;
    const offset = baseRows.length + extraRows.length;
    if (offset >= total) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const res = await fetchMore(offset);
      if (!res.ok) {
        setLoadMoreError(res.error);
        return;
      }
      if (res.rows.length === 0) {
        // Empty page -> nothing left to load (never-ending-scroll end-guard).
        setReachedEnd(true);
        return;
      }
      setExtraRows((prev) => [...prev, ...res.rows]);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, enabled, reachedEnd, baseRows.length, extraRows.length, total, fetchMore]);

  const retry = useCallback(() => {
    setLoadMoreError(null);
    void loadMore();
  }, [loadMore]);

  // IntersectionObserver sentinel: load the next page when the list bottom nears.
  // Skips while loading or after an error (the error surfaces a manual retry).
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore || loadMoreError) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMoreError, loadMore]);

  return { rows, hasMore, loadingMore, loadMoreError, loadMore, retry, sentinelRef };
}
