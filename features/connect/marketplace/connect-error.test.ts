import { describe, it, expect } from 'vitest';
import { extractConnectError } from './connect-error';

/**
 * M1.6.3 - shared Connect error-envelope reader.
 *
 * The backend `HttpExceptionFilter` shapes every error as
 * `{ success: false, error: { code: <status>, message }, ...extra }` and
 * promotes any app-level `code` (and other extras like `limit`) to the response
 * top level. `extractConnectError` reads that envelope once so both the inquiry
 * mapper and the create-listing mapper branch on the same `{ code, status,
 * message, data }`.
 */
function axiosError(status: number, data: unknown, message = 'Request failed') {
  return { isAxiosError: true, response: { status, data }, message };
}

describe('extractConnectError', () => {
  it('reads the top-level app code, status, nested message, and raw data', () => {
    const info = extractConnectError(
      axiosError(403, {
        success: false,
        error: { code: 403, message: 'Listing limit reached (25). Upgrade to add more listings.' },
        code: 'CONNECT_LISTING_LIMIT_REACHED',
        limit: 25,
      }),
    );
    expect(info.code).toBe('CONNECT_LISTING_LIMIT_REACHED');
    expect(info.status).toBe(403);
    expect(info.message).toBe('Listing limit reached (25). Upgrade to add more listings.');
    expect(info.data?.limit).toBe(25);
  });

  it('falls back to the flat message, then the axios message', () => {
    expect(extractConnectError(axiosError(500, { message: 'flat' })).message).toBe('flat');
    expect(extractConnectError(axiosError(500, {})).message).toBe('Request failed');
  });

  it('returns a null code when the body carries no app code', () => {
    const info = extractConnectError(
      axiosError(404, { success: false, error: { code: 404, message: 'Listing not found' } }),
    );
    expect(info.code).toBeNull();
    expect(info.status).toBe(404);
    expect(info.message).toBe('Listing not found');
  });

  it('returns nulls and the error message for a non-axios error', () => {
    const info = extractConnectError(new Error('offline'));
    expect(info.code).toBeNull();
    expect(info.status).toBeNull();
    expect(info.message).toBe('offline');
    expect(info.data).toBeNull();
  });
});
