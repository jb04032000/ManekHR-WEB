import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

// Offline fallback shown by the service worker (public/sw.js) when a page
// navigation fails with no network. Precached at SW install so it is available
// with zero connectivity, and added to PUBLIC_PATHS in proxy.ts so it renders
// logged-out. Server-rendered + JS-free on purpose: the worker serves a cached
// HTML snapshot, so the "try again" control is a plain link (no hydration
// needed). Locale note: the snapshot is captured in whatever locale was active
// when the worker precached it; acceptable for a rare fallback screen.
// Watch: keep the page background / brand color in sync with app/manifest.ts.
export const metadata: Metadata = {
  title: 'Offline',
  robots: { index: false, follow: false },
};

export default async function OfflinePage() {
  const t = await getTranslations('pwa.offline');

  return (
    <main className="flex min-h-screen items-center justify-center bg-page p-lg">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-xl text-center shadow-card">
        <div className="mx-auto mb-lg flex h-16 w-16 items-center justify-center rounded-full bg-primary-light text-primary">
          {/* Inline wifi-off glyph: no icon-library chunk to load, so it shows offline. */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M1 1l22 22" />
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </div>
        <h1 className="mb-sm text-2xl font-semibold text-heading">{t('title')}</h1>
        <p className="mb-lg text-body">{t('body')}</p>
        {/* next/link renders a plain <a href="/"> that works with no JS, so a
            fresh GET to "/" lets the worker serve the live app the moment the
            network returns. prefetch off: pointless on an offline screen. */}
        <Link
          href="/"
          prefetch={false}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-lg py-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          {t('retry')}
        </Link>
      </div>
    </main>
  );
}
