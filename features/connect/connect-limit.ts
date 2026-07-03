/**
 * Shared reader for the Connect plan COUNT-limit 403 (limit-enforcement step).
 *
 * The backend throws ONE consistent body across all four creation/reactivation
 * paths: `{ code: 'CONNECT_LIMIT_REACHED', kind, limit, used }` (HTTP 403, from
 * ConnectAllowanceService). This turns that envelope into a typed `ConnectLimitInfo`
 * so every create action surfaces the same upgrade-prompt instead of a generic
 * toast. Used server-side by the four create actions; the dialog + screens import
 * the TYPES only (erased at runtime, so no axios pulled into the client bundle).
 *
 * Links: backend ConnectLimitReachedException; web LimitReachedDialog.
 */
import { extractConnectError } from './marketplace/connect-error';
import type { ConnectLimitKind } from '@/lib/analytics-events';

export type { ConnectLimitKind };

/** The app-level code on the typed 403. Keep in sync with the backend constant. */
export const CONNECT_LIMIT_REACHED = 'CONNECT_LIMIT_REACHED' as const;

/** Parsed limit-reached detail the dialog renders. `used` == `limit` at the gate. */
export interface ConnectLimitInfo {
  kind: ConnectLimitKind;
  limit: number;
  used: number;
}

const KINDS: readonly ConnectLimitKind[] = ['listing', 'storefront', 'company_page', 'job'];

/**
 * Returns the typed limit info when `e` is a `CONNECT_LIMIT_REACHED` 403, else
 * `null` (so the caller falls back to its normal error handling). Tolerant of a
 * missing `used` (defaults to `limit`) so an older server can't break the prompt.
 */
export function extractConnectLimit(e: unknown): ConnectLimitInfo | null {
  const { code, data } = extractConnectError(e);
  if (code !== CONNECT_LIMIT_REACHED || !data) return null;
  const kind = data.kind;
  if (typeof kind !== 'string' || !KINDS.includes(kind as ConnectLimitKind)) return null;
  const limit = typeof data.limit === 'number' ? data.limit : 0;
  const used = typeof data.used === 'number' ? data.used : limit;
  return { kind: kind as ConnectLimitKind, limit, used };
}
