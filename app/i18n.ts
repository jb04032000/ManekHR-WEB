import { getRequestConfig } from 'next-intl/server';
// SUPPORTED_LOCALES lives in lib/locales.ts (the framework-agnostic source of
// truth shared with the client language switchers). Re-exported here so existing
// server imports keep working.
import { LOCALE_COOKIE, SUPPORTED_LOCALES, type SupportedLocale } from '@/lib/locales';
import en from './messages/en.json';
import guEn from './messages/gu-en.json';
import gu from './messages/gu.json';
import hiEn from './messages/hi-en.json';

const messagesMap: Record<string, object> = {
  en,
  'gu-en': guEn,
  gu,
  'hi-en': hiEn,
};

export { SUPPORTED_LOCALES };
export type { SupportedLocale };

export const localeDirectionMap: Record<SupportedLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  gu: 'ltr',
  'gu-en': 'ltr',
  'hi-en': 'ltr',
};

export const LOCALE_DIRECTION = localeDirectionMap;

export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  return localeDirectionMap[locale as SupportedLocale] || 'ltr';
}

export default getRequestConfig(async ({ requestLocale }) => {
  // Dual-source locale (the heart of the public/app split):
  //  - PUBLIC marketing routes live under `app/[locale]/**` and feed the locale
  //    via the URL segment, surfaced here as `requestLocale`. They never read the
  //    cookie, so they stay STATICALLY pre-renderable (the whole point of the
  //    locale-routing migration). See `i18n/routing.ts` + `proxy.ts`.
  //  - The cookie-based AUTHENTICATED app (`/dashboard`, `/connect`, `/auth`,
  //    `/account`, ...) has no `[locale]` segment, so `requestLocale` is
  //    undefined; we fall back to the `z360_locale` cookie. Reading cookies()
  //    here taints ONLY those routes as dynamic (intended) - it is deliberately
  //    NOT read on the marketing path above.
  let locale = await requestLocale;
  if (!locale) {
    const cookieStore = await import('next/headers').then((m) => m.cookies());
    locale = cookieStore.get(LOCALE_COOKIE)?.value;
  }
  const safeLocale =
    locale && (SUPPORTED_LOCALES as readonly string[]).includes(locale) ? locale : 'en';

  return {
    locale: safeLocale,
    messages: messagesMap[safeLocale],
    // Per-request reference time for `format.relativeTime(...)` / `useNow()`.
    // Without it, next-intl falls back to the live clock and logs an
    // ENVIRONMENT_FALLBACK warning (and risks an SSR/CSR hydration mismatch).
    // A single stable value per request fixes both - relative labels refresh
    // on the next navigation.
    now: new Date(),
  };
});
