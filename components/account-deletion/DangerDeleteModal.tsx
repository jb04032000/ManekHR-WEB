'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input } from 'antd';
import { LockOutlined, CheckCircleFilled, GoogleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useGoogleLogin } from '@react-oauth/google';
import { DsModal } from '@/components/ui';
import { useAuthStore } from '@/lib/store';
import { OtpInput } from '@/components/auth/OtpInput';
import {
  sendDeletionStepupOtp,
  verifyDeletionStepupOtp,
  scheduleConnectDeletion,
  scheduleErpDeletion,
  scheduleAccountDeletion,
  type DeletionReauth,
  type ScheduleDeletionResult,
} from '@/lib/actions/account-deletion.actions';

/** The exact type-to-confirm phrase the backend enforces (DELETION_CONFIRM_PHRASE). */
const CONFIRM_WORD = 'DELETE';

export type DeletionScope = 'connect' | 'erp' | 'account';

interface DangerDeleteModalProps {
  open: boolean;
  scope: DeletionScope;
  onClose: () => void;
  /** Fires after the schedule call succeeds. The parent owns post-success UX
   *  (Scope 3 -> log out + redirect; Scope 1/2 -> success screen + cross-link). */
  onScheduled: (result: { scope: DeletionScope; purgeAfter: string }) => void;
  /** Modal title (scope-specific, supplied by each danger zone). */
  title?: ReactNode;
  /** Scope-specific consequences block rendered above the verification steps. */
  consequences?: ReactNode;
}

/**
 * Shared confirm dialog for all three DPDP deletion scopes
 * (ACCOUNT-DELETION-AND-DPDP-PLAN.md §7). Collects the three delete-time factors -
 * re-auth (password / Google / none for OTP-only), a one-time step-up code, and
 * type-to-confirm - then calls the scope's schedule action. Recovery is
 * admin-mediated (no self-cancel), stated in the recover note.
 *
 * Re-auth mirrors components/auth/ForgotPinModal (password OR Google implicit-flow
 * access token sent as googleIdToken). Cross-link:
 * lib/actions/account-deletion.actions.ts.
 */
