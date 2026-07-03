'use server';

/**
 * Server actions for Connect Broker Reviews (verified-but-anonymous, Slice 3w).
 * Wraps the BE `connect/broker-reviews` endpoints (JwtAuthGuard; the actor is
 * ALWAYS req.user.sub, never the body) + the `@Public` proof-led profile read.
 * Returns the discriminated `ActionResult<T>` used across Connect server actions
 * and maps raw HTTP failures through `extractErrorMessage` (no hand-rolled mapper).
 *
 * Cross-module: the public read powers components/connect/BrokerReviews.tsx; the
 * write actions (upsert/reply/withdraw) power Slice 3wB's review form on a
 * confirmed introduction (introductions module is the trust anchor). Keep the
 * route strings in sync with broker-review.controller.ts.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type { ActionResult } from '../profile.types';
import type {
  MyBrokerReview,
  PublicBrokerProfile,
  UpsertBrokerReviewInput,
} from './broker-reviews.types';

const BASE = '/connect/broker-reviews';

/**
 * Public, proof-led broker profile: the aggregate (confirmed introductions,
 * distinct people, rating count/avg) + anonymized review cards. No auth required
 * (the `@Public` controller route), so it renders on the logged-out profile too.
 */
export async function getBrokerPublicProfile(
  brokerUserId: string,
): Promise<ActionResult<PublicBrokerProfile>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/public/broker/${brokerUserId}`);
    return { ok: true, data: unwrapServer<PublicBrokerProfile>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not load broker reviews.') };
  }
}

/**
 * Create or edit the caller's review of a broker, anchored to a confirmed
 * introduction. The broker is DERIVED from the introduction BE-side (the body
 * cannot forge it); self-review + a non-party are rejected. (Slice 3wB write.)
 */
export async function upsertBrokerReview(
  input: UpsertBrokerReviewInput,
): Promise<ActionResult<MyBrokerReview>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, input);
    return { ok: true, data: unwrapServer<MyBrokerReview>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not post your review.') };
  }
}

/**
 * The broker posts their single reply to a review. Only the reviewed broker may
 * reply, and only once (a second attempt is rejected BE-side). (Slice 3wB write.)
 */
export async function replyBrokerReview(
  id: string,
  text: string,
): Promise<ActionResult<MyBrokerReview>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/reply`, { text });
    return { ok: true, data: unwrapServer<MyBrokerReview>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not post your reply.') };
  }
}

/**
 * The original reviewer withdraws their review (soft-delete BE-side). Only the
 * reviewer may withdraw. (Slice 3wB write.)
 */
export async function withdrawBrokerReview(
  id: string,
): Promise<ActionResult<{ withdrawn: boolean }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${id}/withdraw`);
    return { ok: true, data: unwrapServer<{ withdrawn: boolean }>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not withdraw your review.') };
  }
}

/**
 * The caller's own review for an introduction (drives the Slice 3wB edit form),
 * or null when they have not reviewed yet. A logged-out / no-review caller also
 * resolves to null so the calling surface still renders without a session.
 */
export async function getMyBrokerReview(
  introductionId: string,
): Promise<ActionResult<MyBrokerReview | null>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/mine`, { params: { introductionId } });
    return { ok: true, data: unwrapServer<MyBrokerReview | null>(res) };
  } catch {
    // No session / no review - not an error for the calling surface.
    return { ok: true, data: null };
  }
}
