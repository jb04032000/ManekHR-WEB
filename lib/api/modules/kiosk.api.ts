/**
 * Kiosk API - public calls that bypass the authenticated apiClient.
 * Uses a bare axios instance with no Authorization header and no token-refresh interceptor.
 * baseURL already includes /api (matches NEXT_PUBLIC_BACKEND_API_URL convention).
 * Endpoint helpers are bare paths (no leading slash, no /api prefix) - axios joins them.
 */
import axios from 'axios';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { env } from '@/lib/env';

const baseURL = env.backendApiUrl;

// Bare axios - no auth interceptor, no token refresh.
const bare = axios.create({ baseURL, timeout: 10000 });

function unwrap<T>(res: { data?: { data?: T } | T }): T {
  const d = res?.data as { data?: T } | T | undefined;
  if (d && typeof d === 'object' && 'data' in d) return (d as { data: T }).data;
  return d as T;
}

export const kioskApi = {
  async lookup(
    wsId: string,
    secret: string,
    employeeCode: string,
  ): Promise<{ name: string; photoUrl: string | null }> {
    const res = await bare.post(ApiEndpoints.kiosk.lookup(), {
      wsId,
      secret,
      employeeCode,
    });
    return unwrap(res);
  },

  async punch(
    wsId: string,
    secret: string,
    employeeCode: string,
    pin: string,
  ): Promise<{
    name: string;
    photoUrl: string | null;
    punchType: 'CHECK_IN' | 'CHECK_OUT';
    time: string;
  }> {
    const res = await bare.post(ApiEndpoints.kiosk.punch(), {
      wsId,
      secret,
      employeeCode,
      pin,
    });
    return unwrap(res);
  },
};
