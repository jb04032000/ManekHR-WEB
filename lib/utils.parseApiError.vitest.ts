import { describe, it, expect } from 'vitest';
import { parseApiError } from '@/lib/utils';

/**
 * parseApiError must surface the backend's real message. The API envelope
 * (crewroster-backend HttpExceptionFilter) nests it at `data.error.message`,
 * NOT top-level `data.message`. Before this fix, parseApiError only read the
 * top-level field, so every coded backend error (e.g. the advance-salary
 * ADVANCE_REQUEST_DAY_CLOSED / ADVANCE_DUPLICATE payloads) fell through to the
 * generic "Request failed with status code N" -> friendly-status sentence,
 * masking the actual reason. This mirrors the server-action `extractErrorMessage`
 * which already reads the nested field.
 */
describe('parseApiError - backend envelope { success:false, error:{ code, message } }', () => {
  it('surfaces the nested error.message (real backend envelope)', () => {
    const err = {
      response: {
        status: 400,
        data: {
          success: false,
          error: {
            code: 400,
            message: 'Advance requests can only be submitted on day 15 of the month.',
          },
        },
      },
    };
    expect(parseApiError(err)).toBe(
      'Advance requests can only be submitted on day 15 of the month.',
    );
  });

  it('surfaces a string `error` field when present', () => {
    const err = {
      response: { status: 403, data: { success: false, error: 'You do not have access.' } },
    };
    expect(parseApiError(err)).toBe('You do not have access.');
  });

  it('still prefers a top-level message when present (back-compat)', () => {
    const err = {
      response: { status: 400, data: { message: 'Top-level wins', error: { message: 'nested' } } },
    };
    expect(parseApiError(err)).toBe('Top-level wins');
  });
});
