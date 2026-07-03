import { defineRouting } from 'next-intl/routing';
import { SUPPORTED_LOCALES } from '@/lib/locales';

/**
 * next-intl routing config for the PUBLIC marketing surface only.
 *
 * What it does: declares the 4 site locales and how they map to URLs so the
 * marketing pages can be statically pre-rendered per locale and gain
 * multilingual SEO. Consumed by `i18n/navigation.ts` (locale-aware Link/router),
 * by `proxy.ts` (the composed next-intl middleware that redirects/rewrites
 * locale prefixes), and by `app/[locale]/layout.tsx` (generateStaticParams).
 *
 * Cross-module links:
 *  - locales come from `lib/locales.ts` (the single source of truth shared with
 *    the client language switchers and `app/i18n.ts`). Keep in sync there.
 *  - `proxy.ts` only runs this middleware for marketing paths; the authenticated
 *    app stays cookie-based via `app/i18n.ts` fallback.
 *
 * Watch / invariants:
 *  - `localePrefix: 'as-needed'` keeps `en` at `/` (no `/en`), so every
 *    currently-live English URL + canonical is unchanged; only `/gu`, `/gu-en`,
 *    `/hi-en` are added.
 *  - `localeDetection: false` => the canonical `/` deterministically serves `en`
 *    for crawlers and users (no accept-language / cookie redirect on the live
 *    English URL). Language is changed explicitly via the switcher. Flip to
 *    `true` only if you want first-visit auto-redirect by cookie/header.
 *  - `localeCookie: false` => next-intl does PURE url routing and never writes
 *    its own NEXT_LOCALE cookie. We own `z360_locale` (written by the switchers
 *    in `lib/locales.ts` / `components/marketing/LanguageMenu.tsx`) so the
 *    cookie-based app side stays the single cookie source of truth.
 */
export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
  localeDetection: false,
  localeCookie: false,
});
