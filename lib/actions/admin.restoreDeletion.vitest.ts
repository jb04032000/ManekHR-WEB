import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Admin-mediated deletion recovery action (ACCOUNT-DELETION-AND-DPDP-PLAN.md §6).
 * POSTs to /admin/users/:id/restore-deletion to clear the pending markers and
 * reactivate the account within the 30-day window. Surfaces the BE `code`
 * (NO_PENDING_DELETION / DELETION_WINDOW_EXPIRED) so the support UI can explain
 * why a restore is unavailable. Consumed by app/admin/pending-deletions.
 */

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ post: postMock })),
  unwrapServer: (r: unknown) => r,
}));

import { restoreUserDeletion } from './admin.actions';

describe('restoreUserDeletion', () => {
  beforeEach(() => postMock.mockReset());

  it('POSTs to the restore-deletion endpoint with the reason and returns the restored scopes', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      restored: ['account'],
      memberWorkspacesNeedReinvite: true,
    });

    const res = await restoreUserDeletion('user-1', 'verified by phone');

    expect(postMock).toHaveBeenCalledWith('admin/users/user-1/restore-deletion', {
      reason: 'verified by phone',
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.restored).toEqual(['account']);
      expect(res.memberWorkspacesNeedReinvite).toBe(true);
    }
  });

  it('surfaces the window-expired code so support can explain the failure', async () => {
    postMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: { code: 'DELETION_WINDOW_EXPIRED', message: 'The 30-day window has passed.' },
      },
    });

    const res = await restoreUserDeletion('user-2');

    expect(postMock).toHaveBeenCalledWith('admin/users/user-2/restore-deletion', {});
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('DELETION_WINDOW_EXPIRED');
      expect(res.error).toBe('The 30-day window has passed.');
    }
  });
});
