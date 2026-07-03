import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Locks the go-live invariant: the fixed dev OTP 123456 may seed the OTP box
 * ONLY in a non-production build. A future refactor that drops the `env.isProd`
 * gate must fail here. `vi.doMock` swaps the env module per case; `resetModules`
 * forces otp-mock.ts to recompute OTP_MOCK_UI_ALLOWED from the mocked env.
 */
describe('otpMockSeed / OTP_MOCK_UI_ALLOWED', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('honors mock in a non-production build (dev / e2e)', async () => {
    vi.doMock('@/lib/env', () => ({ env: { isProd: false } }));
    const { otpMockSeed, OTP_MOCK_UI_ALLOWED } = await import('./otp-mock');
    expect(OTP_MOCK_UI_ALLOWED).toBe(true);
    expect(otpMockSeed(true)).toBe('123456');
    expect(otpMockSeed(false)).toBe('');
    expect(otpMockSeed(undefined)).toBe('');
  });

  it('NEVER seeds the dev code in a production build, even when the backend says mock is on', async () => {
    vi.doMock('@/lib/env', () => ({ env: { isProd: true } }));
    const { otpMockSeed, OTP_MOCK_UI_ALLOWED } = await import('./otp-mock');
    expect(OTP_MOCK_UI_ALLOWED).toBe(false);
    expect(otpMockSeed(true)).toBe(''); // the lock: runtime mockMode is ignored in prod
    expect(otpMockSeed(false)).toBe('');
    expect(otpMockSeed(undefined)).toBe('');
  });
});
