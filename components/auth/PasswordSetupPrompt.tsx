'use client';

import { useEffect, useState } from 'react';
import { Alert, Button } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { getProfile } from '@/lib/actions';

const DISMISS_KEY = 'z360_password_setup_dismissed_at';
const RESHOW_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Dashboard-level passive nudge shown to users whose only sign-in method is
 * mobile OTP. Recommends adding a password so SMS rate-limits, deliverability
 * issues, or a number change don't lock the user out. Dismissible - re-shows
 * after 7 days unless the user has set a password by then.
 *
 * Hides itself entirely when:
 *   - user already has a password (hasPassword === true)
 *   - the user dismissed it within RESHOW_AFTER_MS
 *
 * Reads / writes localStorage directly (single-tab dismissal is sufficient).
 */
export function PasswordSetupPrompt() {
  const t = useTranslations('auth.passwordSetupPrompt');
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  // Gates the banner until the server status is confirmed, so it never flashes
  // for someone who already has a password (the store value may be a stale
  // `false`). Only relevant on the no-password path.
  const [statusChecked, setStatusChecked] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDismissed(false);
      return;
    }
    const dismissedAt = Number(raw);
    if (Number.isNaN(dismissedAt)) {
      setDismissed(false);
      return;
    }

    setDismissed(Date.now() - dismissedAt < RESHOW_AFTER_MS);
  }, []);

  // Reconcile `hasPassword` against the server before nagging. The store value
  // can be a stale `false` (password added in another session / on another
  // device / before an in-session patch landed) and nothing else refreshes it.
  // The server reads it from the real `passwordHash`. Runs only on the
  // no-password path; the `statusChecked` guard prevents a re-fetch loop.
  useEffect(() => {
    if (!isHydrated || !user || user.hasPassword || statusChecked) return;
    let cancelled = false;
    void getProfile()
      .then((fresh) => {
        if (!cancelled && fresh.hasPassword) updateUser({ hasPassword: true });
      })
      .catch(() => {
        // A failed check must not block the nudge; fall through and show it.
      })
      .finally(() => {
        if (!cancelled) setStatusChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isHydrated, user, updateUser, statusChecked]);

  const handleDismiss = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDismissed(true);
  };

  if (!isHydrated || !user) return null;
  if (user.hasPassword) return null;
  // Still confirming with the server whether a password exists - don't flash
  // the nag (it would briefly show for users who actually have one).
  if (!statusChecked) return null;
  if (dismissed === null || dismissed) return null;

  return (
    <Alert
      type="info"
      showIcon
      icon={<LockOutlined />}
      className="rounded-[10px]"
      // Inline margin: a plain `mb-*` utility loses specificity to AntD's
      // Alert root styles, so the banner rendered flush against the content.
      style={{ marginBottom: 20 }}
      title={t('title')}
      // The CTA lives INSIDE the content (below the description) rather than in
      // AntD's `action` slot, which pins the button to the message's right edge
      // and squeezed the title into a cramped 2-3 line wrap on mobile. Here it
      // flows under the text: full-width on mobile (native-app feel + bigger tap
      // target), auto-width on sm+ so desktop stays compact.
      description={
        <>
          <p className="m-0">{t('description')}</p>
          <Link
            href="/account/security#password"
            className="mt-3 block w-full no-underline sm:inline-block sm:w-auto"
          >
            <Button type="primary" className="w-full sm:w-auto">
              {t('cta')}
            </Button>
          </Link>
        </>
      }
      closable={{ onClose: handleDismiss }}
    />
  );
}
