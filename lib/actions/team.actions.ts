'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { friendlyHttpStatusMessage } from '@/lib/format/http-errors';
import type {
  TeamMember,
  TeamListResponse,
  CreateTeamMemberPayload,
  CreateTeamMemberResult,
  BulkCreateTeamMembersPayload,
  BulkCreateTeamMembersResult,
  UpdateTeamMemberPayload,
  GrantAccessPayload,
  GrantAccessResponse,
  GrantContext,
  TeamQueryParams,
  BulkStatusPayload,
  BulkDeletePayload,
  BulkRestorePayload,
  RevokeAccessPayload,
  ResendInvitePayload,
  ResendInviteResponse,
  ChangeAccessRolePayload,
  SetPermissionOverridesPayload,
  MobileClassification,
  ActivityEvent,
  ActivityListResponse,
  ActivityQuery,
} from '@/types';

const E = ApiEndpoints.team;

export async function listTeam(wsId: string, params?: TeamQueryParams) {
  const http = await serverHttp();
  return http.get(E.list(wsId), { params }).then(unwrapServer<TeamListResponse>);
}

/** Workspace-wide team activity feed (gated `team.appAccess.manage` BE-side). */
export async function getTeamActivity(
  wsId: string,
  query: ActivityQuery = {},
): Promise<ActivityListResponse> {
  const http = await serverHttp();
  try {
    return await http
      .get(E.teamActivity(wsId), { params: query })
      .then(unwrapServer<ActivityListResponse>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not load the activity log. Please try again.'));
  }
}

/** Per-member activity feed (gated `team.appAccess.manage` BE-side). */
export async function getMemberActivity(
  wsId: string,
  memberId: string,
): Promise<{ items: ActivityEvent[]; total: number }> {
  const http = await serverHttp();
  try {
    return await http
      .get(E.memberActivity(wsId, memberId))
      .then(unwrapServer<{ items: ActivityEvent[]; total: number }>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, "Could not load this member's activity. Please try again."),
    );
  }
}

