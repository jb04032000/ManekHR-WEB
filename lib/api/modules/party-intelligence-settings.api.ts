/**
 * Party Intelligence Settings API client wrappers.
 * Phase 17 / Plan 08 - Wave 3.
 *
 * Endpoints from `lib/api/endpoints.ts` partyIntelligenceSettings group.
 *  - GET    /workspaces/:wsId/settings/party-intelligence
 *  - PATCH  /workspaces/:wsId/settings/party-intelligence
 *  - GET    /workspaces/:wsId/settings/party-intelligence/upcoming-greetings
 *
 * Companion suppress-greetings PATCH (Plan 17-06) is mounted under the
 * firm-scoped parties controller - see suppressGreetings() helper below.
 */

import http, { unwrap } from '../client';
import { partyIntelligenceSettings as PIS } from '../endpoints';
import type { WorkspaceSettingsPartyIntelligence } from '@/types';

export interface UpcomingGreetingRow {
  date: string; // ISO date (YYYY-MM-DD or full ISO)
  partyId: string;
  partyName: string;
  contactId: string;
  contactName?: string;
  occasion: 'birthday' | 'anniversary';
  channel: 'whatsapp' | 'email' | 'sms';
  suppressed?: boolean;
}

export interface UpcomingGreetingsResponse {
  items: UpcomingGreetingRow[];
}

export const partyIntelligenceSettingsApi = {
  getSettings: (wsId: string) =>
    http.get(PIS.get(wsId)).then(unwrap<WorkspaceSettingsPartyIntelligence>),

  updateSettings: (wsId: string, patch: Partial<WorkspaceSettingsPartyIntelligence>) =>
    http.patch(PIS.update(wsId), patch).then(unwrap<WorkspaceSettingsPartyIntelligence>),

  getUpcomingGreetings: (wsId: string, days = 30) =>
    http
      .get(PIS.upcomingGreetings(wsId), { params: { days } })
      .then(unwrap<UpcomingGreetingsResponse>),

  /**
   * Toggle suppressGreetings on a single party contact.
   * Plan 17-06 deviation: route is firm-scoped under
   * `/workspaces/:wsId/finance/firms/:firmId/parties/:partyId/contacts/:contactId/suppress-greetings`.
   * The upcoming-greetings preview rows do not carry firmId, so the caller
   * must pass it from the party detail page or resolve it before calling.
   */
  suppressGreetings: (
    wsId: string,
    firmId: string,
    partyId: string,
    contactId: string,
    suppressGreetings: boolean,
  ) =>
    http
      .patch(
        `workspaces/${wsId}/finance/firms/${firmId}/parties/${partyId}/contacts/${contactId}/suppress-greetings`,
        { suppressGreetings },
      )
      .then(unwrap<{ success: boolean }>),
};
