import type { InquiryErrorCode } from './marketplace.types';
import { extractConnectError } from './connect-error';

/**
 * Map an inquiry POST failure to a discriminated `InquiryErrorCode` + a
 * fallback message. Lives in its own (non-`'use server'`) module so it can be
 * exported and unit-tested - a `'use server'` module may only export async
 * functions.
 *
 * Reads the backend envelope via the shared `extractConnectError`: the two 403
 * app codes win; otherwise the HTTP status decides.
 */

/** App-level codes the backend attaches to the inquiry 403s. */
const APP_CODES: readonly string[] = [
  'CONNECT_SELF_INQUIRY_NOT_ALLOWED',
  'CONNECT_SELLER_LEAD_CAP_REACHED',
];

export function mapInquiryError(e: unknown): { code: InquiryErrorCode; error: string } {
  const { code, status, message } = extractConnectError(e);
  if (code && APP_CODES.includes(code)) {
    return { code: code as InquiryErrorCode, error: message };
  }
  if (status === 404) return { code: 'LISTING_NOT_FOUND', error: message };
  if (status === 429) return { code: 'RATE_LIMITED', error: message };
  return { code: 'UNKNOWN', error: message };
}