export async function createTeamMember(
  wsId: string,
  data: CreateTeamMemberPayload,
  token?: string,
): Promise<CreateTeamMemberResult> {
  try {
    const http = await serverHttp(token);
    const response = await http.post(E.create(wsId), data);
    return unwrapServer<CreateTeamMemberResult>(response);
  } catch (e: unknown) {
    let errorMessage = 'Failed to add team member';

    if (e && typeof e === 'object' && 'response' in e) {
      const axiosErr = e as { response?: { data?: unknown } };
      if (axiosErr.response?.data) {
        const body = axiosErr.response.data as {
          message?: string;
          code?: string;
          error?: { message?: string };
        };
        if (body.message && typeof body.message === 'string') {
          errorMessage = body.message;
        } else if (body.error?.message && typeof body.error.message === 'string') {
          errorMessage = body.error.message;
        }
        // Prefix structured error codes so callers can branch on them.
        if (body.code && typeof body.code === 'string') {
          throw new Error(`${body.code}:${errorMessage}`);
        }
      }
    } else if (e instanceof Error) {
      errorMessage = e.message;
    }

    console.error('[createTeamMember] Error:', errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * CSV bulk import. Posts column-mapped create payloads to the BE bulk-create
 * endpoint (team.service.bulkCreate) and returns its per-row report. The
 * import wizard PIN-gates this call before invoking it. Partial success is
 * expected, so this resolves with the report rather than throwing on row
 * failures - only transport/permission errors reject.
 */
export async function bulkCreateTeamMembers(
  wsId: string,
  payload: BulkCreateTeamMembersPayload,
  token?: string,
): Promise<BulkCreateTeamMembersResult> {
  try {
    const http = await serverHttp(token);
    // Bulk create runs a sequential per-member create() loop server-side (employee-code
    // counter, COA setup, audit, validation per row) - even a 25-row chunk routinely
    // outlives the default 15s timeout (server-client.ts). When axios aborts, the backend
    // keeps running and the rows DO land, but the action reports the whole chunk as failed,
    // so the UI shows phantom "timeout of 15000ms exceeded" rows for members that were
    // actually created. Give just this endpoint a generous per-request ceiling so the
    // request outlasts the work instead of racing it. -> BE team.service.bulkCreate.
    const response = await http.post(E.bulkCreate(wsId), payload, { timeout: 120_000 });
    return unwrapServer<BulkCreateTeamMembersResult>(response);
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Bulk import failed. Please try again.'));
  }
}

export async function getTeamMember(wsId: string, memberId: string): Promise<TeamMember> {
  const http = await serverHttp();
  // Backend returns { success: true, data: { member: {...} } }
  const res = await http.get(E.get(wsId, memberId)).then(unwrapServer<{ member: TeamMember }>);
  return res.member;
}

export async function updateTeamMember(
  wsId: string,
  memberId: string,
  data: UpdateTeamMemberPayload,
  token?: string,
): Promise<TeamMember> {
  try {
    const http = await serverHttp(token);
    const res = await http
      .patch(E.update(wsId, memberId), data)
      .then(unwrapServer<{ member: TeamMember }>);
    return res.member;
  } catch (e: unknown) {
    let errorMessage = 'Failed to update team member';
    if (e && typeof e === 'object' && 'response' in e) {
      const axiosErr = e as { response?: { data?: unknown } };
      if (axiosErr.response?.data) {
        const body = axiosErr.response.data as {
          message?: string;
          error?: { message?: string };
        };
        if (body.message && typeof body.message === 'string') {
          errorMessage = body.message;
        } else if (body.error?.message && typeof body.error.message === 'string') {
          errorMessage = body.error.message;
        }
      }
    } else if (e instanceof Error) {
      errorMessage = e.message;
    }
    throw new Error(errorMessage);
  }
}

export async function deleteTeamMember(wsId: string, memberId: string, token?: string) {
  const http = await serverHttp(token);
  try {
    return await http.delete(E.delete(wsId, memberId)).then(unwrapServer<{ message: string }>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not archive this member. Please try again.'));
  }
}

export async function getPendingBackfillCount(wsId: string) {
  const http = await serverHttp();
  return http
    .get(E.pendingBackfillCount(wsId))
    .then(unwrapServer<{ total: number; withoutCode: number }>);
}

export type TeamStatusCounts = {
  all: number;
  active: number;
  offboarding: number;
  inactive: number;
  archived: number;
};

export async function getTeamStatusCounts(wsId: string): Promise<TeamStatusCounts> {
  const http = await serverHttp();
  return http.get(E.statusCounts(wsId)).then(unwrapServer<TeamStatusCounts>);
}

/**
 * P1.8.1 (2026-05-14) - fetch context-aware grant-flow prelude. Drives
 * the Grant App Access drawer's branching UX (none / registered /
 * conflict / already_granted) without owner having to open the modal
 * first. Read-only; cheap enough to call on rail render.
 */
export async function getGrantContext(wsId: string, memberId: string): Promise<GrantContext> {
  try {
    const http = await serverHttp();
    return await http.get(E.grantContext(wsId, memberId)).then(unwrapServer<GrantContext>);
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Failed to load grant context'));
  }
}

export async function grantAccess(
  wsId: string,
  memberId: string,
  data: GrantAccessPayload,
  token?: string,
): Promise<GrantAccessResponse> {
  // Wrapped in try/catch so BE structured-error messages survive Next.js
  // Server Action serialization. Mirrors revokeTeamAccess / changeTeamAccessRole.
  // Without this wrapper a 400 "Member already has app access" surfaces to the
  // FE as a generic "Something went wrong" toast after parseApiError fallthrough.
  try {
    const http = await serverHttp(token);
    return await http
      .post(E.grantAccess(wsId, memberId), data)
      .then(unwrapServer<GrantAccessResponse>);
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Failed to grant access'));
  }
}

// ── App Access Management (P1+P2+P3) ──────────────────────────────────────
//
// Each action mirrors the updateTeamMember try/catch shape so BE structured-
// error messages survive axios's default unwrap (callers see the BE-supplied
// `message`, not the generic "Network Error" axios default).

export async function revokeTeamAccess(
  wsId: string,
  memberId: string,
  data: RevokeAccessPayload,
  token?: string,
): Promise<TeamMember> {
  try {
    const http = await serverHttp(token);
    const res = await http
      .post(E.revokeAccess(wsId, memberId), data)
      .then(unwrapServer<{ member: TeamMember }>);
    return res.member;
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Failed to revoke access'));
  }
}

export async function resendTeamInvite(
  wsId: string,
  memberId: string,
  data: ResendInvitePayload,
  token?: string,
): Promise<ResendInviteResponse> {
  try {
    const http = await serverHttp(token);
    return await http
      .post(E.resendInvite(wsId, memberId), data)
      .then(unwrapServer<ResendInviteResponse>);
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Failed to resend invite'));
  }
}

export async function changeTeamAccessRole(
  wsId: string,
  memberId: string,
  data: ChangeAccessRolePayload,
  token?: string,
): Promise<TeamMember> {
  try {
    const http = await serverHttp(token);
    const res = await http
      .patch(E.changeAccessRole(wsId, memberId), data)
      .then(unwrapServer<{ member: TeamMember }>);
    return res.member;
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Failed to change role'));
  }
}

export async function setTeamPermissionOverrides(
  wsId: string,
  memberId: string,
  payload: SetPermissionOverridesPayload,
  token?: string,
): Promise<TeamMember> {
  try {
    const http = await serverHttp(token);
    const res = await http
      .put(E.permissionOverrides(wsId, memberId), {
        overrides: payload.overrides,
        ...(payload.pathOverrides !== undefined && { pathOverrides: payload.pathOverrides }),
      })
      .then(unwrapServer<{ member: TeamMember }>);
    return res.member;
  } catch (e: unknown) {
    throw new Error(extractErrorMessage(e, 'Failed to save permission overrides'));
  }
}

function extractErrorMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const axiosErr = e as { response?: { status?: number; data?: unknown } };
    if (axiosErr.response?.data) {
      const body = axiosErr.response.data as {
        message?: string;
        error?: { message?: string };
      };
      if (body.message && typeof body.message === 'string') return body.message;
      if (body.error?.message && typeof body.error.message === 'string') return body.error.message;
    }
    // No structured body message - fall back to a plain-language sentence for
    // the status code rather than letting the raw axios string surface.
    const statusMsg = friendlyHttpStatusMessage(axiosErr.response?.status);
    if (statusMsg) return statusMsg;
  } else if (e instanceof Error && !/request failed with status code/i.test(e.message)) {
    return e.message;
  }
  return fallback;
}

export async function offboardMember(
  wsId: string,
  memberId: string,
  data: { lastWorkingDate: string; resignationNote?: string },
  token?: string,
) {
  const http = await serverHttp(token);
  try {
    return await http.post(E.offboard(wsId, memberId), data).then(unwrapServer<TeamMember>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not offboard this member. Please try again.'));
  }
}

export async function acceptTeamInvite(token: string) {
  const http = await serverHttp();
  return http.post(E.acceptInvite(token)).then(unwrapServer<{ message: string }>);
}

export async function bulkUpdateTeamStatus(wsId: string, data: BulkStatusPayload, token?: string) {
  const http = await serverHttp(token);
  try {
    return await http
      .patch(E.bulkStatus(wsId), data)
      .then(unwrapServer<{ success: boolean; data: { updated: number } }>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, 'Could not update the selected members. Please try again.'),
    );
  }
}

export async function bulkArchiveTeamMembers(
  wsId: string,
  data: BulkDeletePayload,
  token?: string,
) {
  const http = await serverHttp(token);
  try {
    return await http
      .delete(E.bulkDelete(wsId), { data })
      .then(unwrapServer<{ success: boolean; data: { archived: number } }>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, 'Could not archive the selected members. Please try again.'),
    );
  }
}

export async function bulkRestoreTeamMembers(
  wsId: string,
  data: BulkRestorePayload,
  token?: string,
) {
  const http = await serverHttp(token);
  try {
    return await http
      .patch(E.bulkRestore(wsId), data)
      .then(unwrapServer<{ success: boolean; data: { restored: number } }>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, 'Could not restore the selected members. Please try again.'),
    );
  }
}

