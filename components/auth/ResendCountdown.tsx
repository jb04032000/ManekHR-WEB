'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { DsButton } from '@/components/ui';

interface ResendCountdownProps {
  /** Seconds the button stays disabled after the most recent send. */
  cooldownSec: number;
  /** Caller invokes this when the user clicks Resend. */
  onResend: () => Promise<void> | void;
  /** Bumped by parent on every successful send to (re)start the countdown. */
  resetKey: number;
  disabled?: boolean;
}

/**
 * Resend-OTP button with an inline countdown. Driven by a `resetKey` that the
 * parent bumps after each successful /auth/send-otp call (or /resend-otp). The
 * button stays disabled with `Resend in NNs` until the cooldown elapses, then
 * flips to `Resend code`. Mirrors the BE per-phone cooldown so the UI never
 * lets the user fire a request the BE will reject.
 */
export function ResendCountdown({
  cooldownSec,
  onResend,
  resetKey,
  disabled,
}: ResendCountdownProps) {
  const t = useTranslations('auth.verifyOtp');
  const [remaining, setRemaining] = useState(cooldownSec);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemaining(cooldownSec);
    if (cooldownSec <= 0) return;
    const tick = window.setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => window.clearInterval(tick);
  }, [cooldownSec, resetKey]);

  const ready = remaining <= 0;
  const handleClick = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onResend();
    } finally {
      setBusy(false);
    }
  };

  return (
    <DsButton
      htmlType="button"
      dsVariant="ghost"
      dsSize="sm"
      disabled={!ready || busy || disabled}
      onClick={handleClick}
      style={{ padding: 0, height: 'auto', border: 'none', fontSize: 13, fontWeight: 500 }}
    >
      {ready ? t('resend.ready') : t('resend.waiting', { seconds: remaining })}
    </DsButton>
  );
}
