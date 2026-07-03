/**
 * Server-side HTTP Client
 *
 * Used exclusively in Server Actions / Route Handlers.
 * Reads auth token from httpOnly cookies - never touches localStorage.
 * Uses PRIVATE env var `BACKEND_API_URL` (not exposed to client bundle).
 */
import axios, { AxiosError, AxiosResponse } from 'axios';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { env } from '@/lib/env';
import { ApiConfig } from './config';

/**
 * Private backend URL - NOT prefixed with NEXT_PUBLIC_ so it stays server-only.
 * Falls back to the public var for backward compatibility during migration.
 */
const SERVER_BASE_URL = env.serverBackendApiUrl;

const ACCESS_COOKIE = ApiConfig.token.storageKey;
const REFRESH_COOKIE = ApiConfig.token.refreshStorageKey;
const AUTH_HEADER = ApiConfig.token.headerKey;
const TOKEN_PREFIX = ApiConfig.token.prefix;

/** httpOnly cookie options - must stay in sync with `syncAuthCookie` (lib/actions/cookies.ts). */
const AUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days
};

/**
 * Exchange a refresh token for a fresh access+refresh pair via the backend
 * `POST /auth/refresh`. Wrapped in React `cache()` so every `serverHttp`
 * instance in a single render that hits a rotated/revoked cookie token shares
 * ONE refresh round-trip: the ERP access token lives only 15 min and each
 * `/auth/refresh` revokes the prior access token, so uncoordinated refreshes
 * are themselves what make the cookie token go stale.
 */
const refreshServerTokens = cache(
  async (
    refreshToken: string,
    // Current (about-to-be-rotated) access token. Forwarded as the Bearer header
    // so the backend retires its session row (POST /auth/refresh reads it as
    // `oldAccessToken`). Without it, each server-side refresh inserted a new
    // session and removed none, ballooning the active-session count past the cap.
    // The token is stale here, but the session row is keyed by token HASH so the
    // match still holds.
    oldAccessToken?: string | null,
  ): Promise<{ accessToken: string; refreshToken: string } | null> => {
    try {
      const res = await axios.post(
        `${SERVER_BASE_URL}/auth/refresh`,
        { refreshToken },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-platform': 'web',
            ...(oldAccessToken ? { [AUTH_HEADER]: `${TOKEN_PREFIX} ${oldAccessToken}` } : {}),
          },
          timeout: ApiConfig.timeout,
        },
      );
      const body = res.data as {
        data?: { accessToken?: string; refreshToken?: string };
        accessToken?: string;
        refreshToken?: string;
      };
      const accessToken = body?.data?.accessToken ?? body?.accessToken ?? null;
      const newRefresh = body?.data?.refreshToken ?? body?.refreshToken ?? refreshToken;
      if (!accessToken) return null;
      return { accessToken, refreshToken: newRefresh };
    } catch {
      return null;
    }
  },
);

/**
 * Create a one-shot axios instance for a single server-side request.
 * Reads the auth token from the httpOnly cookie set by `syncAuthCookie`.
 * Accepts an optional fallback token for cases where the cookie may not yet be set.
 *
 * On a `401` the instance refreshes the cookie token once and replays the
 * request. Server-rendered pages would otherwise hard-fail every time the
 * 15-min access token rotated under them (`Token has been revoked`) - unlike
 * the browser client, server components have no refresh interceptor of their
 * own, so this is where they self-heal.
 */
