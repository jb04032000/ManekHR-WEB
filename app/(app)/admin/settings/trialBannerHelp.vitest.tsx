import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';

// Guards Bug 1: admin.trialBanner.headlineHelp / headlinePlaceholder contain an
// INSTRUCTIONAL {days} token that must render LITERALLY (it tells the admin to
// type {days} in their headline). Before the fix, next-intl treated {days} as a
// missing ICU variable and THREW FORMATTING_ERROR because no `days` arg is passed.
// The fix single-quotes the token ('{days}') so ICU emits it as literal text.
// This slice mirrors app/messages/en.json admin.trialBanner.* (keep in sync).
const messages = {
  admin: {
    trialBanner: {
      headlineHelp:
        "Leave blank to use the default localized message. Use '{days}' for the trial length.",
      headlinePlaceholder: "e.g. Start your '{days}'-day free trial today",
    },
  },
};

// Reads the two keys exactly as app/admin/settings/page.tsx does: t('trialBanner.*')
// with NO `days` arg, so the test reproduces the real call site.
function TrialBannerHelpProbe() {
  const t = useTranslations('admin');
  return (
    <>
      <span data-testid="help">{t('trialBanner.headlineHelp')}</span>
      <span data-testid="placeholder">{t('trialBanner.headlinePlaceholder')}</span>
    </>
  );
}

afterEach(cleanup);

describe('admin trialBanner help/placeholder ({days} literal escaping)', () => {
  it('renders without throwing FORMATTING_ERROR and shows literal {days}', () => {
    expect(() =>
      render(
        <NextIntlClientProvider locale="en" messages={messages}>
          <TrialBannerHelpProbe />
        </NextIntlClientProvider>,
      ),
    ).not.toThrow();

    // The token survives as literal text, not interpolated / not an error string.
    expect(screen.getByTestId('help').textContent).toBe(
      'Leave blank to use the default localized message. Use {days} for the trial length.',
    );
    expect(screen.getByTestId('placeholder').textContent).toBe(
      'e.g. Start your {days}-day free trial today',
    );
  });
});
