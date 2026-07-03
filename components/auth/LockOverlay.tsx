'use client';

import { useCallback, useRef, useState } from 'react';
import { Button, Alert } from 'antd';
import {
  LockOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LoadingOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { AxiosError } from 'axios';
import { pinApi } from '@/lib/api/modules';
import { useAuthStore } from '@/lib/store';
import { useLogout } from '@/hooks/useLogout';
import { PinInput, type PinInputHandle } from './PinInput';
import { ForgotPinModal } from './ForgotPinModal';

interface LockOverlayProps {
  open: boolean;
  /**
   * Optional - invoked after a successful unlock (PIN verify or forgot-PIN
   * reset). Lets a caller refresh server-rendered content once the session is
   * unlocked (used by the Connect smart-entry's App-Locked branch).
   */
  onUnlocked?: () => void;
}

/**
 * Full-viewport App Lock screen. Sits above DashboardLayout when the auth
 * store reports `isAppLocked === true`. Underlying app content stays mounted
 * but rendered behind a backdrop blur so the user knows they are inside the
 * app, not signed out.
 */
export function LockOverlay({ open, onUnlocked }: LockOverlayProps) {
  const t = useTranslations('auth.appLock');
  const user = useAuthStore((s) => s.user);
  const setAppLocked = useAuthStore((s) => s.setAppLocked);

  const [pin, setPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [reveal, setReveal] = useState(false);
  const inputRef = useRef<PinInputHandle | null>(null);

  const lockoutForgotRequired = errorCode === 'PIN_LOCKOUT_FORGOT_REQUIRED';

  const handleComplete = useCallback(
    async (entered: string) => {
      if (submitting || lockoutForgotRequired) return;
      setSubmitting(true);
      setErrorCode(null);
      try {
        const res = await pinApi.verify(entered);
        setAppLocked(false, res.unlockExpiresAt);
        setPin('');
        setAttemptsRemaining(null);
        onUnlocked?.();
      } catch (err) {
        const ax = err as AxiosError<{
          code?: string;
          attemptsRemaining?: number;
          reason?: string;
        }>;
        const data = ax.response?.data;
        const code = data?.code ?? 'PIN_INCORRECT';
        setErrorCode(code);
        if (typeof data?.attemptsRemaining === 'number') {
          setAttemptsRemaining(data.attemptsRemaining);
        }
        setPin('');
        // Refocus the first box for the next try.
        setTimeout(() => inputRef.current?.focus(), 0);
      } finally {
        setSubmitting(false);
      }
    },
    [setAppLocked, submitting, lockoutForgotRequired, onUnlocked],
  );

  // Forgot-PIN / sign-out from the lock screen runs the shared teardown so it
  // behaves exactly like the header logout (revoke session, clear auth state,
  // hard-reload to /auth) instead of blindly wiping ALL of localStorage. See
  // hooks/useLogout.ts.
  const handleSignOut = useLogout();

  const handleForgotSuccess = useCallback(
    (unlockExpiresAt: string) => {
      setForgotOpen(false);
      setErrorCode(null);
      setAttemptsRemaining(null);
      setPin('');
      setAppLocked(false, unlockExpiresAt);
      onUnlocked?.();
    },
    [setAppLocked, onUnlocked],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-page/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-lock-title"
    >
      <div className="w-[min(420px,calc(100vw-32px))] rounded-xl border border-border-light bg-surface px-6 py-7 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary">
            <LockOutlined />
          </span>
          <div className="min-w-0">
            <h2 id="app-lock-title" className="m-0 text-base font-semibold text-heading">
              {t('lockOverlay.title')}
            </h2>
            {user?.name && <p className="m-0 truncate text-sm text-muted">{user.name}</p>}
          </div>
        </div>

        <p className="mb-4 text-sm text-muted">{t('lockOverlay.subtitle')}</p>

        <div className="mb-2">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium tracking-wide text-muted uppercase">
              {t('lockOverlay.pinLabel')}
            </label>
            <button
              type="button"
              onClick={() => setReveal((r) => !r)}
              className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-heading"
              aria-label={reveal ? t('common.hidePinAria') : t('common.showPinAria')}
              aria-pressed={reveal}
            >
              {reveal ? <EyeInvisibleOutlined /> : <EyeOutlined />}
              <span>{reveal ? t('common.hidePin') : t('common.showPin')}</span>
            </button>
          </div>
          <PinInput
            ref={inputRef}
            value={pin}
            onChange={setPin}
            onComplete={handleComplete}
            disabled={submitting || lockoutForgotRequired}
            hasError={!!errorCode}
            autoFocus
            reveal={reveal}
            ariaLabel={t('lockOverlay.pinLabel')}
          />
        </div>

        {submitting && (
          <div
            className="mt-3 flex items-center justify-center gap-2 text-sm text-primary"
            aria-live="polite"
          >
            <LoadingOutlined spin />
            <span>{t('lockOverlay.verifying')}</span>
          </div>
        )}

        {errorCode && !lockoutForgotRequired && (
          <Alert
            type="error"
            showIcon
            className="mt-3"
            title={t('lockOverlay.error.incorrect', {
              count: attemptsRemaining ?? 0,
            })}
          />
        )}

        {lockoutForgotRequired && (
          <Alert
            type="warning"
            showIcon
            className="mt-3"
            title={t('lockOverlay.error.lockedOut')}
          />
        )}

        <div className="mt-5 flex items-center justify-between">
          <Button type="link" className="px-0" onClick={() => setForgotOpen(true)}>
            {t('lockOverlay.forgotLink')}
          </Button>
          <Button type="text" onClick={handleSignOut} disabled={submitting}>
            {t('lockOverlay.signOut')}
          </Button>
        </div>
      </div>

      <ForgotPinModal
        open={forgotOpen}
        onClose={() => setForgotOpen(false)}
        onSuccess={handleForgotSuccess}
      />
    </div>
  );
}
