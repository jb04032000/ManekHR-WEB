'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { WorkspaceKioskState } from '@/types';

const W = ApiEndpoints.workspaces;
const T = ApiEndpoints.team;

/**
 * Enables kiosk and immediately regenerates the secret token.
 * Returns the plaintext secret ONCE - it will not be recoverable again.
 */
export async function enableKioskWithFreshToken(
  wsId: string,
): Promise<{ enabled: boolean; secret: string; rotatedAt: string }> {
  const http = await serverHttp();
  const updateRes = await http.patch(W.updateKiosk(wsId), { enabled: true });
  const regenRes = await http.post(W.regenerateKioskToken(wsId));
  const u = unwrapServer<{ enabled: boolean }>(updateRes);
  const r = unwrapServer<{ secret: string; rotatedAt: string }>(regenRes);
  return { enabled: u.enabled, secret: r.secret, rotatedAt: r.rotatedAt };
}

/**
 * Regenerates the kiosk secret token, invalidating the previous URL.
 * Returns the new plaintext secret ONCE.
 */
export async function regenerateKioskToken(
  wsId: string,
): Promise<{ secret: string; rotatedAt: string }> {
  const http = await serverHttp();
  const res = await http.post(W.regenerateKioskToken(wsId));
  return unwrapServer<{ secret: string; rotatedAt: string }>(res);
}

/**
 * Updates kiosk settings (enabled flag and/or IP allowlist).
 */
export async function updateKioskSettings(
  wsId: string,
  dto: { enabled?: boolean; allowedIpRanges?: string[] },
): Promise<{ enabled: boolean; allowedIpRanges: string[] }> {
  const http = await serverHttp();
  const res = await http.patch(W.updateKiosk(wsId), dto);
  return unwrapServer<{ enabled: boolean; allowedIpRanges: string[] }>(res);
}

/**
 * Sets a 4-digit kiosk PIN for a team member (admin action).
 * PIN is hashed server-side and cannot be retrieved.
 */
export async function setMemberKioskPin(
  wsId: string,
  memberId: string,
  pin: string,
): Promise<{ message: string }> {
  const http = await serverHttp();
  const res = await http.post(T.setKioskPin(wsId, memberId), { pin });
  return unwrapServer<{ message: string }>(res);
}

/**
 * Fetches current kiosk state for a workspace (enabled, rotatedAt, allowedIpRanges).
 * Reads from the GET /workspaces/:id workspace detail response.
 */
export async function getKioskState(wsId: string): Promise<WorkspaceKioskState> {
  const http = await serverHttp();
  const res = await http.get(W.getKioskState(wsId));
  const ws = unwrapServer<{
    kioskEnabled?: boolean;
    kioskTokenRotatedAt?: string | null;
    kioskAllowedIpRanges?: string[];
  }>(res);
  return {
    kioskEnabled: ws.kioskEnabled ?? false,
    kioskTokenRotatedAt: ws.kioskTokenRotatedAt ?? null,
    kioskAllowedIpRanges: ws.kioskAllowedIpRanges ?? [],
  };
}
