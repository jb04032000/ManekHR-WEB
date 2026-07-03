import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type { GrantedPath } from '@/types/rbac-registry';

const E = ApiEndpoints.me;

/**
 * Wave 1+2 RBAC - calling-user-scoped queries.
 *
 * - `permissions(wsId)` returns the actor's effective permissions in the
 *   given workspace. Powers the <Can> component. Owner short-circuits
 *   server-side (`isOwner: true` + empty permissions array).
 * - `pendingInvites()` returns workspace invites awaiting accept/decline
 *   for the calling user across all workspaces.
 */

export type PermissionScope = 'self' | 'all';

export interface MyPermissionRow {
  module: string;
  actions: string[];
  /** Optional parallel array - undefined entries default to 'all'. */
  actionScopes?: PermissionScope[];
}

/** Hierarchy / SoD posture of the caller's role - `'block'` means a
 *  non-owner cannot edit their own profile/admin record (§7 Part B). */
export type SelfProfileEdit = 'allow' | 'block';

export interface MyPermissionsResponse {
  isOwner: boolean;
  /** The caller's own `TeamMember._id` in this workspace, or `null` when
   *  they have no directory row. Lets the web resolve "which team member
   *  am I?" ambiently - drives the self-profile route + SoD checks. */
  teamMemberId: string | null;
  role: {
    id: string;
    name: string;
    isSystem: boolean;
    selfProfileEdit: SelfProfileEdit;
  } | null;
  permissions: MyPermissionRow[];
  /**
   * Phase 1c - path-override grants returned by the BE
   * `GET /workspaces/:wsId/me/permissions`. Each entry is a `{ path, scope }`
   * tuple derived from the `GrantedPath` registry. Powers `canPath()` /
   * `<Can path="…">` checks.
   */
  paths?: GrantedPath[];
  /**
   * Phase 2.3 - stable 16-hex-char hash of the caller's effective permission
   * set (role + overrides). Changes whenever role assignment or any override
   * changes. Used by the FE `permissions-store` to detect drift against the
   * `X-Permission-Version` response header and trigger cache invalidation
   * without polling.
   */
  permissionVersion?: string;
}

export interface InvitePreview {
  token: string;
  workspaceName: string;
  workspaceType?: string;
  memberCount: number;
  invitedBy: string;
  role: string;
  identifier?: string;
  identifierType?: 'email' | 'mobile';
  isLinkedToTeamMember: boolean;
  /** Wave 4.8 - true when no User exists for the identifier; FE renders
   * atomic signup form. False → route to /auth login + W4.7 switcher path. */
  requiresSignup: boolean;
  /** WorkspaceMember._id; web routes existing users to /auth?inviteId=X. */
  inviteId: string;
}

export interface PendingInvite {
  id: string;
  workspace: {
    id: string;
    name: string;
    businessType?: string;
    logo?: string;
  } | null;
  role: { id: string; name: string; isSystem: boolean } | null;
  invitedBy: string;
  inviteExpiry?: string | null;
  isLinkedToTeamMember: boolean;
}

export interface AcceptInviteResponse {
  workspace: { _id: string; name: string };
  member: unknown;
}

/**
 * Wave B Permission-Gated UI (2026-05-15) - self-scoped dashboard.
 *
 * Returned by `GET /workspaces/:wsId/me/dashboard`. Powers the
 * `MySelfDashboard` surface that restricted invitees see in place of the
 * workspace-aggregate tiles. `member` is null when the caller has no
 * linked TeamMember row (defensive - FE renders empty state).
 */
export interface MyDashboardResponse {
  member: { id: string; name: string; designation: string | null } | null;
  attendanceMonthly: {
    year: number;
    month: number;
    totalDays: number;
    present: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    late: number;
    other: number;
  };
  salaryCurrentMonth: {
    id: string;
    year: number;
    month: number;
    baseSalary: number;
    presentDays: number;
    totalDays: number;
    deductions: number;
    additions: number;
    netSalary: number;
    paidAmount: number;
    paymentStatus: 'pending' | 'partial' | 'paid' | 'advance' | string;
  } | null;
}

export const meApi = {
  permissions: (wsId: string) => http.get(E.permissions(wsId)).then(unwrap<MyPermissionsResponse>),
  dashboard: (wsId: string) => http.get(E.dashboard(wsId)).then(unwrap<MyDashboardResponse>),
  pendingInvites: () => http.get(E.pendingInvites).then(unwrap<PendingInvite[]>),
  acceptInvite: (inviteId: string) =>
    http.post(E.acceptInvite(inviteId), {}).then(unwrap<AcceptInviteResponse>),
  declineInvite: (inviteId: string) =>
    http.delete(E.declineInvite(inviteId)).then(unwrap<{ ok: boolean }>),
};
