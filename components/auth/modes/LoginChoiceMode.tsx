'use client';

import { useState } from 'react';
import { Button, Alert } from 'antd';
import { ArrowLeftOutlined, LockOutlined, MessageOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useAuthErrorMessage } from '@/lib/format/auth-error-codes';
import type { BaseModeProps } from './types';

interface LoginChoiceModeProps extends BaseModeProps {
  /** Canonical 91XXXXXXXXXX form, validated upstream by CheckMode. */
  mobile: string;
  /**
   * Existing-user OTP send for the login flow. Mirrors the helper used by
   * the OTP-only fast-path so the UX is consistent: send inline, jump to
   * OtpVerifyMode on success. Returns ok/error so this mode can surface
   * failures inline without losing the chosen path.
   */
  onStartOtpLoginDirect: (
    mobile: string,
    hasPassword: boolean,
  ) => Promise<{ ok: true } | { ok: false; error: string; errorCode?: string }>;
}

function maskMobile(mobileFull: string): string {
  const digits = mobileFull.replace(/\D/g, '');
  const last4 = digits.slice(-4);
  return digits.length === 12 ? `+91 XXXXX X${last4}` : `XXXXX X${last4}`;
}

/**
 * Two-button choice screen shown when the typed mobile already has both a
 * password and an OTP-capable mobile on file. Replaces the legacy inline
 * "Use OTP instead" link inside LoginMode - making both auth methods
 * first-class peers improves discoverability and matches modern Indian SMB
 * SaaS patterns (PhonePe, CRED, Zoho One). Forgot-password remains a
 * secondary footer affordance.
 */
export function LoginChoiceMode({
  setMode,
  setIdentifier,
  mobile,
  onStartOtpLoginDirect,
}: LoginChoiceModeProps) {
  const t = useTranslations('auth');
  // Localize a backend error code (e.g. NETWORK_UNREACHABLE on a backend-down)
  // so the OTP-send failure never shows a raw axios string.
  const authErrMsg = useAuthErrorMessage();
  const [loading, setLoading] = useState<'otp' | null>(null);
  const [error, setError] = useState('');

  const handleSendOtp = async () => {
    setError('');
    setLoading('otp');
    const res = await onStartOtpLoginDirect(mobile, true);
    setLoading(null);
    if (!res.ok) {
      setError(authErrMsg(res.errorCode, res.error));
    }
    // Success path: parent transitions mode internally; nothing to do here.
  };

  const handleUsePassword = () => {
    setMode('login');
  };

  const handleBack = () => {
    setIdentifier('');
    setMode('check');
  };

  return (
    <>
      <button
        onClick={handleBack}
        className="mb-5 flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] text-muted transition-colors hover:text-body"
      >
        <ArrowLeftOutlined /> {t('loginChoice.back')}
      </button>
      <h1 className="m-0 mb-2 font-display text-2xl font-extrabold text-heading">
        {t('loginChoice.title')}
      </h1>
      <p className="m-0 mb-2 text-[13px] leading-relaxed text-muted">{t('loginChoice.subtitle')}</p>
      <p className="m-0 mb-6 text-[12px] text-subtle">
        {t('loginChoice.signedInAs')} <strong className="text-primary">{maskMobile(mobile)}</strong>
      </p>
      {error && (
        <Alert
          type="error"
          title={error}
          showIcon
          className="mb-4 rounded-[10px]"
          closable={{ onClose: () => setError('') }}
        />
      )}
      <div className="flex flex-col gap-3">
        <Button
          type="primary"
          size="large"
          loading={loading === 'otp'}
          block
          icon={<MessageOutlined />}
          onClick={handleSendOtp}
          className="h-[60px] font-semibold"
        >
          <span className="flex flex-col items-start text-left">
            <span className="text-[14px] leading-tight">
              {t('loginChoice.sendOtp')} {maskMobile(mobile)}
            </span>
            <span className="text-[11px] font-normal opacity-90">
              {t('loginChoice.sendOtpHint')}
            </span>
          </span>
        </Button>
        <Button
          size="large"
          block
          icon={<LockOutlined />}
          onClick={handleUsePassword}
          className="h-[60px] border-[1.5px] border-border font-medium text-body"
        >
          <span className="flex flex-col items-start text-left">
            <span className="text-[14px] leading-tight">{t('loginChoice.usePassword')}</span>
            <span className="text-[11px] font-normal text-muted">
              {t('loginChoice.usePasswordHint')}
            </span>
          </span>
        </Button>
      </div>
      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={() => setMode('forgot')}
          className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-primary hover:underline"
        >
          {t('loginChoice.forgotPassword')}
        </button>
      </div>
    </>
  );
}
