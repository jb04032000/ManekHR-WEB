import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

/**
 * BoostLoadError - shared error panel shown by the boost route pages when a
 * REQUIRED server read fails (a transient outage / auth blip), as opposed to a
 * target that is genuinely missing or ineligible. This keeps an outage from
 * masquerading as a silent redirect ("your listing vanished") and gives the
 * user a real retry.
 *
 * Server Component (no 'use client'): rendered directly by
 * app/connect/boost/{listing,job,post}/[id]/page.tsx. `retryHref` points back at
 * the same route and uses a plain <a> (a full reload re-runs the server fetch,
 * which a soft <Link> to the current URL would not); `backHref` is the module
 * hub fallback. Copy lives in connect.boosts.loadError (4 locales).
 */
export default async function BoostLoadError({
  retryHref,
  backHref,
}: {
  retryHref: string;
  backHref: string;
}) {
  const t = await getTranslations('connect.boosts.loadError');
  return (
    <main
      className="w-full"
      style={{ maxWidth: 480, margin: '0 auto', padding: '48px 16px', textAlign: 'center' }}
    >
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: 'var(--cr-text)' }}>
        {t('title')}
      </h1>
      <p style={{ margin: '8px 0 20px', fontSize: 14, color: 'var(--cr-text-4)' }}>{t('body')}</p>
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap' }}>
        {/* Plain anchor: a full navigation re-runs the server read (a true retry). */}
        <a
          href={retryHref}
          style={{ color: 'var(--cr-primary)', fontWeight: 700, textDecoration: 'underline' }}
        >
          {t('retry')}
        </a>
        <Link
          href={backHref}
          style={{ color: 'var(--cr-text-3)', fontWeight: 700, textDecoration: 'underline' }}
        >
          {t('back')}
        </Link>
      </div>
    </main>
  );
}
