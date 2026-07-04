import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Admin-side "assign configured default ERP plan" server actions — the row
 * action (single user) and the header action (bulk backfill). Both POST to the
 * admin endpoints and unwrap the BE result. The users page's row handler calls
 * adminAssignDefaultPlan(u._id) for a no-plan user and shows the assigned/skip
 * message; the header handler calls adminAssignDefaultPlanToMissing(). These
 * tests pin the URL + payload + return shape so the FE/BE contract can't drift.
 */

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ post: postMock })),
  unwrapServer: (r: unknown) => r,
}));

import {
  adminAssignDefaultPlan,
  adminAssignDefaultPlanToMissing,
  adminCustomAssignPlan,
} from './admin.actions';

describe('adminAssignDefaultPlan (single-user row action)', () => {
  beforeEach(() => postMock.mockReset());

  it('POSTs to the per-user assign-default-plan endpoint and returns the assigned result', async () => {
    postMock.mockResolvedValueOnce({ assigned: true, planName: 'Free Forever' });

    const res = await adminAssignDefaultPlan('user-123');

    expect(postMock).toHaveBeenCalledWith('admin/users/user-123/assign-default-plan', {});
    expect(res).toEqual({ assigned: true, planName: 'Free Forever' });
  });

  it('forwards an optional note and surfaces the already-has-plan skip result', async () => {
    postMock.mockResolvedValueOnce({ assigned: false, reason: 'already-has-plan' });

    const res = await adminAssignDefaultPlan('user-9', { note: 'backfill' });

    expect(postMock).toHaveBeenCalledWith('admin/users/user-9/assign-default-plan', {
      note: 'backfill',
    });
    expect(res.assigned).toBe(false);
    expect(res.reason).toBe('already-has-plan');
  });
});

describe('adminAssignDefaultPlanToMissing (bulk backfill header action)', () => {
  beforeEach(() => postMock.mockReset());

  it('POSTs to the bulk endpoint and returns assigned/skipped/failed/total counts', async () => {
    postMock.mockResolvedValueOnce({ assigned: 3, skipped: 1, failed: 1, total: 5 });

    const res = await adminAssignDefaultPlanToMissing();

    expect(postMock).toHaveBeenCalledWith('admin/subscriptions/assign-default-missing', {});
    expect(res).toEqual({ assigned: 3, skipped: 1, failed: 1, total: 5 });
  });
});

describe('adminCustomAssignPlan', () => {
  beforeEach(() => postMock.mockReset());

  it('rethrows the backend validation message instead of a generic server-action error', async () => {
    postMock.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: { message: 'End date must be in the future' } },
      },
    });

    await expect(
      adminCustomAssignPlan({
        userId: 'user-123',
        entitlements: {
          maxWorkspaces: 1,
          maxMembersPerWorkspace: 5,
          maxTotalMembers: 5,
          modules: [],
          features: {
            export: false,
            apiAccess: false,
            advancedRbac: false,
            customRoles: false,
            shifts: false,
            bills: false,
          },
          moduleAccess: [],
        },
        startDate: '2026-07-04T00:00:00.000Z',
        endDate: '2026-07-03T00:00:00.000Z',
        billingCycle: 'monthly',
      }),
    ).rejects.toThrow('End date must be in the future');
  });
});
