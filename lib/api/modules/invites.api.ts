import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';

const E = ApiEndpoints.invites;

/**
 * Wave 2 invite consolidation - single canonical token-resolution endpoint.
 * Token preview + accept + decline are all keyed off `/invites/:token`.
 * Replaces the legacy split between `workspaces/join/:token` and
 * `team/accept-invite/:token`.
 */

export interface InvitePreview {
  token: string;
  workspaceName: string;
  workspaceType?: string;
  memberCount: number;
  invitedBy: string;
  role: string;
  /** Wave 4.8 - invitee identifier (email or mobile, pre-filled in landing form). */
  identifier?: string;
  identifierType?: 'email' | 'mobile';
  /** Wave 2 - true when bridge invite is linked to a TeamMember directory record. */
  isLinkedToTeamMember: boolean;
  /** Wave 4.8 - drives signup-vs-login routing on the landing page. */
  requiresSignup: boolean;
  /** Wave 4.8 - WorkspaceMember._id. Existing users redirect to /auth?inviteId=X. */
  inviteId: string;
}

export interface InviteAcceptResponse {
  workspace: { _id: string; name: string };
  member: unknown;
}

export const invitesApi = {
  preview: (token: string) => http.get(E.preview(token)).then(unwrap<InvitePreview>),
  accept: (token: string) => http.post(E.accept(token), {}).then(unwrap<InviteAcceptResponse>),
  decline: (token: string) => http.delete(E.decline(token)).then(unwrap<{ message: string }>),
};
