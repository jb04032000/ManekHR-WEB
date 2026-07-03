'use server';
/**
 * SSR server action for the per-party P&L report (Phase 17 / Plan 08).
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { partyPnlReport as PNL } from '@/lib/api/endpoints';
import type { PartyPnlReport } from '@/types';

export async function getPartyPnlAction(
  wsId: string,
  partyId: string,
  from?: string,
  to?: string,
): Promise<PartyPnlReport | null> {
  const http = await serverHttp();
  return http
    .get(PNL.get(wsId, partyId), { params: { from, to } })
    .then(unwrapServer<PartyPnlReport>)
    .catch(() => null);
}
