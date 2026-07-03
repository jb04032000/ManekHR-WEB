'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, Button, Alert } from 'antd';
import { MobileOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
  resendOtp as resendUnauthOtp, // unused - kept for symmetry; verify-mobile uses authenticated send
  sendMobileVerifyOtp,
  verifyMobile,
} from '@/lib/actions';
import { useAuthStore } from '@/lib/store';
import { OtpInput } from '@/components/auth/OtpInput';
import { ResendCountdown } from '@/components/auth/ResendCountdown';
import { MockOtpBanner } from '@/components/auth/MockOtpBanner';
import { otpMockSeed } from '@/components/auth/otp-mock';
import { env } from '@/lib/env';
import { useMsg91Widget } from '@/lib/auth/use-msg91-widget';

const MOBILE_RE = /^[+]?[0-9]{10,15}$/;

/**
 * Authenticated mobile-verification flow. Two states:
 *   - 'send' - user enters / confirms the mobile, request OTP
 *   - 'verify' - user enters the 6-digit code
 *
 * On success, redirects to /dashboard/settings (or wherever the caller routed
 * from). The user's `isMobileVerified` flag is flipped server-side; FE store
 * is NOT mutated here - the next /auth/me refresh picks up the change.
 */
export default function VerifyMobilePage() {
  const t = useTranslations('auth.verifyMobile');
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  const [step, setStep] = useState<'send' | 'verify'>('send');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [hasError, setHasError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(30);
  const [mockMode, setMockMode] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const widget = useMsg91Widget();

  useEffect(() => {
    if (!isHydrated) return;
    if (!user) {
      router.replace('/auth');
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user.mobile) setMobile(user.mobile);
  }, [isHydrated, user, router]);

  const handleSend = async (vals: { mobile: string }) => {
    setError('');
    setSubmitting(true);
    const target = vals.mobile.trim();
    const res = await sendMobileVerifyOtp(target && target !== user?.mobile ? target : undefined);
    if (!res.ok) {
      setSubmitting(false);
      setError(res.error);
      return;
    }
    const effectiveMobile = target || user?.mobile || '';
    if (env.authOtpChannel === 'widget') {
      try {
        await widget.sendOtp(effectiveMobile);
      } catch {
        // Never surface MSG91's raw SDK error text (e.g. "IPBlocked") to the
        // user - always show the friendly generic message.
        setSubmitting(false);
        setError(t('verify.error.generic'));
        return;
      }
    }
    setSubmitting(false);
    setMobile(target);
    setCooldownSec(res.data.resendCooldownSec);
    setMockMode(res.data.mockMode);
    setResetKey(Date.now());
    setOtp(otpMockSeed(res.data.mockMode));
    setStep('verify');
  };

  const handleVerify = async (value: string) => {
    setError('');
    setHasError(false);
    setSubmitting(true);

    let accessToken: string | undefined;
    if (env.authOtpChannel === 'widget') {
      try {
        const data = (await widget.verifyOtp(value)) as { message?: string };
        accessToken = data?.message;
      } catch {
        setSubmitting(false);
        setError(t('verify.error.generic'));
        setHasError(true);
        return;
      }
    }

    const res = await verifyMobile(accessToken ? { accessToken } : { otp: value });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      setHasError(true);
      return;
    }
    router.replace('/account/profile');
  };

  const handleResend = async () => {
    const res = await sendMobileVerifyOtp(mobile);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (env.authOtpChannel === 'widget') {
      try {
        await widget.retryOtp();
      } catch {
        setError(t('verify.error.generic'));
        return;
      }
    }
    setCooldownSec(res.data.resendCooldownSec);
    setMockMode(res.data.mockMode);
    setResetKey(Date.now());
    setOtp(otpMockSeed(res.data.mockMode));
    setHasError(false);
  };

  // Reference unused import to keep next-intl tree-shake honest - used in the
  // pre-auth /auth flow but imported here for parity.
  void resendUnauthOtp;

  if (!isHydrated || !user) return null;

  // Interim (SMS OTP off): phone verification can't run without a live SMS
  // gateway, so show a tidy "available soon" panel instead of a send that the
  // backend can't fulfil. Flips back to the real flow when env.smsOtpEnabled.
  if (!env.smsOtpEnabled) {
    return (
      <div className="mx-auto max-w-md px-6 py-12">
        <div className="rounded-[20px] border border-border bg-surface p-8 text-center shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">
            {t('unavailable.title')}
          </h1>
          <p className="m-0 mb-6 text-[13px] leading-relaxed text-muted">
            {t('unavailable.description')}
          </p>
          <Button
            type="primary"
            size="large"
            block
            className="h-[46px] font-semibold"
            onClick={() => router.replace('/account/profile')}
          >
            {t('unavailable.back')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-6 py-12">
      <div className="rounded-[20px] border border-border bg-surface p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">{t('title')}</h1>
        <p className="m-0 mb-6 text-[13px] text-muted">{t('subtitle')}</p>
        <MockOtpBanner force={mockMode} />
        {error && (
          <Alert
            type="error"
            title={error}
            showIcon
            className="mb-4 rounded-[10px]"
            closable={{ onClose: () => setError('') }}
          />
        )}
        {step === 'send' && (
          <Form
            layout="vertical"
            onFinish={handleSend}
            requiredMark={false}
            initialValues={{ mobile }}
          >
            <Form.Item
              name="mobile"
              label={t('mobile.label')}
              rules={[
                { required: true, message: t('mobile.required') },
                {
                  validator: (_, v) => {
                    if (!v) return Promise.resolve();
                    const trimmed = String(v).trim().replace(/[\s-]/g, '');
                    return MOBILE_RE.test(trimmed)
                      ? Promise.resolve()
                      : Promise.reject(new Error(t('mobile.invalid')));
                  },
                },
              ]}
            >
              <Input
                prefix={<MobileOutlined className="text-subtle" />}
                size="large"
                placeholder={t('mobile.placeholder')}
                inputMode="tel"
                autoComplete="tel"
                maxLength={15}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={submitting}
              block
              className="h-[46px] font-semibold"
            >
              {t('send.submit')}
            </Button>
          </Form>
        )}
        {step === 'verify' && (
          <>
            <p className="m-0 mb-6 text-[13px] text-muted">
              {t('verify.subtitle')} <strong className="text-primary">{mobile}</strong>
            </p>
            <div className="mb-6">
              <OtpInput
                value={otp}
                onChange={setOtp}
                onComplete={handleVerify}
                disabled={submitting}
                hasError={hasError}
                autoFocus
                ariaLabel={t('verify.aria')}
              />
            </div>
            <Button
              type="primary"
              size="large"
              loading={submitting}
              block
              disabled={otp.length !== 6}
              className="h-[46px] font-semibold"
              onClick={() => handleVerify(otp)}
            >
              {t('verify.submit')}
            </Button>
            <div className="mt-5 flex items-center justify-between text-[13px] text-muted">
              <span>{t('verify.resendPrompt')}</span>
              <ResendCountdown
                cooldownSec={cooldownSec}
                resetKey={resetKey}
                onResend={handleResend}
                disabled={submitting}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
