'use server';

/**
 * ManekHR Connect -- Inbox (Phase 7) server actions.
 *
 * Thin wrappers over `serverHttp()` + `unwrapServer()`, each returning the
 * discriminated `ActionResult<T>` (never throws). The Server Component seeds
 * the first thread-list page + the opened thread's messages from here, so the
 * client mounts with data already in the react-query cache (no duplicate fetch
 * on mount). The realtime socket then keeps the cache warm.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type {
  InboxChannelType,
  InboxContextEntityType,
  InboxMessage,
  InboxReportReason,
  InboxThread,
  PersonTimeline,
  SendMessageInput,
} from './inbox.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

const BASE = '/connect/inbox';

/** Stable code the client maps to a localized rate-limit message (open-DM safety, I5). */
const RATE_LIMITED = 'MESSAGING_RATE_LIMITED';
function isRateLimited(e: unknown): boolean {
  return isAxiosError(e) && e.response?.status === 429;
}

/** Mint a short-lived ticket for the `/inbox` Socket.IO handshake. */
export async function mintInboxSocketTicket(): Promise<ActionResult<{ ticket: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/realtime/ticket`);
    return { ok: true, data: unwrapServer<{ ticket: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The caller's threads, newest-active first, optionally channel-filtered. */
export async function listInboxThreads(
  channel?: InboxChannelType,
  before?: string,
): Promise<ActionResult<InboxThread[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/threads`, {
      params: { ...(channel ? { channel } : {}), ...(before ? { before } : {}) },
    });
    return { ok: true, data: unwrapServer<InboxThread[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getInboxThread(id: string): Promise<ActionResult<InboxThread>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}`);
    return { ok: true, data: unwrapServer<InboxThread>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** The UNIFIED per-person timeline: all of the pair's threads merged into one
 *  createdAt-sorted stream (contexts as inline cards + messages). Feeds
 *  UnifiedConversationPane; BE `GET /connect/inbox/person/:userId`. */
export async function getPersonTimeline(userId: string): Promise<ActionResult<PersonTimeline>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/person/${userId}`);
    return { ok: true, data: unwrapServer<PersonTimeline>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Page a thread's messages, newest-first, keyset by `seq` (`before`). */
export async function listInboxMessages(
  id: string,
  before?: number,
): Promise<ActionResult<InboxMessage[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}/messages`, {
      params: before !== undefined ? { before } : {},
    });
    return { ok: true, data: unwrapServer<InboxMessage[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Since-cursor catch-up after a reconnect (`seq > since`, ascending). */
export async function inboxMessagesSince(
  id: string,
  seq: number,
): Promise<ActionResult<InboxMessage[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/${id}/since`, { params: { seq } });
    return { ok: true, data: unwrapServer<InboxMessage[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function sendInboxMessage(
  id: string,
  input: SendMessageInput,
): Promise<ActionResult<InboxMessage>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/messages`, input);
    return { ok: true, data: unwrapServer<InboxMessage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function markInboxRead(id: string, upToSeq: number): Promise<ActionResult<null>> {
  try {
    const http = await serverHttp();
    await http.post(`${BASE}/${id}/read`, { upToSeq });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function startInboxDm(recipientUserId: string): Promise<ActionResult<InboxThread>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/dm`, { recipientUserId });
    return { ok: true, data: unwrapServer<InboxThread>(res) };
  } catch (e) {
    if (isRateLimited(e)) return { ok: false, error: RATE_LIMITED };
    return { ok: false, error: toError(e) };
  }
}

export async function startInboxContextThread(
  recipientUserId: string,
  contextEntityType: InboxContextEntityType,
  contextEntityId: string,
): Promise<ActionResult<InboxThread>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/context`, {
      recipientUserId,
      contextEntityType,
      contextEntityId,
    });
    return { ok: true, data: unwrapServer<InboxThread>(res) };
  } catch (e) {
    if (isRateLimited(e)) return { ok: false, error: RATE_LIMITED };
    return { ok: false, error: toError(e) };
  }
}

export async function blockInboxUser(userId: string): Promise<ActionResult<null>> {
  try {
    const http = await serverHttp();
    await http.post(`${BASE}/block/${userId}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function unblockInboxUser(userId: string): Promise<ActionResult<null>> {
  try {
    const http = await serverHttp();
    await http.delete(`${BASE}/block/${userId}`);
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function reportInboxThread(
  id: string,
  reason: InboxReportReason,
  detail?: string,
  messageId?: string,
): Promise<ActionResult<null>> {
  try {
    const http = await serverHttp();
    await http.post(`${BASE}/${id}/report`, {
      reason,
      ...(detail ? { detail } : {}),
      ...(messageId ? { messageId } : {}),
    });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getInboxUnreadBadge(): Promise<ActionResult<{ total: number }>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/unread-badge`);
    return { ok: true, data: unwrapServer<{ total: number }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
