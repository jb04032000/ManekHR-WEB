import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntdApp } from 'antd';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

/**
 * Shared DangerDeleteModal - the one confirm dialog reused by all three deletion
 * scopes (Connect / ERP / whole account). It gates the destructive action behind
 * re-auth (password / Google / OTP-only) + a one-time step-up code + type-to-confirm,
 * then calls the scope's schedule action. These tests pin the gating + the exact
 * payload sent + the coded-error surface. Cross-link:
 * lib/actions/account-deletion.actions.ts.
 */

// ── Mocks ────────────────────────────────────────────────────────────────────
const actions = vi.hoisted(() => ({
  sendDeletionStepupOtp: vi.fn(),
  verifyDeletionStepupOtp: vi.fn(),
  scheduleConnectDeletion: vi.fn(),
  scheduleErpDeletion: vi.fn(),
  scheduleAccountDeletion: vi.fn(),
}));
vi.mock('@/lib/actions/account-deletion.actions', () => actions);

const googleLogin = vi.hoisted(() => vi.fn());
vi.mock('@react-oauth/google', () => ({
  useGoogleLogin: () => googleLogin,
}));

// Mock the segmented OTP entry to a single input so tests can fill it in one step.
vi.mock('@/components/auth/OtpInput', () => ({
  OtpInput: ({
    value,
    onChange,
    onComplete,
  }: {
    value: string;
    onChange: (v: string) => void;
    onComplete?: (v: string) => void;
  }) => (
    <input
      aria-label="one-time-code"
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        if (e.target.value.length === 6) onComplete?.(e.target.value);
      }}
    />
  ),
}));

import { useAuthStore } from '@/lib/store';
import { DangerDeleteModal } from './DangerDeleteModal';

/** Set just the fields the modal reads on the real zustand store. */
function setUser(user: { hasPassword?: boolean; googleId?: string } | null) {
  useAuthStore.setState({ user: user as never });
}

const messages = {
  accountDeletion: {
    modal: {
      identityHeading: 'Confirm it is you',
      passwordLabel: 'Your password',
      passwordPlaceholder: 'Enter your password',
      methodPassword: 'Password',
      methodGoogle: 'Google',
      googleButton: 'Re-verify with Google',
      sendCode: 'Send code',
      resendCode: 'Resend code',
      codeLabel: 'One-time code',
      codeSent: 'We sent a 6-digit code to your mobile.',
      codeVerified: 'Code verified',
      confirmHeading: 'Type DELETE to confirm',
      typeToConfirmHint: 'Type {word} below',
      typeToConfirmPlaceholder: 'DELETE',
      recoverNote: 'Recover within 30 days by contacting us, then it is permanent.',
      cancel: 'Cancel',
      submit: 'Delete permanently',
      errorTitle: 'Could not schedule deletion',
    },
  },
};

function renderModal(overrides?: Partial<React.ComponentProps<typeof DangerDeleteModal>>) {
  const onScheduled = vi.fn();
  const onClose = vi.fn();
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AntdApp>
        <DangerDeleteModal
          open
          scope="connect"
          onClose={onClose}
          onScheduled={onScheduled}
          {...overrides}
        />
      </AntdApp>
    </NextIntlClientProvider>,
  );
  return { onScheduled, onClose };
}

const submitBtn = () => screen.getByRole('button', { name: 'Delete permanently' });

describe('DangerDeleteModal', () => {
  beforeEach(() => {
    setUser({ hasPassword: true, googleId: undefined });
    Object.values(actions).forEach((fn) => fn.mockReset());
    googleLogin.mockReset();
    actions.sendDeletionStepupOtp.mockResolvedValue({ ok: true, data: { sent: true } });
    actions.verifyDeletionStepupOtp.mockResolvedValue({
      ok: true,
      data: { proofToken: 'proof-token' },
    });
    actions.scheduleConnectDeletion.mockResolvedValue({
      ok: true,
      state: 'pending',
      purgeAfter: '2026-07-25T00:00:00.000Z',
    });
  });
  afterEach(cleanup);

  it('keeps the destructive button disabled until identity is verified and DELETE is typed', () => {
    renderModal();
    expect(submitBtn()).toBeDisabled();
  });

  it('runs the full happy path and schedules with reauth + proof + confirm', async () => {
    const { onScheduled } = renderModal();

    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(actions.sendDeletionStepupOtp).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText('one-time-code'), { target: { value: '123456' } });
    await waitFor(() => expect(actions.verifyDeletionStepupOtp).toHaveBeenCalledWith('123456'));

    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await waitFor(() => expect(submitBtn()).toBeEnabled());

    fireEvent.click(submitBtn());

    await waitFor(() =>
      expect(actions.scheduleConnectDeletion).toHaveBeenCalledWith({
        reauth: { kind: 'password', password: 'pw' },
        otpProof: 'proof-token',
        confirm: 'DELETE',
      }),
    );
    expect(onScheduled).toHaveBeenCalledWith({
      scope: 'connect',
      purgeAfter: '2026-07-25T00:00:00.000Z',
    });
  });

  it('omits reauth entirely for a password-less, Google-less (OTP-only) account', async () => {
    setUser({ hasPassword: false, googleId: undefined });
    actions.scheduleAccountDeletion.mockResolvedValue({
      ok: true,
      state: 'pending',
      purgeAfter: 'x',
    });
    renderModal({ scope: 'account' });

    expect(screen.queryByLabelText('Your password')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(actions.sendDeletionStepupOtp).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('one-time-code'), { target: { value: '123456' } });
    await waitFor(() => expect(actions.verifyDeletionStepupOtp).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await waitFor(() => expect(submitBtn()).toBeEnabled());
    fireEvent.click(submitBtn());

    await waitFor(() =>
      expect(actions.scheduleAccountDeletion).toHaveBeenCalledWith({
        otpProof: 'proof-token',
        confirm: 'DELETE',
      }),
    );
  });

  it('surfaces a coded failure (sole-admin block) and does not call onScheduled', async () => {
    actions.scheduleConnectDeletion.mockResolvedValue({
      ok: false,
      code: 'ERASURE_LAST_ADMIN_BLOCKED',
      error: 'You are the last admin.',
    });
    const { onScheduled } = renderModal();

    fireEvent.change(screen.getByLabelText('Your password'), { target: { value: 'pw' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(actions.sendDeletionStepupOtp).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('one-time-code'), { target: { value: '123456' } });
    await waitFor(() => expect(actions.verifyDeletionStepupOtp).toHaveBeenCalled());
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } });
    await waitFor(() => expect(submitBtn()).toBeEnabled());
    fireEvent.click(submitBtn());

    await waitFor(() => expect(screen.getByText('You are the last admin.')).toBeInTheDocument());
    expect(onScheduled).not.toHaveBeenCalled();
  });
});
