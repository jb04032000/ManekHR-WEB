'use server';
/**
 * Server Actions for Party Intelligence settings (SSR initial-data hydration).
 * Phase 17 / Plan 08.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { partyIntelligenceSettings as PIS } from '@/lib/api/endpoints';
import type { WorkspaceSettingsPartyIntelligence } from '@/types';
import type {
  UpcomingGreetingsResponse,
} from '@/lib/api/modules/party-intelligence-settings.api';

export async function getSettingsAction(
  wsId: string,
): Promise<WorkspaceSettingsPartyIntelligence | null> {
  const http = await serverHttp();
  return http
    .get(PIS.get(wsId))
    .then(unwrapServer<WorkspaceSettingsPartyIntelligence>)
    .catch(() => null);
}

export async function getUpcomingGreetingsAction(
  wsId: string,
  days = 30,
): Promise<UpcomingGreetingsResponse> {
  const http = await serverHttp();
  return http
    .get(PIS.upcomingGreetings(wsId), { params: { days } })
    .then(unwrapServer<UpcomingGreetingsResponse>)
    .catch(() => ({ items: [] as UpcomingGreetingsResponse['items'] }));
}
