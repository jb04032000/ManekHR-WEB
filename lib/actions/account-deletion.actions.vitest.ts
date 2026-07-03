import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Self-serve account-deletion server actions (DPDP, ACCOUNT-DELETION-AND-DPDP-PLAN.md
 * Phase 5). These thin mappers POST/GET the `me/deletion/*` backend routes built in
 * Phases 1-4 and unwrap the result. The tests pin URL + payload + return shape so the
 * FE/BE contract can't drift, and assert the coded-error surface the confirm modal
 * relies on (sole-admin block, invalid step-up proof). Cross-link:
 * components/account-deletion/DangerDeleteModal.tsx consumes these.
 */

const { getMock, postMock } = vi.hoisted(() => ({ getMock: vi.fn(), postMock: vi.fn() }));
vi.mock('@/lib/api/server-client', () => ({
  serverHttp: vi.fn(async () => ({ get: getMock, post: postMock })),
  unwrapServer: (r: unknown) => r,
}));

import {
  sendDeletionStepupOtp,
  verifyDeletionStepupOtp,
  getErpDeletionPreview,
  scheduleConnectDeletion,
  scheduleErpDeletion,
  scheduleAccountDeletion,
} from './account-deletion.actions';

describe('account-deletion actions: step-up OTP', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it('sends the step-up OTP via POST me/deletion/stepup', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      sent: true,
      expiresAt: '2026-06-25T10:05:00.000Z',
      resendCooldownSec: 30,
      mockMode: false,
    });

    const res = await sendDeletionStepupOtp();

    expect(postMock).toHaveBeenCalledWith('me/deletion/stepup', {});
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.sent).toBe(true);
      expect(res.data.resendCooldownSec).toBe(30);
    }
  });

  it('verifies the step-up OTP and returns the single-use proof token', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      proofToken: 'proof-abc',
      expiresAt: '2026-06-25T10:10:00.000Z',
    });

    const res = await verifyDeletionStepupOtp('123456');

    expect(postMock).toHaveBeenCalledWith('me/deletion/stepup/verify', { otp: '123456' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.proofToken).toBe('proof-abc');
  });

  it('maps an invalid OTP to a friendly failure message', async () => {
    postMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: { code: 'STEPUP_PROOF_INVALID', message: 'That code is wrong or expired.' },
      },
    });

    const res = await verifyDeletionStepupOtp('000000');

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toBe('That code is wrong or expired.');
  });
});

describe('account-deletion actions: ERP preview', () => {
  beforeEach(() => getMock.mockReset());

  it('reads the ERP deletion impact via GET me/deletion/erp/preview', async () => {
    const impact = {
      ownedWorkspaces: [{ workspaceId: 'w1', name: 'Anant Group', memberCount: 4 }],
      memberWorkspaces: [{ workspaceId: 'w2', name: 'Partner Co' }],
      teamLosesAccess: true,
      memberWorkspacesNeedReinvite: true,
      openEmployerLoans: 2,
      unpaidAdvances: 1,
    };
    getMock.mockResolvedValueOnce(impact);

    const res = await getErpDeletionPreview();

    expect(getMock).toHaveBeenCalledWith('me/deletion/erp/preview');
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.teamLosesAccess).toBe(true);
      expect(res.data.openEmployerLoans).toBe(2);
      expect(res.data.ownedWorkspaces[0].memberCount).toBe(4);
    }
  });
});

describe('account-deletion actions: schedule', () => {
  beforeEach(() => postMock.mockReset());

  it('schedules Connect deletion with reauth + proof + confirm', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      state: 'pending',
      purgeAfter: '2026-07-25T00:00:00.000Z',
    });

    const res = await scheduleConnectDeletion({
      reauth: { kind: 'password', password: 'pw' },
      otpProof: 'proof',
      confirm: 'DELETE',
    });

    expect(postMock).toHaveBeenCalledWith('me/deletion/connect', {
      otpProof: 'proof',
      confirm: 'DELETE',
      reauth: { kind: 'password', password: 'pw' },
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.purgeAfter).toBe('2026-07-25T00:00:00.000Z');
  });

  it('omits the reauth field entirely for OTP-only (password-less) accounts', async () => {
    postMock.mockResolvedValueOnce({ ok: true, state: 'pending', purgeAfter: 'x' });

    await scheduleAccountDeletion({ otpProof: 'proof', confirm: 'DELETE' });

    expect(postMock).toHaveBeenCalledWith('me/deletion/account', {
      otpProof: 'proof',
      confirm: 'DELETE',
    });
  });

  it('schedules ERP deletion and echoes the impact back', async () => {
    postMock.mockResolvedValueOnce({
      ok: true,
      state: 'pending',
      purgeAfter: 'x',
      impact: {
        ownedWorkspaces: [],
        memberWorkspaces: [],
        teamLosesAccess: false,
        memberWorkspacesNeedReinvite: false,
        openEmployerLoans: 0,
        unpaidAdvances: 0,
      },
    });

    const res = await scheduleErpDeletion({ otpProof: 'p', confirm: 'DELETE' });

    expect(postMock).toHaveBeenCalledWith('me/deletion/erp', { otpProof: 'p', confirm: 'DELETE' });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.impact?.teamLosesAccess).toBe(false);
  });

  it('surfaces the sole-admin block code so the confirm modal can special-case it', async () => {
    postMock.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        data: { code: 'ERASURE_LAST_ADMIN_BLOCKED', message: 'You are the last admin.' },
      },
    });

    const res = await scheduleAccountDeletion({
      reauth: { kind: 'password', password: 'pw' },
      otpProof: 'p',
      confirm: 'DELETE',
    });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe('ERASURE_LAST_ADMIN_BLOCKED');
      expect(res.error).toBe('You are the last admin.');
    }
  });
});
