'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

/**
 * Compact post-/auth marketing rail - brand mark + eyebrow line + trust
 * line. Replaces the full feature-list rail (used pre-account-creation in
 * `AuthClient`) on screens that come AFTER auth success: PIN setup and the
 * PolicyGate. Adds visual continuity so the user does not feel dropped into
 * a stark page after the OTP step.
 *
 * Mobile (< 1024 px) hides the rail entirely - same breakpoint as AuthClient.
 *
 * Design spec: docs/connect/specs/2026-05-20-intent-routed-policy-flow-design.md §3.4.4.
 */
export function AuthCompactRail() {
  const t = useTranslations('auth');

  return (
    <div
      className="auth-hero relative hidden w-[420px] flex-shrink-0 flex-col justify-between overflow-hidden p-10 lg:flex"
      style={{
        background:
          'linear-gradient(160deg,var(--cr-primary) 0%,var(--cr-indigo-400) 60%,var(--cr-text) 100%)',
      }}
    >
      <div className="absolute -top-20 -right-20 h-80 w-80 rounded-full border border-white/[0.12]" />
      <div className="absolute -bottom-15 -left-15 h-65 w-65 rounded-full border border-white/[0.1]" />
      <Link href="/" className="block no-underline" aria-label={t('hero.brand')}>
        {/* Two-color on-dark brand lockup (cream "zari", gold "360") for the dark
            rail. Same asset as the auth hero panel (AuthClient); keep in sync. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/manekhr-horizontal-on-dark.svg" alt={t('hero.brand')} className="h-12 w-auto" />
      </Link>
      <div>
        <p className="mb-3 text-[12px] font-semibold tracking-[0.18em] text-[#C9A227] uppercase">
          {t('hero.eyebrow')}
        </p>
        <p className="text-[15px] leading-relaxed text-white/85">{t('hero.subheading')}</p>
      </div>
      <p className="text-[13px] tracking-wide text-white/70">{t('hero.trustLine')}</p>
    </div>
  );
}
