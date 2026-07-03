/**
 * Phase 16 / FIN-15-03 - Customer Portal Token client API wrappers.
 *
 * Used by the Portal Access dashboard page (issue / list / revoke / share).
 * The raw JWT URL is returned only on `issue` - the persisted schema stores
 * `jti` only (Plan 16-04 T-16-04-06 mitigation).
 */
import http, { unwrap } from '../client';
import { portalTokens } from '../endpoints';
import type {
  PortalToken,
  IssueTokenInput,
  IssueTokenResult,
  SharePortalTokenInput,
} from '@/types';

export const portalTokensApi = {
  list: (wsId: string, partyId: string) =>
    http.get(portalTokens.list(wsId, partyId)).then(unwrap<PortalToken[]>),

  issue: (wsId: string, partyId: string, dto: IssueTokenInput) =>
    http.post(portalTokens.issue(wsId, partyId), dto).then(unwrap<IssueTokenResult>),

  revoke: (wsId: string, partyId: string, jti: string, reason?: string) =>
    http
      .delete(portalTokens.revoke(wsId, partyId, jti), {
        data: reason ? { reason } : undefined,
      })
      .then(unwrap<{ ok: true }>),

  revokeAll: (wsId: string, partyId: string) =>
    http.delete(portalTokens.revokeAll(wsId, partyId)).then(unwrap<{ ok: true; revoked: number }>),

  share: (wsId: string, partyId: string, jti: string, dto: SharePortalTokenInput) =>
    http.post(portalTokens.share(wsId, partyId, jti), dto).then(unwrap<{ ok: true }>),
};
