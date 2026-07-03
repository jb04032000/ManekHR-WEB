'use client';

/**
 * useInboxBadge -- the inbox nav / mobile-tab unread count.
 *
 * Deliberately rides the ALREADY-GLOBAL `/notifications` socket (via the shared
 * NotificationProvider) rather than opening a second always-on socket per
 * logged-in user -- a 100k-concurrency consideration. The rich `/inbox` socket
 * only connects while the inbox screen is open (InboxProvider). The badge:
 *   - seeds an initial total from `getInboxUnreadBadge()`,
 *   - refetches on a `z360:connect-inbox-changed` window event (local read/send),
 *   - refetches on a live `connect.message_received` push.
 * No polling. Mirrors `useNetworkBadge`.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNotificationEvent } from '@/lib/connect/NotificationProvider';
import { isConnectModuleEnabled } from '@/lib/connect/flags';
import { getInboxUnreadBadge } from './inbox.actions';

/** Sibling components dispatch this after a local read / send to refresh fast. */
export const INBOX_CHANGED_EVENT = 'z360:connect-inbox-changed';

export function useInboxBadge(): number {
  const [count, setCount] = useState(0);

  const refetch = useCallback(() => {
    if (!isConnectModuleEnabled('inbox')) return;
    void getInboxUnreadBadge().then((res) => {
      if (res.ok) setCount(res.data.total);
    });
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => refetch();
    window.addEventListener(INBOX_CHANGED_EVENT, handler);
    return () => window.removeEventListener(INBOX_CHANGED_EVENT, handler);
  }, [refetch]);

  useNotificationEvent(
    useCallback(
      (event) => {
        if (event.category === 'connect.message_received') refetch();
      },
      [refetch],
    ),
  );

  return count;
}
