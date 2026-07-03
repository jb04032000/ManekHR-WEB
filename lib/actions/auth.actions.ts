'use server';

import axios from 'axios';
import { headers } from 'next/headers';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { env } from '@/lib/env';
import type { User, AuthResult, RegisterPayload } from '@/types';
import {
  syncAuthCookie,
  clearAuthCookie,
  getRefreshCookieValue,
  getAccessCookieValue,
} from './cookies';
// Shared network-failure detection + friendly fallback (single source of truth
// in lib/format/http-errors). Used so a backend-down / timeout never leaks a raw
// axios string and so the auth UI can localize via the NETWORK_UNREACHABLE code.
import { isNetworkError, NETWORK_UNREACHABLE_MESSAGE } from '@/lib/format/http-errors';

// Stable code surfaced to the auth UI when the backend cannot be reached at all
// (server down, DNS, connection refused, timeout). Maps to
// auth.errors.codes.NETWORK_UNREACHABLE in all four locales via
// `useAuthErrorMessage` (lib/format/auth-error-codes). Keep the literal in sync
// with LOCALIZED_AUTH_ERROR_CODES.
const NETWORK_UNREACHABLE_CODE = 'NETWORK_UNREACHABLE';

const E = ApiEndpoints.auth;
// Server-only backend base URL for the cookie-driven refresh (OQ-1). Uses the
// private var so the refresh round-trip never depends on the client bundle.
const E_REFRESH_BASE = env.serverBackendApiUrl;

type ActionResult<T> =
  | { ok: true; data: T }
  // `errorCode` (auth-hardening Pillar 3): the BE's structured error code (e.g.
  // OTP_LOCKED, PIN_INCORRECT, SESSION_LIMIT_REACHED) when present, so the client
  // can localize via `useAuthErrorMessage` (lib/format/auth-error-codes). `error`
  // stays the human-readable fallback. Additive — existing callers ignore it.
  | { ok: false; error: string; errorCode?: string; sessionData?: unknown };

/**
 * Pull the BE structured error `code` out of a thrown axios error (server
 * actions strip `response`, so we read it here while it is still available).
 * Returns undefined when the BE did not send a code. The BE nests the code at
 * either `data.code` or `data.data.code` depending on the throw shape.
 */
function extractErrorCode(e: unknown): string | undefined {
  // Backend-unreachable (no HTTP response / serialised timeout) is reported as a
  // stable NETWORK_UNREACHABLE code so the UI shows the localized friendly
  // message instead of a raw axios string. Checked before the BE-code read
  // because a network error never carries a response body with a code.
  if (isNetworkError(e)) return NETWORK_UNREACHABLE_CODE;
  if (!axios.isAxiosError(e)) return undefined;
  const data = e.response?.data as { code?: string; data?: { code?: string } } | undefined;
  return data?.data?.code ?? data?.code;
}

