/**
 * HTTP Client
 * Axios instance with request/response interceptors
 */
import axios, { AxiosInstance, AxiosError, AxiosResponse, AxiosRequestConfig } from 'axios';
import { ApiConfig } from './config';
import { refreshSession } from '@/lib/actions/auth.actions';
import { useAuthStore } from '@/lib/store';
import { usePermissionsStore } from '@/lib/stores/permissions-store';

const PLATFORM_HEADER = 'x-platform';
const PLATFORM_VALUE = 'web';

// ── Create instance ────────────────────────────────
// OQ-1 (auth-hardening): `withCredentials: true` so the browser sends the BE
// httpOnly refresh cookie to the API on cross-origin requests (and any future
// cookie-based auth). The refresh token is NO LONGER kept in localStorage; the
// 401 retry below refreshes via a server action that reads the httpOnly cookie.
const http: AxiosInstance = axios.create({
  baseURL: ApiConfig.baseURL,
  timeout: ApiConfig.timeout,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    [PLATFORM_HEADER]: PLATFORM_VALUE,
  },
});

// ── Request interceptor - attach token ────────────
http.interceptors.request.use((config) => {
  config.headers[PLATFORM_HEADER] = PLATFORM_VALUE;
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(ApiConfig.token.storageKey);
    if (token) config.headers[ApiConfig.token.headerKey] = `${ApiConfig.token.prefix} ${token}`;
  }
  return config;
});

// ── Logout teardown guard ─────────────────────────
// Flipped true by `beginLogout()` the instant a user-initiated sign-out starts
// (hooks/useLogout.ts). During teardown every in-flight request 401s as soon as
// the token is revoked; without this guard each 401 would run the refresh +
// hard-redirect path below ONCE PER REQUEST (doubled by `retry: 1`), flooding
// the console and racing the logout navigation. While logging out we let any
// failure reject quietly. The hard reload to /auth ends the flow and resets this
// back to false on the fresh page. Keep in sync with useLogout.
let isLoggingOut = false;
export function beginLogout(): void {
  isLoggingOut = true;
}

// ── Response interceptor - refresh on 401 ─────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)));
  failedQueue = [];
};

// ── App Lock (Quick PIN) - 423 queue + drain ──────
// When the backend returns 423 `APP_LOCKED`, the request is queued here and
// replayed once the user successfully unlocks (LockOverlay → /auth/pin-verify
// → store.setAppLocked(false) → drain). Mirrors the 401-refresh queue shape.
type LockedQueueItem = {
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
  original: AxiosRequestConfig;
};
let lockedQueue: LockedQueueItem[] = [];

const drainLockedQueue = () => {
  const items = lockedQueue;
  lockedQueue = [];
  items.forEach((p) => {
    http(p.original).then(p.resolve).catch(p.reject);
  });
};

if (typeof window !== 'undefined') {
  let prevLocked = useAuthStore.getState().isAppLocked;
  useAuthStore.subscribe((state) => {
    const next = state.isAppLocked;
    if (prevLocked === true && next === false) {
      drainLockedQueue();
    }
    prevLocked = next;
  });
}

