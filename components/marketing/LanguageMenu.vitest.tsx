import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageMenu } from './LanguageMenu';

// LanguageMenu navigates via the locale-aware router (i18n/navigation) and reads
// the current path; mock both so the cookie-write assertion can run in jsdom.
vi.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/',
}));

const messages = { marketing: { a11y: { language: 'Choose language' } } };

function setup(locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <LanguageMenu />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe('LanguageMenu', () => {
  it('shows exactly the four supported locales', () => {
    setup();
    fireEvent.click(screen.getByRole('button', { name: /Choose language/ }));
    expect(screen.getAllByRole('option')).toHaveLength(4);
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('ગુજરાતી')).toBeTruthy();
    expect(screen.getByText('ગુજરાતી + English')).toBeTruthy();
    expect(screen.getByText('हिंदी + English')).toBeTruthy();
  });

  it('writes the z360_locale cookie when a language is chosen', () => {
    setup('en');
    fireEvent.click(screen.getByRole('button', { name: /Choose language/ }));
    fireEvent.click(screen.getByText('ગુજરાતી'));
    expect(document.cookie).toContain('z360_locale=gu');
  });
});
