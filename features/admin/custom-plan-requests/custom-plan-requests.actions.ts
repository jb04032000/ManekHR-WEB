'use server';

// Admin custom-plan-requests console server actions. Wrap admin/custom-plan-requests
// (AdminCustomPlanRequestsController). Never throw -- return ActionResult so the
// client renders inline errors. Admin identity comes from the JWT on the BE.
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { ActionResult } from '@/features/connect/profile.types';

const E = ApiEndpoints.admin;

export type CustomPlanRequestStatus = 'new' | 'contacted' | 'closed';

// Which surface produced the lead: the tailored-plan form vs a Subscribe click on
// a predefined plan (payments-off path). Both share this list, distinguished here.
export type CustomPlanRequestKind = 'custom' | 'plan';

export type CustomPlanRequestRow = {
  _id: string;
  userId: string;
  userName: string;
  userEmail: string;
  product: string;
  // 'custom' on legacy rows (BE defaults it), 'plan' for predefined-plan clicks.
  kind?: CustomPlanRequestKind;
  // Set only for kind='plan': which predefined plan the user clicked Subscribe on.
  planTier?: string;
  planName?: string;
  teamMembers?: number;
  companiesOrFactories: number;
  mobile: string;
  note: string;
  status: CustomPlanRequestStatus;
  adminNote?: string;
  createdAt: string;
};

export type CustomPlanRequestListResult = {
  items: CustomPlanRequestRow[];
  total: number;
  limit: number;
  offset: number;
};

function toError(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong';
}

export async function listCustomPlanRequests(params: {
  status?: CustomPlanRequestStatus;
  kind?: CustomPlanRequestKind;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<CustomPlanRequestListResult>> {
  try {
    const http = await serverHttp();
    const res = await http.get(E.customPlanRequests, { params });
    return { ok: true, data: unwrapServer<CustomPlanRequestListResult>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

export async function updateCustomPlanRequest(
  id: string,
  body: { status?: CustomPlanRequestStatus; adminNote?: string },
): Promise<ActionResult<CustomPlanRequestRow>> {
  try {
    const http = await serverHttp();
    const res = await http.patch(E.updateCustomPlanRequest(id), body);
    return { ok: true, data: unwrapServer<CustomPlanRequestRow>(res) };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
