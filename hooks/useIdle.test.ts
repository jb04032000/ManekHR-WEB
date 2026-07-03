// Tests for the App Lock idle timer (useIdle). The cross-tab cases pin the
// fix for "locks even while active": idle must be measured across ALL tabs
// (shared last-activity timestamp in localStorage), because the lock itself
// is session-wide (family-keyed Redis unlock + BroadcastChannel sync, see
// useAppLockSync). Without the share, a background tab's timer fires and
// locks the actively-used tab.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdle, APP_LOCK_LAST_ACTIVITY_KEY } from './useIdle';

const IDLE_MS = 10_000;

describe('useIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('fires onIdle after idleMs with no activity anywhere', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdle(IDLE_MS, onIdle));

    vi.advanceTimersByTime(IDLE_MS - 1);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(2);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('local activity resets the timer', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdle(IDLE_MS, onIdle));

    // Activity at t=6s (past the 500ms debounce) pushes the deadline to t=16s.
    vi.advanceTimersByTime(6_000);
    window.dispatchEvent(new Event('mousemove'));
    vi.advanceTimersByTime(IDLE_MS - 1_000);
    expect(onIdle).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_001);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('counts activity even when an event was stopPropagation-ed below window', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdle(IDLE_MS, onIdle));

    const input = document.createElement('input');
    document.body.appendChild(input);
    // A widget that swallows keydown (stopPropagation) must still count as
    // activity - listeners are capture-phase.
    input.addEventListener('keydown', (e) => e.stopPropagation());

    vi.advanceTimersByTime(6_000);
    input.dispatchEvent(new Event('keydown', { bubbles: true }));
    vi.advanceTimersByTime(IDLE_MS - 1_000);
    expect(onIdle).not.toHaveBeenCalled();

    input.remove();
  });

  it('does NOT fire when another tab reported recent activity (cross-tab share)', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdle(IDLE_MS, onIdle));

    // No local activity in this tab. At t=8s another tab records activity
    // (it writes the shared localStorage timestamp on its own user events).
    vi.advanceTimersByTime(8_000);
    window.localStorage.setItem(APP_LOCK_LAST_ACTIVITY_KEY, String(Date.now()));

    // t=10s: this tab's local timer matures, but the session is NOT idle -
    // the other tab saw activity 2s ago. Must not lock.
    vi.advanceTimersByTime(2_500);
    expect(onIdle).not.toHaveBeenCalled();

    // With no further activity anywhere, it locks once the SHARED activity
    // goes stale: t = 8s + 10s = 18s.
    vi.advanceTimersByTime(8_000);
    expect(onIdle).toHaveBeenCalledTimes(1);
  });

  it('publishes local activity to the shared key for other tabs', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdle(IDLE_MS, onIdle));

    vi.advanceTimersByTime(6_000);
    window.dispatchEvent(new Event('mousedown'));
    const raw = window.localStorage.getItem(APP_LOCK_LAST_ACTIVITY_KEY);
    expect(raw).toBe(String(Date.now()));
  });

  it('a garbage future shared timestamp cannot postpone the lock forever', () => {
    const onIdle = vi.fn();
    renderHook(() => useIdle(IDLE_MS, onIdle));

    window.localStorage.setItem(APP_LOCK_LAST_ACTIVITY_KEY, String(Date.now() + 100 * IDLE_MS));
    // Deferral per check is clamped to idleMs, so worst case 2x idleMs.
    vi.advanceTimersByTime(2 * IDLE_MS + 10);
    expect(onIdle).toHaveBeenCalled();
  });
});