export function DangerDeleteModal({
  open,
  scope,
  onClose,
  onScheduled,
  title,
  consequences,
}: DangerDeleteModalProps) {
  const t = useTranslations('accountDeletion.modal');
  const user = useAuthStore((s) => s.user);

  const hasPassword = !!user?.hasPassword;
  const hasGoogle = !!user?.googleId;
  const otpOnly = !hasPassword && !hasGoogle;
  const bothMethods = hasPassword && hasGoogle;

  const [method, setMethod] = useState<'password' | 'google'>(hasPassword ? 'password' : 'google');
  const [password, setPassword] = useState('');
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [proofToken, setProofToken] = useState<string | null>(null);

  const [typed, setTyped] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setMethod(hasPassword ? 'password' : 'google');
    setPassword('');
    setGoogleToken(null);
    setSending(false);
    setCodeSent(false);
    setOtp('');
    setVerifying(false);
    setProofToken(null);
    setTyped('');
    setSubmitting(false);
    setError(null);
  }, [hasPassword]);

  // Open clean every time (closed -> open transition only, per React 19 rules).
  const prevOpenRef = useRef(false);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    if (!wasOpen && open) reset();
  }, [open, reset]);

  // Google re-verify: implicit flow yields an access_token the backend verifies
  // via OAuth2Client (same path as login). Sent as `googleIdToken`.
  const googleLogin = useGoogleLogin({
    flow: 'implicit',
    scope: 'openid email profile',
    onSuccess: (tokenResp) => {
      const accessToken = (tokenResp as { access_token?: string }).access_token;
      if (!accessToken) {
        setError(t('googleFailed'));
        return;
      }
      setGoogleToken(accessToken);
      setError(null);
    },
    onError: () => setError(t('googleFailed')),
  });

  const handleSend = useCallback(async () => {
    setSending(true);
    setError(null);
    const res = await sendDeletionStepupOtp();
    setSending(false);
    if (res.ok) {
      setCodeSent(true);
      setOtp('');
      setProofToken(null);
    } else {
      setError(res.error);
    }
  }, []);

  const handleVerify = useCallback(async (code: string) => {
    setVerifying(true);
    setError(null);
    const res = await verifyDeletionStepupOtp(code);
    setVerifying(false);
    if (res.ok) {
      setProofToken(res.data.proofToken);
    } else {
      setProofToken(null);
      setOtp('');
      setError(res.error);
    }
  }, []);

  const reauthPayload = (): DeletionReauth | undefined => {
    if (otpOnly) return undefined;
    if (method === 'password') return { kind: 'password', password };
    return googleToken ? { kind: 'google', googleIdToken: googleToken } : undefined;
  };

  const reauthReady =
    otpOnly || (method === 'password' ? password.trim().length > 0 : !!googleToken);
  const confirmReady = typed.trim() === CONFIRM_WORD;
  const canSubmit = reauthReady && !!proofToken && confirmReady && !submitting;

  const handleSubmit = useCallback(async () => {
    if (!proofToken) return;
    setSubmitting(true);
    setError(null);
    const input = { reauth: reauthPayload(), otpProof: proofToken, confirm: typed.trim() };
    const scheduler: Record<DeletionScope, (i: typeof input) => Promise<ScheduleDeletionResult>> = {
      connect: scheduleConnectDeletion,
      erp: scheduleErpDeletion,
      account: scheduleAccountDeletion,
    };
    const res = await scheduler[scope](input);
    setSubmitting(false);
    if (res.ok) {
      onScheduled({ scope, purgeAfter: res.purgeAfter });
    } else {
      setError(res.error);
    }
    // reauthPayload reads current state; the deps lint is satisfied by the
    // values it closes over being part of this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofToken, scope, typed, password, googleToken, method, otpOnly, onScheduled]);

  return (
    <DsModal
      open={open}
      onCancel={onClose}
      title={title ?? t('confirmHeading')}
      width={500}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={submitting}>
          {t('cancel')}
        </Button>,
        <Button
          key="submit"
          danger
          type="primary"
          loading={submitting}
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          {t('submit')}
        </Button>,
      ]}
    >
      {consequences}

      {/* Step 1 - re-authenticate */}
      <h3 className="mt-4 mb-2 font-label text-[12px] font-bold tracking-wide text-heading uppercase">
        {t('identityHeading')}
      </h3>

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

      {!otpOnly && method === 'password' && (
        <div className="mb-3">
          <label
            htmlFor="deletion-reauth-password"
            className="mb-1.5 block text-[13px] font-semibold text-heading"
          >
            {t('passwordLabel')}
          </label>
          <Input.Password
            id="deletion-reauth-password"
            size="large"
            prefix={<LockOutlined className="text-subtle" />}
            placeholder={t('passwordPlaceholder')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-label={t('passwordLabel')}
          />
        </div>
      )}

      {!otpOnly && method === 'google' && (
        <Button
          block
          size="large"
          icon={<GoogleOutlined />}
          onClick={() => googleLogin()}
          className="mb-3"
        >
          {googleToken ? t('codeVerified') : t('googleButton')}
        </Button>
      )}

      {/* Step 1b - one-time step-up code */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-heading">{t('codeLabel')}</span>
        <Button size="small" type="link" loading={sending} onClick={handleSend}>
          {codeSent ? t('resendCode') : t('sendCode')}
        </Button>
      </div>
      {codeSent && (
        <>
          <p className="mt-0 mb-2 text-[12.5px] text-muted">{t('codeSent')}</p>
          <OtpInput
            value={otp}
            onChange={setOtp}
            onComplete={handleVerify}
            disabled={verifying || !!proofToken}
            hasError={false}
            ariaLabel={t('codeLabel')}
          />
        </>
      )}
      {proofToken && (
        <p className="mt-2 mb-0 flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-600">
          <CheckCircleFilled /> {t('codeVerified')}
        </p>
      )}

      {/* Step 2 - type-to-confirm */}
      <h3 className="mt-5 mb-2 font-label text-[12px] font-bold tracking-wide text-heading uppercase">
        {t('confirmHeading')}
      </h3>
      <p className="mt-0 mb-2 text-[12.5px] text-muted">
        {t.rich('typeToConfirmHint', { word: () => <b>{CONFIRM_WORD}</b> })}
      </p>
      <Input
        size="large"
        placeholder={t('typeToConfirmPlaceholder')}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        status={typed.length > 0 && !confirmReady ? 'error' : undefined}
        aria-label={t('confirmHeading')}
      />

      <p className="mt-4 mb-0 rounded-[10px] bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800">
        {t('recoverNote')}
      </p>

      {error && (
        <Alert type="error" showIcon className="mt-3" title={t('errorTitle')} description={error} />
      )}
    </DsModal>
  );
}
