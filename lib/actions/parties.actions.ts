'use server';
/**
 * Server Actions for Party Intelligence + Timeline (SSR initial data hydration).
 * Phase 17 / Plan 07.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import {
  partyIntelligence as PI,
  partyTimeline as PT,
  partyPnlReport as PNL,
} from '@/lib/api/endpoints';
import type {
  Party,
  PartyIntelligence,
  PartyTimelineEvent,
  PartyPnlReport,
} from '@/types';

/**
 * Fetch party + intelligence in a single SSR pass.
 * Returns { party, intelligence } shape so the page can render the
 * IntelligencePanel with no client-side data wait.
 */
export async function getPartyWithIntelligence(
  wsId: string,
  firmId: string,
  partyId: string,
): Promise<{ party: Party; intelligence: PartyIntelligence | null }> {
  const http = await serverHttp();
  const [party, intelligence] = await Promise.all([
    http
      .get(`workspaces/${wsId}/finance/firms/${firmId}/parties/${partyId}`)
      .then(unwrapServer<Party>)
      .catch(() => null as Party | null),
    http
      .get(PI.get(wsId, partyId))
      .then(unwrapServer<PartyIntelligence>)
      .catch(() => null as PartyIntelligence | null),
  ]);
  if (!party) {
    throw new Error('Party not found');
  }
  return { party, intelligence };
}

/**
 * Fetch first page of timeline (50 events) for SSR hydration.
 */
export async function getInitialTimeline(
  wsId: string,
  partyId: string,
  limit = 50,
): Promise<{ items: PartyTimelineEvent[]; nextCursor: string | null }> {
  const http = await serverHttp();
  return http
    .get(PT.list(wsId, partyId), { params: { limit } })
    .then(unwrapServer<{ items: PartyTimelineEvent[]; nextCursor: string | null }>)
    .catch(() => ({ items: [], nextCursor: null }));
}

/**
 * SSR P&L summary for the current FY (used by IntelligencePanel Card 3).
 */
export async function getPartyPnlSummary(
  wsId: string,
  partyId: string,
): Promise<PartyPnlReport | null> {
  const http = await serverHttp();
  return http
    .get(PNL.get(wsId, partyId))
    .then(unwrapServer<PartyPnlReport>)
    .catch(() => null);
}
