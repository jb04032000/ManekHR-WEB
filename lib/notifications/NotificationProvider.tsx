'use client';

/**
 * NotificationProvider - the single source of truth for in-platform
 * notifications across both shells (ERP + Connect).
 *
 * Phase 7a (2026-05-22) - replaces the fragmented per-component socket
 * subscriptions. Mounted once at the `DashboardLayout` root, it:
 *  - Owns ONE `/notifications` socket connection (connect / reconnect /
 *    disconnect lifecycle + connection-state visibility).
 *  - Holds shared state: `unreadCount`, recent `notifications`, and the
 *    live `connectionState` so a dropped socket is observable.
 *  - Fans every `notification:created` event out to subscribers registered
 *    via `useNotificationEvent` (the bell, the network badge, the network
 *    invitations list, the notifications center all subscribe - no
 *    duplicate sockets).
 *  - Polls `/me/notifications` on a slow 2-min fallback so a degraded
 *    socket never leaves the bell stale.
 *
 * Consumers:
 *  - `useNotifications()` - count + list + markRead/markAllRead/refresh.
 *  - `useNotificationEvent(handler)` - subscribe to live created-events.
 *
 * The provider is a no-op (renders children, never connects) until the auth
 * store has a user - the socket ticket endpoint is JWT-only.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { App as AntApp } from 'antd';
import { useAuthStore } from '@/lib/store';
import { env } from '@/lib/env';
import { onForegroundMessage } from '@/lib/push/firebase-messaging';
import {
  createNotificationSocket,
  NOTIFICATION_SOCKET_EVENTS,
  type NotificationCreatedEvent,
} from './notification-socket';
import {
  clearAllNotifications,
  deleteNotification,
  listMyNotifications,
  markAllNotificationsRead,
  markAllNotificationsSeen,
  markNotificationRead,
  type NotificationItem,
} from './notifications.actions';

export type NotificationConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface NotificationContextValue {
  /** UNSEEN count - drives the red bell badge. Cleared by `markAllSeen`
   *  (opening the bell / center), NOT by per-row read. */
  unseenCount: number;
  /** UNREAD count - notifications not yet individually clicked (per-row bold). */
  unreadCount: number;
  /** Recent notifications (newest first), capped at the fetch limit. */
  notifications: NotificationItem[];
  /** Live socket connection state - surfaced for debugging + fallback UI. */
  connectionState: NotificationConnectionState;
  /** Force a refetch of the list + counts from the server. */
  refresh: () => void;
  /** Mark notifications SEEN (clears the red badge; rows stay bold). Optional
   *  `product` scopes the clear to one shell's inbox ("one engine, two
   *  inboxes") so opening the Connect bell never clears the ERP badge. */
  markAllSeen: (product?: 'connect' | 'erp') => Promise<void>;
  /** Mark one CATEGORY seen (e.g. visiting /connect/network clears
   *  `connect.connection_accepted` from the network nav badge while leaving
   *  any other unseen items still lighting the bell). */
  markCategorySeen: (category: string) => Promise<void>;
  /** Mark one notification read (optimistic; per-row bold clears). */
  markRead: (id: string) => Promise<void>;
  /** Mark notifications read (optimistic). Optional `product` scopes to one shell. */
  markAllRead: (product?: 'connect' | 'erp') => Promise<void>;
  /** Delete one notification (optimistic; rolls back on failure). Resolves
   *  `true` on success so callers can surface an error + reconcile their own
   *  view buckets (the centre also holds server `initial` + load-older rows). */
  deleteOne: (id: string) => Promise<boolean>;
  /** Clear notifications (optimistic). Optional `product` scopes to one shell's
   *  inbox so clearing Connect leaves the ERP bell intact (and vice-versa).
   *  Resolves `true` on success. */
  clearAll: (product?: 'connect' | 'erp') => Promise<boolean>;
  /** Subscribe to live `notification:created` events. Returns an unsubscribe.
   *  `handler` should be stable (wrap in `useCallback`). */
  subscribe: (handler: (event: NotificationCreatedEvent) => void) => () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

/** Slow fallback poll - the socket is primary; this catches a degraded socket. */
const FALLBACK_POLL_MS = 120_000;
/** How many notifications the bell + center hold in memory. */
const LIST_LIMIT = 50;

/**
 * Reduce a `notification:created` socket event into the local list. A brand-new
 * id is prepended; a re-fired BATCHED event (same id, another actor folded in,
 * §12.3) UPDATES that row in place - refreshed copy + count, badge re-lit - so
 * the bell never duplicates the row and the count reflects the fold live.
 * Pure (no React) so it is unit-testable in isolation.
 */
