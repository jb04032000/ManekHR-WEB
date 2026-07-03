'use server';

/**
 * Connect content reports (public-UGC abuse) + the admin moderation queue.
 *   - Member report -> content-reports.controller (JwtAuthGuard, @AuthenticatedOnly).
 *   - Admin queue + resolve -> content-reports.admin.controller (IsAdminGuard);
 *     the admin id is derived from the JWT, never sent in the body.
 * Mirrors the ActionResult shape used by marketplace-admin.actions.ts.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';

export type ContentReportTargetType = 'post' | 'comment' | 'profile' | 'listing';
export type ContentReportReason =
  | 'spam'
  | 'harassment'
  | 'hate'
  | 'adult'
  | 'scam'
  | 'misinformation'
  | 'other';

export interface ContentReport {
  _id: string;
  reporterUserId: string;
  targetType: ContentReportTargetType;
  targetId: string;
  targetOwnerUserId?: string | null;
  reason: ContentReportReason;
  detail: string;
  snapshot: string;
  targetUrl: string;
  status: 'open' | 'actioned' | 'dismissed';
  createdAt: string;
}

export interface CreateContentReportPayload {
  targetType: ContentReportTargetType;
  targetId: string;
  reason: ContentReportReason;
  detail?: string;
  snapshot?: string;
  targetUrl?: string;
  targetOwnerUserId?: string;
}

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

// ── Member ───────────────────────────────────────────────────────────────────

/** File an abuse report against public content (post / comment / profile / listing). */
export async function submitContentReport(
  payload: CreateContentReportPayload,
): Promise<ActionResult<{ id: string }>> {
  try {
    const http = await serverHttp();
    const res = await http.post('/connect/content-reports', payload);
    return { ok: true, data: unwrapServer<{ id: string }>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

// ── Admin moderation queue ─────────────────────────────────────────────────────

/** Open reports awaiting moderation (optionally filtered by target type). */
export async function listContentReports(
  targetType?: ContentReportTargetType,
): Promise<ActionResult<ContentReport[]>> {
  try {
    const http = await serverHttp();
    const qs = targetType ? `?targetType=${encodeURIComponent(targetType)}` : '';
    const res = await http.get(`/admin/connect/content-reports${qs}`);
    return { ok: true, data: unwrapServer<ContentReport[]>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Action a report: removes the reported content + closes the report. */
export async function actionContentReport(
  id: string,
  note?: string,
): Promise<ActionResult<ContentReport>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/content-reports/${id}/action`, { note });
    return { ok: true, data: unwrapServer<ContentReport>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/** Dismiss a report: no action, closes it. */
export async function dismissContentReport(
  id: string,
  note?: string,
): Promise<ActionResult<ContentReport>> {
  try {
    const http = await serverHttp();
    const res = await http.post(`/admin/connect/content-reports/${id}/dismiss`, { note });
    return { ok: true, data: unwrapServer<ContentReport>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
