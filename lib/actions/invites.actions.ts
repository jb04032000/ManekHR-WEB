'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { SentInvite, InviteHistoryItem } from '@/types';

const ME = ApiEndpoints.me;

/**
 * P2.0 (2026-05-15) - Sent tab on /dashboard/invitations.
 * Aggregated across all workspaces the caller has personally invited
 * members from. Includes accepted / declined / removed states for the
 * status-chip filter strip.
 */
export async function listMySentInvites() {
  const http = await serverHttp();
  return http.get(ME.sentInvites).then(unwrapServer<SentInvite[]>);
}

/**
 * P2.0 (2026-05-15) - History filter chip on Received tab.
 * Past invitations addressed to the caller (active / declined / removed).
 */
export async function listMyInviteHistory() {
  const http = await serverHttp();
  return http.get(ME.inviteHistory).then(unwrapServer<InviteHistoryItem[]>);
}
