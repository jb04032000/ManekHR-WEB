'use client';

import { useEffect, useRef, useState } from 'react';
import { Modal, Form, Input, Button, Alert, Typography } from 'antd';
import { MailOutlined, MobileOutlined } from '@ant-design/icons';
import { OtpInput } from './OtpInput';
import {
  sendVerificationEmail,
  verifyEmail,
  sendMobileVerifyOtp,
  verifyMobile,
} from '@/lib/actions';
import type { PinInputHandle } from './PinInput';
import { useMsg91Widget } from '@/lib/auth/use-msg91-widget';
import { env } from '@/lib/env';

type Channel = 'email' | 'mobile';
type Step = 'enter' | 'otp';

interface Props {
  open: boolean;
  channel: Channel;
  /** Existing identifier on file. When present + isLocked, input is hidden. */
  currentValue?: string;
  /** Lock the input: identifier already on file (channel + verified prior or
   * already attached but unverified). User can only request OTP for it. */
  isLocked?: boolean;
  /** Called after a successful verify with the canonical identifier. Caller
   * patches the auth store with the verified flag + value. */
  onVerified: (canonical: string) => void;
  onClose: () => void;
}

// Mirror of BE normaliseIndianMobile - keep FE in lockstep.
const INDIAN_MOBILE_RE = /^[6-9]\d{9}$/;
function normaliseIndianMobile(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  let bare: string | null = null;
  if (digits.length === 10) bare = digits;
  else if (digits.length === 12 && digits.startsWith('91')) bare = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) bare = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith('091')) bare = digits.slice(3);
  if (!bare || !INDIAN_MOBILE_RE.test(bare)) return null;
  return `91${bare}`;
}

