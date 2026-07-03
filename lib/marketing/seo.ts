import { routing } from '@/i18n/routing';

/**
 * Per-locale canonical + hreflang alternates for a public marketing page.
 *
 * What it does: builds the Next `Metadata['alternates']` shape so each locale of
 * a page is self-canonical and cross-links to its siblings via hreflang - the
 * signal that lets Google index `/gu`, `/gu-en`, `/hi-en` as distinct language
 * versions instead of treating them as duplicates of the English URL.
 *
 * `path` is the UNPREFIXED pathname (e.g. '/pricing', '/'). With localePrefix
 * 'as-needed', `en` stays at the bare path and the others get a `/<locale>`
 * prefix - so URLs already live at `/` never change. `x-default` points at the
 * default (en) URL.
 *
 * Cross-module links: locale list + default come from `i18n/routing.ts`. URLs are
 * relative; they resolve against `metadataBase` (set in `app/layout.tsx`).
 */
export function marketingAlternates(path: string, locale: string) {
  const url = (loc: string) => {
    const prefix = loc === routing.defaultLocale ? '' : `/${loc}`;
    if (path === '/') return prefix || '/';
    return `${prefix}${path}`;
  };
  const languages: Record<string, string> = {};
  for (const loc of routing.locales) languages[loc] = url(loc);
  languages['x-default'] = url(routing.defaultLocale);
  return { canonical: url(locale), languages };
}
