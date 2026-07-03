'use client';

import { useState } from 'react';
import { Button, Alert } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { resendOtp, verifyOtp } from '@/lib/actions';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { OtpInput } from '@/components/auth/OtpInput';
import { ResendCountdown } from '@/components/auth/ResendCountdown';
import { MockOtpBanner } from '@/components/auth/MockOtpBanner';
import { otpMockSeed } from '@/components/auth/otp-mock';
// MSG91 OTP Widget channel - verify/retry go through the widget SDK first
// when authOtpChannel === 'widget' (see use-msg91-widget.ts). No-op otherwise.
import { useMsg91Widget } from '@/lib/auth/use-msg91-widget';
import { env } from '@/lib/env';
import type { BaseModeProps, OtpContext, SessionLimitData, SignupFormData } from './types';
import type { AuthResult } from '@/types';

interface OtpVerifyModeProps extends BaseModeProps {
  ctx: OtpContext;
  setCtx: (next: OtpContext) => void;
  onAuthSuccess: (result: AuthResult) => Promise<void> | void;
  /** Called on SESSION_LIMIT_REACHED. Receives the already-verified
   *  credential (`otp` for the DLT channel, `accessToken` for the widget
   *  channel - exactly one is set) so the orchestrator can replay it via
   *  /auth/terminate-and-otp-login. */
  onSessionLimitWithOtp: (
    data: SessionLimitData,
    credential: { otp?: string; accessToken?: string },
  ) => void;
  /**
   * "Change number" target. Login fast-path skips OtpSendMode entirely so we
   * route back to `check`; register path may want to return to `otp_send` to
   * preserve the in-progress register context. Defaults to `check`.
   */
  changeNumberTarget?: 'check' | 'otp_send';
  /**
   * Web combined-signup form data - when present on a register-flow verify
   * call, name + password are added to the verifyOtp payload so the BE
   * creates the User (see SmsOtpService.verifyOtp register branch). Absent
   * for legacy OTP-only register and for login/forgot flows.
   */
  signupFormData?: SignupFormData | null;
}

function maskMobile(mobileFull: string): string {
  const digits = mobileFull.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return digits.length === 12 ? `+91 XXXXX X${last4}` : `XXXXX X${last4}`;
}

/**
 * OTP entry - 6 digits via <OtpInput> + Resend countdown. On Verify success
 * we hand the AuthResult upstream (login/forgot) or trigger the workspace
 * setup step (register).
 */
