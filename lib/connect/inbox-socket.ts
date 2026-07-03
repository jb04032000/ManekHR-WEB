'use client';

/**
 * Low-level `/inbox` Socket.IO connector + shared contract types (Phase 7).
 *
 * Mirrors `notification-socket.ts`. The lifecycle (connect / state / catch-up)
 * is owned by `InboxProvider`; this only exposes the factory + payload shapes
 * so the provider and BE (`inbox-realtime.ts`) agree on names. The `auth`
 * callback mints a fresh ticket on every (re)connect, so expiry needs no
 * special handling. Distinct namespace + ticket audience from feed /
 * notifications.
 */

import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/env';
import { mintInboxSocketTicket } from '@/features/connect/inbox/inbox.actions';

export const INBOX_SOCKET_EVENTS = {
  message: 'inbox:message',
  read: 'inbox:read',
  threadUpdated: 'inbox:thread-updated',
} as const;

/** `inbox:message` payload -- the delivered message (client dedups by id). */
export interface InboxMessageEvent {
  threadId: string;
  messageId: string;
  senderUserId: string | null;
  kind: string;
  body: string;
  seq: number;
  createdAt: string;
}

/** `inbox:read` payload -- a participant's read watermark. */
export interface InboxReadEvent {
  threadId: string;
  readerUserId: string;
  upToSeq: number;
}

/** `inbox:thread-updated` payload -- a thread-list row changed. */
export interface InboxThreadUpdatedEvent {
  threadId: string;
}

/** The backend Socket.IO origin (`backendApiUrl` minus `/api`) + `/inbox`. */
const SOCKET_URL = `${env.backendApiUrl.replace(/\/api\/?$/, '')}/inbox`;

/** Create a fresh `/inbox` socket. The provider owns + disconnects it. */
export function createInboxSocket(): Socket {
  return io(SOCKET_URL, {
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    auth: (cb) => {
      void mintInboxSocketTicket().then((res) => cb({ ticket: res.ok ? res.data.ticket : '' }));
    },
  });
}
