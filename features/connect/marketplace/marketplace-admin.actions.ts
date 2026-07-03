'use server';

/**
 * Platform-admin server actions for the Connect marketplace moderation console.
 *
 * Wraps the BE `/admin/connect/marketplace/*` endpoints. The backend guards
 * every route with JwtAuthGuard + IsAdminGuard; the admin user id is derived
 * from the JWT (req.user.sub), never sent in the body. Mirrors the ActionResult
 * shape used by ads-admin.actions.ts.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { AdminListing } from './marketplace.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

/** Listings awaiting review (moderationStatus: pending), newest first. */
export async function listListingReview(): Promise<ActionResult<AdminListing[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/marketplace/review');
    return { ok: true, data: unwrapServer<AdminListing[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Approve a listing; it goes live (active). */
export async function approveListing(
  id: string,
  note?: string,
): Promise<ActionResult<AdminListing>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/marketplace/review/${id}/approve`, { note });
    return { ok: true, data: unwrapServer<AdminListing>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Reject a listing with a reason shown to the owner. */
export async function rejectListing(
  id: string,
  reason: string,
): Promise<ActionResult<AdminListing>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/marketplace/review/${id}/reject`, { reason });
    return { ok: true, data: unwrapServer<AdminListing>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
