import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * The `/connect` state for a user without `connectEnabled` - Connect is a
 * flag-gated closed beta. An honest "coming soon" panel, never a 404 or a
 * redirect (the smart-entry server component renders this branch directly).
 */
export default async function ConnectComingSoon() {
  const t = await getTranslations('connectMode');

  return (
    <div className="flex min-h-screen items-center justify-center py-10">
      <div className="mx-auto max-w-[560px] text-center">
        <span
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl"
          style={{ background: 'var(--cr-primary-light)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
          <img src="/manekhr-symbol.svg" alt="" aria-hidden className="h-11 w-11" />
        </span>
        <span
          className="inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold tracking-wide uppercase"
          style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
        >
          {t('homeBadge')}
        </span>
        <h1 className="mt-4 font-display text-[clamp(1.55rem,1rem+1.9vw,2.25rem)] font-semibold text-heading">
          {t('homeTitle')}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">{t('homeBody')}</p>
        {/* Always offer a way out: the layout renders this WITHOUT the nav
            chrome, so without this link a not-enabled user is stranded with
            nothing to click. The dashboard is the user's ERP home. */}
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-[14px] font-semibold text-white no-underline transition-opacity hover:opacity-90"
          style={{ background: 'var(--cr-primary)' }}
        >
          {t('homeCta')}
        </Link>
      </div>
    </div>
  );
}
