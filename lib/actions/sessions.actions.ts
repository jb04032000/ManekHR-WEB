'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { SessionInfo, TerminateAndLoginResult } from '@/lib/api/modules/sessions.api';

const E = ApiEndpoints.sessions;

export async function getActiveSessions(): Promise<SessionInfo[]> {
  const http = await serverHttp();
  const response = await http.get(E.list).then(unwrapServer<{ data: SessionInfo[] }>);
  return response.data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const http = await serverHttp();
  await http.delete(E.delete(sessionId));
}

export async function invalidateAllOtherSessions(): Promise<number> {
  const http = await serverHttp();
  const response = await http.delete(E.deleteAll).then(unwrapServer<{ count: number }>);
  return response.count;
}

export async function terminateAndLogin(data: {
  sessionId: string;
  deviceName: string;
  platform: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<TerminateAndLoginResult> {
  const http = await serverHttp();
  return http.post(E.terminateAndLogin, data).then(unwrapServer<TerminateAndLoginResult>);
}