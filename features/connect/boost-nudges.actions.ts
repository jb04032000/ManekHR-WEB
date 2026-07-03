'use server';

/**
 * Server actions for the traction-based boost nudge. All three wrap the
 * owner-scoped me/connect/boost-nudges endpoints (JwtAuthGuard; the person is
 * resolved server-side from the JWT). See backend BoostNudgeController.
 *
 * Cross-module links: consumed by features/connect/useBoostNudges.ts (read) and
 * components/connect/BoostNudgeSlot.tsx (shown / dismiss writes).
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type { ActionResult } from './profile.types';
import type {
  BoostNudgeCandidate,
  BoostNudgeKind,
  BoostNudgesResponse,
} from './boost-nudges.types';

/** The owner's current nudge candidates (ranked by views desc, up to 3). */
export async function getBoostNudges(): Promise<ActionResult<BoostNudgeCandidate[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/me/connect/boost-nudges');
    const data = unwrapServer<BoostNudgesResponse>(res);
    return { ok: true, data: data?.candidates ?? [] };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** Record that a nudge was rendered (starts the 7-day global cool-down). */
export async function markBoostNudgeShown(): Promise<ActionResult<true>> {
  try {
    const http = await serverHttp();
    await http.post('/me/connect/boost-nudges/shown', {});
    return { ok: true, data: true };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}

/** Dismiss the nudge for one entity (sticks for 30 days). Idempotent. */
export async function dismissBoostNudge(
  entityId: string,
  kind: BoostNudgeKind,
): Promise<ActionResult<true>> {
  try {
    const http = await serverHttp();
    await http.post(`/me/connect/boost-nudges/${entityId}/dismiss`, { kind });
    return { ok: true, data: true };
  } catch (e) {
    return { ok: false, error: extractErrorMessage(e, 'Something went wrong') };
  }
}
