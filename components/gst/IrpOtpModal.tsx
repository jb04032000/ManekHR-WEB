'use client';

import React, { startTransition, useEffect, useRef, useState } from 'react';
import { Alert, Modal } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { DsInput } from '@/components/ui/DsInput';

interface IrpOtpModalProps {
  open: boolean;
  sessionId: string;
  mobileLast4?: string;
  wsId: string;
  firmId: string;
  onSuccess: () => void;
  onClose: () => void;
  /** WR-07: called with the new sessionId when OTP is resent so parent can update state. */
  onResendSuccess?: (newSessionId: string) => void;
}

const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const RESEND_COOLDOWN_SECONDS = 60;

export default function IrpOtpModal({
  open,
  sessionId,
  mobileLast4,
  wsId,
  firmId,
  onSuccess,
  onClose,
  onResendSuccess,
}: IrpOtpModalProps) {
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockMinutes, setLockMinutes] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(OTP_EXPIRY_SECONDS);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  const expiryRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start countdown timers when modal opens
  useEffect(() => {
    if (!open) return;

    startTransition(() => {
      setOtp('');
      setError(null);
      setLocked(false);
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
    });

    expiryRef.current = setInterval(() => {
      setExpirySeconds((s) => Math.max(0, s - 1));
    }, 1000);

    resendRef.current = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) {
          clearInterval(resendRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      if (expiryRef.current) clearInterval(expiryRef.current);
      if (resendRef.current) clearInterval(resendRef.current);
    };
  }, [open]);

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      // Dynamic import to avoid server-action import issues in client component
      const { completeIrpSession } = await import('@/lib/actions/finance/gst.actions');
      const result = await completeIrpSession(wsId, firmId, sessionId, otp);

      if (result.sessionReady) {
        onSuccess();
        return;
      }
      if (result.locked) {
        setLocked(true);
        setLockMinutes(result.minutesRemaining ?? 30);
        return;
      }
      if (result.otpFailed) {
        const left = result.attemptsLeft ?? 0;
        setError(`Incorrect OTP. ${left} attempt${left !== 1 ? 's' : ''} left.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Verification failed. Please try again.';
      setError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setResending(true);
    setError(null);
    try {
      const { prepareIrpSession } = await import('@/lib/actions/finance/gst.actions');
      const result = await prepareIrpSession(wsId, firmId);
      // WR-07: propagate the new sessionId to the parent so subsequent OTP verification
      // uses the correct session. Without this, completeIrpSession would use the stale
      // sessionId from before the resend, causing all verifications to return otpFailed.
      if (result?.sessionId && onResendSuccess) {
        onResendSuccess(result.sessionId);
      }
      // Reset expiry + cooldown timers
      setExpirySeconds(OTP_EXPIRY_SECONDS);
      setResendCooldown(RESEND_COOLDOWN_SECONDS);
      resendRef.current = setInterval(() => {
        setResendCooldown((s) => {
          if (s <= 1) {
            clearInterval(resendRef.current!);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch {
      setError('Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const expiryColor = expirySeconds < 30 ? 'var(--cr-error)' : 'var(--cr-text-3)';

  return (
    <Modal
      open={open}
      title="IRP Authentication Required"
      onCancel={onClose}
      footer={null}
      centered
      width={420}
    >
      <div className="flex flex-col gap-4 py-2">
        <p className="font-body text-[14px]" style={{ color: 'var(--cr-text-2)' }}>
          Enter the OTP sent to your registered mobile number
          {mobileLast4 ? (
            <>
              {' '}
              ending in <span className="font-mono">&bull;&bull;&bull;{mobileLast4}</span>.
            </>
          ) : (
            '.'
          )}
        </p>

        {/* OTP Input */}
        <div className="flex justify-center">
          <DsInput
            value={otp}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '').slice(0, 6);
              setOtp(val);
            }}
            placeholder="------"
            maxLength={6}
            disabled={locked || verifying}
            style={{
              width: 200,
              height: 48,
              textAlign: 'center',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 24,
              letterSpacing: 8,
            }}
            onPressEnter={handleVerify}
          />
        </div>

        {/* OTP expiry countdown */}
        <p className="text-center font-body text-[13px]" style={{ color: expiryColor }}>
          OTP expires in {expirySeconds}s
        </p>

        {/* Error message */}
        {error && !locked && (
          <p className="text-center font-body text-[13px]" style={{ color: 'var(--cr-error)' }}>
            {error}
          </p>
        )}

        {/* Lock state */}
        {locked && (
          <Alert
            type="error"
            title={`Too many attempts. Try again in ${lockMinutes} minute${lockMinutes !== 1 ? 's' : ''}.`}
            showIcon
          />
        )}

        {/* Verify button */}
        <DsButton
          dsVariant="primary"
          dsSize="md"
          onClick={handleVerify}
          loading={verifying}
          disabled={locked || otp.length !== 6}
          style={{ width: '100%' }}
        >
          Verify OTP
        </DsButton>

        {/* Resend OTP */}
        <div className="text-center">
          {resendCooldown > 0 ? (
            <span className="font-body text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="cursor-pointer font-body text-[13px] underline"
              style={{ color: 'var(--cr-primary)', background: 'none', border: 'none', padding: 0 }}
            >
              {resending ? 'Sending…' : 'Resend OTP'}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
