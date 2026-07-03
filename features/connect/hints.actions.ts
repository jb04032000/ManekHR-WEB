'use server';

/**
 * Connect UI-hint dismissal - server action. Records a permanently-dismissed
 * hint on the backend (`User.dismissedHints`) through the httpOnly-cookie-authed
 * `serverHttp` client, so the dismissal survives sign-out and follows the user
 * across devices. See docs/connect/plans/2026-05-19-nudge-dismissal.md.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';

/** UI hints a user can permanently dismiss - mirrors the backend `DISMISSIBLE_HINTS`. */
export type DismissibleHint = 'connect_explore' | 'connect_profile_card' | 'connect_erp_crosssell';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Record that the caller dismissed a UI hint. Returns the updated hint list. */
export async function dismissHint(
  hint: DismissibleHint,
): Promise<Result<{ dismissedHints: string[] }>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/me/dismiss-hint', { hint });
    return { ok: true, data: unwrapServer<{ dismissedHints: string[] }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
