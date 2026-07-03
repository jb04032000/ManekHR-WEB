'use server';

/**
 * Platform-admin server actions for the Connect ads sub-system.
 *
 * Wraps the BE `/admin/connect/ads/*` endpoints. The backend guards every
 * route with JwtAuthGuard + IsAdminGuard; the admin user id is derived from the
 * JWT (req.user.sub), never sent in the body. These mirror the ActionResult
 * shape used by the advertiser-facing ads.actions.ts.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type {
  AdminLiveBoost,
  AdminPendingCreative,
  AdPlacementView,
  AdRevenue,
  ConnectPricingView,
  ReviewActionResult,
} from './ads.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** List all creatives awaiting review, each enriched with campaign context. */
export async function listAdReview(): Promise<ActionResult<AdminPendingCreative[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/ads/review');
    return { ok: true, data: unwrapServer<AdminPendingCreative[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * List all LIVE boosts (active + paused) for the admin take-down view
 * (publish-then-moderate). Each item mirrors the pending-review shape plus a
 * `spotlight` flag. Backend: GET /admin/connect/ads/live. The admin takes one
 * down via the existing rejectCreative action; for a live boost the backend also
 * withholds the review fee, unlinks the creative, and notifies the advertiser.
 */
export async function listLiveBoosts(): Promise<ActionResult<AdminLiveBoost[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/ads/live');
    return { ok: true, data: unwrapServer<AdminLiveBoost[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Approve a creative; activates its parent campaign for delivery. */
export async function approveCreative(
  id: string,
  note?: string,
): Promise<ActionResult<ReviewActionResult>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/ads/review/${id}/approve`, { note });
    return { ok: true, data: unwrapServer<ReviewActionResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Reject a creative; marks the campaign rejected and releases unspent budget. */
export async function rejectCreative(
  id: string,
  reason: string,
): Promise<ActionResult<ReviewActionResult>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/ads/review/${id}/reject`, { reason });
    return { ok: true, data: unwrapServer<ReviewActionResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** List all placement slots. */
export async function listAdPlacements(): Promise<ActionResult<AdPlacementView[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/ads/placements');
    return { ok: true, data: unwrapServer<AdPlacementView[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Update floor CPM and enabled flag for a placement slot. */
export async function updateAdPlacement(
  key: string,
  body: { floorCpm: number; enabled: boolean },
): Promise<ActionResult<AdPlacementView>> {
  try {
    const http = await serverHttp();
    const res = await http.put(`/admin/connect/ads/placements/${key}`, body);
    return { ok: true, data: unwrapServer<AdPlacementView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Get the platform-wide total ad spend. */
export async function getAdRevenue(): Promise<ActionResult<AdRevenue>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/ads/revenue');
    return { ok: true, data: unwrapServer<AdRevenue>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Get the live pricing levers (boost bid / min budget / durations / top-up
 * presets) for the admin editor. Backend: GET /admin/connect/ads/pricing.
 */
export async function getConnectPricing(): Promise<ActionResult<ConnectPricingView>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/ads/pricing');
    return { ok: true, data: unwrapServer<ConnectPricingView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Update the pricing levers. The backend validates every field against hard
 * guardrails and audits the change; the new values are live on the next boost /
 * top-up with no deploy. Backend: PUT /admin/connect/ads/pricing.
 */
export async function updateConnectPricing(
  body: ConnectPricingView,
): Promise<ActionResult<ConnectPricingView>> {
  try {
    const http = await serverHttp();
    const res = await http.put('/admin/connect/ads/pricing', body);
    return { ok: true, data: unwrapServer<ConnectPricingView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
