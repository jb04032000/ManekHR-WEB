/**
 * SignupMode -- referral-capture tests (RTL + vitest).
 *
 * Regression guard for the Task 22 referral bug (2026-06-19): opening
 * /auth?ref=CODE must PREFILL the visible referral field AND forward the code in
 * the signup payload even when the user never touches the field. The original
 * bug was a `<Form.Item name="referralCode">` that handed value ownership to the
 * AntD Form store (no initialValues), so the controlled `value={refCode}` was
 * ignored and the field rendered empty.
 *
 * Covers:
 *   1. The visible referral field initialises to `initialRefCode` (?ref= prefill).
 *   2. Email-path submit forwards `referralCode` in SignupFormData with the
 *      field UNTOUCHED (robustness - link-click alone attributes).
 *   3. Mobile-path submit forwards `referralCode` the same way.
 *
 * Mock strategy mirrors ReferralScreen.test.tsx: next-intl returns key paths
 * verbatim, lib/actions send-OTP calls resolve ok, the referral gate is on.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { SignupFormData } from '../types';

// next-intl: return the full key path so assertions/placeholders are stable
// regardless of the message catalog state. `t.rich` is supported because
// SignupMode uses it for the intent "Change" pill + policy label.
vi.mock('next-intl', () => ({
  useTranslations: (namespace: string) => {
    const t = (key: string) => `${namespace}.${key}`;
    // t.rich invokes each chunk-renderer so the rendered tree is non-empty;
    // we don't assert on its content, just that it doesn't throw.
    t.rich = (key: string, values?: Record<string, (chunks?: unknown) => unknown>) => {
      const parts: unknown[] = [`${namespace}.${key}`];
      if (values) {
        for (const fn of Object.values(values)) parts.push(fn('chunk'));
      }
      return parts;
    };
    return t;
  },
}));

// Referral program must be ON for the field to render + forward.
vi.mock('@/features/connect/referrals/referral-gate', () => ({
  REFERRAL_ENABLED: true,
}));

// Stub the send-OTP server actions so handleSubmit reaches the proceed callback.
const sendOtp = vi.fn(async () => ({
  ok: true as const,
  data: { resendCooldownSec: 30, mockMode: true },
}));
const sendEmailRegistrationOtp = vi.fn(async () => ({
  ok: true as const,
  data: { resendCooldownSec: 30 },
}));
vi.mock('@/lib/actions', () => ({
  sendOtp: (...args: unknown[]) => sendOtp(...(args as [])),
  sendEmailRegistrationOtp: (...args: unknown[]) => sendEmailRegistrationOtp(...(args as [])),
}));

// Error-code localizer -> identity passthrough.
vi.mock('@/lib/format/auth-error-codes', () => ({
  useAuthErrorMessage: () => (_code: string | undefined, msg: string | undefined) => msg ?? '',
}));

import { SignupMode } from '../SignupMode';

const fillAccountFields = () => {
  // Name + password + confirm + policy checkbox so the AntD form validates and
  // onFinish fires. Placeholders come back as full i18n key paths from the mock.
  fireEvent.change(screen.getByPlaceholderText('auth.signup.name.placeholder'), {
    target: { value: 'Test Owner' },
  });
  const pwd = screen.getByPlaceholderText('auth.signup.password.placeholder');
  fireEvent.change(pwd, { target: { value: 'sup3rsecret' } });
  fireEvent.change(screen.getByPlaceholderText('auth.signup.confirm.placeholder'), {
    target: { value: 'sup3rsecret' },
  });
  // Policy consent checkbox (the only checkbox on the form).
  fireEvent.click(screen.getByRole('checkbox'));
};

describe('SignupMode referral capture', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('prefills the visible referral field from initialRefCode (?ref=)', () => {
    render(
      <SignupMode
        setMode={vi.fn()}
        identifier="owner@example.com"
        setIdentifier={vi.fn()}
        intent="connect"
        email="owner@example.com"
        onProceedToEmailOtp={vi.fn()}
        initialRefCode="TESTXPFY"
      />,
    );
    const field = screen.getByPlaceholderText(
      'connect.referrals.signup.placeholder',
    ) as HTMLInputElement;
    expect(field.value).toBe('TESTXPFY');
  });

  it('forwards referralCode in the email payload with the field UNTOUCHED', async () => {
    const onProceedToEmailOtp = vi.fn();
    render(
      <SignupMode
        setMode={vi.fn()}
        identifier="owner@example.com"
        setIdentifier={vi.fn()}
        intent="connect"
        email="owner@example.com"
        onProceedToEmailOtp={onProceedToEmailOtp}
        initialRefCode="TESTXPFY"
      />,
    );

    fillAccountFields();
    fireEvent.click(screen.getByRole('button', { name: 'auth.signup.submit' }));

    await waitFor(() => expect(onProceedToEmailOtp).toHaveBeenCalledTimes(1));
    const payload = onProceedToEmailOtp.mock.calls[0][0] as SignupFormData;
    expect(payload.email).toBe('owner@example.com');
    expect(payload.referralCode).toBe('TESTXPFY');
  });

  it('forwards referralCode in the mobile payload with the field UNTOUCHED', async () => {
    const onProceedToOtp = vi.fn();
    render(
      <SignupMode
        setMode={vi.fn()}
        identifier="9999999999"
        setIdentifier={vi.fn()}
        intent="connect"
        mobile="919999999999"
        onProceedToOtp={onProceedToOtp}
        initialRefCode="TESTXPFY"
      />,
    );

    fillAccountFields();
    fireEvent.click(screen.getByRole('button', { name: 'auth.signup.submit' }));

    await waitFor(() => expect(onProceedToOtp).toHaveBeenCalledTimes(1));
    const payload = onProceedToOtp.mock.calls[0][0] as SignupFormData;
    expect(payload.mobile).toBe('919999999999');
    expect(payload.referralCode).toBe('TESTXPFY');
  });
});
