'use client';

/**
 * useNetworkBadge - the "My Network" nav badge count.
 *
 * The badge is a NEW-ACTIVITY signal, not a standing to-do count: it counts the
 * UNSEEN connection notifications - a new incoming request, or a new acceptance
 * of a request you sent. Opening /connect/network marks both categories seen
 * (see `NetworkScreen`), so the badge clears on visit like every other menu
 * badge in the app, and a later socket event re-raises it. The true pending-
 * invitation count still lives on the Network page's Invitations tab (server-
 * driven), so nothing is lost by the badge clearing.
 *
 * Earlier shape fed the badge from the server pending-requests count, which
 * never cleared on visit (only on accept / ignore) - inconsistent with the rest
 * of the app's "seen on open" badges, so it looked stuck. It is now derived
 * purely from the shared `NotificationProvider` state (one socket, no extra
 * fetch), updating live as events arrive and as the page marks them seen.
 */

import { useNotifications } from '@/lib/connect/NotificationProvider';

/** Custom-event name dispatched after a network action (send / accept / ignore
 *  / withdraw). Sibling views (the screen, the invitations list) listen to it to
 *  refresh themselves; kept here as the canonical name. */
export const NETWORK_CHANGED_EVENT = 'z360:connect-network-changed';

/** The notification categories that light the "My Network" nav badge. Cleared
 *  on visit by `NetworkScreen` (`markCategorySeen` for each). */
export const NETWORK_BADGE_CATEGORIES: readonly string[] = [
  'connect.connection_requested',
  'connect.connection_accepted',
];

export function useNetworkBadge(): number {
  const { notifications } = useNotifications();
  return notifications.filter(
    (n) => !n.seenAt && n.category != null && NETWORK_BADGE_CATEGORIES.includes(n.category),
  ).length;
}
