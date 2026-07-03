'use server';

/**
 * Server actions for Connect Broker Introductions (anti-gaming core, Slice 2).
 * Wraps the BE `connect/introductions` endpoints (JwtAuthGuard + @AuthenticatedOnly;
 * the broker / actor is ALWAYS req.user.sub, never the body / param). Returns the
 * discriminated `ActionResult<T>` used across Connect server actions.
 *
 * Cross-module: copied from features/connect/reviews/reviews.actions.ts (same
 * serverHttp / unwrapServer / ActionResult shape). Read endpoints power
 * IntroductionsList; the write endpoints power IntroduceComposer + the
 * confirm / decline buttons.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type { ActionResult } from '../profile.types';
import type {
  CreateIntroductionInput,
  Introduction,
  IntroductionStatus,
  ReceivedIntroduction,
} from './introductions.types';

const BASE = '/connect/introductions';

/**
 * Create a pending introduction (the caller is the broker). The BE enforces the
 * broker gate (ConnectProfile.isBroker), anti-self, both-parties-live, distinct
 * phones, and dedup - any violation surfaces as a friendly error string.
 */
export async function createIntroduction(
  input: CreateIntroductionInput,
): Promise<ActionResult<Introduction>> {
  try {
    const http = await serverHttp();
    const res = await http.post(BASE, input);
    return { ok: true, data: unwrapServer<Introduction>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not send the introduction.') };
  }
}

/** Confirm the caller's OWN side of an introduction (only an introduced party can). */
export async function confirmIntroduction(id: string): Promise<ActionResult<Introduction>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${encodeURIComponent(id)}/confirm`);
    return { ok: true, data: unwrapServer<Introduction>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not confirm the introduction.') };
  }
}

/** Decline the caller's participation in an introduction (soft-delete server-side). */
export async function declineIntroduction(id: string): Promise<ActionResult<Introduction>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`${BASE}/${encodeURIComponent(id)}/decline`);
    return { ok: true, data: unwrapServer<Introduction>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not decline the introduction.') };
  }
}

/**
 * The caller's pending-to-confirm queue: introductions where they are a party
 * and their OWN side is not yet confirmed. Party refs are populated.
 */
export async function listPendingIntroductions(): Promise<ActionResult<Introduction[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/pending`);
    return { ok: true, data: unwrapServer<Introduction[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not load introductions.') };
  }
}

/**
 * The caller's introductions as a broker (their auto contact book), newest
 * first, with the two introduced parties populated. Optional status filter.
 */
export async function listMyIntroductions(
  status?: IntroductionStatus,
): Promise<ActionResult<Introduction[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/mine`, {
      params: status ? { status } : undefined,
    });
    return { ok: true, data: unwrapServer<Introduction[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not load introductions.') };
  }
}

/**
 * The introductions the caller RECEIVED (as a party, never only the broker),
 * defaulting BE-side to `confirmed` so a party can review the broker who made a
 * confirmed introduction. Each item carries `myRole` + `brokerId` so the web can
 * open BrokerReviewModal for that broker (broker-reviews module write surface).
 */
export async function listReceivedIntroductions(
  status?: IntroductionStatus,
): Promise<ActionResult<ReceivedIntroduction[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get(`${BASE}/received`, {
      params: status ? { status } : undefined,
    });
    return { ok: true, data: unwrapServer<ReceivedIntroduction[]>(res) };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Could not load introductions.') };
  }
}
