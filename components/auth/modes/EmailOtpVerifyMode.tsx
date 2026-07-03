'use client';

import { useState } from 'react';
import { Button, Alert } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { Mail, Clipboard, ArrowRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { register as registerAction, sendEmailRegistrationOtp } from '@/lib/actions';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { OtpInput } from '@/components/auth/OtpInput';
import { ResendCountdown } from '@/components/auth/ResendCountdown';
import type { AuthSuccessHandler, BaseModeProps, SessionLimitData, SignupFormData } from './types';
import type { AuthResult } from '@/types';

interface EmailOtpVerifyModeProps extends BaseModeProps {
  /** Captured upstream by SignupMode (email path). */
  signupFormData: SignupFormData & { email: string };
  /** Set on mount and bumped on each successful resend so countdown resets. */
  resendCooldownSec: number;
  resetKey: number;
  setResendCtx: (next: { resendCooldownSec: number; resetKey: number }) => void;
  onAuthSuccess: AuthSuccessHandler['onAuthSuccess'];
  onSessionLimit?: (data: SessionLimitData) => void;
}

/**
 * Email channel parity with OtpVerifyMode. User enters the 6-digit code from
 * the registration email; submit fires POST /auth/register with the OTP +
 * captured signup payload. BE consumes the OTP from Redis (single-use),
 * creates the User, returns AuthResult. The orchestrator
 * routes to /dashboard via handleAuthSuccess.
 *
 * No "use password" escape - the user is mid-signup and has no account yet.
 * Edit-email link routes back to CheckMode.
 */
export function EmailOtpVerifyMode({
  setMode,
  setIdentifier,
  signupFormData,
  resendCooldownSec,
  resetKey,
  setResendCtx,
  onAuthSuccess,
  onSessionLimit,
}: EmailOtpVerifyModeProps) {
  const t = useTranslations('auth');
  // Localize BE error codes (and the FE-synthesised NETWORK_UNREACHABLE on a
  // backend-down) so the register/resend error never shows a raw axios string.
  const authErrMsg = useAuthErrorMessage();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasError, setHasError] = useState(false);

  const handleVerify = async (value: string) => {
    setError('');
    setHasError(false);
    setLoading(true);
    const res = await registerAction({
      name: signupFormData.name,
      email: signupFormData.email,
      password: signupFormData.password,
      emailOtp: value,
      // Wave 5 (2026-05-21) - atomic policy stamp at signup. BE writes the
      // matching *PolicyAcceptedAt field on the same user-creation save so
      // the post-signup policy gate sees the stamp on first navigation.
      acceptedPolicy: signupFormData.product,
      // Task 22 (2026-06-19) - referral program. Forward when present
      // (only non-empty when REFERRAL_ENABLED=true). BE no-ops when off.
      ...(signupFormData.referralCode ? { referralCode: signupFormData.referralCode } : {}),
    });
    if (!res.ok) {
      if (res.error === 'SESSION_LIMIT_REACHED' && res.sessionData && onSessionLimit) {
        onSessionLimit(res.sessionData as SessionLimitData);
        setLoading(false);
        return;
      }
      setError(authErrMsg(res.errorCode, res.error));
      setHasError(true);
      setLoading(false);
      return;
    }
    await onAuthSuccess(res.data as AuthResult);
  };

  /**
   * Read a 6-digit numeric string from the clipboard and fill the OTP cells.
   * Browsers may block `navigator.clipboard.readText()` without explicit user
   * gesture or HTTPS context - wrap in try/catch and silently no-op when the
   * read fails (the user can always type the code manually). Filters to
   * digits only and clips to 6 characters so a multi-line / noisy paste
   * still produces a sane code.
   */
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, '').slice(0, 6);
      if (!digits) return;
      setOtp(digits);
      if (digits.length === 6) {
        void handleVerify(digits);
      }
    } catch {
      // Permission denied / not in secure context - silent no-op.
    }
  };

  const handleResend = async () => {
    setError('');
    const res = await sendEmailRegistrationOtp(signupFormData.email);
    if (!res.ok) {
      setError(authErrMsg(res.errorCode, res.error));
      return;
    }
    setOtp('');
    setHasError(false);
    setResendCtx({
      resendCooldownSec: res.data.resendCooldownSec,
      resetKey: Date.now(),
    });
  };

  return (
    <>
      <button
        onClick={() => {
          setIdentifier('');
          setMode('check');
        }}
        className="mb-6 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('emailOtpVerify.back')}
      </button>

      {/* Email-sent status card. Replaces the previous flat "Code sent to
          email - Edit" line. Reference idiom: green-tinted icon badge with
          dot (delivery confirmation), small uppercase status label above the
          email address, Change affordance on the far right. Reads as
          "delivery succeeded" not "here is some info". */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-border-light bg-surface px-4 py-3">
        <span
          className="relative grid h-10 w-10 flex-shrink-0 place-items-center rounded-full"
          style={{ background: 'var(--cr-success-bg, var(--cr-primary-light))' }}
          aria-hidden
        >
          <Mail
            size={16}
            strokeWidth={2.25}
            style={{ color: 'var(--cr-success, var(--cr-primary))' }}
          />
          <span
            className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface"
            style={{ background: 'var(--cr-success, #16a34a)' }}
          />
        </span>
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <span
            className="text-[10px] font-semibold tracking-[0.14em] uppercase"
            style={{ color: 'var(--cr-success, var(--cr-primary))' }}
          >
            {t('emailOtpVerify.statusLabel')}
          </span>
          <span className="mt-0.5 truncate text-[13px] font-medium text-heading">
            {signupFormData.email}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setIdentifier('');
            setMode('check');
          }}
          aria-label={t('emailOtpVerify.editAria')}
          className="inline-flex flex-shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent p-1 text-[12px] font-medium text-primary hover:underline"
        >
          <EditOutlined /> {t('emailOtpVerify.changeLabel')}
        </button>
      </div>

      <h1 className="m-0 mb-2 font-display text-2xl leading-tight font-extrabold text-heading">
        {t('emailOtpVerify.title')}
      </h1>
      <p className="m-0 mb-5 pb-2 text-[13px] leading-relaxed text-muted">
        {t('emailOtpVerify.subtitle')}
      </p>

      {/* OTP cells render bare - no card wrapper. */}
      <div className="mb-3 flex flex-col gap-3">
        {error && (
          <Alert
            type="error"
            title={error}
            showIcon
            className="!mb-0 rounded-[10px]"
            closable={{ onClose: () => setError('') }}
          />
        )}
        <OtpInput
          value={otp}
          onChange={setOtp}
          onComplete={handleVerify}
          disabled={loading}
          hasError={hasError}
          autoFocus
          ariaLabel={t('verifyOtp.input.aria')}
        />
      </div>

      {/* Paste-from-clipboard quick action. Sits below the OTP cells, small
          + secondary, so the user can dump the code from their email reader
          without typing 6 digits by hand. Read fails silently when the
          browser blocks clipboard read. */}
      <button
        type="button"
        onClick={handlePaste}
        className="mb-6 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[12px] font-medium text-primary hover:underline"
      >
        <Clipboard size={13} aria-hidden /> {t('emailOtpVerify.paste')}
      </button>

      {/*
        Dynamic CTA. When the user has not filled all 6 digits the button
        narrates the remaining count ("Enter N more digits") - borrowed
        idiom from the reference design. Once the code is complete the
        button flips to the action label and becomes enabled. The icon
        switches to ArrowRight while waiting, removed when ready to
        verify (which feels like a more committed action).
      */}
      <Button
        type="primary"
        size="large"
        loading={loading}
        block
        disabled={otp.length !== 6}
        className="h-[48px] font-semibold"
        onClick={() => handleVerify(otp)}
      >
        {otp.length === 6 ? (
          t('emailOtpVerify.submit')
        ) : (
          <span className="inline-flex items-center gap-2">
            {t('emailOtpVerify.remaining', { count: 6 - otp.length })}
            <ArrowRight size={15} aria-hidden />
          </span>
        )}
      </Button>

      {/* Resend row grouped + centered so "Didn't get the code?" + the
          countdown read as one phrase, not the two unrelated ends of a
          justify-between sentence. */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[13px] text-muted">
        <span>{t('emailOtpVerify.resendPrompt')}</span>
        <ResendCountdown
          cooldownSec={resendCooldownSec}
          resetKey={resetKey}
          onResend={handleResend}
          disabled={loading}
        />
      </div>
    </>
  );
}
