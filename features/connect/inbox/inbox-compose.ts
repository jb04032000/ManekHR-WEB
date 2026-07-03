/**
 * ManekHR Connect -- Inbox (Phase 7) optimistic-send core.
 *
 * Pure cache transforms for the composer's send lifecycle, kept out of the
 * component so the (race-prone) reconciliation logic unit-tests in isolation:
 *
 *   1. `makeOptimisticMessage` -- a local echo shown instantly (seq 0, a
 *      `pending:<clientMsgId>` id) so the sender sees their line with no
 *      round-trip.
 *   2. `reconcileSent` -- swap the optimistic row for the server row IN PLACE
 *      (by `clientMsgId`), and de-dupe by `_id` so the realtime echo (which
 *      arrives with no `clientMsgId`) can never leave a twin. This makes the
 *      result correct whether the socket echo or the HTTP response lands first.
 *   3. `removeOptimistic` -- drop the echo on a send failure (the composer
 *      restores the draft so the member can retry).
 *
 * The cache is newest-first (the backend lists `seq` descending); the optimistic
 * row is prepended so it renders at the bottom of the (reversed) log.
 */

import type { InboxMessage, PersonTimeline, PersonTimelineItem } from './inbox.types';

const PENDING_PREFIX = 'pending:';

export interface OptimisticInput {
  threadId: string;
  senderUserId: string;
  clientMsgId: string;
  body: string;
  media?: InboxMessage['media'];
  audioUrl?: string | null;
  audioDurationSec?: number | null;
  createdAt: string;
}

/** Derive the message kind from the payload, mirroring the backend rule. */
export function deriveKind(input: {
  audioUrl?: string | null;
  media?: { length: number } | unknown[];
}): InboxMessage['kind'] {
  if (input.audioUrl) return 'voice';
  if (Array.isArray(input.media) ? input.media.length > 0 : Boolean(input.media)) return 'photo';
  return 'text';
}

/** Build the local optimistic row. `seq` 0 + the `pending:` id mark it unsent. */
export function makeOptimisticMessage(input: OptimisticInput): InboxMessage {
  return {
    _id: `${PENDING_PREFIX}${input.clientMsgId}`,
    threadId: input.threadId,
    senderUserId: input.senderUserId,
    kind: deriveKind(input),
    seq: 0,
    body: input.body,
    media: input.media ?? [],
    audioUrl: input.audioUrl ?? null,
    audioDurationSec: input.audioDurationSec ?? null,
    clientMsgId: input.clientMsgId,
    createdAt: input.createdAt,
  };
}

/** True for an optimistic, not-yet-acknowledged row. */
export function isPendingMessage(msg: InboxMessage): boolean {
  return msg.seq === 0 && msg._id.startsWith(PENDING_PREFIX);
}

/** Prepend the optimistic row (newest-first cache). Pure. */
export function appendOptimistic(
  old: InboxMessage[] | undefined,
  msg: InboxMessage,
): InboxMessage[] {
  return [msg, ...(old ?? [])];
}

/**
 * Reconcile the server row into the cache. Replaces the optimistic row in place
 * by `clientMsgId` (so order is preserved), then de-dupes by `_id` to remove a
 * realtime echo twin. Idempotent + order-independent. Pure.
 */
export function reconcileSent(
  old: InboxMessage[] | undefined,
  serverRow: InboxMessage,
): InboxMessage[] {
  const list = old ?? [];
  let placed = false;
  let next = list.map((m) => {
    if (m.clientMsgId && m.clientMsgId === serverRow.clientMsgId) {
      placed = true;
      return serverRow;
    }
    return m;
  });
  if (!placed) {
    if (next.some((m) => m._id === serverRow._id)) {
      next = next.map((m) => (m._id === serverRow._id ? serverRow : m));
    } else {
      next = [serverRow, ...next];
    }
  }
  // Drop any duplicate of the server row's id (a realtime echo carries no
  // clientMsgId, so it would otherwise survive the in-place swap above).
  const seen = new Set<string>();
  return next.filter((m) => {
    if (seen.has(m._id)) return false;
    seen.add(m._id);
    return true;
  });
}

/** Remove the optimistic row on a send failure. Pure. */
export function removeOptimistic(
  old: InboxMessage[] | undefined,
  clientMsgId: string,
): InboxMessage[] {
  return (old ?? []).filter((m) => m.clientMsgId !== clientMsgId);
}

/**
 * Unified per-person timeline (UnifiedConversationPane) variants of the optimistic
 * transforms. The unified pane's cache is a `PersonTimeline` (contexts + messages
 * merged, oldest-first), not the per-thread `InboxMessage[]`, so it needs its own
 * insert/remove. Confirmation is handled by the pane's existing success refetch
 * (Approach A) -- these only cover the instant echo and the failure rollback.
 */

/** Append an optimistic message as a timeline item (newest-last). The pane sends
 *  to the dm lane, so the echo is tagged `dm`. Pure. */
export function appendOptimisticToTimeline(
  timeline: PersonTimeline,
  msg: InboxMessage,
): PersonTimeline {
  const item: PersonTimelineItem = {
    type: 'message',
    threadId: msg.threadId,
    channelType: 'dm',
    message: msg,
    createdAt: msg.createdAt,
  };
  return { ...timeline, items: [...timeline.items, item] };
}

/** Drop an optimistic message item by `clientMsgId` (send failed). Pure. */
export function removeOptimisticFromTimeline(
  timeline: PersonTimeline,
  clientMsgId: string,
): PersonTimeline {
  return {
    ...timeline,
    items: timeline.items.filter(
      (it) => !(it.type === 'message' && it.message.clientMsgId === clientMsgId),
    ),
  };
}

/** Highest acknowledged seq in the cache (ignores optimistic rows). 0 if none. */
export function maxAckedSeq(messages: InboxMessage[] | undefined): number {
  let max = 0;
  for (const m of messages ?? []) {
    if (m.seq > max) max = m.seq;
  }
  return max;
}
