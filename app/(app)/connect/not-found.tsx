import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * Connect 404. Catches `notFound()` thrown by any `/connect/*` page (missing
 * post/job/listing/user/store/company, etc.) AND the unmatched-URL catch-all
 * at `app/connect/[...notFound]/page.tsx`. Renders inside the Connect shell
 * (`app/connect/layout.tsx`), so the user keeps the nav.
 *
 * Why it exists: without a Connect-scoped not-found, Next falls back to the
 * global ERP 404 (`app/not-found.tsx`) whose primary CTA is "Go to Dashboard"
 * -> `/dashboard` (the ERP dashboard). Inside Connect the home IS the feed, so
 * the primary CTA points at `/connect/feed` instead. Keep the feed path in sync
 * with the layout's auth redirect (app/connect/layout.tsx).
 */
export default async function ConnectNotFound() {
  const t = await getTranslations('connectMode');

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-lg py-16 text-center">
      <div className="mx-auto mb-lg flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--cr-grad-primary)] text-4xl">
        🔍
      </div>
      <h1 className="mb-2 font-display text-7xl leading-none font-extrabold text-border">404</h1>
      <h2 className="mb-3 font-display text-2xl font-bold text-heading">{t('notFoundTitle')}</h2>
      <p
        className="mx-auto mb-xl text-[15px] leading-relaxed text-muted"
        style={{ maxWidth: '360px' }}
      >
        {t('notFoundBody')}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        {/* Inline white color: the global `a { color: var(--cr-primary) }` rule
            painted this label navy-on-navy (invisible); inline style overrides it. */}
        <Link
          href="/connect/feed"
          className="inline-flex items-center gap-sm rounded-lg bg-primary px-lg py-3 text-sm font-semibold no-underline"
          style={{ color: 'var(--cr-surface)' }}
        >
          {t('notFoundFeedCta')}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-sm rounded-lg border-[1.5px] border-border bg-surface px-lg py-3 text-sm font-semibold text-body no-underline"
        >
          {t('notFoundHomeCta')}
        </Link>
      </div>
    </div>
  );
}