export function VerifyChannelModal({
  open,
  channel,
  currentValue,
  isLocked,
  onVerified,
  onClose,
}: Props) {
  // Initial state is derived from the props that come in on the first mount.
  // The parent unmounts this component whenever the verify-channel slot
  // returns to null, so each open lifecycle starts with a fresh component
  // instance - no need for an effect to reset state on `open` flips.
  const [step, setStep] = useState<Step>('enter');
  const [identifier, setIdentifier] = useState(currentValue ?? '');
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const otpRef = useRef<PinInputHandle>(null);
  const widget = useMsg91Widget();

  useEffect(() => {
    if (cooldown <= 0) return;
    const tid = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(tid);
  }, [cooldown]);

  const isEmail = channel === 'email';

  function validateIdentifier(
    value: string,
  ): { ok: true; canonical: string } | { ok: false; error: string } {
    const trimmed = value.trim();
    if (!trimmed)
      return {
        ok: false,
        error: isEmail ? 'Enter your email address' : 'Enter your mobile number',
      };
    if (isEmail) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRe.test(trimmed)) return { ok: false, error: 'Enter a valid email address' };
      return { ok: true, canonical: trimmed.toLowerCase() };
    }
    const norm = normaliseIndianMobile(trimmed);
    if (!norm) return { ok: false, error: 'Enter a valid 10-digit Indian mobile number' };
    return { ok: true, canonical: norm };
  }

  async function handleSend() {
    const v = validateIdentifier(identifier);
    if (!v.ok) {
      setErr(v.error);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (isEmail) {
        const res = await sendVerificationEmail(v.canonical);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
      } else {
        const res = await sendMobileVerifyOtp(v.canonical);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        if (env.authOtpChannel === 'widget') {
          try {
            await widget.sendOtp(v.canonical);
          } catch {
            // Never surface MSG91's raw SDK error text (e.g. "IPBlocked") to
            // the user - always show the friendly generic message.
            setErr('Could not send the code.');
            return;
          }
        }
      }
      setStep('otp');
      setOtp('');
      setCooldown(30);
      // Focus the OTP boxes once the step renders.
      setTimeout(() => otpRef.current?.focus(), 50);
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    const v = validateIdentifier(identifier);
    if (!v.ok) {
      setErr(v.error);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      if (isEmail) {
        const res = await sendVerificationEmail(v.canonical);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
      } else {
        const res = await sendMobileVerifyOtp(v.canonical);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        if (env.authOtpChannel === 'widget') {
          try {
            await widget.retryOtp();
          } catch {
            setErr('Could not resend the code.');
            return;
          }
        }
      }
      setOtp('');
      setCooldown(30);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify() {
    if (otp.length !== 6) {
      setErr('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const v = validateIdentifier(identifier);
      const canonical = v.ok ? v.canonical : identifier;
      if (isEmail) {
        const res = await verifyEmail(otp, canonical);
        if (!res.ok) {
          setErr(res.error);
          setOtp('');
          return;
        }
      } else {
        let accessToken: string | undefined;
        if (env.authOtpChannel === 'widget') {
          try {
            const data = (await widget.verifyOtp(otp)) as { message?: string };
            accessToken = data?.message;
          } catch {
            setErr('Could not verify the code.');
            setOtp('');
            return;
          }
        }
        const res = await verifyMobile(accessToken ? { accessToken } : { otp });
        if (!res.ok) {
          setErr(res.error);
          setOtp('');
          return;
        }
      }
      onVerified(canonical);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const titleIcon = isEmail ? <MailOutlined /> : <MobileOutlined />;
  const title = (
    <span className="flex items-center gap-2">
      {titleIcon}
      {isEmail
        ? currentValue
          ? 'Verify your email'
          : 'Add and verify your email'
        : currentValue
          ? 'Verify your mobile'
          : 'Add and verify your mobile'}
    </span>
  );

  return (
    <Modal
      open={open}
      onCancel={busy ? undefined : onClose}
      title={title}
      footer={null}
      destroyOnHidden
      mask={{ closable: !busy }}
    >
      {step === 'enter' && (
        <div className="flex flex-col gap-4">
          {err && <Alert type="error" title={err} showIcon />}
          <Form layout="vertical">
            <Form.Item label={isEmail ? 'Email address' : 'Mobile number'} required>
              <Input
                size="large"
                prefix={titleIcon}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isEmail ? 'you@example.com' : '10-digit Indian mobile number'}
                disabled={busy || (!!currentValue && !!isLocked)}
                readOnly={!!currentValue && !!isLocked}
                autoComplete={isEmail ? 'email' : 'tel'}
              />
            </Form.Item>
          </Form>
          <Button type="primary" size="large" block loading={busy} onClick={handleSend}>
            {isEmail ? 'Send verification code' : 'Send OTP'}
          </Button>
          <Typography.Text type="secondary" className="text-xs">
            {isEmail
              ? "We'll email you a 6-digit code valid for 15 minutes."
              : "We'll text you a 6-digit code valid for 5 minutes."}
          </Typography.Text>
        </div>
      )}

      {step === 'otp' && (
        <div className="flex flex-col gap-4">
          {err && <Alert type="error" title={err} showIcon />}
          <Typography.Text>
            {isEmail ? 'Code sent to ' : 'OTP sent to '}
            <strong>{identifier}</strong>
          </Typography.Text>
          <OtpInput
            ref={otpRef}
            value={otp}
            onChange={setOtp}
            onComplete={() => void handleVerify()}
            disabled={busy}
            hasError={!!err}
            autoFocus
            ariaLabel={isEmail ? 'Email verification code' : 'Mobile OTP'}
          />
          <Button
            type="primary"
            size="large"
            block
            loading={busy}
            disabled={otp.length !== 6}
            onClick={handleVerify}
          >
            Verify
          </Button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              className="text-primary disabled:text-muted"
              disabled={cooldown > 0 || busy}
              onClick={handleResend}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button
              type="button"
              className="text-muted hover:text-heading"
              disabled={busy}
              onClick={() => {
                setStep('enter');
                setOtp('');
                setErr(null);
              }}
            >
              {currentValue ? 'Cancel' : 'Change ' + (isEmail ? 'email' : 'mobile')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
