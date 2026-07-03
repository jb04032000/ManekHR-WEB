import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';

export interface SessionInfo {
  id: string;
  deviceName: string;
  platform: 'web' | 'mobile';
  ipAddress?: string;
  userAgent?: string;
  location?: string;
  lastActiveAt: string;
}

export interface TerminateAndLoginResult {
  accessToken: string;
  refreshToken: string | null;
  session: {
    id: string;
    deviceName: string;
    platform: string;
  };
}

const E = ApiEndpoints.sessions;

export const sessionsApi = {
  getActiveSessions: () => http.get(E.list).then(unwrap<{ data: SessionInfo[] }>),
  deleteSession: (sessionId: string) => http.delete(E.delete(sessionId)),
  invalidateAllOtherSessions: () => http.delete(E.deleteAll),
  terminateAndLogin: (data: { sessionId: string; deviceName: string; platform: string; ipAddress?: string; userAgent?: string }) =>
    http.post(E.terminateAndLogin, data).then(unwrap<TerminateAndLoginResult>),
};