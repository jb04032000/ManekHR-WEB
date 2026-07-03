'use client';

import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'pointerdown',
] as const;

const DEBOUNCE_MS = 500;

/**
 * Cross-tab last-activity share. The App Lock is SESSION-wide (one
 * family-keyed Redis unlock key + useAppLockSync broadcast), but each tab
 * runs its own idle timer - so a background tab that sees no events would
 * lock the whole session out from under an actively-used tab. Every tab
 * publishes its last user-activity timestamp here, and before locking a tab
 * re-checks it: lock only when NO tab has seen activity for idleMs.
 * Keep in sync with nothing else - this is the only reader/writer.
 */
export const APP_LOCK_LAST_ACTIVITY_KEY = 'manekhr_app_lock_last_activity';

const readSharedActivity = (): number => {
  try {
    const raw = window.localStorage.getItem(APP_LOCK_LAST_ACTIVITY_KEY);
    const n = raw ? Number.parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0; // storage unavailable (private mode) - fall back to per-tab behaviour
  }
};

const writeSharedActivity = (now: number): void => {
  try {
    window.localStorage.setItem(APP_LOCK_LAST_ACTIVITY_KEY, String(now));
  } catch {
    // best-effort; other tabs just won't see this tab's activity
  }
};

interface UseIdleOptions {
  /**
   * Called (throttled by `activityThrottleMs`) on real user activity. Used by
   * the App Lock to ping the backend so its request-driven unlock TTL slides on
   * the SAME signal that resets this local timer. Without it the BE idle clock
   * (refreshed only by API calls) drifts ahead of the FE clock and 423-locks an
   * active-but-not-fetching user. Keep stable / cheap; failures must be swallowed.
   */
  onActivity?: () => void;
  /** Min gap between `onActivity` calls. Default 20s. Set well below `idleMs`. */
  activityThrottleMs?: number;
}

/**
 * Fires `onIdle` after `idleMs` of no user activity. Activity is sniffed via
 * window-level passive listeners on mouse / keyboard / touch / scroll /
 * pointer events. The reset is debounced to ~500ms so a single mousemove
 * stream doesn't reschedule the timer thousands of times per minute.
 *
 * Optionally pings `onActivity` (throttled) on the same events so a caller can
 * keep a server-side idle clock in sync with this one (see App Lock heartbeat).
 *
 * Used by `DashboardLayout` to drive the App Lock idle timeout. Stable
 * `onIdle` is recommended (wrap in `useCallback` if it closes over state).
 */
export function useIdle(idleMs: number, onIdle: () => void, opts?: UseIdleOptions): void {
  const onIdleRef = useRef(onIdle);
  const onActivityRef = useRef(opts?.onActivity);
  const activityThrottleMs = opts?.activityThrottleMs ?? 20_000;

  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    onActivityRef.current = opts?.onActivity;
  }, [opts?.onActivity]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (idleMs <= 0) return;

    let idleTimer: ReturnType<typeof setTimeout> | null = null;
    let lastReset = 0;
    // Seed the heartbeat clock to "now" so the freshly-unlocked key (full TTL)
    // isn't pinged immediately on mount; the first heartbeat waits one throttle
    // window of genuine activity.
    let lastActivityPing = Date.now();

    const fire = () => {
      // Session-wide idle check: another tab's activity (shared via
      // localStorage) vetoes this tab's lock. Defer to the moment the SHARED
      // clock matures. A timestamp in the future is garbage (all tabs share
      // this machine's clock) - ignore it so it can't postpone the lock.
      const now = Date.now();
      const raw = readSharedActivity();
      const shared = raw > now ? 0 : raw;
      const remaining = shared > 0 ? shared + idleMs - now : 0;
      if (remaining > 0) {
        idleTimer = setTimeout(fire, Math.min(remaining, idleMs));
        return;
      }
      onIdleRef.current();
    };

    // `fromUserEvent` distinguishes real input from the mount kick - only
    // real input is published to the cross-tab share (a background tab
    // remounting must not look like user activity to other tabs).
    const reset = (fromUserEvent: boolean) => {
      const now = Date.now();
      // Heartbeat on activity (throttled), independent of the 500ms reset
      // debounce so it can't be starved by it. Bridges FE activity -> BE TTL.
      if (
        fromUserEvent &&
        onActivityRef.current &&
        activityThrottleMs > 0 &&
        now - lastActivityPing >= activityThrottleMs
      ) {
        lastActivityPing = now;
        onActivityRef.current();
      }
      if (now - lastReset < DEBOUNCE_MS) return;
      lastReset = now;
      if (fromUserEvent) writeSharedActivity(now);
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(fire, idleMs);
    };

    const onUserEvent = () => reset(true);

    // Kick the timer once on mount so users who land + stay still still get
    // locked after `idleMs`.
    reset(false);

    // Capture phase: a component calling stopPropagation on keydown/mousedown
    // (editors, some AntD widgets) must still count as activity - bubble-phase
    // window listeners would never see those events.
    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, onUserEvent, { passive: true, capture: true });
    });

    return () => {
      if (idleTimer) clearTimeout(idleTimer);
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, onUserEvent, { capture: true });
      });
    };
  }, [idleMs, activityThrottleMs]);
}
