import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * ERP 404. Catches `notFound()` thrown by any `/dashboard/*` page AND the
 * unmatched-URL catch-all at `app/dashboard/[...notFound]/page.tsx`. Renders
 * inside the ERP shell (`app/dashboard/layout.tsx`), so the user keeps the nav.
 *
 * Why it exists: the global `app/not-found.tsx` is now a neutral public-facing
 * 404 (Home + Connect) that deliberately drops the ERP dashboard CTA. ERP users
 * deep inside `/dashboard` still want a dashboard-first 404, so the primary CTA
 * here points at `/dashboard`. Mirrors `app/connect/not-found.tsx` (whose CTA is
 * the Connect feed). Keep the dashboard path in sync with the layout's entry
 * handling (app/dashboard/layout.tsx).
 */
export default async function DashboardNotFound() {
  const t = await getTranslations('errorPages');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-lg py-16 text-center">
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
        {/* Inline white color: the global `a { color: var(--cr-primary) }` rule
            painted this label navy-on-navy (invisible); inline style overrides it. */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-3 text-sm font-semibold no-underline"
          style={{ color: 'var(--cr-surface)' }}
        >
          {t('goToDashboard')}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-sm rounded-lg border-[1.5px] border-border bg-surface px-lg py-3 text-sm font-semibold text-body no-underline"
        >
          {t('backHome')}
        </Link>
      </div>
    </div>
  );
}
