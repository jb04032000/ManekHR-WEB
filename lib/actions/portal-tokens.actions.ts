'use server';

/**
 * Phase 16 / FIN-15-03 - Portal Token server actions.
 *
 * SSR-friendly read paths + write paths (issue / revoke / revoke-all / share)
 * for the Portal Access owner-side dashboard. Mirrors the client API in
 * `lib/api/modules/portal-tokens.api.ts`.
 */
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { portalTokens } from '@/lib/api/endpoints';
import type {
  PortalToken,
  IssueTokenInput,
  IssueTokenResult,
  SharePortalTokenInput,
} from '@/types';

export async function listPortalTokens(wsId: string, partyId: string): Promise<PortalToken[]> {
  const http = await serverHttp();
  return http.get(portalTokens.list(wsId, partyId)).then(unwrapServer<PortalToken[]>);
}

export async function issuePortalToken(
  wsId: string,
  partyId: string,
  dto: IssueTokenInput,
): Promise<IssueTokenResult> {
  const http = await serverHttp();
  return http.post(portalTokens.issue(wsId, partyId), dto).then(unwrapServer<IssueTokenResult>);
}

export async function revokePortalToken(
  wsId: string,
  partyId: string,
  jti: string,
  reason?: string,
): Promise<{ ok: true }> {
  const http = await serverHttp();
  return http
    .delete(portalTokens.revoke(wsId, partyId, jti), {
      data: reason ? { reason } : undefined,
    })
    .then(unwrapServer<{ ok: true }>);
}

export async function revokeAllPortalTokens(
  wsId: string,
  partyId: string,
): Promise<{ ok: true; revoked: number }> {
  const http = await serverHttp();
  return http
    .delete(portalTokens.revokeAll(wsId, partyId))
    .then(unwrapServer<{ ok: true; revoked: number }>);
}

export async function sharePortalToken(
  wsId: string,
  partyId: string,
  jti: string,
  dto: SharePortalTokenInput,
): Promise<{ ok: true }> {
  const http = await serverHttp();
  return http.post(portalTokens.share(wsId, partyId, jti), dto).then(unwrapServer<{ ok: true }>);
}
