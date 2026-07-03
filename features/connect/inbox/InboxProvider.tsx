'use client';

/**
 * InboxProvider -- owns the ONE `/inbox` Socket.IO connection for the inbox
 * screen. Mounted by the inbox route only (NOT the global shell), so the rich
 * message socket is open only while the user is actively in the inbox -- a
 * 100k-concurrency choice (the always-on socket is the notifications one; the
 * badge rides it via `useInboxBadge`).
 *
 * It writes realtime events straight into the react-query cache (no refetch --
 * the owner's no-duplicate-call requirement):
 *   - `inbox:message` -> append to that thread's message cache + bump the
 *     thread-list row (or invalidate once if the thread is brand-new).
 * On (re)connect it fans a signal to subscribers so the open conversation can
 * run its own since-cursor catch-up (it knows its threadId + lastSeq).
 *
 * The context value is memoized and all callbacks are stable, so subscribers
 * never re-render from provider churn.
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
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import {
  createInboxSocket,
  INBOX_SOCKET_EVENTS,
  type InboxMessageEvent,
  type InboxReadEvent,
} from '@/lib/connect/inbox-socket';
import { appendMessage, applyReadReceipt, bumpThread, inboxKeys } from './inbox-cache';
import { INBOX_CHANGED_EVENT } from './useInboxBadge';
import type { InboxMessage, InboxThread, PersonTimeline } from './inbox.types';

export type InboxConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected';

interface InboxContextValue {
  connectionState: InboxConnectionState;
  /** Subscribe to (re)connect events so the open thread can catch up. Returns
   *  an unsubscribe. `handler` MUST be stable (wrap in useCallback). */
  onReconnect: (handler: () => void) => () => void;
}

const InboxContext = createContext<InboxContextValue | null>(null);

export function InboxProvider({ children }: { children: ReactNode }) {
  const userId = useAuthStore((s) => s.user?._id ?? null);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<InboxConnectionState>('idle');
  const reconnectSubs = useRef<Set<() => void>>(new Set());

  const onReconnect = useCallback((handler: () => void) => {
    reconnectSubs.current.add(handler);
    return () => {
      reconnectSubs.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!isHydrated || !userId) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot connect indicator
    setConnectionState('connecting');
    const socket = createInboxSocket();
    let firstConnect = true;

    socket.on('connect', () => {
      setConnectionState('connected');
      if (firstConnect) {
        firstConnect = false;
      } else {
        // A reconnect -- the open conversation replays its gap via since-cursor.
        reconnectSubs.current.forEach((h) => {
          try {
            h();
          } catch {
            /* a subscriber throwing must not break the fan-out */
          }
        });
      }
    });
    socket.on('disconnect', () => setConnectionState('disconnected'));
    socket.on('connect_error', () => setConnectionState('disconnected'));

    socket.on(INBOX_SOCKET_EVENTS.message, (event: InboxMessageEvent) => {
      // Build a cache-shaped message from the slim event payload.
      const msg: InboxMessage = {
        _id: event.messageId,
        threadId: event.threadId,
        senderUserId: event.senderUserId,
        kind: event.kind as InboxMessage['kind'],
        seq: event.seq,
        body: event.body,
        media: [],
        audioUrl: null,
        audioDurationSec: null,
        clientMsgId: '',
        createdAt: event.createdAt,
      };
      // Append to the open thread's message cache (deduped).
      queryClient.setQueryData<InboxMessage[]>(inboxKeys.messages(event.threadId), (old) =>
        appendMessage(old, msg),
      );
      // Bump the thread-list row; if the thread is new (not cached), refetch once.
      const threadsKey = inboxKeys.threads('all');
      const existing = queryClient.getQueryData<InboxThread[]>(threadsKey);
      if (existing && existing.some((t) => t._id === event.threadId)) {
        const fromOther = event.senderUserId !== userId;
        queryClient.setQueryData<InboxThread[]>(threadsKey, (old) =>
          bumpThread(old, event.threadId, {
            lastMessage: {
              preview: event.body,
              kind: msg.kind,
              senderUserId: event.senderUserId,
              seq: event.seq,
              createdAt: event.createdAt,
            },
            lastActivityAt: event.createdAt,
            ...(fromOther
              ? {
                  unreadCount:
                    (existing.find((t) => t._id === event.threadId)?.unreadCount ?? 0) + 1,
                }
              : {}),
          }),
        );
      } else {
        void queryClient.invalidateQueries({ queryKey: threadsKey });
      }
      // Refresh the nav badge.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(INBOX_CHANGED_EVENT));
      }
    });

    // The other party read up to a seq -> advance their read watermark in the
    // open person-timeline cache so my sent ticks turn blue live (read receipts).
    // The reader IS the conversation partner, so the cache key is person(reader).
    socket.on(INBOX_SOCKET_EVENTS.read, (event: InboxReadEvent) => {
      queryClient.setQueryData<PersonTimeline>(inboxKeys.person(event.readerUserId), (old) =>
        applyReadReceipt(old, event.threadId, event.upToSeq),
      );
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [isHydrated, userId, queryClient]);

  const value = useMemo<InboxContextValue>(
    () => ({ connectionState, onReconnect }),
    [connectionState, onReconnect],
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

/** Read the inbox realtime context (safe no-op outside the provider). */
export function useInbox(): InboxContextValue {
  const ctx = useContext(InboxContext);
  if (ctx) return ctx;
  return { connectionState: 'idle', onReconnect: () => () => undefined };
}
