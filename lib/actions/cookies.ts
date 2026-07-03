'use server';

import { cookies } from 'next/headers';
import { ApiConfig } from '@/lib/api/config';
import { env } from '@/lib/env';

/**
 * Sync auth token from client (localStorage/Zustand) into an httpOnly cookie.
 * Called after login, register, google-auth, and token refresh.
 */
export async function syncAuthCookie(
  accessToken: string,
  refreshToken?: string | null,
  platformAccess?: string,
) {
  const cookieStore = await cookies();
  const opts = {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  };

  cookieStore.set(ApiConfig.token.storageKey, accessToken, opts);
  if (refreshToken) {
    cookieStore.set(ApiConfig.token.refreshStorageKey, refreshToken, opts);
  }
  if (platformAccess) {
    cookieStore.set('z360_platform_access', platformAccess, { ...opts, httpOnly: false });
  }
}

/**
 * Whether the current request carries a session (an access-token cookie is
 * present). Used by public Server Components (e.g. `/u/[slug]`) to decide
 * whether to make viewer-scoped calls and whether to render login-gated
 * sections. This is a presence check only -- a stale-but-present token still
 * reads as "signed in"; `serverHttp` self-heals staleness via its refresh
 * retry, and the backend remains the source of truth for what data a viewer
 * actually receives (e.g. it strips the rate card for a logged-out caller).
 */
export async function isViewerSignedIn(): Promise<boolean> {
  const cookieStore = await cookies();
  return !!cookieStore.get(ApiConfig.token.storageKey)?.value;
}

/**
 * Clear auth cookies on logout.
 */
export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ApiConfig.token.storageKey);
  cookieStore.delete(ApiConfig.token.refreshStorageKey);
  cookieStore.delete('z360_platform_access');
}

/**
 * OQ-1 (auth-hardening): read the web-origin httpOnly refresh cookie value
 * server-side. The browser CANNOT read this (httpOnly), so the only way to use
 * the refresh token from the client is via a server action (`refreshSession`).
 * Returns undefined when absent (logged-out / pre-deploy).
 */
export async function getRefreshCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ApiConfig.token.refreshStorageKey)?.value;
}

/** Server-side read of the web-origin access-token cookie (httpOnly). */
export async function getAccessCookieValue(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(ApiConfig.token.storageKey)?.value;
}
