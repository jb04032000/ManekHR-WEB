'use client';
import { Select } from 'antd';
import { useRouter } from 'next/navigation';
import { startTransition, useCallback, useEffect, useState } from 'react';
import { LOCALE_COOKIE, LOCALE_OPTIONS, writeLocaleCookie } from '@/lib/locales';

/**
 * In-app language picker (AntD). Options come from the site's own supported
 * locale list (`lib/locales.ts`), NOT the backend `getLanguages()` API, which
 * returned languages the site has no translations for. Writes the same
 * `z360_locale` cookie that `app/i18n.ts` reads, then refreshes so server
 * components re-render in the chosen locale.
 *
 * Cross-module links: shares the locale source + cookie writer with
 * `components/marketing/LanguageMenu.tsx` and `LocaleToggle.tsx`. Keep the four
 * locales in sync via `lib/locales.ts`.
 */
export default function LanguageSwitcher() {
  const router = useRouter();
  const [currentLocale, setCurrentLocale] = useState('en');

  useEffect(() => {
    const match = document.cookie.split('; ').find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
    if (match)
      startTransition(() => {
        setCurrentLocale(match.split('=')[1]);
      });
  }, []);

  const handleChange = useCallback(
    (locale: string) => {
      writeLocaleCookie(locale);
      router.refresh();
    },
    [router],
  );

  return (
    <Select
      value={currentLocale}
      onChange={handleChange}
      options={LOCALE_OPTIONS.map((l) => ({ value: l.code, label: l.label }))}
      style={{ width: 180 }}
      size="small"
      popupMatchSelectWidth={180}
    />
  );
}
