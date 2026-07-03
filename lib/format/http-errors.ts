/**
 * User-facing fallbacks for raw HTTP failures (2026-05-22).
 *
 * Server actions ('use server') serialize thrown errors across the RSC
 * boundary, stripping the axios `response` object. The client is then left
 * with a bare `Error('Request failed with status code 403')` which must never
 * be shown to a user. These helpers map a status (or that raw axios message)
 * to a plain-language sentence.
 *
 * Cross-module: shared by every server action in `lib/actions/*` (via
 * `extractErrorMessage`) and the auth-specific `extractError` in
 * `lib/actions/auth.actions.ts`. The auth UI localizes the network case via the
 * `NETWORK_UNREACHABLE` code in `lib/format/auth-error-codes.ts` - keep the
 * predicate + constant here as the single source of truth so every surface
 * detects a backend-down / timeout the same way.
 */

import axios from 'axios';

/**
 * Friendly fallback shown when the backend cannot be reached at all (server
 * down, DNS failure, request timeout, connection refused). This is the message
 * a user sees on the sign-in screen when the API is offline - it must never be
 * the raw axios "timeout of 15000ms exceeded" string. Auth screens swap this
 * for the localized `auth.errors.codes.NETWORK_UNREACHABLE` via the
 * `NETWORK_UNREACHABLE` error code; this English constant is the non-localized
 * floor for non-auth callers + the server-action boundary.
 */
export const NETWORK_UNREACHABLE_MESSAGE =
  "We couldn't reach the server. Please check your internet connection and try again.";

// Signatures of a network/transport-layer failure carried on a plain Error
// message. Server actions strip the axios `response`, so after the RSC boundary
// a timeout/connection-refused arrives as a bare `Error('timeout of 15000ms
// exceeded')` (or ECONNREFUSED / ERR_NETWORK / ...). Matching these lets us
// still recognise it and never leak the raw string. Keep in sync with the axios
// + node error codes we can actually receive from `serverHttp`.
const NETWORK_MESSAGE_PATTERNS: readonly RegExp[] = [
  /timeout of \d+ms exceeded/i,
  /network ?error/i,
  /ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNABORTED|ERR_NETWORK|EAI_AGAIN/i,
];

/**
 * True when `e` is a transport-layer failure (no HTTP response was ever
 * received): the backend is down, DNS failed, the connection was refused, or
 * the request timed out. Detects BOTH shapes the FE can see:
 *   - an axios error with no `.response` (still on the server side of a
 *     server action), and
 *   - a plain `Error` whose message matches a network/timeout signature
 *     (after Next.js serialised + stripped the axios response).
 *
 * Reusable predicate so `extractErrorMessage`, the auth `extractError`, and any
 * future caller all classify a backend-down identically. Exported alongside
 * `NETWORK_UNREACHABLE_MESSAGE`.
 */
export function isNetworkError(e: unknown): boolean {
  // Axios error that never received a response = pure transport failure.
  if (axios.isAxiosError(e) && !e.response) return true;
  // Serialised / plain Error: match the known network/timeout message shapes.
  if (e instanceof Error && typeof e.message === 'string') {
    return NETWORK_MESSAGE_PATTERNS.some((re) => re.test(e.message));
  }
  // Next.js serialises a thrown error as a plain object { message, digest }.
  if (e && typeof e === 'object' && !axios.isAxiosError(e)) {
    const msg = (e as { message?: unknown }).message;
    if (typeof msg === 'string') {
      return NETWORK_MESSAGE_PATTERNS.some((re) => re.test(msg));
    }
  }
  return false;
}

export const HTTP_STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'That request could not be completed. Please check the details and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to perform this action.',
  404: 'That item could not be found. It may have already been changed or removed.',
  408: 'The request timed out. Please try again.',
  409: 'This change conflicts with the current state. Refresh the page and try again.',
  413: 'That upload is too large. Please use a smaller file.',
  422: 'Some of the details could not be accepted. Please review and try again.',
  423: 'The app is locked. Please unlock it and try again.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on our end. Please try again in a moment.',
  502: 'The service is temporarily unavailable. Please try again shortly.',
  503: 'The service is temporarily unavailable. Please try again shortly.',
  504: 'The service took too long to respond. Please try again.',
};

/** Friendly sentence for an HTTP status, or null when unmapped. */
export function friendlyHttpStatusMessage(status: number | undefined | null): string | null {
  if (status == null) return null;
  return HTTP_STATUS_MESSAGES[status] ?? (status >= 500 ? HTTP_STATUS_MESSAGES[500] : null);
}

/**
 * If `message` is a raw axios "Request failed with status code N", return the
 * friendly equivalent; otherwise null (caller keeps its own message).
 */
export function friendlyFromAxiosMessage(message: string): string | null {
  const m = /request failed with status code (\d+)/i.exec(message);
  return m ? (friendlyHttpStatusMessage(Number(m[1])) ?? HTTP_STATUS_MESSAGES[500]) : null;
}

/**
 * Extract a user-facing message from a thrown error inside a server action.
 * Prefers a structured `response.data.message` / `.error.message` (e.g. the
 * backend PolicyDenied body), then a friendly status sentence, then the
 * caller's `fallback`. Never lets a raw "Request failed with status code N"
 * reach the user. Shared by the server actions in `lib/actions/*`.
 */
export function extractErrorMessage(e: unknown, fallback: string): string {
  // Transport-layer failure (backend down / timeout / connection refused).
  // Checked FIRST so a network error never falls through to `return e.message`
  // and leaks a raw "timeout of 15000ms exceeded" string to the user. Covers
  // both the axios-no-response shape and the serialised plain-Error shape.
  if (isNetworkError(e)) return NETWORK_UNREACHABLE_MESSAGE;
  if (e && typeof e === 'object' && 'response' in e) {
    const axiosErr = e as { response?: { status?: number; data?: unknown } };
    if (axiosErr.response?.data) {
      const body = axiosErr.response.data as { message?: string; error?: { message?: string } };
      if (body.message && typeof body.message === 'string') return body.message;
      if (body.error?.message && typeof body.error.message === 'string') return body.error.message;
    }
    const statusMsg = friendlyHttpStatusMessage(axiosErr.response?.status);
    if (statusMsg) return statusMsg;
  } else if (
    e instanceof Error &&
    // Guard the raw-message fallback: never leak a "Request failed with status
    // code N" NOR a serialised network/timeout Error. `isNetworkError` above
    // already returned for the latter, so this regex stays the status-code
    // guard; the explicit re-check keeps the intent obvious if the order moves.
    !/request failed with status code/i.test(e.message)
  ) {
    return e.message;
  }
  return fallback;
}
