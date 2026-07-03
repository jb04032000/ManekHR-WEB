import { describe, it, expect } from 'vitest';
import { mapInquiryError } from './inquiry-error';

/**
 * M1.6.2 - `mapInquiryError` turns an HTTP failure from
 * `POST /connect/marketplace/listings/:id/inquiries` into a discriminated
 * `InquiryErrorCode` the modal branches on, plus a fallback message.
 *
 * The backend `HttpExceptionFilter` promotes the app-level code to the response
 * top level (`data.code`) and keeps the human message at `data.error.message`.
 * The two 403 app codes win; otherwise the HTTP status decides (404 -> gone,
 * 429 -> rate-limited, anything else -> UNKNOWN).
 */

/** Build a minimal axios-shaped error (`isAxiosError === true` is all axios checks). */
function axiosError(status: number, data: unknown, message = 'Request failed') {
  return { isAxiosError: true, response: { status, data }, message };
}

describe('mapInquiryError', () => {
  it('maps the self-inquiry app code from the response top level', () => {
    const out = mapInquiryError(
      axiosError(403, {
        success: false,
        error: { code: 403, message: 'You cannot send an inquiry to your own listing.' },
        code: 'CONNECT_SELF_INQUIRY_NOT_ALLOWED',
      }),
    );
    expect(out.code).toBe('CONNECT_SELF_INQUIRY_NOT_ALLOWED');
    expect(out.error).toBe('You cannot send an inquiry to your own listing.');
  });

  it('maps the seller lead-cap app code', () => {
    const out = mapInquiryError(
      axiosError(403, {
        success: false,
        error: { code: 403, message: 'This seller has reached their inquiry limit for the month.' },
        code: 'CONNECT_SELLER_LEAD_CAP_REACHED',
      }),
    );
    expect(out.code).toBe('CONNECT_SELLER_LEAD_CAP_REACHED');
  });

  it('maps a 404 to LISTING_NOT_FOUND', () => {
    const out = mapInquiryError(
      axiosError(404, { success: false, error: { code: 404, message: 'Listing not found' } }),
    );
    expect(out.code).toBe('LISTING_NOT_FOUND');
  });

  it('maps a 429 to RATE_LIMITED', () => {
    const out = mapInquiryError(
      axiosError(429, { success: false, error: { code: 429, message: 'Too many requests' } }),
    );
    expect(out.code).toBe('RATE_LIMITED');
  });

  it('maps an unrecognized server error to UNKNOWN with the backend message', () => {
    const out = mapInquiryError(
      axiosError(500, { success: false, error: { code: 500, message: 'boom' } }),
    );
    expect(out.code).toBe('UNKNOWN');
    expect(out.error).toBe('boom');
  });

  it('maps a non-axios error to UNKNOWN with its message', () => {
    const out = mapInquiryError(new Error('network down'));
    expect(out.code).toBe('UNKNOWN');
    expect(out.error).toBe('network down');
  });
});