export async function restoreTeamMember(wsId: string, memberId: string, token?: string) {
  const http = await serverHttp(token);
  try {
    return await http
      .patch(E.restore(wsId, memberId))
      .then(unwrapServer<{ success: boolean; message: string }>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not restore this member. Please try again.'));
  }
}

export async function deleteTeamMemberPermanent(wsId: string, memberId: string, token?: string) {
  const http = await serverHttp(token);
  try {
    return await http
      .delete(E.deletePermanent(wsId, memberId))
      .then(unwrapServer<{ success: boolean; message: string }>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, 'Could not permanently delete this member. Please try again.'),
    );
  }
}

export async function listMemberDocuments(wsId: string, memberId: string) {
  const http = await serverHttp();
  const res = await http.get(E.documents(wsId, memberId));
  const payload = unwrapServer<{ documents: import('@/types').TeamMemberDocument[] }>(res);
  return payload?.documents ?? [];
}

export async function deleteMemberDocument(
  wsId: string,
  memberId: string,
  docId: string,
  token?: string,
) {
  const http = await serverHttp(token);
  return http
    .delete(E.deleteDocument(wsId, memberId, docId))
    .then(unwrapServer<{ success: boolean }>);
}

/**
 * Classify a mobile number against the platform's identity graph for the
 * given workspace. Returns a `MobileClassification` discriminated union
 * describing the collision state. Used by the Add Member form to show a
 * contextual banner below the mobile field before the owner submits.
 *
 * Calls `GET /workspaces/:wsId/team/check-identifier?mobile=...&classify=true`
 * (optionally with `excludeId` for edit-mode reuse).
 */
