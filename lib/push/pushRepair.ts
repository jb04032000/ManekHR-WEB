/**
 * Pure gating logic for the browser-push self-heal (see PushAutoRepair).
 * Decides whether this page load should silently re-register the FCM worker
 * and refresh the token. Kept pure so it is unit-testable without browser
 * APIs. Cross-links: components/push/PushAutoRepair.tsx (caller),
 * useBrowserPush DEVICE_ID_KEY (the "opted in before" marker).
 */

export const REPAIR_AT_KEY = 'z360.push.repairedAt';

/** Re-check at most once a day; the register endpoint is an upsert but there
 *  is no reason to hit it on every navigation. */
export const REPAIR_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function shouldAttemptRepair(input: {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  /** localStorage z360.push.deviceId, set by a past successful enable(). */
  deviceId: string | null;
  /** localStorage z360.push.repairedAt (ms epoch as string), if any. */
  lastRepairedAt: string | null;
  now: number;
}): boolean {
  if (!input.supported) return false;
  // Only repair browsers that ALREADY opted in: permission granted AND a
  // device id from a past enable(). Never prompts, never opts anyone in.
  if (input.permission !== 'granted') return false;
  if (!input.deviceId) return false;
  const last = Number(input.lastRepairedAt);
  if (Number.isFinite(last) && last > 0 && input.now - last < REPAIR_INTERVAL_MS) return false;
  return true;
}
