'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Typography } from 'antd';
import type { GetRef } from 'antd';
import { LoadingOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { startMobileVerification, confirmMobileVerification } from '@/lib/actions/team.actions';
import { env } from '@/lib/env';

/**
 * Phase 1f (2026-05-21) mobile-OTP verification modal.
 *
 * Auto-dispatches the start endpoint when the modal opens with a non-empty
 * mobile. Surfaces a 6-digit Input.OTP, a 60-second resend cooldown with a
 * live countdown, and a BE-error-code-aware error mapping. On success
 * returns the short-lived JWT proof token up to PersonalTab via the
 * `onVerified` callback so the form submit can forward it as
 * `mobileVerifyToken` on the create payload.
 *
 * Accessibility:
 *  - Modal owns its own focus trap (AntD default) and escape-to-close.
 *  - The OTP input is autofocused on send so screen readers announce the
 *    "Verification code" label without an extra tab stop.
 *  - Send / verify / error transitions are announced via an aria-live
 *    polite region so non-sighted users hear state changes.
 */

interface MobileOtpModalProps {
  open: boolean;
  workspaceId: string;
  mobile: string;
  onClose: () => void;
  /** Invoked with the short-lived proof JWT on a successful confirm. */
  onVerified: (token: string) => void;
}

type Phase = 'idle' | 'sending' | 'awaiting_code' | 'verifying' | 'verified';

const RESEND_COOLDOWN_SECONDS = 60;

export default function MobileOtpModal({
  open,
  workspaceId,
  mobile,
  onClose,
  onVerified,
}: MobileOtpModalProps) {
  const t = useTranslations('team.addMember.mobileOtpModal');
  const [phase, setPhase] = useState<Phase>('idle');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const lastSentRef = useRef<{ workspaceId: string; mobile: string } | null>(null);
  const otpRef = useRef<GetRef<typeof Input.OTP>>(null);
  // Out-of-order response guards. If the user changes mobile (or cancels)
  // while a send/verify is in flight, the stale response must not clobber
  // newer state. Mirrors the reqIdRef pattern in useMobileClassification.
  const sendIdRef = useRef(0);
  const verifyIdRef = useRef(0);

  // Focus the OTP input once the awaiting-code phase begins so screen readers
  // announce the labelled control and keyboard users do not need an extra tab
  // stop. Re-focus after a wrong-code failure too (phase resets to
  // awaiting_code) so retry is a single keystroke. Imperative ref.focus()
  // call, not setState; safe in an effect body.
  useEffect(() => {
    if (phase !== 'awaiting_code') return;
    otpRef.current?.focus();
  }, [phase]);

  // Start the resend countdown after each successful start. The effect depends
  // on a boolean signal (not on `resendIn` itself) so the interval is created
  // once when the countdown starts and torn down once when it reaches zero,
  // rather than being recreated on every tick. setInterval is also cleared on
  // unmount so we never leak a timer.
  const hasCountdown = resendIn > 0;
  useEffect(() => {
    if (!hasCountdown) return;
    const id = setInterval(() => {
      setResendIn((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [hasCountdown]);

  // Map a BE error code (prefix from formatStructuredErrorPrefix) to a
  // localized error string. Wrong-code carries `attempts=N`; we surface
  // "5 - N attempts left" so the message stays user-readable.
  const renderErrorMessage = useCallback(
    (raw: string): string => {
      if (raw.startsWith('OTP_WRONG_CODE')) {
        const attemptsMatch = raw.match(/attempts=(\d+)/);
        const attempts = attemptsMatch ? Number(attemptsMatch[1]) : 0;
        const remaining = Math.max(0, 5 - attempts);
        return t('errors.wrongCode', { remaining });
      }
      if (raw.startsWith('OTP_EXPIRED_OR_INVALID')) return t('errors.expired');
      if (raw.startsWith('OTP_LOCKED')) return t('errors.locked');
      if (raw.startsWith('TOO_MANY_REQUESTS')) return t('errors.rateLimited');
      return t('errors.smsFailed');
    },
    [t],
  );

  const sendCode = useCallback(async () => {
    if (!workspaceId || !mobile) return;
    const myReq = ++sendIdRef.current;
    setPhase('sending');
    setError(null);
    setCode('');
    setAnnouncement('');
    try {
      await startMobileVerification(workspaceId, mobile);
      // Bail if a newer sendCode invocation has superseded this one (e.g. the
      // user changed mobile mid-flight). Otherwise the stale success would
      // clobber `lastSentRef`, `resendIn`, and phase with outdated values.
      if (myReq !== sendIdRef.current) return;
      lastSentRef.current = { workspaceId, mobile };
      setPhase('awaiting_code');
      setResendIn(RESEND_COOLDOWN_SECONDS);
      setAnnouncement(t('subtitle', { mobile }));
    } catch (e) {
      if (myReq !== sendIdRef.current) return;
      const raw = e instanceof Error ? e.message : 'unknown';
      const msg = renderErrorMessage(raw);
      setError(msg);
      setPhase('idle');
      setAnnouncement(msg);
    }
  }, [workspaceId, mobile, renderErrorMessage, t]);

  // Auto-send on open. Guard against duplicate sends if the props don't
  // actually change (React strict-mode double-mount, parent re-renders) by
  // comparing against the last successful send key.
  useEffect(() => {
    if (!open) return;
    // Interim (SMS OTP off): never auto-send - the unavailable panel renders
    // instead (see the early return below). Flips back on when env.smsOtpEnabled.
    if (!env.smsOtpEnabled) return;
    if (!workspaceId || !mobile) return;
    const last = lastSentRef.current;
    if (last && last.workspaceId === workspaceId && last.mobile === mobile) {
      // Modal re-opened with the same target. Don't auto-resend; the cooldown
      // still applies (resendIn drives the resend button).
      if (phase === 'idle' || phase === 'verified') {
         
        setPhase('awaiting_code');
      }
      return;
    }
    void sendCode();
    // sendCode is referentially stable per (workspaceId, mobile, t).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId, mobile]);

  // Reset transient state when the modal closes so reopening for the same
  // mobile presents a clean slate (cooldown excepted; lastSentRef survives).
  // Intentional set-state-in-effect: synchronize transient UI state with the
  // externally-controlled `open` prop. The reset cannot live in the parent
  // because the parent only knows whether the modal is open; it does not own
  // the OTP input value, error string, or phase machine.
  useEffect(() => {
    if (open) return;
     
    setCode('');
    setError(null);
    setAnnouncement('');
    if (phase === 'verifying' || phase === 'verified') {
      setPhase('idle');
    }
  }, [open, phase]);

  const handleVerify = useCallback(async () => {
    if (code.length !== 6 || !workspaceId || !mobile) return;
    const myReq = ++verifyIdRef.current;
    setPhase('verifying');
    setError(null);
    try {
      const { token } = await confirmMobileVerification(workspaceId, mobile, code);
      // Bail if the user changed mobile or cancelled mid-verify. Without this,
      // a stale success could call onVerified() with a token bound to a now
      // outdated mobile number, silently mismatching the form payload.
      if (myReq !== verifyIdRef.current) return;
      setPhase('verified');
      setAnnouncement(t('success'));
      onVerified(token);
      onClose();
    } catch (e) {
      if (myReq !== verifyIdRef.current) return;
      const raw = e instanceof Error ? e.message : 'unknown';
      const msg = renderErrorMessage(raw);
      setError(msg);
      setPhase('awaiting_code');
      setAnnouncement(msg);
      setCode('');
    }
  }, [code, workspaceId, mobile, onVerified, onClose, renderErrorMessage, t]);

  const handleResend = useCallback(() => {
    if (resendIn > 0) return;
    void sendCode();
  }, [resendIn, sendCode]);

  const isSending = phase === 'sending';
  const isVerifying = phase === 'verifying';
  const isAwaiting = phase === 'awaiting_code';
  const canVerify = code.length === 6 && isAwaiting;

  // Interim (SMS OTP off): show a tidy "available soon" panel instead of the OTP
  // flow. Mobile verification is optional on the create payload, so members are
  // still added without it. Reverts to the full flow when env.smsOtpEnabled.
  if (!env.smsOtpEnabled) {
    return (
      <Modal
        open={open}
        title={
          <span className="flex items-center gap-2">
            <SafetyCertificateOutlined className="text-[var(--cr-primary,#0B6E4F)]" />
            {t('title')}
          </span>
        }
        onCancel={onClose}
        footer={null}
        destroyOnHidden
        centered
        width={440}
      >
        <div className="flex flex-col gap-4">
          <Typography.Paragraph className="m-0 text-sm text-[var(--cr-text-3,#4b5563)]">
            {t('unavailable')}
          </Typography.Paragraph>
          <div className="flex justify-end">
            <Button onClick={onClose}>{t('closeCta')}</Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={
        <span className="flex items-center gap-2">
          <SafetyCertificateOutlined className="text-[var(--cr-primary,#0B6E4F)]" />
          {t('title')}
        </span>
      }
      onCancel={onClose}
      footer={null}
      mask={{ closable: !isVerifying }}
      keyboard={!isVerifying}
      destroyOnHidden
      centered
      width={440}
    >
      <div className="flex flex-col gap-4">
        <Typography.Paragraph className="m-0 text-sm text-[var(--cr-text-3,#4b5563)]">
          {t('subtitle', { mobile })}
        </Typography.Paragraph>

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {announcement}
        </div>

        <div className="flex flex-col gap-2" role="group" aria-labelledby="cr-otp-label">
          <span id="cr-otp-label" className="text-sm font-medium text-gray-600">
            {t('codeLabel')}
          </span>
          <div className="flex items-center gap-3">
            <Input.OTP
              ref={otpRef}
              length={6}
              value={code}
              onChange={(v) => {
                setCode(v);
                if (error) setError(null);
              }}
              disabled={isSending || isVerifying}
              formatter={(v) => v.replace(/\D/g, '')}
              size="large"
            />
            {isSending && (
              <LoadingOutlined
                aria-hidden="true"
                className="text-base text-[var(--cr-text-3,#4b5563)]"
              />
            )}
          </div>
        </div>

        {error && <Alert type="error" showIcon title={error} className="mb-0" />}

        <div className="mt-1 flex items-center justify-between gap-3">
          <Button
            type="link"
            size="small"
            onClick={handleResend}
            disabled={resendIn > 0 || isSending || isVerifying}
            className="px-0"
          >
            {resendIn > 0 ? t('resendIn', { seconds: resendIn }) : t('resend')}
          </Button>
          <div className="flex items-center gap-2">
            <Button onClick={onClose} disabled={isVerifying}>
              {t('closeCta')}
            </Button>
            <Button
              type="primary"
              onClick={handleVerify}
              disabled={!canVerify}
              loading={isVerifying}
            >
              {t('verifyCta')}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
