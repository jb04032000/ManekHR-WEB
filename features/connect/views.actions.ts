'use server';

/**
 * Server actions for Connect view-tracking. `recordConnectView` is a
 * fire-and-forget beacon (auth derives the viewer from the cookie; an anonymous
 * call 401s and is swallowed). `getStorefrontViewSummary` is owner-scoped on the
 * backend and powers the storefront analytics (Overview stat + 30d sparkline +
 * per-listing view counts).
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from './profile.types';

export type ConnectViewTarget = 'storefront' | 'listing';

export interface StorefrontViewSummary {
  views7d: number;
  views30d: number;
  series: { date: string; count: number }[];
  byListing: { listingId: string; views7d: number }[];
}

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

/** Record one view (deduped per viewer/day server-side). Best-effort, never throws. */
export async function recordConnectView(
  targetType: ConnectViewTarget,
  targetId: string,
): Promise<{ ok: boolean }> {
  try {
    const http = await serverHttp();
    await http.post('/connect/views', { targetType, targetId });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/** A storefront's view roll-up (owner-only on the backend). */
export async function getStorefrontViewSummary(
  storefrontId: string,
): Promise<ActionResult<StorefrontViewSummary>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`/connect/views/storefront/${storefrontId}/summary`);
    return { ok: true, data: unwrapServer<StorefrontViewSummary>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