function extractError(e: unknown): string {
  // Transport-layer failure first: backend down / timeout / connection refused
  // must surface the friendly fallback, never the raw "timeout of 15000ms
  // exceeded" string. Mirrors extractErrorMessage in lib/format/http-errors.
  if (isNetworkError(e)) return NETWORK_UNREACHABLE_MESSAGE;
  if (axios.isAxiosError(e)) {
    const data = e.response?.data as Record<string, unknown> | undefined;
    const raw = data?.message ?? data?.error;
    if (typeof raw === 'string' && raw) return raw;
    if (raw && typeof raw === 'object') {
      const nested = (raw as Record<string, unknown>).message;
      if (typeof nested === 'string' && nested) return nested;
    }
    const status = e.response?.status;
    if (status === 401) return 'Incorrect password. Please try again.';
    if (status === 403) {
      const msg = data?.message as string | undefined;
      if (msg && msg.toLowerCase().includes('deactivated')) {
        return `Account deactivated: ${msg}`;
      }
      return 'Access denied. Contact support.';
    }
    if (status === 404) return 'Account not found. Please check your details.';
    if (status === 429) return 'Too many attempts. Please wait and try again.';
    if (status && status >= 500) return 'Server error. Please try again later.';
  }
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export async function checkUser(identifier: string) {
  const http = await serverHttp();
  return http
    .post(E.checkUser, { identifier })
    .then(unwrapServer<{ exists: boolean; hasPassword: boolean }>);
}

export async function login(
  identifier: string,
  password: string,
): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';

  try {
    const result = await http
      .post(E.login, {
        identifier,
        password,
        platform: 'web',
        deviceName: 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken);
    return { ok: true, data: result };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      const data = e.response.data as any;
      const code = data?.data?.code ?? data?.code;
      if (code === 'SESSION_LIMIT_REACHED') {
        return {
          ok: false,
          error: 'SESSION_LIMIT_REACHED',
          sessionData: data?.data ?? data,
        };
      }
    }
    // errorCode lets the login UI localize a backend-down (NETWORK_UNREACHABLE)
    // via useAuthErrorMessage instead of rendering the raw axios string.
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function register(payload: RegisterPayload): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';

  try {
    const result = await http
      .post(E.register, {
        ...payload,
        platform: 'web',
        deviceName: 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode lets register UIs localize a backend-down (NETWORK_UNREACHABLE).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function googleAuth(idToken: string): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';

  try {
    const result = await http
      .post(E.google, {
        idToken,
        platform: 'web',
        deviceName: 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    return { ok: true, data: result };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      const data = e.response.data as any;
      const code = data?.data?.code ?? data?.code;
      if (code === 'SESSION_LIMIT_REACHED') {
        return {
          ok: false,
          error: 'SESSION_LIMIT_REACHED',
          sessionData: data?.data ?? data,
        };
      }
    }
    // errorCode lets the Google sign-in path localize a backend-down.
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function forgotPassword(
  identifier: string,
): Promise<ActionResult<{ message: string }>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.forgotPassword, { identifier })
      .then(unwrapServer<{ message: string }>);
    return { ok: true, data: result };
  } catch (e) {
    // BE throws explicit IDENTIFIER_NOT_REGISTERED / EMAIL_NOT_ON_FILE /
    // RESET_DISPATCH_FAILED. Without this catch, Next.js serialises the
    // axios error and the FE sees the default "Request failed with status
    // code 400" instead of the BE's user-friendly message.
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const http = await serverHttp();
  return http.post(E.resetPassword, { token, newPassword }).then(unwrapServer<{ message: string }>);
}

/**
 * Authenticated reset-after-OTP - calls the new BE endpoint that allows
 * setting a new password without supplying the current one, gated on the
 * `forgotPasswordReset` JWT claim. On success the BE issues a fresh token
 * pair WITHOUT the claim; the FE swaps tokens + clears the flag.
 */
export async function changePasswordAfterForgot(payload: {
  newPassword: string;
  // OQ-1: optional — the BE reads the prior refresh token from the httpOnly
  // cookie (forwarded by serverHttp). Kept for callers that still pass it.
  refreshToken?: string;
}): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';
  // Forward the cookie refresh token to the BE body (the BE denylists the old
  // pair from it). Cookie wins over any passed value.
  const cookieRefresh = await getRefreshCookieValue();
  try {
    const result = await http
      .post(E.changePasswordAfterForgot, {
        newPassword: payload.newPassword,
        refreshToken: cookieRefresh ?? payload.refreshToken,
        platform: 'web',
        deviceName: 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function sendVerificationEmail(
  email: string,
): Promise<ActionResult<{ message: string }>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.sendVerificationEmail, { email })
      .then(unwrapServer<{ message: string }>);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function verifyEmail(
  token: string,
  email?: string,
): Promise<ActionResult<{ message: string }>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.verifyEmail, email ? { token, email } : { token })
      .then(unwrapServer<{ message: string }>);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

/**
 * Returns the signed-in user from `/auth/me`. The BE wraps the user with
 * `subscription` / `workspaces` / `forgotPasswordReset` siblings; this
 * helper unpacks just the `user` field so callers can read `me.name`,
 * `me.profilePicture`, etc. directly. (Earlier this cast the whole
 * envelope as `User`, which silently returned `undefined` for every
 * field on the user record.)
 */
export async function getMe(): Promise<User> {
  const http = await serverHttp();
  const envelope = await http.get(E.me).then(unwrapServer<{ user: User }>);
  return envelope.user;
}

export async function setupAdmin(
  identifier: string,
  secret: string,
): Promise<ActionResult<{ message: string }>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.setupAdmin, { identifier, secret })
      .then(unwrapServer<{ message: string }>);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function logout(refreshToken?: string) {
  // OQ-1 (auth-hardening): the refresh token now lives in an httpOnly cookie,
  // not localStorage. `serverHttp` already authenticates via the access cookie
  // and forwards the refresh cookie to the BE in the body so the BE can denylist
  // the right jti; the BE ALSO clears its own httpOnly refresh cookie. We then
  // clear the web-origin cookies. `refreshToken` arg is now optional (the cookie
  // is authoritative) and kept only for backward-compat callers.
  const http = await serverHttp();
  const cookieRefresh = await getRefreshCookieValue();
  const result = await http
    .post(E.logout, { refreshToken: cookieRefresh ?? refreshToken })
    .then(unwrapServer<{ message: string }>);
  await clearAuthCookie();
  return result;
}

/**
 * OQ-1 (auth-hardening): browser-side token refresh WITHOUT exposing the refresh
 * token to JavaScript. The client axios 401 interceptor calls this server action
 * instead of reading a localStorage refresh token: it reads the web-origin
 * httpOnly refresh cookie, calls BE `/auth/refresh` (which rotates + re-sets its
 * own httpOnly cookie), writes the rotated pair back to the web-origin cookies,
 * and returns ONLY the short-lived access token to the browser. The refresh
 * token never crosses into client-readable storage.
 *
 * Cross-module: consumed by `lib/api/client.ts` (browser 401 retry). Mirrors the
 * server-render self-heal in `lib/api/server-client.ts`. Returns null when no
 * refresh cookie exists or the BE rejects it (caller then bounces to /auth).
 */
export async function refreshSession(): Promise<{ accessToken: string } | null> {
  const cookieRefresh = await getRefreshCookieValue();
  if (!cookieRefresh) return null;
  const accessCookie = await getAccessCookieValue();
  try {
    const res = await axios.post(
      `${E_REFRESH_BASE}/auth/refresh`,
      { refreshToken: cookieRefresh },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-platform': 'web',
          // Forward the about-to-be-rotated access token so the BE retires its
          // session row (same contract as server-client + browser-client).
          ...(accessCookie ? { Authorization: `Bearer ${accessCookie}` } : {}),
        },
        timeout: 15_000,
      },
    );
    const body = res.data as {
      data?: { accessToken?: string; refreshToken?: string; platformAccess?: string };
      accessToken?: string;
      refreshToken?: string;
      platformAccess?: string;
    };
    const accessToken = body?.data?.accessToken ?? body?.accessToken ?? null;
    const refreshToken = body?.data?.refreshToken ?? body?.refreshToken ?? cookieRefresh;
    const platformAccess = body?.data?.platformAccess ?? body?.platformAccess;
    if (!accessToken) return null;
    // Persist the rotated pair into the web-origin httpOnly cookies so the next
    // server render + the browser both see a valid session.
    await syncAuthCookie(accessToken, refreshToken, platformAccess);
    return { accessToken };
  } catch {
    return null;
  }
}

/**
 * Used by the SessionLimitModal terminate-and-sign-in flow when the user is
 * NOT yet authenticated - re-submits credentials together with the sessionId
 * to terminate. Backend endpoint is @Public (mirrors /auth/login throttle).
 */
export async function terminateAndLoginUnauth(payload: {
  identifier: string;
  password: string;
  sessionId: string;
  deviceName?: string;
}): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';
  try {
    const result = await http
      .post(E.terminateAndLogin, {
        ...payload,
        platform: 'web',
        deviceName: payload.deviceName ?? 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

// ─────────────────────── SMS-OTP server actions ───────────────────────
// Mirrors the email-verify shape: send / verify / resend. Verify-otp returns
// AuthResult (issues tokens) for login / register / forgot. The forgot path
// includes `mustResetPassword: true` so the FE post-login redirect routes to
// /dashboard/settings/security/change-password instead of /dashboard.

export type OtpFlowType = 'login' | 'register' | 'forgot';

export interface SendOtpResponse {
  ok: true;
  sent: true;
  expiresAt: string;
  resendCooldownSec: number;
  mockMode: boolean;
  idempotent?: true;
}

export async function sendOtp(
  mobile: string,
  flowType: OtpFlowType,
): Promise<ActionResult<SendOtpResponse>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.sendOtp, { mobile, flowType })
      .then(unwrapServer<SendOtpResponse>);
    return { ok: true, data: result };
  } catch (e) {
    // Surface OTP_RATE_LIMITED / OTP_LOCKED etc. for FE localization (Pillar 3).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

/**
 * Send a registration OTP to the user's email. Mirrors `sendOtp` for the
 * SMS register flow but channel-keyed for email - the OTP is consumed by
 * `register({...,emailOtp})` to gate User+Workspace creation. No `mockMode`
 * field - email path always sends a real mail (no mock toggle today).
 */
export async function sendEmailRegistrationOtp(
  email: string,
): Promise<ActionResult<{ expiresAt: string; resendCooldownSec: number }>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.sendEmailRegistrationOtp, { email })
      .then(unwrapServer<{ expiresAt: string; resendCooldownSec: number }>);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function resendOtp(
  mobile: string,
  flowType: OtpFlowType,
): Promise<ActionResult<SendOtpResponse>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.resendOtp, { mobile, flowType })
      .then(unwrapServer<SendOtpResponse>);
    return { ok: true, data: result };
  } catch (e) {
    // Surface OTP_RATE_LIMITED / OTP_LOCKED etc. for FE localization (Pillar 3).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function verifyOtp(payload: {
  mobile: string;
  otp?: string;
  /** MSG91 Widget channel — the verified access-token from
   *  useMsg91Widget().verifyOtp(), sent instead of `otp`. Exactly one of
   *  `otp`/`accessToken` must be present; the backend enforces this. */
  accessToken?: string;
  flowType: OtpFlowType;
  name?: string;
  password?: string;
  /**
   * Wave 4.8 (2026-05-10) - atomic signup-and-accept-invite (mobile path).
   * Passing the raw invite token alongside register-flow OTP creates a User
   * AND joins the existing workspace via the bridge invite row in one shot.
   */
  inviteToken?: string;
  /**
   * Wave 5 (2026-05-21) - atomic product-policy consent at signup. BE stamps
   * the matching `*PolicyAcceptedAt` field as part of user creation.
   */
  acceptedPolicy?: 'connect' | 'erp';
  /**
   * Task 22 (2026-06-19) - referral program capture. Forwarded to the BE
   * alongside register-flow OTP; BE no-ops when the program is off.
   */
  referralCode?: string;
}): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';
  try {
    const result = await http
      .post(E.verifyOtp, {
        ...payload,
        platform: 'web',
        deviceName: 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    return { ok: true, data: result };
  } catch (e) {
    if (axios.isAxiosError(e) && e.response?.status === 403) {
      const data = e.response.data as { data?: Record<string, unknown>; code?: string };
      const code = (data?.data as { code?: string } | undefined)?.code ?? data?.code;
      if (code === 'SESSION_LIMIT_REACHED') {
        return {
          ok: false,
          error: 'SESSION_LIMIT_REACHED',
          errorCode: 'SESSION_LIMIT_REACHED',
          sessionData: data?.data ?? data,
        };
      }
    }
    // Surface the BE code (OTP_LOCKED / OTP_INCORRECT / ...) for FE localization.
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

/**
 * SessionLimitModal terminate-and-sign-in for the OTP path. Caller passes the
 * mobile + a freshly verified OTP + the sessionId to terminate. Backend
 * re-verifies the OTP, terminates the target session, and issues new tokens.
 */
export async function terminateAndOtpLogin(payload: {
  mobile: string;
  otp?: string;
  /** MSG91 Widget channel — the verified access-token from
   *  useMsg91Widget().verifyOtp(), sent instead of `otp`. Exactly one of
   *  `otp`/`accessToken` must be present; the backend enforces this. */
  accessToken?: string;
  sessionId: string;
}): Promise<ActionResult<AuthResult>> {
  const http = await serverHttp();
  const headersList = await headers();
  const userAgent = headersList.get('user-agent') ?? 'Web Browser';
  try {
    const result = await http
      .post(E.terminateAndOtpLogin, {
        ...payload,
        platform: 'web',
        deviceName: 'Web Browser',
        userAgent,
      })
      .then(unwrapServer<AuthResult>);
    await syncAuthCookie(result.accessToken, result.refreshToken, result.platformAccess);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function sendMobileVerifyOtp(mobile?: string): Promise<ActionResult<SendOtpResponse>> {
  const http = await serverHttp();
  try {
    const result = await http
      .post(E.sendMobileVerifyOtp, mobile ? { mobile } : {})
      .then(unwrapServer<SendOtpResponse>);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}

export async function verifyMobile(payload: {
  otp?: string;
  /** MSG91 Widget channel — the verified access-token from
   *  useMsg91Widget().verifyOtp(), sent instead of `otp`. Exactly one of
   *  `otp`/`accessToken` must be present; the backend enforces this. */
  accessToken?: string;
}): Promise<ActionResult<{ ok: true }>> {
  const http = await serverHttp();
  try {
    const result = await http.post(E.verifyMobile, payload).then(unwrapServer<{ ok: true }>);
    return { ok: true, data: result };
  } catch (e) {
    // errorCode surfaces NETWORK_UNREACHABLE on a backend-down so the auth UI
    // localizes the friendly message (lib/format/auth-error-codes).
    return { ok: false, error: extractError(e), errorCode: extractErrorCode(e) };
  }
}
