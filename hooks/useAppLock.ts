'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { pinApi } from '@/lib/api/modules';
import { env } from '@/lib/env';
import { useAuthStore } from '@/lib/store';
import { useIdle } from '@/hooks/useIdle';
import { useAppLockSync } from '@/hooks/useAppLockSync';

interface UseAppLockResult {
  isAppLocked: boolean;
  pinSetupRequired: boolean;
  /** True once `/auth/pin-status` has resolved (or immediately when disabled). */
  pinStateResolved: boolean;
}

/**
 * App Lock (Quick PIN) lifecycle for a shell other than the user dashboard.
 *
 * `DashboardLayout` keeps its own copy of this logic, gated on `!user.isAdmin`,
 * and therefore deliberately skips it for admins. The admin panel
 * (`AdminLayout`) is just as subject to the backend `PinUnlockGuard` (no admin
 * bypass - an idle admin's next API call 423s), so it needs the same lifecycle.
 * This hook is that mirror, reusing the same primitives (useIdle,
 * useAppLockSync, pinApi) so behaviour matches the dashboard exactly.
 *
 * Pass `enabled` to arm only for the intended shell (admin: `user.isAdmin`).
 * When disabled the hook is inert and reports `pinStateResolved = true` so the
 * caller never blocks on it.
 */
export function useAppLock(enabled: boolean): UseAppLockResult {
  const router = useRouter();
  const pathname = usePathname();
  // Pillar 4 (auth-hardening): narrow selectors. This hook runs in the admin
  // shell and ticks the pin-touch heartbeat; a broad destructure would make it
  // re-render on its own `unlockExpiresAt` writes. setAppLocked /
  // setPinSetupRequired are stable action refs.
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isAppLocked = useAuthStore((s) => s.isAppLocked);
  const pinSetupRequired = useAuthStore((s) => s.pinSetupRequired);
  const setAppLocked = useAuthStore((s) => s.setAppLocked);
  const setPinSetupRequired = useAuthStore((s) => s.setPinSetupRequired);
  const [pinStateResolved, setPinStateResolved] = useState(false);
  const hiddenAtRef = useRef<number | null>(null);

  // Broadcast lock/unlock across tabs.
  useAppLockSync();

  const lockNow = useCallback(async () => {
    try {
      await pinApi.lock();
    } catch {
      // Lock locally even if the backend write fails; the next API call will
      // 423 and converge state via the interceptor.
    }
    setAppLocked(true);
  }, [setAppLocked]);

  // Idle timeout - only arms once the user is authenticated, has a PIN, and is
  // not already locked. The admin panel has no workspace, so it always uses the
  // deployment-default idle window (no per-workspace override like the ERP).
  const idleArmed = enabled && !!user?.hasPin && !isAppLocked && !pinSetupRequired;
  // App Lock heartbeat - mirror of DashboardLayout: slide the BE unlock TTL on
  // user activity so the server idle clock tracks user input, not just API
  // traffic (prevents locking an active admin mid-use). The admin shell has no
  // workspace, so it always uses the deployment env idle window.
  const touchBackend = useCallback(() => {
    void pinApi.touch().catch(() => {});
  }, []);
  useIdle(idleArmed ? env.appLockIdleMs : 0, lockNow, {
    onActivity: touchBackend,
    activityThrottleMs: Math.min(Math.floor(env.appLockIdleMs / 3), 20_000),
  });

  // Manual-lock shortcut - Ctrl+Shift+L (Cmd+Shift+L on Mac). Same gate as the
  // idle timer; mirrors DashboardLayout / the 1Password convention.
  useEffect(() => {
    if (!idleArmed) return;
    const onKeydown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || !e.shiftKey) return;
      if (e.key !== 'L' && e.key !== 'l') return;
      e.preventDefault();
      void lockNow();
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [idleArmed, lockNow]);

  // Pull /auth/pin-status once after hydrate to determine the initial lock
  // state, and re-pull when the tab returns from being hidden for more than
  // 2 minutes (catches cross-tab lock or server-side eviction).
  useEffect(() => {
    if (!enabled || !isHydrated || !user) return;

    let cancelled = false;
    const refreshPinStatus = async () => {
      try {
        const res = await pinApi.status();
        if (cancelled) return;
        if (!res.pinSet) {
          setPinSetupRequired(true);
          setAppLocked(false);
        } else if (res.locked) {
          setPinSetupRequired(false);
          setAppLocked(true);
        } else {
          setPinSetupRequired(false);
          setAppLocked(false, res.unlockExpiresAt ?? undefined);
        }
      } catch {
        // 423 path - interceptor already toggled isAppLocked. Other errors
        // (network etc.) leave state as-is and the next API call retries.
      } finally {
        if (!cancelled) setPinStateResolved(true);
      }
    };

    // Fire on every effect run (deps are user/setters - stable enough). Not
    // gated by a ref so React Strict Mode's double-invoke can't leave
    // `pinStateResolved` stuck at false (see DashboardLayout for the history).
    void refreshPinStatus();

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now();
        return;
      }
      const hiddenSince = hiddenAtRef.current;
      hiddenAtRef.current = null;
      if (hiddenSince && Date.now() - hiddenSince > 120_000) {
        void refreshPinStatus();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled, isHydrated, user, setAppLocked, setPinSetupRequired]);

  // When the admin must set a PIN, route to /auth/setup-pin. Don't loop if
  // we're already on that route.
  useEffect(() => {
    if (!enabled || !isHydrated || !user) return;
    if (pinSetupRequired && !pathname?.startsWith('/auth/setup-pin')) {
      router.replace('/auth/setup-pin');
    }
  }, [enabled, isHydrated, user, pinSetupRequired, pathname, router]);

  return {
    isAppLocked,
    pinSetupRequired,
    pinStateResolved: enabled ? pinStateResolved : true,
  };
}
