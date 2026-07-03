'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { karigarProfile } from '@/lib/api/endpoints';
import type { TeamMember, UpdateKarigarProfilePayload } from '@/types';

/**
 * Update a team member's Karigar (piece-rate artisan) profile fields. Backed by
 * the Team module's `/team/:memberId/karigar` route (NOT Finance/Job Work —
 * relocated here 2026-07-04 when Finance was removed; the endpoint and its
 * backend controller were always part of Team). Consumed by
 * components/dashboard/team/form/KarigarTab.tsx.
 */
export async function updateKarigarProfile(
  wsId: string,
  memberId: string,
  payload: UpdateKarigarProfilePayload,
): Promise<TeamMember> {
  const http = await serverHttp();
  return http.patch(karigarProfile.update(wsId, memberId), payload).then(unwrapServer<TeamMember>);
}
