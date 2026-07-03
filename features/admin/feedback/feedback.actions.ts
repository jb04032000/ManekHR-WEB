'use server';

// Admin feedback console server actions. Wrap admin/feedback endpoints
// (feedback-admin.controller.ts). Never throw — return ActionResult so the
// client renders inline errors. Admin identity comes from the JWT on the BE.
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { ActionResult } from '@/lib/types/action-result';
import type {
  AdminFeedbackListResult,
  AdminFeedbackDetail,
  FeedbackStatus,
} from './feedback.types';

const E = ApiEndpoints.feedback;

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export async function listFeedback(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  scope?: string;
}): Promise<ActionResult<AdminFeedbackListResult>> {
  try {
    const http = await serverHttp();
    const res = await http.get(E.adminList, { params });
    return { ok: true, data: unwrapServer<AdminFeedbackListResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function getFeedback(id: string): Promise<ActionResult<AdminFeedbackDetail>> {
  try {
    const http = await serverHttp();
    const res = await http.get(E.adminGetOne(id));
    return { ok: true, data: unwrapServer<AdminFeedbackDetail>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
  adminNotes?: string,
): Promise<ActionResult<AdminFeedbackDetail>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(E.adminUpdateStatus(id), { status, adminNotes });
    return { ok: true, data: unwrapServer<AdminFeedbackDetail>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
