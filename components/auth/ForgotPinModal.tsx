'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Input, Alert } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined, KeyOutlined, LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useGoogleLogin } from '@react-oauth/google';
import { AxiosError } from 'axios';
import { DsModal } from '@/components/ui';
import { pinApi } from '@/lib/api/modules';
import { useAuthStore } from '@/lib/store';
import { PinInput } from './PinInput';

interface ForgotPinModalProps {
  open: boolean;
  onClose: () => void;
  /** Fires after the new PIN is set; parent should drop the lock overlay. */
  onSuccess: (unlockExpiresAt: string) => void;
}

type Step = 'verify' | 'set-new';

/**
 * Forgot PIN flow modal. Two steps:
 *   1. `verify` - caller proves identity (password OR Google re-verify),
 *      backend returns a 5-min `pinResetToken`.
 *   2. `set-new` - caller enters a new 6-digit PIN; backend consumes the
 *      token and writes the new PIN, returning the unlock state.
 *
 * Branches for users with both credential types: shows a method picker.
 * Google-only users see only the Google branch; password-only see only the
 * password branch.
 */
export function ForgotPinModal({ open, onClose, onSuccess }: ForgotPinModalProps) {
  const t = useTranslations('auth.appLock.forgotPin');
  const tCommon = useTranslations('auth.appLock.common');
  const user = useAuthStore((s) => s.user);

  const hasPassword = !!user?.hasPassword;
  const hasGoogle = !!user?.googleId;
  const onlyGoogle = hasGoogle && !hasPassword;
  const bothMethods = hasGoogle && hasPassword;

  const [method, setMethod] = useState<'password' | 'google'>(onlyGoogle ? 'google' : 'password');
  const [step, setStep] = useState<Step>('verify');
  const [password, setPassword] = useState('');
  const [pinResetToken, setPinResetToken] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [reveal, setReveal] = useState(false);

  const reset = useCallback(() => {
    setStep('verify');
    setPassword('');
    setPinResetToken(null);
    setNewPin('');
    setConfirmPin('');
    setError(null);
    setSubmitting(false);
    setMethod(onlyGoogle ? 'google' : 'password');
  }, [onlyGoogle]);

  // Fire reset only on closed→open transition (not on every effect run)
  // to satisfy React 19's set-state-in-effect rule.
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!wasOpen && open) reset();
  }, [open, reset]);

  const handlePasswordSubmit = useCallback(async () => {
    if (!password.trim()) {
      setError(t('error.passwordRequired'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await pinApi.forgotPinCredentialVerify({
        kind: 'password',
        password,
      });
      setPinResetToken(res.pinResetToken);
      setStep('set-new');
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      setError(ax.response?.data?.message ?? t('error.verifyFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [password, t]);

  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    // Backend reads the profile from this access token via Google userinfo, so
    // request email + profile (keep in sync with AuthClient's googleLogin).
    scope: 'openid email profile',
    onSuccess: async (tokenResp) => {
      // Implicit flow yields an access_token, not an id_token. Fetch the
      // userinfo to get a verifiable id-token-equivalent. To avoid that
      // round-trip we instead require the caller use the GIS one-tap path
      // already wired in AuthClient - but in this modal we follow the
      // simpler implicit path and accept the same access-token shape the
      // backend's googleAuth path already verifies via `OAuth2Client`.
      // If your project uses id-token-only verification, swap to GIS here.
      const accessToken = (tokenResp as { access_token?: string }).access_token;
      if (!accessToken) {
        setError(t('error.googleFailed'));
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const res = await pinApi.forgotPinCredentialVerify({
          kind: 'google',
          googleIdToken: accessToken,
        });
        setPinResetToken(res.pinResetToken);
        setStep('set-new');
      } catch (err) {
        const ax = err as AxiosError<{ message?: string }>;
        setError(ax.response?.data?.message ?? t('error.googleFailed'));
      } finally {
        setSubmitting(false);
      }
    },
    onError: () => setError(t('error.googleFailed')),
  });

  const handleNewPinSubmit = useCallback(async () => {
    if (newPin.length !== 6 || confirmPin.length !== 6) {
      setError(t('error.sixDigits'));
      return;
    }
    if (newPin !== confirmPin) {
      setError(t('error.mismatch'));
      return;
    }
    if (!pinResetToken) {
      setError(t('error.tokenMissing'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await pinApi.forgotPinReset(pinResetToken, newPin);
      onSuccess(res.unlockExpiresAt);
    } catch (err) {
      const ax = err as AxiosError<{ message?: string }>;
      setError(ax.response?.data?.message ?? t('error.resetFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [newPin, confirmPin, pinResetToken, onSuccess, t]);

  const subtitle = method === 'password' ? t('passwordSubtitle') : t('googleSubtitle');

  const titleNode = (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[var(--cr-indigo-50)] text-primary">
        {step === 'set-new' ? <KeyOutlined /> : <LockOutlined />}
      </span>
      <span className="font-display text-[18px] font-bold text-heading">{t('title')}</span>
    </span>
  );

  return (
    <DsModal
      title={titleNode}
      open={open}
      zIndex={1200}
      onCancel={onClose}
      footer={
        step === 'verify' && method === 'password'
          ? [
              <Button key="cancel" onClick={onClose} disabled={submitting}>
                {t('cancel')}
              </Button>,
              <Button
                key="verify"
                type="primary"
                loading={submitting}
                onClick={handlePasswordSubmit}
              >
                {t('verifyButton')}
              </Button>,
            ]
          : step === 'set-new'
            ? [
                <Button key="cancel" onClick={onClose} disabled={submitting}>
                  {t('cancel')}
                </Button>,
                <Button key="set" type="primary" loading={submitting} onClick={handleNewPinSubmit}>
                  {t('setButton')}
                </Button>,
              ]
            : [
                <Button key="cancel" onClick={onClose} disabled={submitting}>
                  {t('cancel')}
                </Button>,
              ]
      }
      width={460}
    >
      {step === 'verify' && (
        <>
          {bothMethods && (
            <div className="mb-3 flex items-center gap-2">
              <Button
                size="small"
                type={method === 'password' ? 'primary' : 'default'}
                onClick={() => setMethod('password')}
              >
                {t('methodPassword')}
              </Button>
              <Button
                size="small"
                type={method === 'google' ? 'primary' : 'default'}
                onClick={() => setMethod('google')}
              >
                {t('methodGoogle')}
              </Button>
            </div>
          )}
          <p className="mb-5 text-[14px] leading-[1.5] text-muted">{subtitle}</p>
          {method === 'password' && (
            <div>
              <label
                htmlFor="forgot-pin-password"
                className="mb-1.5 block text-[13px] font-semibold text-heading"
              >
                {t('passwordLabel')}
              </label>
              <Input.Password
                id="forgot-pin-password"
                size="large"
                autoFocus
                prefix={<LockOutlined className="text-subtle" />}
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onPressEnter={handlePasswordSubmit}
                disabled={submitting}
                autoComplete="current-password"
              />
            </div>
          )}
          {method === 'google' && (
            <Button block size="large" loading={submitting} onClick={() => googleLogin()}>
              {t('googleButton')}
            </Button>
          )}
        </>
      )}

      {step === 'set-new' && (
        <>
          <p className="mb-5 text-[14px] leading-[1.5] text-muted">{t('setSubtitle')}</p>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium tracking-wide text-muted uppercase">
              {t('newLabel')}
            </label>
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-heading"
              aria-label={reveal ? tCommon('hidePinAria') : tCommon('showPinAria')}
              aria-pressed={reveal}
            >
              {reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              <span>{reveal ? tCommon('hidePin') : tCommon('showPin')}</span>
            </button>
          </div>
          <PinInput
            value={newPin}
            onChange={setNewPin}
            disabled={submitting}
            autoFocus
            reveal={reveal}
            ariaLabel={t('newLabel')}
          />
          <label className="mt-4 mb-2 block text-xs font-medium tracking-wide text-muted uppercase">
            {t('confirmLabel')}
          </label>
          <PinInput
            value={confirmPin}
            onChange={setConfirmPin}
            disabled={submitting}
            reveal={reveal}
            ariaLabel={t('confirmLabel')}
          />
        </>
      )}

      {error && <Alert type="error" showIcon className="mt-4" title={error} />}
    </DsModal>
  );
}