export function OtpVerifyMode({
  setMode,
  setIdentifier,
  ctx,
  setCtx,
  onAuthSuccess,
  onSessionLimitWithOtp,
  changeNumberTarget = 'check',
  signupFormData = null,
}: OtpVerifyModeProps) {
  const t = useTranslations('auth');
  // Pillar 3 (auth-hardening): localize BE error codes (OTP_LOCKED /
  // OTP_INCORRECT / OTP_RATE_LIMITED) into the active locale, falling back to the
  // BE message for unmapped codes.
  const authErrMsg = useAuthErrorMessage();
  // Prefill the fixed dev code only in a non-production build (otpMockSeed
  // returns '' in a live build, even if ctx.mockMode is somehow true).
  const [otp, setOtp] = useState(otpMockSeed(ctx.mockMode));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasError, setHasError] = useState(false);
  const widget = useMsg91Widget();

  const handleVerify = async (value: string) => {
    setError('');
    setHasError(false);
    setLoading(true);

    // Widget channel: exchange the typed digits for MSG91's access-token via
    // their SDK before calling our backend - our BE never sees the raw OTP
    // on this channel (see use-msg91-widget.ts watch note).
    let accessToken: string | undefined;
    if (env.authOtpChannel === 'widget') {
      try {
        const data = (await widget.verifyOtp(value)) as { message?: string };
        accessToken = data?.message;
      } catch {
        // Never surface MSG91's raw SDK error text (e.g. "IPBlocked") to the
        // user - always show the friendly generic message.
        setLoading(false);
        setError(authErrMsg(undefined, t('verifyOtp.error.generic')));
        setHasError(true);
        return;
      }
    }

    const res = await verifyOtp({
      mobile: ctx.mobile,
      ...(accessToken ? { accessToken } : { otp: value }),
      flowType: ctx.flowType,
      // Person-only signup payload - name + password attached on register-flow
      // verifies when the user came through SignupMode. The BE creates the
      // User only; a workspace (if any) is created later in the guided
      // workspace step.
      ...(ctx.flowType === 'register' && signupFormData
        ? {
            name: signupFormData.name,
            password: signupFormData.password,
            // Wave 5 (2026-05-21) - atomic policy stamp at signup. BE writes
            // *PolicyAcceptedAt during user creation; downstream policy gate
            // reads it as already-accepted on first navigation.
            acceptedPolicy: signupFormData.product,
            // Task 22 (2026-06-19) - referral program. Forward when present
            // (only non-empty when REFERRAL_ENABLED=true and code was captured
            // from ?ref= or the in-form input). BE no-ops when program is off.
            ...(signupFormData.referralCode ? { referralCode: signupFormData.referralCode } : {}),
          }
        : {}),
    });
    if (!res.ok) {
      if (res.error === 'SESSION_LIMIT_REACHED' && res.sessionData) {
        onSessionLimitWithOtp(
          res.sessionData as SessionLimitData,
          accessToken ? { accessToken } : { otp: value },
        );
        setLoading(false);
        return;
      }
      setError(authErrMsg(res.errorCode, res.error));
      setHasError(true);
      setLoading(false);
      return;
    }
    await onAuthSuccess(res.data);
  };

  const handleResend = async () => {
    setError('');
    const res = await resendOtp(ctx.mobile, ctx.flowType);
    if (!res.ok) {
      setError(authErrMsg(res.errorCode, res.error));
      return;
    }
    // Widget channel: also trigger MSG91's own retry so the widget's
    // internal request id stays in sync with the new BE-issued cooldown.
    if (env.authOtpChannel === 'widget') {
      try {
        await widget.retryOtp();
      } catch {
        setError(authErrMsg(undefined, t('verifyOtp.error.generic')));
        return;
      }
    }
    setOtp(otpMockSeed(res.data.mockMode));
    setHasError(false);
    setCtx({
      ...ctx,
      resendCooldownSec: res.data.resendCooldownSec,
      mockMode: res.data.mockMode,
      resetKey: Date.now(),
    });
  };

  return (
    <>
      <button
        onClick={() => {
          if (changeNumberTarget === 'check') {
            setIdentifier('');
          }
          setMode(changeNumberTarget);
        }}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('verifyOtp.back')}
      </button>
      <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">
        {t('verifyOtp.title')}
      </h1>
      <p className="m-0 mb-5 text-[13px] text-muted">
        {t.rich('verifyOtp.sentTo', {
          target: () => <strong className="text-primary">{maskMobile(ctx.mobile)}</strong>,
          edit: () => (
            <button
              type="button"
              onClick={() => {
                if (changeNumberTarget === 'check') {
                  setIdentifier('');
                }
                setMode(changeNumberTarget);
              }}
              className="ml-1 inline-flex cursor-pointer items-center gap-1 border-none bg-transparent p-0 text-[12px] font-medium text-primary hover:underline"
              aria-label={t('verifyOtp.editAria')}
            >
              <EditOutlined /> {t('verifyOtp.edit')}
            </button>
          ),
        })}
      </p>
      {/* Stacked notice + entry block uses flex-gap so banner / error / OTP
          input always have consistent 20px breathing room regardless of which
          notices render. mb-6 below the block separates it from the primary
          Verify CTA. */}
      <div className="mb-6 flex flex-col gap-5">
        <MockOtpBanner force={ctx.mockMode} className="!mb-0" />
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
      <Button
        type="primary"
        size="large"
        loading={loading}
        block
        disabled={otp.length !== 6}
        className="h-[46px] font-semibold"
        onClick={() => handleVerify(otp)}
      >
        {t('verifyOtp.submit')}
      </Button>
      <div className="mt-4 flex items-center justify-between text-[13px] text-muted">
        <span>{t('verifyOtp.resend.prompt')}</span>
        <ResendCountdown
          cooldownSec={ctx.resendCooldownSec}
          resetKey={ctx.resetKey}
          onResend={handleResend}
          disabled={loading}
        />
      </div>
      {ctx.hasPassword && (
        <p className="mt-5 mb-0 text-center text-[13px] text-muted">
          <button
            type="button"
            onClick={() => setMode('login')}
            className="cursor-pointer border-none bg-transparent text-[13px] font-semibold text-primary hover:underline"
          >
            {t('verifyOtp.usePassword')}
          </button>
        </p>
      )}
    </>
  );
}
