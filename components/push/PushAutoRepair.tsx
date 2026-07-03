'use client';

/**
 * Self-heal for browsers that enabled push BEFORE the service-worker scope fix
 * (FCM worker moved from '/' to '/firebase-cloud-messaging-push-scope'; the PWA
 * worker kept evicting it at '/', killing their token). Those devices never
 * re-run enable(), so without this they stay broken until a reinstall. On load,
 * for already-opted-in browsers only (permission granted + stored device id),
 * it silently re-registers the FCM worker at the new scope, mints a fresh
 * token, and upserts it via /devices/register (BE dedupes by token). Also
 * unsubscribes any legacy push subscription left on the '/' registration so
 * the dead token stops receiving handler-less pushes. Throttled to once a day.
 * Renders nothing. Mounted by PwaManager. Cross-links: firebase-messaging
 * (requestPushToken), push-device.actions, pushRepair (gating),
 * useBrowserPush (DEVICE_ID_KEY).
 */

import { useEffect } from 'react';
import { isPushSupported, pushPermission, requestPushToken } from '@/lib/push/firebase-messaging';
import { registerWebPushToken } from '@/lib/push/push-device.actions';
import { DEVICE_ID_KEY } from '@/lib/push/useBrowserPush';
import { REPAIR_AT_KEY, shouldAttemptRepair } from '@/lib/push/pushRepair';

export default function PushAutoRepair() {
  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    if (
      !shouldAttemptRepair({
        supported: isPushSupported(),
        permission: pushPermission(),
        deviceId: localStorage.getItem(DEVICE_ID_KEY),
        lastRepairedAt: localStorage.getItem(REPAIR_AT_KEY),
        now: Date.now(),
      })
    ) {
      return;
    }

    // Defer past first paint; repair is background housekeeping.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          // Drop the legacy pre-fix subscription on the '/' scope (owned by the
          // PWA worker, which has no push handler). Best-effort: the current
          // subscription lives on the FCM scope, never '/'.
          const rootReg = await navigator.serviceWorker.getRegistration('/');
          if (rootReg) {
            const stale = await rootReg.pushManager.getSubscription();
            if (stale) await stale.unsubscribe();
          }

          // Permission is already granted, so this never prompts: it registers
          // the FCM worker at its own scope and returns a live token.
          const token = await requestPushToken();
          if (!token) return;
          const res = await registerWebPushToken(token);
          if (res.ok) {
            localStorage.setItem(DEVICE_ID_KEY, res.data._id);
            localStorage.setItem(REPAIR_AT_KEY, String(Date.now()));
          }
        } catch {
          // Best-effort: a failed repair just retries on a later load.
        }
      })();
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
