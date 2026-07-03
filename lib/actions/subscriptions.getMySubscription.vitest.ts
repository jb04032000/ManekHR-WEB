import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * getMySubscription is a best-effort bootstrap read (DashboardLayout fires it
 * for every shell, account mode included). It MUST fail soft on the benign
 * "this workspaceId isn't valid for you right now" outcomes so the Server Action
 * never 500s (a thrown action surfaces as `POST /<route> 500` in the console and
 * aborts the RSC). Confirmed root cause: when the persisted currentWorkspaceId
 * points at a workspace the caller is NOT a member of (stale selection carried
 * over from another account, or a member removed from the workspace), the
 * backend returns 403 "You are not a member of this workspace" -> the old code
 * rethrew it -> 500. 423 = App-Locked (re-PIN). 404 = workspace gone. All map to
 * null (callers read my?.subscription / my?.entitlements). Genuine 5xx still throw.
 */

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ get: getMock })),
  unwrapServer: (r: unknown) => r,
}));

import { getMySubscription } from './subscriptions.actions';

function axiosErr(status: number) {
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    isAxiosError: true,
    response: { status },
  });
}

// async-throw (not mockRejectedValue) so the rejection only exists when the
// mock is actually called + awaited - avoids eager unhandled-rejection noise.
const rejectWith = (status: number) =>
  getMock.mockImplementationOnce(async () => {
    throw axiosErr(status);
  });

describe('getMySubscription - fail-soft on benign workspace-scope errors', () => {
  beforeEach(() => getMock.mockReset());

  it('returns null on 403 (caller not a member of the active workspace)', async () => {
    rejectWith(403);
    await expect(getMySubscription('tok', 'ws-not-mine')).resolves.toBeNull();
  });

  it('returns null on 423 (App-Locked) and 404 (workspace gone)', async () => {
    rejectWith(423);
    await expect(getMySubscription('tok', 'ws')).resolves.toBeNull();
    rejectWith(404);
    await expect(getMySubscription('tok', 'ws')).resolves.toBeNull();
  });

  it('still propagates a genuine 500 (real backend fault)', async () => {
    rejectWith(500);
    await expect(getMySubscription('tok', 'ws')).rejects.toThrow(/500/);
  });
});
