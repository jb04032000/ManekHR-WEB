'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import httpClient from '@/lib/api/client';
import type {
  Workspace,
  WorkspaceMember,
  CreateWorkspacePayload,
  UpdateWorkspacePayload,
  InviteMemberPayload,
  ChangeMemberRolePayload,
  BrandingAssets,
  WorkspaceExportPreferences,
  EmployeeCodeSettings,
  EmployeeCodeSettingsResponse,
  BackfillEmployeeCodesResponse,
  DesignationRecord,
  DesignationLabels,
  WorkspaceNotificationPolicy,
} from '@/types';
import axios from 'axios';
import {
  type ActionResult,
  success,
  failure,
  extractError,
  validateRequired,
  validateNonEmptyString,
  validateIdentifier,
  combineValidations,
} from '@/lib/common';

const E = ApiEndpoints.workspaces;

/**
 * List all workspaces for the current user.
 * Accepts an optional token fallback for cases where the httpOnly cookie
 * may not yet be set (e.g. first bootstrap after login).
 */
export async function listWorkspaces(token?: string): Promise<ActionResult<Workspace[]>> {
  try {
    const http = await serverHttp(token);
    const data = await http.get(E.list).then(unwrapServer<Workspace[]>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Create a new workspace
 * Accepts an optional token fallback for cases where the httpOnly cookie
 * may not yet be set (e.g. immediately after registration).
 */
export async function createWorkspace(
  payload: CreateWorkspacePayload,
  token?: string,
): Promise<ActionResult<Workspace>> {
  // Validate required fields
  const validation = validateNonEmptyString(payload.name, 'Workspace name');
  if (!validation.valid) {
    return { ok: false, error: validation.error };
  }

  try {
    const http = await serverHttp(token);

    const response = await http.post(E.create, payload);

    const data = unwrapServer<Workspace>(response);

    // Create a completely plain object with only primitive values
    const result: Workspace = {
      _id: String(data._id || ''),
      name: String(data.name || ''),
      businessType: data.businessType ? String(data.businessType) : undefined,
      location: data.location ? String(data.location) : undefined,
      timezone: String(data.timezone || 'UTC'),
      ownerId: String(data.ownerId || ''),
      isActive: data.isActive === true,
      isDefault: data.isDefault === true,
      designations: [],
      bankAccounts: [],
      createdAt: String(data.createdAt || new Date().toISOString()),
    };

    return { ok: true, data: result };
  } catch (e: unknown) {
    // Extract error message as plain string
    let errorMessage = 'Failed to create workspace';

    if (e && typeof e === 'object' && 'response' in e) {
      const response = (e as { response: unknown }).response;
      if (response && typeof response === 'object') {
        const res = response as { data?: { message?: string }; status?: number };
        // First try to get message from response data
        if (res.data?.message) {
          errorMessage = res.data.message;
        } else if (res.status === 403) {
          errorMessage =
            'Workspace limit reached. Please upgrade your plan to create more workspaces.';
        }
      }
    } else if (e instanceof Error) {
      errorMessage = e.message;
    } else if (typeof e === 'string') {
      errorMessage = e;
    } else if (e && typeof e === 'object' && 'message' in e) {
      errorMessage = String((e as { message: unknown }).message);
    }

    console.error('[createWorkspace] Error:', errorMessage);
    return { ok: false, error: errorMessage };
  }
}

/**
 * Get a specific workspace by ID
 */
export async function getWorkspace(id: string): Promise<ActionResult<Workspace>> {
  try {
    const validation = validateRequired(id, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http.get(E.get(id)).then(unwrapServer<Workspace>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Update workspace details
 */
export async function updateWorkspace(
  id: string,
  payload: UpdateWorkspacePayload,
): Promise<ActionResult<Workspace>> {
  try {
    const idValidation = validateRequired(id, 'Workspace ID');
    if (!idValidation.valid) {
      return failure(idValidation.error);
    }

    // Validate name if provided
    if (payload.name !== undefined) {
      const nameValidation = validateNonEmptyString(payload.name, 'Workspace name');
      if (!nameValidation.valid) {
        return failure(nameValidation.error);
      }
    }

    const http = await serverHttp();
    const data = await http.patch(E.update(id), payload).then(unwrapServer<Workspace>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Delete a workspace permanently
 */
export async function deleteWorkspace(id: string): Promise<ActionResult<{ message: string }>> {
  try {
    const validation = validateRequired(id, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http.delete(E.delete(id)).then(unwrapServer<{ message: string }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

// ── OQ-W3 (workspace-delete undo) - recovery surface ─────────────────────────
// Reads the caller's recently soft-deleted workspaces and restores one within
// the 30-day window. Consumed by the "Deleted workspaces" recovery section on
// the workspace settings page. Cross-link: BE listRestorableWorkspaces / restore.

/** One soft-deleted-but-restorable workspace row. */
export interface DeletedWorkspace {
  id: string;
  name: string;
  businessType?: string | null;
  logo?: string | null;
  deletedAt: string | null;
  /** Hard cutoff (deletedAt + 30d) so the UI can show "restorable until {date}". */
  restorableUntil: string | null;
}

/**
 * List the caller's recently soft-deleted, still-restorable workspaces.
 * Owner-only is enforced server-side (filters ownerId).
 */
export async function listDeletedWorkspaces(): Promise<ActionResult<DeletedWorkspace[]>> {
  try {
    const http = await serverHttp();
    const data = await http.get(E.deleted).then(unwrapServer<DeletedWorkspace[]>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Restore result - carries the BE error `code` so the UI can special-case the
 * expired-window case ("recovery window passed, contact support") rather than
 * parsing message strings.
 */
export type RestoreWorkspaceResult =
  | { ok: true; workspaceId: string }
  | { ok: false; error: string; code?: 'WORKSPACE_RESTORE_WINDOW_EXPIRED' };

/**
 * Restore a soft-deleted workspace. Returns 400 WORKSPACE_RESTORE_WINDOW_EXPIRED
 * when the delete is older than the 30-day window (admin-only recovery past that).
 */
export async function restoreWorkspace(id: string): Promise<RestoreWorkspaceResult> {
  try {
    const validation = validateRequired(id, 'Workspace ID');
    if (!validation.valid) return { ok: false, error: validation.error };
    const http = await serverHttp();
    const data = await http
      .post(E.restore(id), {})
      .then(unwrapServer<{ ok: boolean; workspaceId: string }>);
    return { ok: true, workspaceId: data.workspaceId };
  } catch (e) {
    // Surface the structured expired-window code so the caller can branch.
    if (axios.isAxiosError(e)) {
      const payload = e.response?.data as { code?: string; message?: string } | undefined;
      if (payload?.code === 'WORKSPACE_RESTORE_WINDOW_EXPIRED') {
        return {
          ok: false,
          error: payload.message || extractError(e),
          code: 'WORKSPACE_RESTORE_WINDOW_EXPIRED',
        };
      }
    }
    return { ok: false, error: extractError(e) };
  }
}

/**
 * OQ-W6 (auto-added consent) - self-serve leave. A non-owner member exits a
 * workspace they belong to (including one they were auto-added to). The owner is
 * blocked server-side, so the FE hides the action for owners; this is the last
 * line of defense if it is ever called for an owner.
 */
export async function leaveWorkspace(id: string): Promise<ActionResult<{ ok: boolean }>> {
  try {
    const validation = validateRequired(id, 'Workspace ID');
    if (!validation.valid) return failure(validation.error);
    const http = await serverHttp();
    const data = await http.post(E.leave(id), {}).then(unwrapServer<{ ok: boolean }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Get all members of a workspace
 */
export async function getWorkspaceMembers(id: string): Promise<ActionResult<WorkspaceMember[]>> {
  try {
    const validation = validateRequired(id, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http.get(E.members(id)).then(unwrapServer<WorkspaceMember[]>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Workspace-invite response shape. `autoAccepted` (OQ-W6) is true when the
 * invitee was activated without clicking (owner's autoAcceptKnownInvites). The
 * §10c.2 rehire signal `priorMembership` is non-null only when this invite
 * reattached to a prior removed/declined membership for the same person - the
 * FE renders a "previously a member (removed on {date})" notice from it.
 * Keep these field names in sync with `inviteMember`'s BE return (workspaces.service.ts).
 */
export interface InviteMemberResponse {
  message: string;
  inviteLink?: string;
  inviteToken?: string;
  autoAccepted?: boolean;
  priorMembership?: { removedAt: string | null; declinedAt: string | null } | null;
}

/**
 * Invite a member to workspace
 */
export async function inviteMember(
  id: string,
  payload: InviteMemberPayload,
): Promise<ActionResult<InviteMemberResponse>> {
  try {
    const idValidation = validateRequired(id, 'Workspace ID');
    if (!idValidation.valid) {
      return failure(idValidation.error);
    }

    // P1.5 (2026-05-14) - teamMemberId-bound invites resolve the identifier
    // server-side from the TeamMember row, so we don't enforce email/mobile
    // at the FE for that path. Bare collaborator invites still need an
    // explicit identifier.
    if (!payload.teamMemberId) {
      const identifier = payload.email || payload.mobile;
      const identifierValidation = validateNonEmptyString(identifier, 'Email or mobile number');
      if (!identifierValidation.valid) {
        return failure(identifierValidation.error);
      }
    }

    const http = await serverHttp();
    const data = await http.post(E.invite(id), payload).then(unwrapServer<InviteMemberResponse>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * P1.5 (2026-05-14) - thin wrapper around `inviteMember` that mirrors the
 * legacy `grantAccess` contract (throws on error with BE-extracted message,
 * returns `{message, inviteToken?}` directly). Lets the Grant App
 * Access drawer call the canonical Wave 2 endpoint without rewriting
 * its try/catch + success-state plumbing.
 *
 * Caller passes a `teamMemberId` so the bridge row links to the directory
 * employee. Email override (when owner overrides on the modal) is forwarded
 * via `email`; backend will use it for the invite-row identifier when set.
 */
export async function inviteTeamMember(
  workspaceId: string,
  teamMemberId: string,
  data: {
    rbacRoleId: string;
    sendMethod: 'auto' | 'link' | 'both';
    /** Optional identifier overrides. When omitted, the caller should
     *  pass through the directory record's mobile / email so BE always
     *  has at least one identifier to route on. */
    email?: string;
    mobile?: string;
    /** P2.0.2 (2026-05-15) - per-channel override. Passes through to
     *  workspaces.inviteMember → InviteNotificationDispatcher. */
    channels?: ('email' | 'sms' | 'in_app')[];
  },
): Promise<{ message: string; inviteToken?: string }> {
  const result = await inviteMember(workspaceId, {
    teamMemberId,
    roleId: data.rbacRoleId,
    sendMethod: data.sendMethod,
    email: data.email,
    mobile: data.mobile,
    channels: data.channels,
  });
  if (!result.ok) {
    throw new Error(result.error || 'Failed to grant access');
  }
  return { message: result.data.message, inviteToken: result.data.inviteToken };
}

/**
 * Join a workspace using invite token
 */
export async function joinWorkspace(token: string): Promise<ActionResult<Workspace>> {
  try {
    const validation = validateRequired(token, 'Invite token');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http.post(E.join(token)).then(unwrapServer<Workspace>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Remove a member from workspace
 */
export async function removeMember(
  id: string,
  memberId: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const validation = combineValidations(
      validateRequired(id, 'Workspace ID'),
      validateRequired(memberId, 'Member ID'),
    );

    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http.delete(E.member(id, memberId)).then(unwrapServer<{ message: string }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Change a member's role in workspace
 */
export async function changeMemberRole(
  id: string,
  memberId: string,
  payload: ChangeMemberRolePayload,
): Promise<ActionResult<WorkspaceMember>> {
  try {
    const validation = combineValidations(
      validateRequired(id, 'Workspace ID'),
      validateRequired(memberId, 'Member ID'),
    );

    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .patch(E.memberRole(id, memberId), payload)
      .then(unwrapServer<WorkspaceMember>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

export interface PendingInvitation {
  _id: string;
  inviteeIdentifier?: string;
  inviteeType?: string;
  role: string;
  invitedBy: string;
  createdAt: string;
  inviteExpiry?: string;
}

/**
 * Get pending invitations for a workspace
 */
export async function getPendingInvitations(
  workspaceId: string,
): Promise<ActionResult<PendingInvitation[]>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .get(`/api/workspaces/${workspaceId}/invitations`)
      .then(unwrapServer<PendingInvitation[]>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Resend an invitation
 */
export async function resendInvite(
  workspaceId: string,
  memberId: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const validation = combineValidations(
      validateRequired(workspaceId, 'Workspace ID'),
      validateRequired(memberId, 'Member ID'),
    );

    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .post(`/api/workspaces/${workspaceId}/invitations/${memberId}/resend`, {})
      .then(unwrapServer<{ message: string }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Cancel an invitation
 */
export async function cancelInvite(
  workspaceId: string,
  memberId: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const validation = combineValidations(
      validateRequired(workspaceId, 'Workspace ID'),
      validateRequired(memberId, 'Member ID'),
    );

    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .delete(`/api/workspaces/${workspaceId}/invitations/${memberId}`)
      .then(unwrapServer<{ message: string }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Decline a workspace invitation
 */
export async function declineWorkspaceInvite(
  token: string,
): Promise<ActionResult<{ message: string }>> {
  try {
    const validation = validateRequired(token, 'Invite token');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .delete(`/api/workspaces/join/${token}`)
      .then(unwrapServer<{ message: string }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Get workspace branding and export preferences
 */
export async function getWorkspaceBranding(
  workspaceId: string,
): Promise<
  ActionResult<{ branding?: BrandingAssets; exportPreferences?: WorkspaceExportPreferences }>
> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .get(ApiEndpoints.workspaces.branding(workspaceId))
      .then(
        unwrapServer<{ branding?: BrandingAssets; exportPreferences?: WorkspaceExportPreferences }>,
      );
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Update workspace branding
 */
export async function updateWorkspaceBranding(
  workspaceId: string,
  branding: BrandingAssets,
): Promise<ActionResult<BrandingAssets>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .patch(ApiEndpoints.workspaces.branding(workspaceId), branding)
      .then(unwrapServer<BrandingAssets>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Update workspace export preferences
 */
export async function updateWorkspaceExportPreferences(
  workspaceId: string,
  preferences: WorkspaceExportPreferences,
): Promise<ActionResult<WorkspaceExportPreferences>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .patch(ApiEndpoints.workspaces.exportPreferences(workspaceId), preferences)
      .then(unwrapServer<WorkspaceExportPreferences>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Get platform default branding (public endpoint, no auth required)
 */
export async function getDefaultBranding(): Promise<BrandingAssets | undefined> {
  try {
    const data = await httpClient
      .get(ApiEndpoints.settings.defaultBranding)
      .then(unwrapServer<BrandingAssets | undefined>);
    return data;
  } catch (e) {
    console.warn('[getDefaultBranding] Failed to fetch platform defaults:', e);
    return undefined;
  }
}

/**
 * Employee-code action result - carries the backend error `code` and any
 * relevant metadata (currentMax, member) so the UI can route the error
 * inline instead of parsing message strings.
 */
export type EmployeeCodeActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      error: string;
      code?: string;
      currentMax?: number;
      member?: string;
    };

function extractEmployeeCodeError(e: unknown): {
  error: string;
  code?: string;
  currentMax?: number;
  member?: string;
} {
  // Axios errors expose the backend envelope under e.response.data
  if (
    typeof e === 'object' &&
    e !== null &&
    'response' in e &&
    typeof (e as { response?: unknown }).response === 'object' &&
    (e as { response?: { data?: unknown } }).response?.data
  ) {
    const data = (e as { response: { data: Record<string, unknown> } }).response.data;
    const message =
      typeof data.message === 'string' && data.message ? data.message : extractError(e);
    return {
      error: message,
      code: typeof data.code === 'string' ? data.code : undefined,
      currentMax: typeof data.currentMax === 'number' ? data.currentMax : undefined,
      member: typeof data.member === 'string' ? data.member : undefined,
    };
  }
  return { error: extractError(e) };
}

/**
 * Get employee code settings for a workspace
 */
export async function getEmployeeCodeSettings(
  workspaceId: string,
): Promise<ActionResult<EmployeeCodeSettingsResponse>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return failure(validation.error);
    }

    const http = await serverHttp();
    const data = await http
      .get(ApiEndpoints.workspaces.employeeCodeSettings(workspaceId))
      .then(unwrapServer<EmployeeCodeSettingsResponse>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Update employee code settings for a workspace.
 * Backend may return 400 with code 'EMP_CODE_STARTING_NUMBER_TOO_LOW' when the
 * requested startingNumber is <= the current counter - surface the code so the
 * UI can place an inline error on the starting number field.
 */
export async function updateEmployeeCodeSettings(
  workspaceId: string,
  settings: Partial<EmployeeCodeSettings>,
): Promise<EmployeeCodeActionResult<EmployeeCodeSettingsResponse>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const http = await serverHttp();
    const data = await http
      .patch(ApiEndpoints.workspaces.employeeCodeSettings(workspaceId), settings)
      .then(unwrapServer<EmployeeCodeSettingsResponse>);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...extractEmployeeCodeError(e) };
  }
}

/**
 * Backfill employee codes for all existing members in a workspace.
 * Requires the setting to be enabled - otherwise backend returns 400
 * with code 'EMP_CODE_DISABLED'.
 */
export async function backfillEmployeeCodes(
  workspaceId: string,
): Promise<EmployeeCodeActionResult<BackfillEmployeeCodesResponse>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) {
      return { ok: false, error: validation.error };
    }

    const http = await serverHttp();
    const data = await http
      .post(ApiEndpoints.team.backfillEmployeeCodes(workspaceId))
      .then(unwrapServer<BackfillEmployeeCodesResponse>);
    return { ok: true, data };
  } catch (e) {
    return { ok: false, ...extractEmployeeCodeError(e) };
  }
}

// ── Designations sub-resource (F2, 2026-05-13) ──────────────────────────────
// Mirror BE controller (workspaces.controller.ts). Mobile-app contract preserved
// via canonical-en mirror on team_member.designation. See memory:
// project_designations_v2.md.

const E_WS = ApiEndpoints.workspaces;

export async function listDesignations(
  workspaceId: string,
): Promise<ActionResult<DesignationRecord[]>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) return failure(validation.error);
    const http = await serverHttp();
    const data = await http
      .get(E_WS.designations(workspaceId))
      .then(unwrapServer<DesignationRecord[]>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

export async function addDesignation(
  workspaceId: string,
  record: DesignationRecord,
): Promise<ActionResult<DesignationRecord[]>> {
  try {
    const idVal = validateRequired(workspaceId, 'Workspace ID');
    if (!idVal.valid) return failure(idVal.error);
    const canonicalVal = validateNonEmptyString(record.canonical, 'Designation');
    if (!canonicalVal.valid) return failure(canonicalVal.error);
    const http = await serverHttp();
    const data = await http
      .post(E_WS.designations(workspaceId), { designation: record })
      .then(unwrapServer<DesignationRecord[]>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

export async function renameDesignation(
  workspaceId: string,
  oldCanonical: string,
  body: { newCanonical: string; labels?: DesignationLabels },
): Promise<ActionResult<{ designations: DesignationRecord[]; cascadedMembers: number }>> {
  try {
    const idVal = validateRequired(workspaceId, 'Workspace ID');
    if (!idVal.valid) return failure(idVal.error);
    const oldVal = validateNonEmptyString(oldCanonical, 'Current designation');
    if (!oldVal.valid) return failure(oldVal.error);
    const newVal = validateNonEmptyString(body.newCanonical, 'New designation');
    if (!newVal.valid) return failure(newVal.error);
    const http = await serverHttp();
    const data = await http
      .patch(E_WS.designation(workspaceId, oldCanonical), body)
      .then(unwrapServer<{ designations: DesignationRecord[]; cascadedMembers: number }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

/**
 * Result type for deleteDesignation - extends the standard failure shape with
 * BE-supplied `inUseCount` + `sampleMemberIds` so the UI can render the
 * "in use, jump to team" block modal without losing structured data.
 */
export type DeleteDesignationResult =
  | { ok: true; data: DesignationRecord[] }
  | {
      ok: false;
      error: string;
      code?: 'DESIGNATION_IN_USE';
      inUseCount?: number;
      sampleMemberIds?: string[];
      canonical?: string;
    };

export async function deleteDesignation(
  workspaceId: string,
  canonical: string,
): Promise<DeleteDesignationResult> {
  try {
    const idVal = validateRequired(workspaceId, 'Workspace ID');
    if (!idVal.valid) return { ok: false, error: idVal.error };
    const canonicalVal = validateNonEmptyString(canonical, 'Designation');
    if (!canonicalVal.valid) return { ok: false, error: canonicalVal.error };
    const http = await serverHttp();
    const data = await http
      .delete(E_WS.designation(workspaceId, canonical))
      .then(unwrapServer<DesignationRecord[]>);
    return { ok: true, data };
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const payload = e.response?.data as
        | {
            message?:
              | string
              | {
                  message?: string;
                  code?: string;
                  inUseCount?: number;
                  sampleMemberIds?: string[];
                  canonical?: string;
                };
            error?: {
              message?: string;
              code?: string;
              inUseCount?: number;
              sampleMemberIds?: string[];
              canonical?: string;
            };
            code?: string;
            inUseCount?: number;
            sampleMemberIds?: string[];
            canonical?: string;
          }
        | undefined;
      // BE BadRequestException body shape: { success:false, code, message, inUseCount, sampleMemberIds, canonical }
      // - message may be either a string or the structured object Nest wraps.
      const flat =
        (payload?.message && typeof payload.message === 'object' ? payload.message : payload) || {};
      const code = flat.code ?? payload?.error?.code;
      if (code === 'DESIGNATION_IN_USE') {
        return {
          ok: false,
          error:
            typeof payload?.message === 'string'
              ? payload.message
              : ((flat as { message?: string }).message ?? extractError(e)),
          code: 'DESIGNATION_IN_USE',
          inUseCount: flat.inUseCount ?? payload?.inUseCount,
          sampleMemberIds: flat.sampleMemberIds ?? payload?.sampleMemberIds,
          canonical: flat.canonical ?? payload?.canonical,
        };
      }
    }
    return { ok: false, error: extractError(e) };
  }
}

export async function getDesignationUsage(
  workspaceId: string,
  canonical: string,
): Promise<ActionResult<{ canonical: string; inUseCount: number; sampleMemberIds: string[] }>> {
  try {
    const idVal = validateRequired(workspaceId, 'Workspace ID');
    if (!idVal.valid) return failure(idVal.error);
    const canonicalVal = validateNonEmptyString(canonical, 'Designation');
    if (!canonicalVal.valid) return failure(canonicalVal.error);
    const http = await serverHttp();
    const data = await http
      .get(E_WS.designationUsage(workspaceId, canonical))
      .then(unwrapServer<{ canonical: string; inUseCount: number; sampleMemberIds: string[] }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}

// ── Notification policy (Phase 2.4, 2026-05-21) ─────────────────────────────
// PATCH /workspaces/:id/notification-policy
// Requires: workspaces.EDIT

export type NotificationPolicyPayload = WorkspaceNotificationPolicy;

/**
 * Update the workspace notification policy.
 * Partial updates are supported - omitted fields are left untouched by the BE.
 */
export async function updateNotificationPolicy(
  workspaceId: string,
  payload: NotificationPolicyPayload,
): Promise<ActionResult<{ message: string; workspace: Workspace }>> {
  try {
    const validation = validateRequired(workspaceId, 'Workspace ID');
    if (!validation.valid) return failure(validation.error);
    const http = await serverHttp();
    const data = await http
      .patch(E_WS.notificationPolicy(workspaceId), payload)
      .then(unwrapServer<{ message: string; workspace: Workspace }>);
    return success(data);
  } catch (e) {
    return failure(extractError(e));
  }
}
