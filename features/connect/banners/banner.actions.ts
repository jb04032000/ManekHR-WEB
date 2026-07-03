'use server';

/**
 * Connect feed banner - server actions.
 *
 * Public read (`getFeedBanners`) powers the feed carousel; it is best-effort
 * (returns `[]` on any failure) so a banner outage never errors the feed - the
 * carousel simply renders nothing. Admin actions (`admin/connect/banners`)
 * back the /admin/connect/banners console and return a discriminated
 * `ActionResult`. All calls go through the httpOnly-cookie-authed `serverHttp`
 * client. Cross-links: FeedBannerCarousel.tsx (consumer),
 * app/(app)/admin/connect/banners (console), api banners module.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { AdminBanner, BannerInput, FeedBanner } from './banner.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

const PUBLIC = '/connect/banners';
const ADMIN = '/admin/connect/banners';

/**
 * The live feed carousel banners. Best-effort: returns `[]` on any error (the
 * FeedBannerCarousel renders nothing on an empty list), so it is safe to drop
 * straight into the feed page's parallel load without a `.catch` guard.
 *
 * The feed page passes a short `{ timeout }` (5s) so a slow / cold-start
 * backend on this NON-critical panel can never hold the whole feed render for
 * the shared 15s default - matching the other best-effort rail calls
 * (getSuggestions / browseCompanyPages / getMyFollowedCompanyPageIds).
 */
export async function getFeedBanners(opts?: { timeout?: number }): Promise<FeedBanner[]> {
  try {
    const http = await serverHttp();
    const res = await http.get(PUBLIC, {
      ...(opts?.timeout ? { timeout: opts.timeout } : {}),
    });
    return unwrapServer<FeedBanner[]>(res);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export async function adminListBanners(): Promise<ActionResult<AdminBanner[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(ADMIN);
    return { ok: true, data: unwrapServer<AdminBanner[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function adminCreateBanner(input: BannerInput): Promise<ActionResult<AdminBanner>> {
  try {
    const http = await serverHttp();
    const res = await http.post(ADMIN, input);
    return { ok: true, data: unwrapServer<AdminBanner>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function adminUpdateBanner(
  id: string,
  input: BannerInput,
): Promise<ActionResult<AdminBanner>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`${ADMIN}/${id}`, input);
    return { ok: true, data: unwrapServer<AdminBanner>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function adminToggleBanner(
  id: string,
  isActive: boolean,
): Promise<ActionResult<AdminBanner>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`${ADMIN}/${id}/toggle`, { isActive });
    return { ok: true, data: unwrapServer<AdminBanner>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function adminDeleteBanner(id: string): Promise<ActionResult<{ deleted: true }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${ADMIN}/${id}`);
    return { ok: true, data: unwrapServer<{ deleted: true }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Persist a new drag-reorder sequence (top-to-bottom order of ids). */
export async function adminReorderBanners(
  orderedIds: string[],
): Promise<ActionResult<AdminBanner[]>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`${ADMIN}/reorder`, { orderedIds });
    return { ok: true, data: unwrapServer<AdminBanner[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
