'use client';

/**
 * useFeedImpressions - batches "post entered the viewport" signals and flushes
 * them to the backend as one impression call (Phase 7c - post views +
 * seen-suppression).
 *
 * Each `PostCard` reports itself once it has dwelled in view (its own
 * IntersectionObserver); this hook de-dups per session, debounces, and POSTs
 * the batch via `recordPostViews`. The backend bumps each post's view count
 * (first unique view) and marks them seen so For-You stops re-surfacing them.
 *
 * Fire-and-forget - impressions are best-effort telemetry, never blocking the
 * feed. A post is reported at most once per mounted session.
 */

import { useCallback, useEffect, useRef } from 'react';
import { recordPostViews } from '../feed.actions';

/** Debounce window - collect viewport entries before one round-trip. */
const FLUSH_DELAY_MS = 1500;
/** Cap per request - mirrors the backend `VIEW_BATCH_MAX`; chunk beyond it. */
const MAX_BATCH = 30;

export function useFeedImpressions(): { reportSeen: (postId: string) => void } {
  // Reported this session - never count the same post twice.
  const reported = useRef<Set<string>>(new Set());
  // Queued, not yet flushed.
  const queue = useRef<Set<string>>(new Set());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    timer.current = null;
    if (queue.current.size === 0) return;
    const ids = [...queue.current];
    queue.current.clear();
    for (const id of ids) reported.current.add(id);
    for (let i = 0; i < ids.length; i += MAX_BATCH) {
      void recordPostViews(ids.slice(i, i + MAX_BATCH));
    }
  }, []);

  const reportSeen = useCallback(
    (postId: string) => {
      if (reported.current.has(postId) || queue.current.has(postId)) return;
      queue.current.add(postId);
      if (!timer.current) timer.current = setTimeout(flush, FLUSH_DELAY_MS);
    },
    [flush],
  );

  // Flush any pending impressions on unmount (best-effort - navigation may cut
  // the request short, which is acceptable for telemetry).
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      flush();
    },
    [flush],
  );

  return { reportSeen };
}
