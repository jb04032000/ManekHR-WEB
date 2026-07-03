import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Complete DPDP erase action (ACCOUNT-DELETION plan §8). POSTs to
 * /admin/users/:id/erase to run the full erase (Connect purge + identity scrub +
 * vendor file delete; statutory retained). Guards the safety contract that
 * `confirm:true` is ALWAYS sent, so the irreversible erase can never fire without
 * it. Consumed by app/admin/users (the "Erase data" action on hidden users).
 */

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ post: postMock })),
  unwrapServer: (r: unknown) => r,
}));

import { eraseAdminUser } from './admin.actions';

describe('eraseAdminUser (complete DPDP erase)', () => {
  beforeEach(() => postMock.mockReset());

  it('POSTs to the erase endpoint with confirm:true + the reason', async () => {
    postMock.mockResolvedValueOnce(undefined);

    await eraseAdminUser('user-1', 'DPDP ticket 9');

    expect(postMock).toHaveBeenCalledWith('admin/users/user-1/erase', {
      confirm: true,
      reason: 'DPDP ticket 9',
    });
  });

  it('always sends confirm:true even with no reason (cannot fire by accident)', async () => {
    postMock.mockResolvedValueOnce(undefined);

    await eraseAdminUser('user-2');

    expect(postMock).toHaveBeenCalledWith('admin/users/user-2/erase', { confirm: true });
  });
});