// Phase 2.3 - detect permission drift via X-Permission-Version response header.
// Runs on every successful workspace-scoped response. If the version changed
// since the last fetch, `noticeVersion` invalidates the permissions cache so
// the next `ensure()` call re-fetches updated permissions automatically.
// Uses getState() so this works outside React render (no hook rules apply).
http.interceptors.response.use((response) => {
  const version = response.headers['x-permission-version'];
  // TEMP DIAG (2026-05-22): trace which endpoint carries the version header
  // and how often, to find the source of the /me/permissions refetch loop.
  // Prod-safe: silent unless `localStorage.z360_perm_diag === '1'`. REMOVE
  // once root cause confirmed.
  if (typeof window !== 'undefined') {
    try {
      if (window.localStorage?.getItem('z360_perm_diag') === '1') {
        console.info(
          `[PERMDIAG http] ${response.config?.method?.toUpperCase() ?? 'GET'} ` +
            `${response.config?.url ?? ''} -> ${response.status} hdr=${version ?? 'none'}`,
        );
      }
    } catch {
      /* ignore */
    }
  }
  if (version && typeof version === 'string') {
    const url = response.config?.url ?? '';
    const match = url.match(/\/workspaces\/([^/]+)\//);
    if (match) {
      const wsId = match[1];
      usePermissionsStore.getState().noticeVersion(wsId, version);
    }
  }
  return response;
});

http.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    // In-progress sign-out: the session is being torn down, so any failure here
    // (a 401 from the just-revoked token, a queued 423, etc.) is expected. Reject
    // quietly - skip the refresh / app-lock-queue / redirect handling below,
    // which would otherwise storm the console and race the logout navigation.
    // Set by beginLogout(); reset by the hard reload to /auth. See useLogout.
    if (isLoggingOut) {
      return Promise.reject(error);
    }
    const original = error.config as AxiosError['config'] & { _retry?: boolean };
    const errorData = error.response?.data as any;
    const isPlatformRestricted =
      error.response?.status === 403 && errorData?.code === 'PLATFORM_RESTRICTED';

    if (isPlatformRestricted && typeof window !== 'undefined') {
      localStorage.removeItem('subscription');
      window.location.href = '/platform-restricted';
      return Promise.reject(error);
    }

    // ── App Lock (Quick PIN) - 423 → queue and replay after unlock ──
    const isAppLocked = error.response?.status === 423 && errorData?.code === 'APP_LOCKED';
    if (isAppLocked && original && typeof window !== 'undefined') {
      const reason = errorData?.reason as string | undefined;
      const store = useAuthStore.getState();
      if (reason === 'pin_setup_required') {
        store.setPinSetupRequired(true);
      } else {
        store.setAppLocked(true);
      }
      return new Promise((resolve, reject) => {
        lockedQueue.push({ resolve, reject, original });
      });
    }

    if (error.response?.status === 401 && original && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (original.headers)
            original.headers[ApiConfig.token.headerKey] = `${ApiConfig.token.prefix} ${token}`;
          return http(original);
        });
      }
      original._retry = true;
      isRefreshing = true;
      try {
        // OQ-1 (auth-hardening): refresh via a SERVER ACTION that reads the
        // httpOnly refresh cookie (the refresh token is no longer in
        // localStorage, so XSS can't read it). The action calls BE /auth/refresh,
        // rotates + re-sets the httpOnly cookies, and returns ONLY the new
        // short-lived access token. We mirror that access token into localStorage
        // for the request interceptor's Authorization header.
        const refreshed = await refreshSession();
        const newToken = refreshed?.accessToken;
        if (newToken) {
          if (typeof window !== 'undefined') {
            localStorage.setItem(ApiConfig.token.storageKey, newToken);
            // Keep the in-memory store's accessToken in sync so components that
            // read it (and the next cookie sync) use the fresh token.
            useAuthStore.setState({ accessToken: newToken });
          }
          processQueue(null, newToken);
          if (original.headers)
            original.headers[ApiConfig.token.headerKey] = `${ApiConfig.token.prefix} ${newToken}`;
          return http(original);
        }
        // No refresh cookie or BE rejected it -> session is truly gone.
        processQueue(error, null);
        if (typeof window !== 'undefined') {
          localStorage.clear();
          window.location.href = '/auth';
        }
        return Promise.reject(error);
      } catch (refreshError) {
        processQueue(refreshError, null);
        if (typeof window !== 'undefined') {
          localStorage.clear();
          window.location.href = '/auth';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

/**
 * Extract data from backend's wrapped response envelope.
 * Backend returns `{ success: true, data: <payload> }` - this extracts the inner payload.
 */
export function unwrap<T>(res: AxiosResponse): T {
  return res?.data?.data !== undefined ? res.data.data : res?.data;
}

export default http;
