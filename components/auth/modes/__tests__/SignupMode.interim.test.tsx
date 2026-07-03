/**
 * SignupMode -- interim mobile-signup (SMS OTP off) test.
 *
 * Guards the go-live interim path (NEXT_PUBLIC_SMS_OTP_ENABLED=false): a new
 * mobile signup must create the account immediately via /auth/register
 * (name+password, NO OTP) and hand the AuthResult up through
 * onMobileSignupNoOtp - NOT fire send-otp. Phone is left unverified server-side
 * (force-verified later by MobileVerificationGate). See SignupMode.handleSubmit
 * + docs/deployment/SMS-OTP-GOLIVE.md.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { AuthResult } from '@/types';

vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    t.rich = (key: string, values?: Record<string, (chunks?: unknown) => unknown>) => {
      const parts: unknown[] = [`${namespace}.${key}`];
      if (values) for (const fn of Object.values(values)) parts.push(fn('chunk'));
      return parts;
    };
    return t;
  },
}));

// Referral field off -> simpler form.
vi.mock('@/features/connect/referrals/referral-gate', () => ({ REFERRAL_ENABLED: false }));

// Flip the master switch OFF (interim) while keeping every other real env field.
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env, smsOtpEnabled: false } };
});

const AUTH_RESULT = {
  user: { _id: 'u1', name: 'Test Owner' },
  accessToken: 'a',
  refreshToken: 'r',
} as unknown as AuthResult;

const register = vi.fn(async () => ({ ok: true as const, data: AUTH_RESULT }));
const sendOtp = vi.fn(async () => ({
  ok: true as const,
  data: { resendCooldownSec: 30, mockMode: false },
}));
vi.mock('@/lib/actions', () => ({
  register: (...args: unknown[]) => register(...(args as [])),
  sendOtp: (...args: unknown[]) => sendOtp(...(args as [])),
  sendEmailRegistrationOtp: vi.fn(async () => ({
    ok: true as const,
    data: { resendCooldownSec: 30 },
  })),
}));

vi.mock('@/lib/format/auth-error-codes', () => ({
  useAuthErrorMessage: () => (_code: string | undefined, msg: string | undefined) => msg ?? '',
}));

import { SignupMode } from '../SignupMode';

const fillAccountFields = () => {
  fireEvent.change(screen.getByPlaceholderText('auth.signup.name.placeholder'), {
    target: { value: 'Test Owner' },
  });
  fireEvent.change(screen.getByPlaceholderText('auth.signup.password.placeholder'), {
    target: { value: 'sup3rsecret' },
  });
  fireEvent.change(screen.getByPlaceholderText('auth.signup.confirm.placeholder'), {
    target: { value: 'sup3rsecret' },
  });
  fireEvent.click(screen.getByRole('checkbox'));
};

describe('SignupMode interim mobile signup (SMS OTP off)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers with name+password and NO OTP, then hands up the AuthResult', async () => {
    const onMobileSignupNoOtp = vi.fn();
    render(
      <SignupMode
        setMode={vi.fn()}
        identifier="9999999999"
        setIdentifier={vi.fn()}
        intent="connect"
        mobile="919999999999"
        onProceedToOtp={vi.fn()}
        onMobileSignupNoOtp={onMobileSignupNoOtp}
      />,
    );

    fillAccountFields();
    // Interim mobile signup swaps the submit label to the neutral variant.
    fireEvent.click(screen.getByRole('button', { name: 'auth.signup.submitInterim' }));

    await waitFor(() => expect(onMobileSignupNoOtp).toHaveBeenCalledTimes(1));

    // Account was created via register (no OTP send).
    expect(register).toHaveBeenCalledTimes(1);
    expect(sendOtp).not.toHaveBeenCalled();
    const payload = (register.mock.calls[0] as unknown[])[0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      name: 'Test Owner',
      mobile: '919999999999',
      password: 'sup3rsecret',
      acceptedPolicy: 'connect',
    });

    // AuthResult + product forwarded for post-signup routing.
    expect(onMobileSignupNoOtp).toHaveBeenCalledWith(AUTH_RESULT, 'connect');
  });
});
