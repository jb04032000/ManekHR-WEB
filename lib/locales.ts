/**
 * Single source of truth for the locales the SITE actually ships translations
 * for. Both the server i18n request config (`app/i18n.ts`) and every client
 * language switcher read this list, so the picker can never offer a language
 * the site has no messages for.
 *
 * Cross-module links:
 *  - `app/i18n.ts` re-exports SUPPORTED_LOCALES and reads LOCALE_COOKIE.
 *  - `components/marketing/LanguageMenu.tsx` (header + footer switcher) and the
 *    in-app `components/LanguageSwitcher.tsx` build their options from here,
 *    NOT from the backend `getLanguages()` API (which returned languages the
 *    site cannot render). Keep LOCALE_LABELS in sync with `app/messages/*.json`.
 *
 * Watch: labels are shown in their own script and never themselves translated.
 */

export const SUPPORTED_LOCALES = ['en', 'gu', 'gu-en', 'hi-en'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/** Cookie that carries the chosen locale; read by `app/i18n.ts`. */
export const LOCALE_COOKIE = 'z360_locale';

/** Human labels, each in its own script + a clear "+ English" for the mixed pair. */
export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  gu: 'ગુજરાતી',
  'gu-en': 'ગુજરાતી + English',
  'hi-en': 'हिंदी + English',
};

/**
 * Compact labels for a tight trigger (e.g. the header switcher). In-script.
 * Gujarati uses "ગુજ" (Guj), not the single syllable "ગુ" — on its own "ગુ"
 * reads as an unrelated/crude word, so we show the conventional 2+ glyph
 * abbreviation instead.
 */
export const LOCALE_SHORT: Record<SupportedLocale, string> = {
  en: 'EN',
  gu: 'ગુજ',
  'gu-en': 'ગુજ + EN',
  'hi-en': 'हि + EN',
};

/** Switcher options, ordered for display. */
export const LOCALE_OPTIONS: ReadonlyArray<{ code: SupportedLocale; label: string }> =
  SUPPORTED_LOCALES.map((code) => ({ code, label: LOCALE_LABELS[code] }));

/** True when `value` is one of the four locales the site can render. */
export function isSupportedLocale(value: string | undefined | null): value is SupportedLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/** Write the locale cookie (1 year). Shared by every client switcher. */
export function writeLocaleCookie(code: string) {
  document.cookie = `${LOCALE_COOKIE}=${code};path=/;max-age=31536000;samesite=lax`;
}
