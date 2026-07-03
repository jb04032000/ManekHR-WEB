import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import { useAuthErrorMessage } from './auth-error-codes';
import en from '@/app/messages/en.json';
import gu from '@/app/messages/gu.json';
import guEn from '@/app/messages/gu-en.json';
import hiEn from '@/app/messages/hi-en.json';

/**
 * Option B — re-signup during the 30-day deletion grace (ACCOUNT-DELETION §9).
 *
 * The backend `register` path returns code `ACCOUNT_SCHEDULED_FOR_DELETION` when
 * the typed email/mobile belongs to an account still in its recovery window. The
 * auth UI must render that as a localized "scheduled for deletion - contact us to
 * recover" message in ALL FOUR locales (not the raw English BE string). This
 * proves the code resolves natively in en / gu / gu-en / hi-en.
 */

const CODE = 'ACCOUNT_SCHEDULED_FOR_DELETION';
const RAW_BE_FALLBACK = '__raw_backend_string__';

// The real shipped catalogs — same objects the app loads at runtime.
const catalogs: Record<string, Record<string, unknown>> = {
  en,
  gu,
  'gu-en': guEn,
  'hi-en': hiEn,
};

/** Resolves the deletion code through the production localization hook. */
function Probe() {
  const tAuthCode = useAuthErrorMessage();
  return <span data-testid="msg">{tAuthCode(CODE, RAW_BE_FALLBACK)}</span>;
}

function resolveIn(locale: string): string {
  render(
    <NextIntlClientProvider locale={locale} messages={catalogs[locale]}>
      <Probe />
    </NextIntlClientProvider>,
  );
  return screen.getByTestId('msg').textContent ?? '';
}

describe('re-signup during deletion grace — message localized in all 4 locales', () => {
  afterEach(cleanup);

  it.each(Object.keys(catalogs))(
    '%s resolves the deletion message and not the raw backend string',
    (locale) => {
      const text = resolveIn(locale);
      expect(text.length).toBeGreaterThan(0);
      // The code is in LOCALIZED_AUTH_ERROR_CODES, so the hook returns the
      // catalog value, never the raw BE fallback.
      expect(text).not.toBe(RAW_BE_FALLBACK);
    },
  );

  it('uses native translations (gu in Gujarati script; each non-en locale differs from en)', () => {
    const en = resolveIn('en');
    cleanup();
    const gu = resolveIn('gu');
    cleanup();
    const guEnText = resolveIn('gu-en');
    cleanup();
    const hiEnText = resolveIn('hi-en');

    // gu is native Gujarati script (non-ASCII present).
    expect(/[઀-૿]/.test(gu)).toBe(true);
    // Every non-en locale is a real translation, not the English string copied.
    expect(gu).not.toBe(en);
    expect(guEnText).not.toBe(en);
    expect(hiEnText).not.toBe(en);
  });
});
