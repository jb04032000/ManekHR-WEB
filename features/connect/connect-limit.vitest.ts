import { describe, it, expect } from 'vitest';
import { extractConnectLimit, CONNECT_LIMIT_REACHED } from './connect-limit';

/**
 * Unit spec for the shared CONNECT_LIMIT_REACHED 403 reader. This is the single
 * detection every Connect create action funnels through, so the four flows share
 * one contract with the backend ConnectLimitReachedException.
 */

/** Build an axios-like error carrying the backend error envelope. */
function axiosError(status: number, body: Record<string, unknown>) {
  return { isAxiosError: true, message: 'Request failed', response: { status, data: body } };
}

describe('extractConnectLimit', () => {
  it('parses the typed 403 into { kind, limit, used }', () => {
    const e = axiosError(403, {
      code: CONNECT_LIMIT_REACHED,
      kind: 'listing',
      limit: 25,
      used: 25,
    });
    expect(extractConnectLimit(e)).toEqual({ kind: 'listing', limit: 25, used: 25 });
  });

  it('returns null for a non-limit error (so normal handling continues)', () => {
    const e = axiosError(400, { code: 'SOME_OTHER_ERROR', message: 'nope' });
    expect(extractConnectLimit(e)).toBeNull();
  });

  it('returns null for an unknown kind', () => {
    const e = axiosError(403, { code: CONNECT_LIMIT_REACHED, kind: 'banana', limit: 1, used: 1 });
    expect(extractConnectLimit(e)).toBeNull();
  });

  it('defaults used to limit when the server omits used', () => {
    const e = axiosError(403, { code: CONNECT_LIMIT_REACHED, kind: 'job', limit: 10 });
    expect(extractConnectLimit(e)).toEqual({ kind: 'job', limit: 10, used: 10 });
  });

  it('returns null for a non-axios error', () => {
    expect(extractConnectLimit(new Error('network down'))).toBeNull();
  });

  it('recognizes each of the four count kinds', () => {
    for (const kind of ['listing', 'storefront', 'company_page', 'job'] as const) {
      const e = axiosError(403, { code: CONNECT_LIMIT_REACHED, kind, limit: 1, used: 1 });
      expect(extractConnectLimit(e)?.kind).toBe(kind);
    }
  });
});
