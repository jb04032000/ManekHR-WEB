/**
 * Server-only Axios helper for the public party portal (Phase 16 / FIN-15-03).
 *
 * Injects the portal JWT into the X-Portal-Token header so the backend
 * PortalTokenGuard can verify it. The JWT is NEVER exposed to client JS:
 * - Server components call portalHttp(token) directly during SSR.
 * - Client components hit the same-origin /api/portal/[token]/[...path]
 *   proxy route, which keeps the token server-side.
 *
 * `validateStatus: () => true` lets callers branch on 401/410/429/5xx and
 * render the appropriate error landing page (T-16-07-01 mitigation).
 */
import 'server-only';
import axios, { AxiosInstance } from 'axios';
import { env } from '@/lib/env';

const BASE_URL = env.serverBackendApiUrl;

export function portalHttp(token: string): AxiosInstance {
  return axios.create({
    baseURL: BASE_URL,
    headers: {
      'X-Portal-Token': token,
      'Content-Type': 'application/json',
      'x-platform': 'web',
    },
    timeout: 30_000,
    // We render error pages ourselves - never throw on non-2xx.
    validateStatus: () => true,
  });
}
