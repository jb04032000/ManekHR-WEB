'use server';

/**
 * ERP policy - server actions. The ERP mirror of the Connect policy actions
 * in the removed Connect profile.actions. Calls the backend `me/erp-*`
 * endpoints through the httpOnly-cookie-authed `serverHttp` client.
 * See docs/connect/specs/2026-05-19-dual-policy-design.md.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/**
 * ERP policy-consent state for the caller. Read by the ERP shell layout
 * (`app/dashboard/layout.tsx`) to decide whether to show the policy gate.
 * The layout fails open on `{ ok: false }` - see the spec §4.3.
 */
export async function getErpEntryState(): Promise<Result<{ erpPolicyAccepted: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/erp-entry');
    return { ok: true, data: unwrapServer<{ erpPolicyAccepted: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Record the caller's one-time ERP policy/terms acceptance.
 *
 * Accepts an optional `fallbackAccessToken` for the signup flow - back-to-back
 * server actions can race the Set-Cookie propagation from `syncAuthCookie`,
 * leaving this action without an auth cookie. The freshly-minted token bypasses
 * the race via `serverHttp(fallbackToken)`. Mirrors `acceptConnectPolicy`.
 */
export async function acceptErpPolicy(
  fallbackAccessToken?: string,
): Promise<Result<{ acceptedAt: string }>> {
  console.info('[acceptErpPolicy] starting', {
    fallbackTokenPresent: !!fallbackAccessToken,
    fallbackTokenLen: fallbackAccessToken?.length ?? 0,
  });
  try {
    const http = await serverHttp(fallbackAccessToken);
    const res = await http.post('/me/erp-policy-accept', {});
    const data = unwrapServer<{ acceptedAt: string }>(res);
    console.info('[acceptErpPolicy] SUCCESS', {
      status: res.status,
      acceptedAt: data?.acceptedAt,
    });
    return { ok: true, data };
  } catch (e) {
    const err = e as { response?: { status?: number; data?: unknown }; message?: string };
    console.error('[acceptErpPolicy] FAILED', {
      status: err?.response?.status,
      data: err?.response?.data,
      message: err?.message,
    });
    return { ok: false, error: toError(e) };
  }
}
