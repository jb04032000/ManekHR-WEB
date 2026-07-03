import type { ReactNode } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Footer } from '@/components/marketing/Footer';
import SampleContentNote from '@/components/connect/SampleContentNote';

/**
 * Public layout for shareable, SEO-indexable Connect pages - company pages,
 * storefronts, public profiles, product + job detail (route map: the
 * `(connect-public)` group). Light chrome - NOT the authenticated Connect app
 * shell. Works logged-out with an "Open Connect" CTA; SSR / ISR.
 *
 * Entity pages (`/u/[userId]`, `/company/[slug]`, `/store/[slug]`,
 * `/products/[id]`, `/jobs/[id]`) are added under this group from Phase 1
 * onward. A sitemap is added in Phase 1 once the first entity route ships.
 */

export default async function ConnectPublicLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations('connect.shell');

  return (
    <div className="flex min-h-[100dvh] flex-col bg-page">
      <header className="flex h-16 items-center justify-between border-b border-border-light bg-surface px-4 md:px-8">
        <Link href="/" className="flex items-center gap-2 no-underline" aria-label="ManekHR">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG brand mark */}
          <img
            src="/manekhr-symbol.svg"
            alt=""
            aria-hidden
            width={36}
            height={36}
            className="h-9 w-9"
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG wordmark */}
          <img
            src="/manekhr-wordmark-on-light.svg"
            alt="ManekHR"
            className="hidden h-5 w-auto sm:block"
          />
        </Link>
        <Link
          href="/connect"
          className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white no-underline transition-colors hover:bg-primary-hover"
        >
          {t('openConnect')}
        </Link>
      </header>

      <main className="flex-1">{children}</main>

      <div className="mx-auto w-full max-w-3xl px-4">
        <SampleContentNote />
      </div>
      <Footer />
    </div>
  );
}