export async function serverHttp(fallbackToken?: string) {
  const cookieStore = await cookies();
  // **Fallback token wins over the cookie when explicitly passed.** The
  // signup flow has the freshly-minted access token in hand and passes it
  // here; the cookie set by `syncAuthCookie` may not yet be visible to a
  // back-to-back server action OR may be a STALE token from a previous
  // session that's about to be replaced. Preferring the explicitly-supplied
  // token means the signup-time policy-accept request is always authed with
  // the right credential, regardless of cookie state. Callers that pass no
  // arg (the vast majority) continue to use the cookie as before.
  const token = fallbackToken ?? cookieStore.get(ACCESS_COOKIE)?.value ?? null;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value ?? null;

  const instance = axios.create({
    baseURL: SERVER_BASE_URL,
    timeout: ApiConfig.timeout,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { [AUTH_HEADER]: `${TOKEN_PREFIX} ${token}` } : {}),
    },
  });

  console.info(
    '[serverHttp] token found:',
    !!token,
    'baseURL:',
    SERVER_BASE_URL,
    'auth header:',
    token ? `${AUTH_HEADER}: ${TOKEN_PREFIX} <token>` : 'NONE',
  );

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const status = error?.response?.status;
      const original = error.config as (AxiosError['config'] & { _retry?: boolean }) | undefined;

      // ── 401 → refresh the cookie token once, then replay ──────────────
      // A revoked-but-unexpired access token sails through the Edge
      // middleware (it can only decode `exp`, not check the denylist), so
      // the cookie can hold a dead token. Refresh + retry here so the
      // server render recovers instead of surfacing a hard 401.
      if (status === 401 && refreshToken && original && !original._retry) {
        original._retry = true;
        // Pass the current access token so the backend retires its session row
        // on rotation (prevents server-side refreshes from ballooning sessions).
        const refreshed = await refreshServerTokens(refreshToken, token);
        if (refreshed) {
          // Persist the rotated pair. This succeeds inside a Server Action /
          // Route Handler; in a pure Server Component render `cookies().set`
          // throws - swallow it, the in-memory retry below still works and
          // the middleware re-persists the cookie on the next navigation.
          try {
            cookieStore.set(ACCESS_COOKIE, refreshed.accessToken, AUTH_COOKIE_OPTS);
            cookieStore.set(REFRESH_COOKIE, refreshed.refreshToken, AUTH_COOKIE_OPTS);
          } catch {
            // Read-only cookie context (Server Component render) - expected.
          }
          if (original.headers) {
            original.headers[AUTH_HEADER] = `${TOKEN_PREFIX} ${refreshed.accessToken}`;
          }
          return instance(original);
        }
      }

      // When the backend never answered there is no `error.response`, so
      // `status` is undefined and the body-derived message is useless. Surface
      // the TRANSPORT reason instead - `error.code` (ECONNREFUSED = backend
      // down/unreachable, ECONNABORTED = the 15s timeout fired, ERR_CANCELED =
      // the server render was aborted) + `error.message` - so the log says WHY
      // the call failed rather than printing "undefined ... unknown".
      const data = error?.response?.data as
        | { error?: { message?: string }; message?: string }
        | undefined;
      const noResponse = !error?.response;
      const message = noResponse
        ? `${error?.code ?? 'NETWORK'}: ${error?.message ?? 'no response from backend'}`
        : data?.error?.message || data?.message || 'unknown';
      const statusLabel = status ?? error?.code ?? 'no-response';
      const url = error?.config?.url;
      const line = `[serverHttp] ${statusLabel} error on ${error?.config?.method?.toUpperCase()} ${url} - ${message}`;
      // A timeout (ECONNABORTED) on a call that opted into a SHORTER-than-default
      // timeout is an INTENTIONAL fail-fast - a best-effort widget capping its own
      // wait (e.g. the feed right-rail calls at 5s vs the 15s default) so it can't
      // hold a render. The caller degrades gracefully (hides/empties on ok:false),
      // so this is expected, not a fault. A timeout on the shared default still
      // means a genuinely slow/unreachable backend and stays a red error.
      const reqTimeout = (error?.config as { timeout?: number } | undefined)?.timeout;
      const isFastFailTimeout =
        error?.code === 'ECONNABORTED' &&
        typeof reqTimeout === 'number' &&
        reqTimeout > 0 &&
        reqTimeout < ApiConfig.timeout;
      // A 423 APP_LOCKED is an expected transient auth state (the user must
      // re-enter their Quick PIN), not a fault. An aborted render (ERR_CANCELED)
      // is likewise benign - Next can cancel an in-flight server render on
      // navigation/prefetch. A fast-fail timeout (above) is by design. Log those
      // at warn so they do not read as a red error; genuine connection failures
      // (ECONNREFUSED, or a default-timeout timeout) stay red.
      if (status === 423 || error?.code === 'ERR_CANCELED' || isFastFailTimeout) console.warn(line);
      else console.error(line);
      return Promise.reject(error);
    },
  );

  return instance;
}

/** Extract data from backend's wrapped response envelope (server-side). */
export function unwrapServer<T>(res: AxiosResponse): T {
  try {
    // Backend wraps responses in { success: true, data: ... }
    // For paginated responses, data contains { data: [], total, page, limit }
    // Return the entire data object to preserve pagination metadata
    if (res?.data?.data !== undefined) return res.data.data;
    if (res?.data !== undefined && res.data !== null) return res.data;
    return undefined as unknown as T;
  } catch (err) {
    console.error('[unwrapServer] Failed to unwrap response:', res?.data, err);
    throw err;
  }
}
