'use server';

/**
 * Server actions for Connect Reviews & Ratings (marketplace Phase C, R3). Wraps
 * the BE `connect/reviews` endpoints (JwtAuthGuard; the reviewer = req.user.sub,
 * never the body) + the `@Public` seller-list read. Returns the discriminated
 * `ActionResult<T>` used across Connect server actions.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { MyReview, SellerReviewsPage, UpsertReviewInput } from './reviews.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

const BASE = '/connect/reviews';

/** Create or edit the caller's review of a seller. Self-review is rejected BE-side. */
export async function upsertReview(input: UpsertReviewInput): Promise<ActionResult<MyReview>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, input);
    return { ok: true, data: unwrapServer<MyReview>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * The caller's own review of a seller (drives the edit form), or null when they
 * have not reviewed yet. A logged-out caller also resolves to null so the public
 * surface still renders without a session.
 */
export async function getMyReview(subjectUserId: string): Promise<ActionResult<MyReview | null>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/me/${subjectUserId}`);
    return { ok: true, data: unwrapServer<MyReview | null>(res) };
  } catch {
    // No session / no review - not an error for the public page.
    return { ok: true, data: null };
  }
}

/** Delete the caller's review of a seller. */
export async function deleteReview(
  subjectUserId: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.delete(`${BASE}/${subjectUserId}`);
    return { ok: true, data: unwrapServer<{ deleted: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Report a review for abuse (increments the moderation counter). */
export async function reportReview(reviewId: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${reviewId}/report`);
    return { ok: true, data: unwrapServer<{ ok: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Public, paginated list of a seller's active reviews + their aggregate. No auth
 * required (powers the profile / company page Reviews tab + the listing detail).
 */
export async function getSellerReviews(
  subjectUserId: string,
  cursor?: string,
): Promise<ActionResult<SellerReviewsPage>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/seller/${subjectUserId}`, {
      params: cursor ? { cursor } : undefined,
    });
    return { ok: true, data: unwrapServer<SellerReviewsPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