export function applyCreatedEvent(
  prev: NotificationItem[],
  event: NotificationCreatedEvent,
  userId: string,
): NotificationItem[] {
  const existingIdx = prev.findIndex((n) => n._id === event.notificationId);
  if (existingIdx >= 0) {
    return prev.map((n, i) =>
      i === existingIdx
        ? {
            ...n,
            actorId: event.actorId,
            title: event.title,
            message: event.message,
            aggregatedCount: event.aggregatedCount ?? n.aggregatedCount,
            seenAt: null, // new activity re-surfaces the row
          }
        : n,
    );
  }
  const item: NotificationItem = {
    _id: event.notificationId,
    recipientId: userId,
    actorId: event.actorId,
    aggregatedCount: event.aggregatedCount,
    category: event.category,
    title: event.title,
    message: event.message,
    seenAt: null,
    isRead: false,
    createdAt: event.createdAt,
  };
  return [item, ...prev];
}

/**
 * Whether a created-event belongs in the BELL list. Messages do NOT - they live
 * in the inbox (own unread badge via useInboxBadge); everything else does. The
 * event is still fanned out to subscribers regardless (so the inbox badge keeps
 * updating); this only gates the bell prepend. Pure so it is unit-testable.
 * Keep in sync with the BE /me/notifications exclusion of messages.
 */
export function belongsInBell(event: NotificationCreatedEvent): boolean {
  return event.category !== 'connect.message_received';
}

/**
 * The product an item belongs to ("one engine, two inboxes"). Prefers the
 * backend `product` stamp; falls back to the category heuristic for legacy
 * (pre-stamp) rows AND live socket events (the `notification:created` payload
 * carries no stamp - a `connect.*` category is Connect, everything else ERP).
 * Mirrors the BE `scopeByProduct` rule that a null stamp belongs to ERP.
 */
