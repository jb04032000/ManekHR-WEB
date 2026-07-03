'use server';

/**
 * Connect Referral Program -- server actions for the web layer.
 *
 * What: wraps the BE referral endpoints with the project's standard serverHttp /
 *   ActionResult pattern (mirror ads-admin.actions.ts). All writes go to the
 *   backend which validates, audits, and enforces guardrails there.
 *
 * Cross-module links:
 *   - serverHttp / unwrapServer from lib/api/server-client (JWT forwarded from
 *     the incoming cookie by the server client)
 *   - ActionResult from features/connect/profile.types
 *   - ReferralSummaryView / ReferralConfigView / ReferralLogPage from
 *     features/connect/referrals/referrals.types
 *   - Consumed by: app/connect/referrals/page.tsx (getMyReferral SSR),
 *     ReferralScreen.tsx (client re-fetch if needed),
 *     AdminReferralEditor.tsx / ReferralLogTable.tsx (admin pages)
 *
 * Watch: backend endpoint paths must match referral.controller.ts and
 *   referral-admin.controller.ts exactly. The admin user id is always derived
 *   from the JWT server-side (never sent in the body).
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import type { ActionResult } from '../profile.types';
import type { ReferralSummaryView, ReferralConfigView, ReferralLogPage } from './referrals.types';

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

// ---------------------------------------------------------------------------
// User-facing actions
// ---------------------------------------------------------------------------

/**
 * Fetch the caller's referral summary (code, stats, recent list).
 * Backend: GET /connect/referrals/me -- JWT-guarded, caller-scoped.
 */
export async function getMyReferral(): Promise<ActionResult<ReferralSummaryView>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/referrals/me');
    return { ok: true, data: unwrapServer<ReferralSummaryView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ---------------------------------------------------------------------------
// Admin-only actions (platform-admin pages)
// ---------------------------------------------------------------------------

/**
 * Get the live platform-wide referral config levers.
 * Backend: GET /admin/connect/referrals/config -- admin-guarded.
 */
export async function getReferralConfig(): Promise<ActionResult<ReferralConfigView>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/admin/connect/referrals/config');
    return { ok: true, data: unwrapServer<ReferralConfigView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Update the referral config levers. The backend validates every field against
 * hard guardrails and audits the change; new values are live on the next referral.
 * Backend: PUT /admin/connect/referrals/config -- admin-guarded.
 */
export async function updateReferralConfig(
  body: ReferralConfigView,
): Promise<ActionResult<ReferralConfigView>> {
  try {
    const http = await serverHttp();
    const res = await http.put('/admin/connect/referrals/config', body);
    return { ok: true, data: unwrapServer<ReferralConfigView>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * List referral rows with optional filters + pagination.
 * Backend: GET /admin/connect/referrals -- admin-guarded.
 */
export async function listReferrals(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<ActionResult<ReferralLogPage>> {
  try {
    const http = await serverHttp();
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.page != null) qs.set('page', String(params.page));
    if (params?.pageSize != null) qs.set('pageSize', String(params.pageSize));
    const path = `/admin/connect/referrals${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await http.get(path);
    return { ok: true, data: unwrapServer<ReferralLogPage>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Clawback a referral (reverse credits, mark rejected). The admin user id is
 * always derived from the JWT server-side.
 * Backend: POST /admin/connect/referrals/:id/clawback -- admin-guarded.
 */
export async function clawbackReferral(
  id: string,
  reason: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/referrals/${id}/clawback`, { reason });
    return { ok: true, data: unwrapServer<{ message: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
