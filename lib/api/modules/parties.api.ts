/**
 * Party Intelligence + Timeline + P&L API client wrappers.
 * Phase 17 / Plan 07 - Wave 2 web layer.
 *
 * Endpoints come from the top-level builder groups in `lib/api/endpoints.ts`
 * (partyIntelligence, partyTimeline, partyPnlReport - added in Plan 17-01).
 */

import http, { unwrap } from '../client';
import { partyIntelligence as PI, partyTimeline as PT, partyPnlReport as PNL } from '../endpoints';
import type {
  PartyIntelligence,
  PartySegment,
  PartyTimelineEvent,
  PartyTimelineEventType,
  PartyPnlReport,
} from '@/types';

// ── Intelligence ──────────────────────────────────────────────
export const partyIntelligenceApi = {
  getIntelligence: (wsId: string, partyId: string) =>
    http.get(PI.get(wsId, partyId)).then(unwrap<PartyIntelligence>),

  setBlacklist: (wsId: string, partyId: string, reason: string) =>
    http.post(PI.setBlacklist(wsId, partyId), { reason }).then(unwrap<PartyIntelligence>),

  clearBlacklist: (wsId: string, partyId: string) =>
    http.delete(PI.clearBlacklist(wsId, partyId)).then(unwrap<PartyIntelligence>),

  setManualSegment: (wsId: string, partyId: string, segment: PartySegment) =>
    http.post(PI.manualSegment(wsId, partyId), { segment }).then(unwrap<PartyIntelligence>),

  clearManualSegment: (wsId: string, partyId: string) =>
    http.delete(PI.manualSegment(wsId, partyId)).then(unwrap<PartyIntelligence>),

  recheckGstin: (wsId: string, partyId: string) =>
    http
      .post(PI.recheckGstin(wsId, partyId), {})
      .then(unwrap<{ status: string; updated?: PartyIntelligence; retryAfterSeconds?: number }>),

  triggerRerunRfm: (wsId: string) =>
    http
      .post(PI.rerunRfm(wsId), {})
      .then(unwrap<{ status: string; updated?: number; retryAfterSeconds?: number }>),
};

// ── Timeline ──────────────────────────────────────────────────
export interface TimelineListParams {
  limit?: number;
  before?: string; // ISO date for cursor
  types?: PartyTimelineEventType[];
}

export interface TimelineListResponse {
  items: PartyTimelineEvent[];
  nextCursor: string | null;
}

export interface CreateTimelineEventBody {
  type: 'call.logged' | 'email.logged' | 'note.added';
  summary: string;
  meta?: Record<string, unknown>;
}

export interface UpdateTimelineEventBody {
  summary?: string;
  meta?: Record<string, unknown>;
}

export const partyTimelineApi = {
  listTimeline: (wsId: string, partyId: string, params?: TimelineListParams) =>
    http
      .get(PT.list(wsId, partyId), {
        params: {
          limit: params?.limit,
          before: params?.before,
          types: params?.types?.join(','),
        },
      })
      .then(unwrap<TimelineListResponse>),

  createTimelineEvent: (wsId: string, partyId: string, body: CreateTimelineEventBody) =>
    http.post(PT.create(wsId, partyId), body).then(unwrap<PartyTimelineEvent>),

  updateTimelineEvent: (
    wsId: string,
    partyId: string,
    eventId: string,
    body: UpdateTimelineEventBody,
  ) => http.patch(PT.update(wsId, partyId, eventId), body).then(unwrap<PartyTimelineEvent>),

  deleteTimelineEvent: (wsId: string, partyId: string, eventId: string) =>
    http.delete(PT.delete(wsId, partyId, eventId)).then(unwrap<void>),
};

// ── P&L ───────────────────────────────────────────────────────
export const partyPnlApi = {
  getPnl: (wsId: string, partyId: string, from?: string, to?: string) =>
    http.get(PNL.get(wsId, partyId), { params: { from, to } }).then(unwrap<PartyPnlReport>),
};

export const partiesApi = {
  ...partyIntelligenceApi,
  ...partyTimelineApi,
  ...partyPnlApi,
};
