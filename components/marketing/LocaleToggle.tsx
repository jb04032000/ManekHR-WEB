'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LOCALE_OPTIONS, writeLocaleCookie } from '@/lib/locales';

/**
 * Compact button-group language switcher (used by the in-app Connect footer,
 * the removed Connect footer). Options + labels + cookie writer
 * come from the shared `lib/locales.ts` source of truth, so it can never offer
 * a language the site cannot render. Writes the `z360_locale` cookie that
 * `app/i18n.ts` reads, then refreshes so server components re-render.
 *
 * Note: the marketing header + footer use the dropdown `LanguageMenu.tsx`
 * instead; both share the same locale source.
 */
const LOCALES = LOCALE_OPTIONS;

export function LocaleToggle() {
  const a11y = useTranslations('marketing.a11y');
  const active = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function pick(code: string) {
    if (code === active || isPending) return;
    writeLocaleCookie(code);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={a11y('language')}
      // rounded-2xl (not rounded-full): with 4 long labels the chips wrap to two
      // rows on mobile, and a full-pill container then shows ugly oversized
      // rounded ends around a 2-row block. A rounded rectangle reads as an
      // intentional chip group. The inner chips stay fully rounded.
      className="inline-flex flex-wrap items-center gap-2 rounded-2xl border border-[var(--cr-neutral-200)] bg-white p-2"
    >
      {LOCALES.map((locale) => {
        const selected = locale.code === active;
        return (
          <button
            key={locale.code}
            type="button"
            onClick={() => pick(locale.code)}
            aria-pressed={selected}
            className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              selected
                ? 'bg-[var(--cr-indigo-600)] text-white'
                : 'text-[var(--cr-neutral-600)] hover:bg-[var(--cr-neutral-100)] hover:text-[var(--cr-neutral-900)]'
            }`}
          >
            {locale.label}
          </button>
        );
      })}
    </div>
  );
}
