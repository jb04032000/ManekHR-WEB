'use client';

/**
 * Client hook owning the browser-push opt-in lifecycle. Used by EnablePushBanner
 * and the PreferencesDrawer toggle. enable(): permission -> FCM token ->
 * register device -> turn browserPush prefs on. disable(): revoke device ->
 * delete token -> turn prefs off. Cross-links: firebase-messaging (token),
 * push-device.actions (register/revoke), notifications.actions
 * (get/updateNotificationPreferences), buildEnablePrefsPatch.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  isPushSupported,
  pushPermission,
  requestPushToken,
  deletePushToken,
} from './firebase-messaging';
import { registerWebPushToken, unregisterWebPushDevice } from './push-device.actions';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
} from '@/features/connect/notifications/notifications.actions';
import { buildEnablePrefsPatch } from './buildEnablePrefsPatch';

// Exported so PushAutoRepair can detect "this browser opted in before" and
// store the refreshed device id after a silent re-registration.
export const DEVICE_ID_KEY = 'z360.push.deviceId';

/** Why enable() failed. Maps 1:1 to the `push.errors.*` i18n keys so the UI
 *  can tell the user WHICH step broke instead of one generic error. */
export type PushEnableError = 'permission' | 'token' | 'register' | 'prefs';

export interface EnableResult {
  ok: boolean;
  reason?: PushEnableError;
}

export interface BrowserPushState {
  /** Browser + config support push at all. */
  supported: boolean;
  /** Native permission ('default' | 'granted' | 'denied' | 'unsupported'). */
  permission: NotificationPermission | 'unsupported';
  /** This browser has an active registered token. */
  enabled: boolean;
  /** An enable/disable round-trip is in flight. */
  busy: boolean;
  enable: () => Promise<EnableResult>;
  disable: () => Promise<boolean>;
}

export function useBrowserPush(): BrowserPushState {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(
    'unsupported',
  );
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  // Initialise from the browser + local marker after mount (avoids SSR
  // hydration mismatch - these APIs are client-only).
  useEffect(() => {
    const ok = isPushSupported();
    setSupported(ok);
    setPermission(pushPermission());
    if (ok && typeof localStorage !== 'undefined') {
      setEnabled(Boolean(localStorage.getItem(DEVICE_ID_KEY)) && pushPermission() === 'granted');
    }
  }, []);

  const enable = useCallback(async (): Promise<EnableResult> => {
    if (!isPushSupported() || busy) return { ok: false, reason: 'token' };
    setBusy(true);
    try {
      const token = await requestPushToken();
      const perm = pushPermission();
      setPermission(perm);
      // Distinguish "user/browser blocked it" from "FCM token mint failed" so
      // the caller can show the right message (push.errors.permission vs token).
      if (!token) return { ok: false, reason: perm === 'granted' ? 'token' : 'permission' };

      const reg = await registerWebPushToken(token);
      if (!reg.ok) return { ok: false, reason: 'register' };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DEVICE_ID_KEY, reg.data._id);
      }

      // Turn browserPush on for every category + the global channel flag. The
      // device token is registered above, but if we can't read or write the
      // prefs the per-category browserPush flags stay OFF -> dispatch silently
      // won't send. Treat that as a FAILED enable (don't show "enabled") so the
      // user retries; the next attempt re-PATCHes the prefs. No rollback needed.
      const prefsRes = await getNotificationPreferences();
      if (!prefsRes.ok) return { ok: false, reason: 'prefs' };
      const patch = buildEnablePrefsPatch(prefsRes.data.prefs, true);
      const updateRes = await updateNotificationPreferences(patch);
      if (!updateRes.ok) return { ok: false, reason: 'prefs' };

      setEnabled(true);
      return { ok: true };
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const disable = useCallback(async (): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      const deviceId =
        typeof localStorage !== 'undefined' ? localStorage.getItem(DEVICE_ID_KEY) : null;
      if (deviceId) {
        await unregisterWebPushDevice(deviceId);
        localStorage.removeItem(DEVICE_ID_KEY);
      }
      await deletePushToken();
      // Turn the global browserPush channel + per-category flags back off.
      const prefsRes = await getNotificationPreferences();
      if (prefsRes.ok) {
        const patch = buildEnablePrefsPatch(prefsRes.data.prefs, false);
        await updateNotificationPreferences(patch);
      }
      setEnabled(false);
      return true;
    } finally {
      setBusy(false);
    }
  }, [busy]);

  return { supported, permission, enabled, busy, enable, disable };
}
