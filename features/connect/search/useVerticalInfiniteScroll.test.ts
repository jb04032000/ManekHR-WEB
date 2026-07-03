import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVerticalInfiniteScroll } from './useVerticalInfiniteScroll';

/**
 * Unit coverage for the shared search infinite-scroll hook (progressive-loading
 * ADR). It backs BOTH the listings tab (Phase 1) and the people tab (Phase 2),
 * so the behaviour proven here - leak-free hasMore + the never-ending-scroll
 * end-guard - applies to every focused vertical.
 *
 * The IntersectionObserver is inert in jsdom (the vitest setup stubs it) and the
 * hook's sentinel ref is never attached to a DOM node here, so the observer
 * effect early-returns; we drive `loadMore` directly to prove the state machine.
 */

type Row = { id: string };

function fetchOk(rows: Row[]) {
  return Promise.resolve({ ok: true as const, rows });
}

describe('useVerticalInfiniteScroll', () => {
  it('has more when enabled and the loaded rows are fewer than the total', () => {
    const { result } = renderHook(() =>
      useVerticalInfiniteScroll<Row>({
        baseRows: [{ id: 'a' }],
        total: 5,
        resetKey: 'k',
        enabled: true,
        fetchMore: () => fetchOk([]),
      }),
    );
    expect(result.current.rows).toEqual([{ id: 'a' }]);
    expect(result.current.hasMore).toBe(true);
  });

  it('has no more when the vertical is not the focused tab (disabled)', () => {
    const { result } = renderHook(() =>
      useVerticalInfiniteScroll<Row>({
        baseRows: [{ id: 'a' }],
        total: 999,
        resetKey: 'k',
        enabled: false,
        fetchMore: () => fetchOk([]),
      }),
    );
    expect(result.current.hasMore).toBe(false);
  });

  it('has no more when every matched row is already loaded', () => {
    const { result } = renderHook(() =>
      useVerticalInfiniteScroll<Row>({
        baseRows: [{ id: 'a' }],
        total: 1,
        resetKey: 'k',
        enabled: true,
        fetchMore: () => fetchOk([]),
      }),
    );
    expect(result.current.hasMore).toBe(false);
  });

  it('appends a fetched page and passes the loaded-count as the offset', async () => {
    const fetchMore = vi.fn(() => fetchOk([{ id: 'b' }, { id: 'c' }]));
    const { result } = renderHook(() =>
      useVerticalInfiniteScroll<Row>({
        baseRows: [{ id: 'a' }],
        total: 10,
        resetKey: 'k',
        enabled: true,
        fetchMore,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });

    // offset = the rows already loaded (1 base row) before this fetch.
    expect(fetchMore).toHaveBeenCalledWith(1);
    expect(result.current.rows).toEqual([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    expect(result.current.hasMore).toBe(true); // 3 < 10
  });

  it('stops (no never-ending scroll) when a fetch returns zero rows even though loaded < total', async () => {
    // Inflated total (e.g. later-page block/author-active drops not subtracted):
    // loaded plateaus below total, but the engine has no more rows. The end-guard
    // must terminate the scroll instead of re-fetching the empty tail forever.
    const { result } = renderHook(() =>
      useVerticalInfiniteScroll<Row>({
        baseRows: [{ id: 'a' }],
        total: 100,
        resetKey: 'k',
        enabled: true,
        fetchMore: () => fetchOk([]),
      }),
    );

    expect(result.current.hasMore).toBe(true);
    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.rows).toHaveLength(1); // nothing appended
    expect(result.current.hasMore).toBe(false); // reached-end guard tripped
  });

  it('surfaces a fetch error but keeps hasMore so the manual retry can show', async () => {
    const fetchMore = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: 'boom' })
      .mockResolvedValueOnce({ ok: true, rows: [{ id: 'b' }] });
    const { result } = renderHook(() =>
      useVerticalInfiniteScroll<Row>({
        baseRows: [{ id: 'a' }],
        total: 10,
        resetKey: 'k',
        enabled: true,
        fetchMore,
      }),
    );

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.loadMoreError).toBe('boom');
    expect(result.current.hasMore).toBe(true); // sentinel still renders -> retry

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.loadMoreError).toBeNull();
  });

  it('clears the appended pages when the reset key changes (new query / tab)', async () => {
    const { result, rerender } = renderHook(
      (props: { resetKey: string }) =>
        useVerticalInfiniteScroll<Row>({
          baseRows: [{ id: 'a' }],
          total: 10,
          resetKey: props.resetKey,
          enabled: true,
          fetchMore: () => fetchOk([{ id: 'b' }]),
        }),
      { initialProps: { resetKey: 'q1' } },
    );

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.rows).toHaveLength(2);

    // A new search re-seeds page 1; the appended page must be discarded.
    rerender({ resetKey: 'q2' });
    expect(result.current.rows).toEqual([{ id: 'a' }]);
  });
});
