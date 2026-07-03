'use client';

/**
 * ConnectNudge - compact sidebar card inviting ERP users to explore Connect.
 *
 * Rendered near the bottom of the ERP sidebar. Self-hides unless ALL hold:
 *   1. Connect is enabled for the user, AND they have NOT onboarded into
 *      Connect - a user already on Connect is never nudged to "explore" it.
 *   2. The user has NOT accepted the Connect policy. A user who has clicked
 *      through the Connect T&C gate (and so passed through `/connect/*` at
 *      least once) is by definition aware of Connect; pitching them to
 *      "explore" it on every ERP visit reads as broken cross-sell. This is
 *      what catches the "I came from Connect a second ago, why is ERP
 *      nudging me to it" case - `policyAccepted=true` is the cheap proxy
 *      for "has engaged with Connect at least once".
 *   3. The `connect_explore` hint is not in `user.dismissedHints`.
 *
 * Dismissal is persisted on the backend (`User.dismissedHints`) so it survives
 * sign-out and follows the user across devices. Renders `null` until the auth
 * store has rehydrated and the Connect entry-state has loaded.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { getConnectEntryState } from '@/features/connect/profile.actions';
import { dismissHint } from '@/features/connect/hints.actions';

export default function ConnectNudge() {
  const t = useTranslations('connect');
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);
  /**
   * `null` until the Connect entry-state fetch resolves; then `true` only when
   * Connect is enabled AND the user has not onboarded AND the user has not
   * yet accepted the Connect policy - i.e. the nudge is worth showing because
   * the user has had zero Connect engagement so far.
   */
  const [eligible, setEligible] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    getConnectEntryState().then((res) => {
      if (cancelled) return;
      setEligible(
        res.ok && res.data.connectEnabled && !res.data.onboarded && !res.data.policyAccepted,
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!isHydrated) return null;
  if (eligible === null) return null;
  if (!eligible) return null;
  if (user?.dismissedHints?.includes('connect_explore')) return null;

  function handleDismiss() {
    updateUser({ dismissedHints: [...(user?.dismissedHints ?? []), 'connect_explore'] });
    void dismissHint('connect_explore');
  }

  return (
    <div
      role="region"
      aria-label={t('crossSell.nudgeTitle')}
      style={{
        background: 'var(--cr-primary-light)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-md)',
        padding: '10px 12px',
        margin: '0 8px 8px',
      }}
    >
      {/* Header row: title + dismiss */}
      <div className="flex items-start justify-between gap-2">
        <p
          className="m-0 text-[12px] leading-snug font-semibold"
          style={{ color: 'var(--cr-text)' }}
        >
          {t('crossSell.nudgeTitle')}
        </p>
        <button
          type="button"
          aria-label={t('crossSell.dismiss')}
          onClick={handleDismiss}
          className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-60"
          style={{ color: 'var(--cr-text-4)', lineHeight: 1, fontSize: '14px' }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <p className="m-0 mt-1 text-[11px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {t('crossSell.nudgeBody')}
      </p>

      {/* CTA */}
      <Link
        href="/connect/feed"
        className="mt-2 inline-flex items-center rounded px-2.5 py-1 text-[11px] font-semibold no-underline transition-opacity hover:opacity-90"
        style={{
          background: 'var(--cr-primary)',
          color: '#fff',
        }}
      >
        {t('crossSell.nudgeAction')}
      </Link>
    </div>
  );
}
