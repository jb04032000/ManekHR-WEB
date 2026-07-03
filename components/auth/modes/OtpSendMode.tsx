'use client';

import { useRef, useState } from 'react';
import { Button, Alert } from 'antd';
import { ArrowLeftOutlined, MobileOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { sendOtp } from '@/lib/actions';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import { MockOtpBanner } from '@/components/auth/MockOtpBanner';
import { useMsg91Widget } from '@/lib/auth/use-msg91-widget';
import { env } from '@/lib/env';
import type { BaseModeProps, OtpContext, OtpFlowType } from './types';

interface OtpSendModeProps extends BaseModeProps {
  initialMobile: string;
  flowType: OtpFlowType;
  onSendSuccess: (ctx: OtpContext) => void;
  /**
   * Optional escape hatch for users who'd rather create the account with a
   * password instead of OTP. Only wired by the orchestrator on the register
   * flow - login/forgot variants never offer it because there's no password
   * to create at those steps.
   */
  onUsePassword?: () => void;
}

/**
 * Format a raw mobile (10-digit, 91-prefixed, or +91-prefixed) into a tidy
 * `+91 XXXXX XXXXX` display string. Falls back to the raw string when the
 * shape doesn't match either expected length so we never print junk.
 */
function formatMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return raw;
}

/**
 * Confirmation step between CheckMode and OtpVerifyMode. Mobile is captured
 * upstream in CheckMode (and validated there against the strict Indian
 * regex), so this screen only confirms the number and fires send-otp.
 *
 * Design intent: the mobile is read-only on this screen. Users who need to
 * change it tap "Edit" or the Back button - both routes return to CheckMode
 * where the input lives. Keeping a single source of truth for mobile entry
 * avoids the prior bug where invalid numbers passed CheckMode and got
 * rejected here by the BE DTO regex (poor recoverability + jarring layout).
 */
export function OtpSendMode({
  setMode,
  setIdentifier,
  initialMobile,
  flowType,
  onSendSuccess,
  onUsePassword,
}: OtpSendModeProps) {
  const t = useTranslations('auth');
  // Localize a backend error code (e.g. NETWORK_UNREACHABLE on a backend-down)
  // so the send-OTP failure never shows a raw axios string.
  const authErrMsg = useAuthErrorMessage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const sentOnce = useRef(false);
  // MSG91 OTP Widget SDK hook. Only actually dispatches an SMS when
  // env.authOtpChannel === 'widget' (see handleSubmit) - inert import
  // otherwise so the DLT channel path is unaffected.
  const widget = useMsg91Widget();

  const goEditMobile = () => {
    setMode('check');
  };

  const handleSubmit = async () => {
    if (sentOnce.current) return;
    setError('');
    setLoading(true);
    // Backend gate first - eligibility, rate-limit, resend-cooldown
    // bookkeeping. For the widget channel it stages the JWT but does NOT
    // send an SMS itself; for the DLT channel it dispatches directly (same
    // as before).
    const res = await sendOtp(initialMobile, flowType);
    if (!res.ok) {
      setLoading(false);
      setError(authErrMsg(res.errorCode, res.error));
      return;
    }
    if (env.authOtpChannel === 'widget') {
      // Widget channel: the actual SMS dispatch happens client-side via the
      // MSG91 SDK, not the backend. verifyOtp (OtpVerifyMode) later calls
      // widget.verifyOtp() against this same session.
      try {
        await widget.sendOtp(initialMobile);
      } catch {
        // Never surface MSG91's raw SDK error text (e.g. "IPBlocked") to the
        // user - it's provider-internal and not actionable for them. Always
        // show the friendly generic message; the real reason is still
        // logged by useMsg91Widget's promise rejection for debugging.
        setLoading(false);
        setError(authErrMsg(undefined, t('sendOtp.error.generic')));
        return;
      }
    }
    setLoading(false);
    sentOnce.current = true;
    onSendSuccess({
      mobile: initialMobile,
      flowType,
      resendCooldownSec: res.data.resendCooldownSec,
      mockMode: res.data.mockMode,
      resetKey: Date.now(),
    });
  };

  return (
    <>
      <button
        onClick={() => setMode('check')}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('sendOtp.back')}
      </button>
      <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">
        {t(`sendOtp.title.${flowType}`)}
      </h1>
      <p className="m-0 mb-5 text-[13px] leading-relaxed text-muted">
        {t(`sendOtp.subtitle.${flowType}`)}
      </p>
      <MockOtpBanner className="mb-5" />
      {/* Read-only mobile confirmation card. Edit + Back both return to
          CheckMode - single source of truth for mobile entry. */}
      <div className="mb-5">
        <p className="m-0 mb-2 text-[13px] font-medium text-heading">{t('sendOtp.mobile.label')}</p>
        <div className="flex items-center justify-between gap-3 rounded-[10px] border border-border bg-page px-4 py-3">
          <div className="flex items-center gap-2">
            <MobileOutlined className="text-subtle" />
            <span className="text-[15px] font-medium text-heading">
              {formatMobile(initialMobile)}
            </span>
          </div>
          <button
            type="button"
            onClick={goEditMobile}
            className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-primary hover:underline"
          >
            {t('sendOtp.mobile.edit')}
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-5 flex flex-col gap-2">
          <Alert
            type="error"
            title={error}
            showIcon
            className="!mb-0 rounded-[10px]"
            closable={{ onClose: () => setError('') }}
          />
          <p className="m-0 pl-1 text-[12px] leading-relaxed text-muted">
            {t('sendOtp.fallback.prompt')}{' '}
            <button
              type="button"
              onClick={() => {
                setIdentifier('');
                setMode('check');
              }}
              className="cursor-pointer border-none bg-transparent p-0 text-[12px] font-semibold text-primary hover:underline"
            >
              {t('sendOtp.fallback.useDifferent')}
            </button>
          </p>
        </div>
      )}
      <Button
        type="primary"
        size="large"
        loading={loading}
        block
        className="h-[46px] font-semibold"
        onClick={handleSubmit}
      >
        {t('sendOtp.submit')}
      </Button>
      {onUsePassword && (
        <p className="mt-5 mb-0 text-center text-[13px] text-muted">
          {t('sendOtp.passwordOption.prompt')}{' '}
          <button
            type="button"
            onClick={onUsePassword}
            className="cursor-pointer border-none bg-transparent text-[13px] font-semibold text-primary hover:underline"
          >
            {t('sendOtp.passwordOption.cta')}
          </button>
        </p>
      )}
    </>
  );
}
