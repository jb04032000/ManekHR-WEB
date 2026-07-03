/**
 * Reports API client wrappers - Phase 17 / Plan 08.
 *
 * Currently exposes the per-party P&L endpoint. Future report endpoints
 * (party-statement, customer-bucket, etc.) belong here too.
 */

import http, { unwrap } from '../client';
import { partyPnlReport as PNL } from '../endpoints';
import type { PartyPnlReport } from '@/types';

export const reportsApi = {
  /**
   * GET /workspaces/:wsId/reports/parties/:partyId/pnl?from=&to=
   * Returns null when the party does not exist or backend errors.
   */
  getPartyPnl: (wsId: string, partyId: string, range?: { from?: string; to?: string }) =>
    http
      .get(PNL.get(wsId, partyId), { params: { from: range?.from, to: range?.to } })
      .then(unwrap<PartyPnlReport>),
};
