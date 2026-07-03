/**
 * ManekHR Connect -- Inbox (Phase 7) pure react-query cache mutators.
 *
 * Pure functions (no React) so they unit-test in isolation and let the
 * realtime layer update the cache instantly WITHOUT a refetch (the owner's
 * no-duplicate-call requirement). Mirrors the feed `feed-cache.ts` pattern.
 */

import type { InboxMessage, InboxThread, PersonTimeline } from './inbox.types';

/** The react-query keys -- one source so the provider + screen agree. */
export const inboxKeys = {
  threads: (channel: string) => ['connect-inbox-threads', channel] as const,
  messages: (threadId: string) => ['connect-inbox-messages', threadId] as const,
  // The unified per-person timeline (contexts-as-messages view).
  person: (userId: string) => ['connect-inbox-person', userId] as const,
};

/** A page of messages held under a thread's query key (newest-first list). */
export type MessagesCache = InboxMessage[] | undefined;

/**
 * Append a delivered message to a thread's message cache, deduped by `_id` AND
 * `clientMsgId` (so an optimistic local echo is reconciled by the server row,
 * and a reconnect replay never doubles a line). Kept newest-first.
 */
export function appendMessage(old: MessagesCache, msg: InboxMessage): InboxMessage[] {
  const list = old ?? [];
  if (
    list.some((m) => m._id === msg._id || (msg.clientMsgId && m.clientMsgId === msg.clientMsgId))
  ) {
    // Reconcile an optimistic echo: replace the matching clientMsgId row.
    return list.map((m) => (m.clientMsgId && m.clientMsgId === msg.clientMsgId ? msg : m));
  }
  return [msg, ...list];
}

/** Merge a since-cursor catch-up batch (ascending) into the cache, deduped. */
export function mergeSince(old: MessagesCache, batch: InboxMessage[]): InboxMessage[] {
  let list = old ?? [];
  for (const msg of batch) {
    if (!list.some((m) => m._id === msg._id)) list = [msg, ...list];
  }
  // Keep the canonical newest-first order by seq.
  return [...list].sort((a, b) => b.seq - a.seq);
}

/**
 * Move a thread to the top of the thread-list cache with a fresh last message +
 * an unread bump for the viewer when the message is from the other party.
 */
export function bumpThread(
  old: InboxThread[] | undefined,
  threadId: string,
  patch: Partial<InboxThread>,
): InboxThread[] | undefined {
  if (!old) return old;
  const idx = old.findIndex((t) => t._id === threadId);
  if (idx < 0) return old;
  const updated = { ...old[idx], ...patch };
  return [updated, ...old.slice(0, idx), ...old.slice(idx + 1)];
}

/** Clear a thread's unread count in the thread-list cache (on open / read). */
export function clearThreadUnread(
  old: InboxThread[] | undefined,
  threadId: string,
): InboxThread[] | undefined {
  if (!old) return old;
  return old.map((t) => (t._id === threadId ? { ...t, unreadCount: 0 } : t));
}

/**
 * Advance the OTHER party's read watermark for one thread in the person-timeline
 * cache (driven by the `inbox:read` socket event). Monotonic -- never moves the
 * watermark backwards. Pure; the bubbles re-derive read receipts from it.
 */
export function applyReadReceipt(
  old: PersonTimeline | undefined,
  threadId: string,
  upToSeq: number,
): PersonTimeline | undefined {
  if (!old) return old;
  return {
    ...old,
    threads: old.threads.map((t) =>
      t.threadId === threadId
        ? { ...t, otherLastReadSeq: Math.max(t.otherLastReadSeq, upToSeq) }
        : t,
    ),
  };
}
