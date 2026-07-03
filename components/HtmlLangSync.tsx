'use client';

import { useEffect } from 'react';

/**
 * Syncs the document <html lang>/<dir> to the active locale on the client.
 *
 * Why it exists: after the locale-routing migration the GLOBAL root layout
 * (`app/layout.tsx`) is locale-NEUTRAL (renders a static `lang="en"`) so the
 * public marketing pages can be statically pre-rendered. The authenticated app
 * is still cookie-based and dynamic, so its group layout (`app/(app)/layout.tsx`)
 * mounts this to correct <html lang> for screen readers / browser translation
 * once hydrated. Marketing pages emit per-locale hreflang + URLs for SEO, so the
 * crawler-facing language signal does not depend on this.
 *
 * Cross-module links: rendered by `app/(app)/layout.tsx`; locale comes from
 * `app/i18n.ts` (cookie `z360_locale`). All current locales are LTR, so `dir`
 * is effectively a no-op today but kept for correctness if an RTL locale is added.
 */
export function HtmlLangSync({ locale, dir }: { locale: string; dir: 'ltr' | 'rtl' }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  return null;
}
