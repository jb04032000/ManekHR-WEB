'use client';

/**
 * ConnectErpCrossSell - Connect-feed cross-sell card for users whose onboarding
 * intent is `workshop_owner` but who have not yet created an ERP workspace.
 *
 * Self-hides unless ALL three hold:
 *   1. `intent === 'workshop_owner'`
 *   2. `user?.hasWorkspace === false`
 *   3. the `connect_erp_crosssell` hint is not in `user.dismissedHints`
 *
 * Dismissal is persisted on the backend (`User.dismissedHints`) so it survives
 * sign-out and follows the user across devices. Renders `null` until the auth
 * store has rehydrated, to avoid an SSR/hydration mismatch.
 */

import Link from 'next/link';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { dismissHint } from '@/features/connect/hints.actions';
import type { ConnectOnboardingIntent } from '@/features/connect/profile.types';

interface ConnectErpCrossSellProps {
  intent?: ConnectOnboardingIntent | null;
}

export default function ConnectErpCrossSell({ intent }: ConnectErpCrossSellProps) {
  const t = useTranslations('connect');
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const updateUser = useAuthStore((s) => s.updateUser);

  if (!isHydrated) return null;
  if (intent !== 'workshop_owner') return null;
  if (user?.hasWorkspace !== false) return null;
  if (user?.dismissedHints?.includes('connect_erp_crosssell')) return null;

  function handleDismiss() {
    // Optimistic: record the hint in the store so the card hides instantly.
    // The backend write is best-effort - a failed write just means it may
    // reappear on the next sign-in (when the store reloads the server user).
    updateUser({
      dismissedHints: [...(user?.dismissedHints ?? []), 'connect_erp_crosssell'],
    });
    void dismissHint('connect_erp_crosssell');
  }

  return (
    <div
      role="region"
      aria-label={t('crossSell.erpTitle')}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 'var(--cr-space-md)',
      }}
      className="w-full"
    >
      {/* Header row: title + dismiss */}
      <div className="flex items-start justify-between gap-3">
        <h2
          className="m-0 text-[15px] leading-snug font-semibold"
          style={{ color: 'var(--cr-text)' }}
        >
          {t('crossSell.erpTitle')}
        </h2>
        <button
          type="button"
          aria-label={t('crossSell.dismiss')}
          onClick={handleDismiss}
          className="shrink-0 rounded p-0.5 transition-opacity hover:opacity-60"
          style={{ color: 'var(--cr-text-4)', lineHeight: 1 }}
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {/* Body */}
      <p className="m-0 mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {t('crossSell.erpBody')}
      </p>

      {/* CTA */}
      <Link
        href="/auth/setup-workspace"
        className="mt-4 inline-flex items-center justify-center rounded-lg px-4 py-2 text-[13px] font-semibold no-underline transition-opacity hover:opacity-90"
        style={{
          background: 'var(--cr-primary)',
          color: '#fff',
        }}
      >
        {t('crossSell.erpAction')}
      </Link>
    </div>
  );
}
