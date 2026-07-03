import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { getLocaleDirection } from '../i18n';
import { HtmlLangSync } from '@/components/HtmlLangSync';

/**
 * Locale segment for the PUBLIC marketing pages (`app/[locale]/(marketing)/**`).
 *
 * What it does: makes the marketing surface statically pre-renderable per locale.
 *  - `generateStaticParams` emits the 4 locales so Next builds one static copy each.
 *  - `setRequestLocale(locale)` feeds the URL locale into next-intl's request cache
 *    so child pages/layouts can call getTranslations() WITHOUT reading cookies
 *    (the dynamic taint we are removing). Must run before any i18n call below.
 *  - re-wraps children in a locale-correct NextIntlClientProvider (the global root
 *    in `app/layout.tsx` only provides a static `en` base).
 *
 * Cross-module links: locale set from `i18n/routing.ts`; the composed next-intl
 * middleware in `proxy.ts` rewrites `/pricing` -> `/en/pricing` etc. so `en` stays
 * at `/`. With `localePrefix: 'as-needed'`, only `gu`/`gu-en`/`hi-en` get a prefix.
 *
 * Watch: an unknown first segment that is not a locale (and not a concrete route)
 * lands here and 404s via notFound() - same as before the migration.
 */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!(routing.locales as readonly string[]).includes(locale)) {
    notFound();
  }
  setRequestLocale(locale);
  // Marketing pages render their hero/meta copy SERVER-SIDE via getTranslations,
  // so the client provider only needs the handful of `marketing.*` sub-trees that
  // the CLIENT components actually read with useTranslations:
  //   Navbar -> marketing.nav, MobileStickyCta -> marketing.stickyCta,
  //   layout skip-link -> marketing.a11y, ContactForm -> marketing.pages.contact.form,
  //   ErpPricingTable -> marketing.pages.erpPricing.
  // Shipping the full `marketing` namespace (~55KB) inlined it into every
  // prerendered page x4 locales; this 4KB pick keeps ~15MB out of the Amplify
  // build output. Passing the whole catalog blew it to 746MB before that.
  // Watch: if a marketing client component starts reading another marketing
  // sub-key, add it here or its useTranslations() will throw MISSING_MESSAGE at
  // build (prerender). Server components are unaffected - they use getTranslations.
  const m = (await getMessages()).marketing as Record<string, any>;
  const messages = {
    marketing: {
      nav: m.nav,
      a11y: m.a11y,
      stickyCta: m.stickyCta,
      pages: {
        contact: { form: m.pages?.contact?.form },
        erpPricing: m.pages?.erpPricing,
      },
    },
  };

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {/* The static root renders <html lang="en"> so marketing can prerender;
          this corrects <html lang>/<dir> to the URL locale on the client for
          screen readers. Crawlers rely on the per-locale hreflang + canonical
          (emitted in each page's metadata), not this. */}
      <HtmlLangSync locale={locale} dir={getLocaleDirection(locale)} />
      {children}
    </NextIntlClientProvider>
  );
}
