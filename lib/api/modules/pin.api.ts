import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import { useWorkspaceStore } from '@/lib/store';
import type { PinStatus, PinUnlockResult } from '@/types';

const E = ApiEndpoints.auth;

// Active workspace id - sent on PIN unlock writes so the backend can size
// the sliding unlock TTL against the workspace's `appLockIdleMs` override.
const activeWorkspaceId = (): string | undefined =>
  useWorkspaceStore.getState().currentWorkspaceId ?? undefined;

/**
 * App Lock (Quick PIN) API wrappers. Endpoints all carry @SkipPinUnlock on the
 * backend so they remain callable while the session is locked - they're how
 * the user transitions between locked and unlocked states.
 */
export const pinApi = {
  status: () => http.get(E.pinStatus).then(unwrap<PinStatus>),

  set: (pin: string) =>
    http.post(E.pinSet, { pin, workspaceId: activeWorkspaceId() }).then(unwrap<PinUnlockResult>),

  change: (currentPin: string, newPin: string) =>
    http
      .post(E.pinChange, { currentPin, newPin, workspaceId: activeWorkspaceId() })
      .then(unwrap<PinUnlockResult>),

  verify: (pin: string) =>
    http.post(E.pinVerify, { pin, workspaceId: activeWorkspaceId() }).then(unwrap<PinUnlockResult>),

  forgotPinCredentialVerify: (
    payload: { kind: 'password'; password: string } | { kind: 'google'; googleIdToken: string },
  ) => http.post(E.forgotPinCredentialVerify, payload).then(unwrap<{ pinResetToken: string }>),

  forgotPinReset: (pinResetToken: string, newPin: string) =>
    http
      .post(E.forgotPinReset, { pinResetToken, newPin, workspaceId: activeWorkspaceId() })
      .then(unwrap<PinUnlockResult>),

  lock: () => http.post(E.lock, {}).then(unwrap<{ ok: true }>),

  /**
   * App Lock activity heartbeat. Fired (throttled) by the idle timer on real
   * user input so the backend slides the unlock TTL on the SAME signal that
   * resets the local idle timer - without this the request-driven BE clock
   * 423-locks a user who is active but not making API calls. Best-effort: the
   * caller swallows errors (a 423 still routes through the client interceptor,
   * which is the correct "already locked" outcome). NOT @SkipPinUnlock on the
   * backend, so the global PinUnlockGuard runs and performs the slide.
   */
  touch: () => http.post(E.pinTouch, {}).then(unwrap<{ unlockExpiresAt: string | null }>),

  /**
   * Set (or clear with `null`) the caller's App Lock idle timeout. The web
   * UI feeds one of the documented presets (see IDLE_PRESETS on the security
   * page); the backend re-validates against the same list. Returns the
   * resolved value for an optimistic `updateUser` into the auth store.
   */
  setIdleMs: (appLockIdleMs: number | null) =>
    http.patch(E.appLockIdleSet, { appLockIdleMs }).then(unwrap<{ appLockIdleMs: number | null }>),
};