export function effectiveProduct(n: NotificationItem): 'connect' | 'erp' {
  if (n.product === 'connect' || n.product === 'erp') return n.product;
  const cat =
    n.category ?? (n.metadata as { category?: string } | null | undefined)?.category ?? '';
  return cat.startsWith('connect.') ? 'connect' : 'erp';
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const userId = user?._id ?? null;
  // Provider is mounted inside antd's <App> (components/AntdProvider.tsx), so the
  // static-free `message` API is available here for the foreground push toast.
  const { message: toast } = AntApp.useApp();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);
  const [connectionState, setConnectionState] = useState<NotificationConnectionState>('idle');

  // Unread (per-row bold) derived from the list; the badge uses unseen.
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  // Live subscribers (the network badge, invitations list, etc.). A plain Set
  // of stable callbacks - fanned out on every created-event.
  const subscribersRef = useRef<Set<(e: NotificationCreatedEvent) => void>>(new Set());

  const refresh = useCallback(() => {
    if (!userId) return;
    void listMyNotifications({ limit: LIST_LIMIT }).then((res) => {
      if (!res.ok) return;
      // Merge: server list is authoritative, but keep any locally-prepended
      // unread item the server hasn't surfaced yet (eventual-consistency
      // race - the socket event can beat the read replica). This is why the
      // bell dot no longer flashes then vanishes: a refetch can never drop
      // a just-arrived notification.
      setNotifications((local) => {
        const serverIds = new Set(res.data.map((n) => n._id));
        const localOnly = local.filter((n) => !serverIds.has(n._id) && !n.seenAt);
        const merged = [...localOnly, ...res.data];
        // Red badge = UNSEEN count (`seenAt` null).
        setUnseenCount(merged.filter((n) => !n.seenAt).length);
        return merged;
      });
    });
  }, [userId]);

  // Mark SEEN - clears the red badge (unseen→0). Rows keep their bold/unread
  // styling until individually clicked. Optimistic: badge clears instantly,
  // local `seenAt` is stamped so a refetch doesn't re-raise the count. The
  // BE `updateMany` is a no-op when nothing is unseen, so calling it on every
  // open is cheap + idempotent.
  const markAllSeen = useCallback(async (product?: 'connect' | 'erp') => {
    const now = new Date().toISOString();
    setNotifications((prev) => {
      const next = prev.map((n) =>
        n.seenAt || (product && effectiveProduct(n) !== product) ? n : { ...n, seenAt: now },
      );
      setUnseenCount(next.filter((x) => !x.seenAt).length);
      return next;
    });
    await markAllNotificationsSeen(undefined, product);
  }, []);

  // Mark a single CATEGORY seen. Optimistic: stamp `seenAt` on matching unseen
  // rows + recompute the unseen count, then persist (scoped to that category so
  // the BE clears only that slice). Powers the network nav badge clearing
  // `connect.connection_accepted` when the user opens /connect/network, without
  // touching the bell's other unseen items.
  const markCategorySeen = useCallback(async (category: string) => {
    const now = new Date().toISOString();
    setNotifications((prev) => {
      const next = prev.map((n) =>
        !n.seenAt && n.category === category ? { ...n, seenAt: now } : n,
      );
      setUnseenCount(next.filter((x) => !x.seenAt).length);
      return next;
    });
    await markAllNotificationsSeen(category);
  }, []);

  const markRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n._id === id ? { ...n, isRead: true, seenAt: n.seenAt ?? new Date().toISOString() } : n,
      ),
    );
    const res = await markNotificationRead(id);
    if (!res.ok) {
      // Roll back the read flag on failure (leave seenAt - a read implies seen).
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
    }
  }, []);

  const markAllRead = useCallback(
    async (product?: 'connect' | 'erp') => {
      const prevList = notifications;
      const now = new Date().toISOString();
      setNotifications((prev) => {
        const next = prev.map((n) =>
          product && effectiveProduct(n) !== product
            ? n
            : { ...n, isRead: true, seenAt: n.seenAt ?? now },
        );
        setUnseenCount(next.filter((x) => !x.seenAt).length);
        return next;
      });
      const res = await markAllNotificationsRead(undefined, product);
      if (!res.ok) {
        setNotifications(prevList);
        setUnseenCount(prevList.filter((n) => !n.seenAt).length);
      }
    },
    [notifications],
  );

  // Delete one row (optimistic). The provider holds both shells' rows, so the
  // removal is purely by id; counts recompute from the trimmed list. Rolls back
  // on a server failure so a dropped request never silently loses the row.
  const deleteOne = useCallback(
    async (id: string) => {
      const prevList = notifications;
      setNotifications((prev) => {
        const next = prev.filter((n) => n._id !== id);
        setUnseenCount(next.filter((x) => !x.seenAt).length);
        return next;
      });
      const res = await deleteNotification(id);
      if (!res.ok) {
        setNotifications(prevList);
        setUnseenCount(prevList.filter((n) => !n.seenAt).length);
      }
      return res.ok;
    },
    [notifications],
  );

  // Clear notifications (optimistic). `product` scopes the wipe to one shell's
  // inbox ("one engine, two inboxes"); omitting it clears everything.
  const clearAll = useCallback(
    async (product?: 'connect' | 'erp') => {
      const prevList = notifications;
      setNotifications((prev) => {
        const next = product ? prev.filter((n) => effectiveProduct(n) !== product) : [];
        setUnseenCount(next.filter((x) => !x.seenAt).length);
        return next;
      });
      const res = await clearAllNotifications(product);
      if (!res.ok) {
        setNotifications(prevList);
        setUnseenCount(prevList.filter((n) => !n.seenAt).length);
      }
      return res.ok;
    },
    [notifications],
  );

  const subscribe = useCallback((handler: (e: NotificationCreatedEvent) => void) => {
    subscribersRef.current.add(handler);
    return () => {
      subscribersRef.current.delete(handler);
    };
  }, []);

  // Socket lifecycle - connect once a user is present, tear down on logout.
  // `connectionState` starts 'idle' and is only advanced inside the active
  // branch (no synchronous setState in the no-user path - that would trip
  // `set-state-in-effect`). On logout the provider unmounts (redirect to
  // /auth), so a stale state never lingers.
  useEffect(() => {
    if (!isHydrated || !userId) {
      return;
    }

    // Initial load so the bell is populated before the first socket event.
    refresh();

    // Mark "connecting" once as the socket starts. Subsequent transitions
    // happen in the socket event callbacks below (lint-clean). This single
    // synchronous set is intentional + runs once per userId change.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot connect indicator, not a render-loop
    setConnectionState('connecting');
    const socket = createNotificationSocket();

    const log = (msg: string) => {
      if (env.isDev) {
        console.info(`[notifications] ${msg}`);
      }
    };

    socket.on('connect', () => {
      setConnectionState('connected');
      log('socket connected');
      // Resync on (re)connect - covers events missed while disconnected.
      refresh();
    });
    socket.on('disconnect', (reason) => {
      setConnectionState('disconnected');
      log(`socket disconnected: ${reason}`);
    });
    socket.on('connect_error', (err) => {
      setConnectionState('disconnected');
      log(`socket connect_error: ${err.message}`);
    });

    socket.on(NOTIFICATION_SOCKET_EVENTS.created, (event: NotificationCreatedEvent) => {
      log(`event created: ${event.category}`);
      // Messages live in the inbox (its own unread badge via useInboxBadge),
      // NOT the bell. Skip prepending them to the bell list - but still fan
      // them out below so the inbox badge keeps live-updating. The backend
      // also excludes messages from /me/notifications, so refresh() stays in
      // sync. Keep in sync with useInboxBadge (subscriber of these events).
      if (belongsInBell(event)) {
        // Prepend the new notification from the event payload so the bell list
        // + count update INSTANTLY and stay put regardless of when the refetch
        // resolves (dedupe by id - a reconnect refresh won't double it).
        setNotifications((prev) => {
          const next = applyCreatedEvent(prev, event, userId);
          // Red badge = unseen count.
          setUnseenCount(next.filter((n) => !n.seenAt).length);
          return next;
        });
      }
      // Fan out to subscribers (network badge, invitations list, inbox badge).
      subscribersRef.current.forEach((handler) => {
        try {
          handler(event);
        } catch {
          /* a subscriber throwing must not break the fan-out */
        }
      });
      // Background reconcile (merge-safe - see `refresh`).
      refresh();
    });

    // Fallback poll - catches a silently-degraded socket.
    const pollId = setInterval(refresh, FALLBACK_POLL_MS);

    return () => {
      clearInterval(pollId);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [isHydrated, userId, refresh]);

  // Foreground FCM toast: when browser push is enabled and the tab is focused,
  // FCM delivers via onMessage (it does NOT auto-show an OS notification). Show a
  // real toast via antd's message API; the bell is already updated by the
  // in-platform socket channel above, so this is purely the extra visible cue.
  // No-op when push is unsupported/unconfigured (onForegroundMessage guards).
  // Cross-link: lib/push/firebase-messaging (onForegroundMessage).
  useEffect(() => {
    if (!isHydrated || !userId) return;
    // `cancelled` guards the async subscribe: if the effect re-runs (or unmounts)
    // before onForegroundMessage resolves, unsubscribe the moment it does so the
    // FCM onMessage listener never leaks.
    let cancelled = false;
    let unsub: (() => void) | undefined;
    void onForegroundMessage(({ title, body, category }) => {
      // A message push is redundant while the user is already on the inbox
      // (they see it live) - suppress that toast only. The OS/background push
      // already only fires when the tab is unfocused (service worker), so this
      // guard is purely for the focused-tab case. All other categories toast
      // as normal. Cross-link: app/connect/inbox (the route this checks).
      if (
        category === 'connect.message_received' &&
        typeof window !== 'undefined' &&
        window.location.pathname.startsWith('/connect/inbox')
      ) {
        return;
      }
      toast.info(body ? `${title} - ${body}` : title);
    }).then((fn) => {
      if (cancelled) fn();
      else unsub = fn;
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isHydrated, userId, toast]);

  const value = useMemo<NotificationContextValue>(
    () => ({
      unseenCount,
      unreadCount,
      notifications,
      connectionState,
      refresh,
      markAllSeen,
      markCategorySeen,
      markRead,
      markAllRead,
      deleteOne,
      clearAll,
      subscribe,
    }),
    [
      unseenCount,
      unreadCount,
      notifications,
      connectionState,
      refresh,
      markAllSeen,
      markCategorySeen,
      markRead,
      markAllRead,
      deleteOne,
      clearAll,
      subscribe,
    ],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

/**
 * Read shared notification state. Returns a safe no-op shape when called
 * outside the provider (e.g. an isolated test render) so consumers never
 * crash on a missing provider.
 */
export function useNotifications(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (ctx) return ctx;
  return {
    unseenCount: 0,
    unreadCount: 0,
    notifications: [],
    connectionState: 'idle',
    refresh: () => undefined,
    markAllSeen: async () => undefined,
    markCategorySeen: async () => undefined,
    markRead: async () => undefined,
    markAllRead: async () => undefined,
    deleteOne: async () => false,
    clearAll: async () => false,
    subscribe: () => () => undefined,
  };
}

/**
 * Shell-scoped view of the shared notification state ("one engine, two
 * inboxes"). The provider owns BOTH products' rows on one socket; this hook
 * narrows the list + counts to the active shell's product and binds the bulk
 * actions (seen / read / clear) to it, so the Connect bell never shows ERP rows
 * and clearing one inbox leaves the other intact. `markRead` / `deleteOne` stay
 * id-based (product-agnostic). Pass `mode === 'connect' ? 'connect' : 'erp'`.
 */
export function useShellNotifications(product: 'connect' | 'erp'): NotificationContextValue {
  const ctx = useNotifications();
  return useMemo(() => {
    const notifications = ctx.notifications.filter((n) => effectiveProduct(n) === product);
    return {
      ...ctx,
      notifications,
      unseenCount: notifications.filter((n) => !n.seenAt).length,
      unreadCount: notifications.filter((n) => !n.isRead).length,
      markAllSeen: () => ctx.markAllSeen(product),
      markAllRead: () => ctx.markAllRead(product),
      clearAll: () => ctx.clearAll(product),
    };
  }, [ctx, product]);
}

/**
 * Subscribe to live `notification:created` events. `handler` MUST be stable
 * (wrap in `useCallback`) or it resubscribes every render.
 */
export function useNotificationEvent(handler: (event: NotificationCreatedEvent) => void): void {
  const { subscribe } = useNotifications();
  useEffect(() => subscribe(handler), [subscribe, handler]);
}
