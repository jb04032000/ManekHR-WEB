import type {
  ChannelPrefs,
  NotificationPrefs,
} from '@/features/connect/notifications/notifications.actions';

/**
 * Build the preferences patch that turns browser push on (or off) for ALL of a
 * user's notification categories at once, plus the global `browserPush` channel
 * flag. Used by useBrowserPush after a permission grant / on disable. Cross-link:
 * updateNotificationPreferences (notifications.actions.ts) consumes this shape;
 * the BE silently drops any non-toggleable category.
 */
export function buildEnablePrefsPatch(
  prefs: NotificationPrefs,
  next: boolean,
): {
  prefs: Partial<Record<string, Partial<ChannelPrefs>>>;
  channels: { browserPush: boolean };
} {
  const prefsPatch: Partial<Record<string, Partial<ChannelPrefs>>> = {};
  for (const category of Object.keys(prefs)) {
    prefsPatch[category] = { browserPush: next };
  }
  return { prefs: prefsPatch, channels: { browserPush: next } };
}
