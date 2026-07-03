import Link from 'next/link';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export const metadata: Metadata = { title: '404 - Page Not Found' };

/**
 * Global 404 for genuinely unmatched URLs across the whole site (Next.js
 * renders THIS, not a nested not-found, for non-matching paths). Kept neutral
 * and public-facing: primary CTA is the marketing home, secondary is Connect.
 * It deliberately does NOT push to the ERP dashboard, because most unmatched
 * URLs come from public / marketing / Connect visitors who may not have ERP
 * access. Area-scoped 404s with their own home CTAs live at
 * `app/dashboard/not-found.tsx` (Go to dashboard) and
 * `app/connect/not-found.tsx` (Go to feed), each reached via that area's
 * catch-all route. Strings reuse the `errorPages` namespace (all four locales).
 */
export default async function NotFound() {
  const t = await getTranslations('errorPages');

  return (
    <div className="flex min-h-screen items-center justify-center bg-page">
      <div className="px-lg text-center">
        <div className="mx-auto mb-lg flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--cr-grad-primary)] text-4xl">
          🔍
        </div>
        <h1 className="mb-2 font-display text-7xl leading-none font-extrabold text-border">404</h1>
        <h2 className="mb-3 font-display text-2xl font-bold text-heading">{t('title')}</h2>
        <p
          className="mx-auto mb-xl text-[15px] leading-relaxed text-muted"
          style={{ maxWidth: '360px' }}
        >
          {t('body')}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {/* Inline white color: the global `a { color: var(--cr-primary) }` link
              rule was painting this button's label navy-on-navy (invisible). The
              `text-surface` utility did not override it; an inline style wins over
              the element rule reliably. */}
          <Link
            href="/"
            className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-3 text-sm font-semibold no-underline"
            style={{ color: 'var(--cr-surface)' }}
          >
            {t('backHome')}
          </Link>
          <Link
            href="/connect"
            className="inline-flex items-center gap-sm rounded-lg border-[1.5px] border-border bg-surface px-lg py-3 text-sm font-semibold text-body no-underline"
          >
            {t('openConnect')}
          </Link>
        </div>
      </div>
    </div>
  );
}
