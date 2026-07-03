'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import {
  LOCALE_OPTIONS,
  LOCALE_SHORT,
  type SupportedLocale,
  writeLocaleCookie,
} from '@/lib/locales';
import { GlobeIcon } from './icons';

/**
 * Shared marketing language switcher (header + footer). A compact dropdown
 * whose options come from the site's own locale list (`lib/locales.ts`), never
 * the backend API. Writes the `z360_locale` cookie that `app/i18n.ts` reads,
 * then refreshes so server components re-render in the chosen locale.
 *
 * Cross-module links: shares the locale source + cookie writer with
 * `LanguageSwitcher.tsx` (in-app) and `LocaleToggle.tsx` (Connect footer).
 *
 * Watch: trigger width is fixed by min-width so opening the menu causes no
 * layout shift; `placement="top"` is used in the footer so it opens upward.
 */
export function LanguageMenu({
  placement = 'bottom',
  align = 'start',
}: {
  placement?: 'top' | 'bottom';
  align?: 'start' | 'end';
}) {
  const a11y = useTranslations('marketing.a11y');
  const active = useLocale() as SupportedLocale;
  const router = useRouter();
  // Locale-stripped current path (e.g. `/pricing` on both `/pricing` and
  // `/gu/pricing`) so switching re-navigates to the SAME page in the new locale.
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  // Close on outside click / Escape. Keeps the menu from trapping the page.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function pick(code: string) {
    setOpen(false);
    if (code === active || isPending) return;
    // Keep the z360_locale cookie in sync so the chosen language persists across
    // the public <-> authenticated app boundary (the app side is cookie-based).
    writeLocaleCookie(code);
    // Navigate to the SAME marketing page under the new locale prefix (en stays
    // at `/`, others get `/gu` etc. via localePrefix 'as-needed'). This menu only
    // renders on the locale-routed marketing surface (the in-app/Connect switcher
    // is LocaleToggle, which stays cookie-based).
    startTransition(() => router.replace(pathname, { locale: code }));
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        // Only reference the listbox while it is actually rendered. The list is
        // mounted only when `open`, so pointing `aria-controls` at a non-existent
        // id when closed is both invalid ARIA and the source of a hydration
        // mismatch: this menu renders in several places (header x2 + footer), and
        // `useId()` numbers instances by tree order, so any server/client tree
        // difference shifts the footer instance's id and React flags the
        // `aria-controls` attribute as mismatched. Emitting it only when open
        // removes the attribute from the server + initial-client render, so
        // there is nothing to mismatch.
        aria-controls={open ? listId : undefined}
        // Accessible name includes the visible short code (e.g. "Choose
        // language (EN)") so it satisfies WCAG 2.5.3 Label in Name.
        aria-label={`${a11y('language')} (${LOCALE_SHORT[active] ?? 'EN'})`}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-full border border-[var(--cr-neutral-300)] bg-white px-3 py-1.5 text-[0.82rem] font-semibold text-[var(--cr-neutral-700)] transition-colors hover:border-[var(--cr-indigo-600)] hover:text-[var(--cr-indigo-700)]"
      >
        <GlobeIcon className="h-4 w-4 shrink-0 text-[var(--cr-neutral-500)]" />
        <span>{LOCALE_SHORT[active] ?? 'EN'}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 12 12"
          className={`h-3 w-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={a11y('language')}
          className={`absolute z-50 min-w-[188px] overflow-hidden rounded-[12px] border border-[var(--cr-neutral-200)] bg-white py-1.5 shadow-[0_14px_38px_-12px_rgba(14,24,68,0.32)] ${
            placement === 'top' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
          } ${align === 'end' ? 'right-0' : 'left-0'}`}
        >
          {LOCALE_OPTIONS.map((locale) => {
            const selected = locale.code === active;
            return (
              <li key={locale.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => pick(locale.code)}
                  className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[0.92rem] transition-colors ${
                    selected
                      ? 'font-semibold text-[var(--cr-indigo-700)]'
                      : 'text-[var(--cr-neutral-700)] hover:bg-[var(--cr-indigo-50)]'
                  }`}
                >
                  <span>{locale.label}</span>
                  {selected ? (
                    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0">
                      <path
                        d="M3 8.5 6.5 12 13 4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
