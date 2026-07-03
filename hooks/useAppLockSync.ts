'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/store';

const CHANNEL_NAME = 'manekhr_app_lock';

type LockMessage = { type: 'lock' } | { type: 'unlock' };

/**
 * Cross-tab App Lock sync. Each tab opens a BroadcastChannel and:
 *   - Posts `{ type: 'lock' | 'unlock' }` whenever the local store's
 *     `isAppLocked` flips because of a *user action* (idle timeout in
 *     this tab, manual lock click, successful PIN unlock).
 *   - On incoming message: reflects the change into the local store
 *     WITHOUT echoing back (suppression via `isRemoteUpdate` ref).
 *
 * Mounted once at the dashboard shell (`DashboardLayout`).
 *
 * `enabled` lets a shell opt out: the Connect shell disables App Lock entirely
 * (App Lock is ERP-only), so a Connect tab must NOT react to a lock broadcast
 * from an ERP tab. Defaults to true so the admin mirror (`useAppLock`) keeps
 * working unchanged. Keep in sync with DashboardLayout's `mode !== 'connect'`.
 */
export function useAppLockSync(enabled = true): void {
  const isRemoteUpdate = useRef(false);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const prevLockedRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
      return;
    }

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<LockMessage>) => {
      const msg = event.data;
      if (!msg || (msg.type !== 'lock' && msg.type !== 'unlock')) return;
      isRemoteUpdate.current = true;
      const store = useAuthStore.getState();
      if (msg.type === 'lock') store.setAppLocked(true);
      else store.setAppLocked(false);
    };

    // Subscribe to local store; broadcast on local-driven transitions only.
    const unsub = useAuthStore.subscribe((state) => {
      const next = state.isAppLocked;
      if (prevLockedRef.current === null) {
        prevLockedRef.current = next;
        return;
      }
      if (prevLockedRef.current === next) return;

      const wasRemote = isRemoteUpdate.current;
      isRemoteUpdate.current = false;
      prevLockedRef.current = next;
      if (wasRemote) return; // we just received this - don't echo

      try {
        channel.postMessage({ type: next ? 'lock' : 'unlock' });
      } catch {
        // BroadcastChannel can throw when the document is being unloaded.
        // Suppress - the other tabs will resync via their own visibility
        // listener pulling /auth/pin-status on next foreground.
      }
    });

    return () => {
      unsub();
      try {
        channel.close();
      } catch {
        // ignore
      }
      channelRef.current = null;
    };
  }, [enabled]);
}
