/**
 * ManekHR Connect -- Inbox (Phase 7) pure presentation helpers.
 *
 * No React, no `next-intl` -- they return primitive / structured data so the
 * components own the actual localized rendering AND so the logic unit-tests in
 * isolation. Mirrors the split used by `inbox-cache.ts` / `feed-cache.ts`.
 */

import type { InboxThread } from './inbox.types';

/**
 * Group a flat thread list by the OTHER party (the unified per-person view):
 * one entry per person, with their newest thread as the representative row and
 * the unread count SUMMED across all their threads. Party-less threads (system)
 * are dropped. Sorted by most-recent activity. Pure; consumed by ThreadList.
 */
export interface PersonGroup {
  userId: string;
  /** The newest thread for this person, with `unreadCount` overwritten to the sum. */
  representative: InboxThread;
}

export function groupThreadsByPerson(threads: InboxThread[]): PersonGroup[] {
  const byUser = new Map<string, { rep: InboxThread; unread: number; latest: number }>();
  for (const t of threads) {
    const uid = t.party?.userId;
    if (!uid) continue; // system / party-less threads never group into a person
    const ts = new Date(t.lastActivityAt).getTime() || 0;
    const cur = byUser.get(uid);
    const unread = (cur?.unread ?? 0) + (t.unreadCount ?? 0);
    if (!cur || ts > cur.latest) byUser.set(uid, { rep: t, unread, latest: ts });
    else byUser.set(uid, { ...cur, unread });
  }
  return [...byUser.entries()]
    .map(([userId, v]) => ({ userId, representative: { ...v.rep, unreadCount: v.unread } }))
    .sort(
      (a, b) =>
        new Date(b.representative.lastActivityAt).getTime() -
        new Date(a.representative.lastActivityAt).getTime(),
    );
}

/**
 * What the thread-list preview should show. Media-only messages localize from
 * `kind` (the backend stores an empty preview for them, by design), so the
 * component maps `photo` / `voice` to a translated label; text / system keep
 * their (already capped) body.
 */
export type ThreadPreview =
  | { kind: 'empty' }
  | { kind: 'photo' }
  | { kind: 'voice' }
  | { kind: 'text'; text: string };

export function threadPreview(thread: InboxThread): ThreadPreview {
  const last = thread.lastMessage;
  if (!last) return { kind: 'empty' };
  if (last.kind === 'photo') return { kind: 'photo' };
  if (last.kind === 'voice') return { kind: 'voice' };
  const text = last.preview?.trim();
  if (!text) return { kind: 'empty' };
  return { kind: 'text', text };
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * A relative-time descriptor for a timestamp, resolved against `now`. The
 * component maps the `unit` to a localized string (`time.now` / `time.minutes`
 * / ...) and renders an absolute date for anything a week or older. Pure +
 * `now`-injectable so it tests deterministically (no `Date.now()` inside).
 */
export type RelativeTime =
  | { unit: 'now' }
  | { unit: 'minutes'; count: number }
  | { unit: 'hours'; count: number }
  | { unit: 'days'; count: number }
  | { unit: 'date' };

export function relativeTime(iso: string, now: number): RelativeTime {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return { unit: 'date' };
  const diff = Math.max(0, now - then);
  if (diff < MINUTE) return { unit: 'now' };
  if (diff < HOUR) return { unit: 'minutes', count: Math.floor(diff / MINUTE) };
  if (diff < DAY) return { unit: 'hours', count: Math.floor(diff / HOUR) };
  if (diff < 7 * DAY) return { unit: 'days', count: Math.floor(diff / DAY) };
  return { unit: 'date' };
}

/** Day-separator bucket for the conversation log. */
export type DayBucket = 'today' | 'yesterday' | 'date';

export function messageDayBucket(iso: string, now: number): DayBucket {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return 'date';
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThen = new Date(then);
  startOfThen.setHours(0, 0, 0, 0);
  const dayDiff = Math.round((startOfToday.getTime() - startOfThen.getTime()) / DAY);
  if (dayDiff <= 0) return 'today';
  if (dayDiff === 1) return 'yesterday';
  return 'date';
}
