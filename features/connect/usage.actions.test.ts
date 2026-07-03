import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Spec for the Connect usage action. The server HTTP boundary is mocked so the
 * action never touches next/headers cookies() (throws outside a Server
 * Component). Mirrors marketplace.actions.test.ts.
 */
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ get })),
  unwrapServer: <T>(res: unknown): T => (res as { data: { data: T } }).data.data,
}));

import { getConnectUsage } from './usage.actions';

describe('getConnectUsage', () => {
  beforeEach(() => vi.clearAllMocks());

  it('GETs /me/connect/usage and returns the rows', async () => {
    const rows = [
      { kind: 'listing', used: 3, limit: 25 },
      { kind: 'storefront', used: 1, limit: 1 },
      { kind: 'company_page', used: 0, limit: 1 },
      { kind: 'job', used: 4, limit: 10 },
      { kind: 'storage', used: 120.5, limit: 500 },
    ];
    get.mockResolvedValueOnce({ data: { data: rows } });

    const res = await getConnectUsage();

    expect(get).toHaveBeenCalledWith('/me/connect/usage');
    expect(res).toEqual({ ok: true, data: rows });
  });

  it('returns a not-ok result (never throws) on a network/API error', async () => {
    get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 500, data: { error: { message: 'boom' } } },
      message: 'Request failed',
    });

    const res = await getConnectUsage();

    expect(res.ok).toBe(false);
    if (!res.ok) expect(typeof res.error).toBe('string');
  });
});