export async function classifyMobile(
  workspaceId: string,
  mobile: string,
  excludeId?: string,
): Promise<MobileClassification> {
  const http = await serverHttp();
  const params = new URLSearchParams({ mobile, classify: 'true' });
  if (excludeId) params.set('excludeId', excludeId);
  const response = await http.get<{
    success: boolean;
    data: { mobileStatus: MobileClassification };
  }>(`${E.checkIdentifier(workspaceId)}?${params}`);
  return unwrapServer<{ mobileStatus: MobileClassification }>(response).mobileStatus;
}

export interface CheckTeamIdentifierResult {
  mobile?: { available: boolean; conflictMemberName?: string };
  email?: { available: boolean; conflictMemberName?: string };
}

export async function checkTeamIdentifier(
  wsId: string,
  args: { mobile?: string; email?: string; excludeId?: string },
): Promise<CheckTeamIdentifierResult> {
  const http = await serverHttp();
  return http
    .get(E.checkIdentifier(wsId), { params: args })
    .then(unwrapServer<CheckTeamIdentifierResult>);
}

export async function createMemberDocument(
  wsId: string,
  memberId: string,
  data: {
    type: string;
    label?: string;
    fileUrl: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
  },
) {
  const http = await serverHttp();
  const res = await http.post(E.documents(wsId, memberId), data);
  const payload = unwrapServer<{ document: import('@/types').TeamMemberDocument }>(res);
  return payload.document;
}

// Phase 1f (2026-05-21): mobile-OTP verification at add-member time.
//
// Both endpoints are gated BE-side on `team.member.create`. The proof token
// returned by confirm is a short-lived JWT (15-min TTL) consumed by the
// subsequent createTeamMember call as `mobileVerifyToken`. BE persists
// `mobileVerifiedAt` only when the token validates successfully.
//
// Error envelope unwrap mirrors the createTeamMember pattern: structured
// `code` (OTP_WRONG_CODE / OTP_EXPIRED_OR_INVALID / OTP_LOCKED /
// TOO_MANY_REQUESTS / OTP_PROOF_INVALID) is prefixed onto the thrown
// Error message so the caller can branch on it. Wrong-code responses also
// carry an `attempts` integer in the body so the modal can render
// "{remaining} attempts left".

