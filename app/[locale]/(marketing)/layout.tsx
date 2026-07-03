import type { ReactNode } from 'react';
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Footer } from '@/components/marketing/Footer';
import { Navbar } from '@/components/marketing/Navbar';

/**
 * Marketing-site type system - scoped to the public pages so the
 * authenticated app keeps its own all-sans DM Sans type untouched.
 */
const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-mkt-display',
});
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mkt-body',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mkt-mono',
});

/**
 * Shared shell for every public marketing page (home + product/company
 * pages). Supplies the sticky navbar, the footer, and a skip link. The
 * root layout (html/body, providers, base fonts) still wraps this.
 */
export default async function MarketingLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Enable static rendering for the marketing shell: pin the request locale from
  // the URL segment before any next-intl call. See app/[locale]/layout.tsx.
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('marketing.a11y');
  return (
    <div
      className={`mkt-root ${newsreader.variable} ${inter.variable} ${jetbrainsMono.variable} flex min-h-dvh flex-col select-none`}
    >
      <a
        href="#main"
        className="mkt-btn mkt-btn--primary sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-4 focus:z-[60]"
      >
        {t('skipToContent')}
      </a>
      <Navbar />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
