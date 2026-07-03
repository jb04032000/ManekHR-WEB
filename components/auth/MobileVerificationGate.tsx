'use client';

/**
 * MobileVerificationGate - blocking "verify your number" gate.
 *
 * Shows ONCE SMS OTP is live (env.smsOtpEnabled === true) for any signed-in user
 * whose phone is still unverified (isMobileVerified === false) - i.e. the accounts
 * created during the SMS-OTP interim where signup skipped OTP (see SignupMode +
 * docs/deployment/SMS-OTP-GOLIVE.md). While the switch is OFF this renders
 * nothing, so it stays fully dormant during the interim.
 *
 * Reuses the authenticated verify-mobile endpoints (sendMobileVerifyOtp +
 * verifyMobile) and the shared OtpInput. On success it patches the auth store
 * (updateUser) so the gate closes and stays closed across navigation.
 *
 * Cross-module: lib/store updateUser; lib/actions send/verify; excluded on
 * /auth/* + /invite/* (those screens own the flag during signup/verify).
 * Watch: mounted once globally in app/layout.tsx next to PwaManager.
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Modal, Button, Alert, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { env } from '@/lib/env';
import { logout, sendMobileVerifyOtp, verifyMobile } from '@/lib/actions';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { OtpInput } from '@/components/auth/OtpInput';
import { ResendCountdown } from '@/components/auth/ResendCountdown';
import { otpMockSeed } from '@/components/auth/otp-mock';
import { useMsg91Widget } from '@/lib/auth/use-msg91-widget';

function maskMobile(mobileFull: string): string {
  const digits = mobileFull.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return digits.length >= 4 ? `XXXXX X${last4}` : mobileFull;
}

export function MobileVerificationGate() {
  const t = useTranslations('auth.mobileVerifyGate');
  const authErrMsg = useAuthErrorMessage();
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [step, setStep] = useState<'intro' | 'verify'>('intro');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hasError, setHasError] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(30);
  const [resetKey, setResetKey] = useState(0);
  const widget = useMsg91Widget();

  // Force verification only when SMS is live AND a signed-in user still has an
  // unverified phone. Excluded on the auth/invite screens (which set the flag
  // themselves during signup/verify). Dormant while env.smsOtpEnabled is false.
  const needsVerify =
    env.smsOtpEnabled &&
    isHydrated &&
    !!user &&
    !!user.mobile &&
    user.isMobileVerified === false &&
    !pathname.startsWith('/auth') &&
    !pathname.startsWith('/invite');

  if (!needsVerify) return null;

  const handleSend = async () => {
    if (busy) return;
    setError('');
    setBusy(true);
    // Verify the number already on file - pass none so the BE uses the user's
    // stored mobile (not a change-number request).
    const res = await sendMobileVerifyOtp();
    if (!res.ok) {
      setBusy(false);
      setError(authErrMsg(res.errorCode, res.error));
      return;
    }
    if (env.authOtpChannel === 'widget') {
      try {
        await widget.sendOtp(user?.mobile ?? '');
      } catch {
        // Never surface MSG91's raw SDK error text (e.g. "IPBlocked") to the
        // user - always show the friendly generic message.
        setBusy(false);
        setError(t('error.generic'));
        return;
      }
    }
    setBusy(false);
    setCooldownSec(res.data.resendCooldownSec);
    setResetKey(Date.now());
    setOtp(otpMockSeed(res.data.mockMode));
    setStep('verify');
  };

  const handleVerify = async (value: string) => {
    if (busy) return;
    setError('');
    setHasError(false);
    setBusy(true);

    let accessToken: string | undefined;
    if (env.authOtpChannel === 'widget') {
      try {
        const data = (await widget.verifyOtp(value)) as { message?: string };
        accessToken = data?.message;
      } catch {
        setBusy(false);
        setError(t('error.generic'));
        setHasError(true);
        return;
      }
    }

    const res = await verifyMobile(accessToken ? { accessToken } : { otp: value });
    setBusy(false);
    if (!res.ok) {
      setError(authErrMsg(res.errorCode, res.error));
      setHasError(true);
      return;
    }
    // Persist verified so the gate closes and stays closed across navigation.
    // The next /auth/me refresh confirms it server-side.
    updateUser({ isMobileVerified: true });
  };

  const handleResend = async () => {
    setError('');
    const res = await sendMobileVerifyOtp();
    if (!res.ok) {
      setError(authErrMsg(res.errorCode, res.error));
      return;
    }
    if (env.authOtpChannel === 'widget') {
      try {
        await widget.retryOtp();
      } catch {
        setError(t('error.generic'));
        return;
      }
    }
    setCooldownSec(res.data.resendCooldownSec);
    setResetKey(Date.now());
    setOtp(otpMockSeed(res.data.mockMode));
    setHasError(false);
  };

  const handleSignOut = async () => {
    try {
      await logout();
    } catch {
      /* best-effort; the hard redirect below resets the session regardless */
    }
    window.location.href = '/auth';
  };

  return (
    <Modal
      open
      closable={false}
      mask={{ closable: false }}
      keyboard={false}
      footer={null}
      centered
      width={440}
      title={
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined className="text-[var(--cr-primary,#0B6E4F)]" />
          {t('title')}
        </span>
      }
    >
      <div className="flex flex-col gap-4">
        <Typography.Paragraph className="m-0 text-sm text-[var(--cr-text-3,#4b5563)]">
          {t('description', { mobile: maskMobile(user?.mobile ?? '') })}
        </Typography.Paragraph>

        {error && <Alert type="error" showIcon title={error} className="mb-0" />}

        {step === 'intro' ? (
          <Button
            type="primary"
            size="large"
            block
            loading={busy}
            onClick={handleSend}
            className="h-[46px] font-semibold"
          >
            {t('sendCta')}
          </Button>
        ) : (
          <>
            <OtpInput
              value={otp}
              onChange={setOtp}
              onComplete={handleVerify}
              disabled={busy}
              hasError={hasError}
              autoFocus
              ariaLabel={t('codeAria')}
            />
            <Button
              type="primary"
              size="large"
              block
              disabled={otp.length !== 6}
              loading={busy}
              onClick={() => handleVerify(otp)}
              className="h-[46px] font-semibold"
            >
              {t('verifyCta')}
            </Button>
            <div className="flex items-center justify-between text-[13px] text-muted">
              <span>{t('resendPrompt')}</span>
              <ResendCountdown
                cooldownSec={cooldownSec}
                resetKey={resetKey}
                onResend={handleResend}
                disabled={busy}
              />
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className="mt-1 cursor-pointer border-none bg-transparent p-0 text-center text-[12px] text-muted hover:text-body hover:underline"
        >
          {t('signOut')}
        </button>
      </div>
    </Modal>
  );
}
