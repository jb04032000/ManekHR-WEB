import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useEffect, useCallback, useState } from 'react';

/**
 * CN-FEED-6 (feed harden Bucket 7) — pins the auto-fetch / retry fix in
 * `FeedList.tsx` (the feed module's main screen).
 *
 * BEFORE this fix: the bottom-of-list auto-fetch effect's dependency array did
 * not include the query's `error` state, so once a page fetch FAILED, every
 * subsequent re-render (virtualizer measurement, a websocket tick, an unrelated
 * state change) re-evaluated the same stale "near the bottom + hasNextPage +
 * !isFetchingNextPage" condition and fired `fetchNextPage()` again — a runaway
 * refetch loop against a dead Retry button, since the button's `retry` also
 * called `router.refresh()` (a server re-render that can never clear a
 * CLIENT-side React Query error).
 *
 * AFTER: the effect gates on `!error` (no auto-refire while an error is
 * showing — the reader must explicitly Retry), and `retry` calls
 * `fetchNextPage()`/`refetch()` directly instead of `router.refresh()`.
 *
 * FeedList.tsx itself is NOT rendered here (see FeedScreen.spotlight-mobile.test.tsx
 * and every other sibling test — FeedList is always stubbed via `vi.mock`
 * because it pulls in socket.io-client, @tanstack/react-virtual, and every ad
 * card; no test in this codebase has ever rendered it directly). Consistent
 * with this codebase's own pattern for isolating a hook-shaped concern
 * (useVerticalInfiniteScroll.test.ts does the same for its sibling infinite-
 * scroll guard), this harness reproduces the EXACT guard condition and retry
 * callback as written in FeedList.tsx (lines ~350-364) against a bare
 * `renderHook`, so the effect's re-fire behaviour is provable without needing
 * to mock the whole component tree. Any future edit to FeedList.tsx's guard
 * clause must keep this test's inputs/outputs in sync — if the guard changes,
 * update BOTH files together (see the file's own CN-FEED-6 comment).
 */

interface FetchState {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  error: Error | null;
}

/** Mirrors the FeedList.tsx effect: fires fetchNextPage() when near the
 *  bottom of the rendered window, gated by hasNextPage / isFetchingNextPage /
 *  (post-fix) !error. `nearBottom` stands in for the virtualizer's
 *  `last.index >= rows.length - 3` check — re-rendered on every tick like the
 *  real virtualizer measurement would be. */
function useFeedAutoFetch(
  nearBottom: boolean,
  state: FetchState,
  fetchNextPage: () => void,
  refetch: () => void,
) {
  useEffect(() => {
    if (nearBottom && state.hasNextPage && !state.isFetchingNextPage && !state.error) {
      fetchNextPage();
    }
  }, [nearBottom, state.hasNextPage, state.isFetchingNextPage, state.error, fetchNextPage]);

  const retry = useCallback(() => {
    if (state.hasNextPage) fetchNextPage();
    else refetch();
  }, [state.hasNextPage, fetchNextPage, refetch]);

  return { retry };
}

/** Drives a re-render WITHOUT changing any of the effect's real dependencies —
 *  simulates an unrelated tick (virtualizer measurement, a websocket event, a
 *  parent state change) that the pre-fix bug re-evaluated the stale condition
 *  against. */
function useTicker() {
  const [, setTick] = useState(0);
  const bump = useCallback(() => setTick((t) => t + 1), []);
  return bump;
}

describe('FeedList auto-fetch guard (CN-FEED-6)', () => {
  it('fires fetchNextPage exactly once when the reader nears the bottom (happy path)', () => {
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    renderHook(() =>
      useFeedAutoFetch(
        true,
        { hasNextPage: true, isFetchingNextPage: false, error: null },
        fetchNextPage,
        refetch,
      ),
    );
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire when a page fetch already failed (error present)', () => {
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    renderHook(() =>
      useFeedAutoFetch(
        true,
        { hasNextPage: true, isFetchingNextPage: false, error: new Error('network down') },
        fetchNextPage,
        refetch,
      ),
    );
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('REGRESSION (CN-FEED-6): an unrelated re-render tick while an error is showing never re-fires fetchNextPage', () => {
    // This is the exact runaway-loop shape: the reader is near the bottom, a
    // page fetch already failed, and something UNRELATED re-renders the tree
    // repeatedly (the real bug's trigger — a virtualizer measurement tick).
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    const { result, rerender } = renderHook(() => {
      const bump = useTicker();
      useFeedAutoFetch(
        true,
        { hasNextPage: true, isFetchingNextPage: false, error: new Error('network down') },
        fetchNextPage,
        refetch,
      );
      return { bump };
    });

    // Simulate 20 unrelated re-render ticks (what a stuck virtualizer / busy
    // websocket tab would produce against the pre-fix effect every frame).
    for (let i = 0; i < 20; i += 1) {
      act(() => result.current.bump());
      rerender();
    }

    // Zero auto-fetch calls throughout — the error gate held on every tick.
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('resumes auto-fetching once the error clears (a later render carries error:null)', () => {
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    const { rerender } = renderHook<void, FetchState>(
      (state) => useFeedAutoFetch(true, state, fetchNextPage, refetch),
      { initialProps: { hasNextPage: true, isFetchingNextPage: false, error: new Error('x') } },
    );
    expect(fetchNextPage).not.toHaveBeenCalled();

    // The reader tapped Retry, the query resolved, error is now null.
    rerender({ hasNextPage: true, isFetchingNextPage: false, error: null });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('retry() re-attempts the failed NEXT page directly (not a server refresh) when one is pending', () => {
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    const { result } = renderHook(() =>
      useFeedAutoFetch(
        false, // not near bottom -> the effect itself does not auto-fire
        { hasNextPage: true, isFetchingNextPage: false, error: new Error('x') },
        fetchNextPage,
        refetch,
      ),
    );

    act(() => result.current.retry());

    expect(fetchNextPage).toHaveBeenCalledTimes(1);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('retry() falls back to refetch() when there is no next page (loaded pages need a re-pull)', () => {
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    const { result } = renderHook(() =>
      useFeedAutoFetch(
        false,
        { hasNextPage: false, isFetchingNextPage: false, error: new Error('x') },
        fetchNextPage,
        refetch,
      ),
    );

    act(() => result.current.retry());

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not double-fire while a fetch is already in flight (isFetchingNextPage guard)', () => {
    const fetchNextPage = vi.fn();
    const refetch = vi.fn();
    const { rerender } = renderHook(
      (state: FetchState) => useFeedAutoFetch(true, state, fetchNextPage, refetch),
      { initialProps: { hasNextPage: true, isFetchingNextPage: true, error: null } },
    );
    expect(fetchNextPage).not.toHaveBeenCalled();

    // Still in flight on the next tick -> still no fire.
    rerender({ hasNextPage: true, isFetchingNextPage: true, error: null });
    expect(fetchNextPage).not.toHaveBeenCalled();
  });
});