/**
 * Server action: start the mobile-OTP send flow for the supplied number.
 * Returns `{ sent, expiresAt }` where expiresAt is an ISO timestamp marking
 * the 5-minute window before the code becomes invalid. Throws on rate-limit
 * (TOO_MANY_REQUESTS) or SMS dispatch failure. Never echoes the code.
 */
export async function startMobileVerification(
  workspaceId: string,
  mobile: string,
): Promise<{ sent: true; expiresAt: string }> {
  try {
    const http = await serverHttp();
    const response = await http.post(E.verifyMobileStart(workspaceId), { mobile });
    return unwrapServer<{ sent: true; expiresAt: string }>(response);
  } catch (e: unknown) {
    throw new Error(formatStructuredErrorPrefix(e, 'Failed to send verification code'));
  }
}

/**
 * Server action: confirm a 6-digit OTP code against the latest unconsumed
 * send for the (workspaceId, mobile) pair. On success returns the proof
 * `token` (short-lived JWT) to be passed back on the createTeamMember call.
 * On failure throws a structured Error whose message starts with the BE
 * error code (OTP_WRONG_CODE, OTP_EXPIRED_OR_INVALID, OTP_LOCKED,
 * TOO_MANY_REQUESTS); the wrong-code variant additionally carries an
 * `attempts=<n>` segment so the modal can compute attempts remaining.
 */
export async function confirmMobileVerification(
  workspaceId: string,
  mobile: string,
  code: string,
): Promise<{ token: string; expiresAt: string }> {
  try {
    const http = await serverHttp();
    const response = await http.post(E.verifyMobileConfirm(workspaceId), { mobile, code });
    return unwrapServer<{ token: string; expiresAt: string }>(response);
  } catch (e: unknown) {
    throw new Error(formatStructuredErrorPrefix(e, 'Failed to verify code'));
  }
}

/**
 * Phase 1f verify-later (2026-05-21). Stamps mobileVerifiedAt on an
 * already-saved member when the owner verifies from the profile page after a
 * skip. Pass the JWT proof token minted by `confirmMobileVerification`
 * (15-min TTL). BE validates the token against the member's persisted mobile
 * before stamping and returns the refreshed member document.
 */
export async function verifyMemberMobileNow(
  workspaceId: string,
  memberId: string,
  mobileVerifyToken: string,
): Promise<import('@/types').TeamMember> {
  try {
    const http = await serverHttp();
    const response = await http.post(E.verifyMemberMobile(workspaceId, memberId), {
      mobileVerifyToken,
    });
    return unwrapServer<import('@/types').TeamMember>(response);
  } catch (e: unknown) {
    throw new Error(formatStructuredErrorPrefix(e, 'Failed to verify member mobile'));
  }
}

/**
 * Variant of `extractErrorMessage` that returns a string with the structured
 * BE `code` prefix and an optional `attempts=N` segment (returned by
 * OTP_WRONG_CODE) prepended, joined by `:`. Caller splits on `:` to recover
 * the parts. Mirrors the createTeamMember error-wrap envelope so the modal
 * can branch on the BE error code. Despite the "format" in the name this is
 * still a pure unwrap; it does NOT throw.
 */
function formatStructuredErrorPrefix(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'response' in e) {
    const axiosErr = e as { response?: { data?: unknown } };
    if (axiosErr.response?.data) {
      const body = axiosErr.response.data as {
        message?: string;
        code?: string;
        attempts?: number;
        error?: { message?: string; code?: string; attempts?: number };
      };
      let message = fallback;
      if (body.message && typeof body.message === 'string') {
        message = body.message;
      } else if (body.error?.message && typeof body.error.message === 'string') {
        message = body.error.message;
      }
      const code = body.code ?? body.error?.code;
      const attempts = body.attempts ?? body.error?.attempts;
      if (code && typeof code === 'string') {
        return typeof attempts === 'number'
          ? `${code}:attempts=${attempts}:${message}`
          : `${code}:${message}`;
      }
      return message;
    }
  } else if (e instanceof Error) {
    return e.message;
  }
  return fallback;
}
