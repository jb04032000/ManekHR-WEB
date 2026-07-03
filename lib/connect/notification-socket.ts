'use client';

/**
 * Low-level `/notifications` Socket.IO connector + shared contract types.
 *
 * The lifecycle (connect / subscribe / state / fallback) is owned by
 * `NotificationProvider` - this module only exposes the socket factory +
 * the event payload shapes so the provider and any future consumer agree
 * on names. Event names mirror BE
 * `src/modules/notifications/notifications-realtime.ts`.
 *
 * Earlier this file held a module-singleton socket + per-component hooks.
 * That fragmented the connection state across consumers (no shared count,
 * no shared connection signal, no fallback). The provider replaces that.
 */

import { io, type Socket } from 'socket.io-client';
import { env } from '@/lib/env';
import { mintNotificationSocketTicket } from '@/features/connect/notifications/notifications.actions';

export const NOTIFICATION_SOCKET_EVENTS = {
  created: 'notification:created',
  unreadCountChanged: 'notification:unread-count-changed',
} as const;

/** `notification:created` payload - slim summary. */
export interface NotificationCreatedEvent {
  notificationId: string;
  category: string;
  title: string;
  message: string;
  actorId: string | null;
  /** Distinct actors folded into this row by batching (§12.3); 1 = singleton. */
  aggregatedCount?: number;
  createdAt: string;
}

export interface NotificationUnreadCountChangedEvent {
  count: number;
}

/** The backend Socket.IO origin - `backendApiUrl` minus its `/api` suffix -
 *  with the `/notifications` namespace appended. */
const SOCKET_URL = `${env.backendApiUrl.replace(/\/api\/?$/, '')}/notifications`;

/**
 * Create a fresh `/notifications` socket. `auth` is a function so a new
 * ticket is minted on every (re)connect - expiry needs no special handling.
 * The provider owns this instance + disconnects it on unmount.
 */
export function createNotificationSocket(): Socket {
  return io(SOCKET_URL, {
    withCredentials: true,
    // Reconnect with backoff is socket.io-client default; make it explicit.
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    auth: (cb) => {
      void mintNotificationSocketTicket().then((res) =>
        cb({ ticket: res.ok ? res.data.ticket : '' }),
      );
    },
  });
}
