import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import en from '@/app/messages/en.json';

/**
 * Test render helpers for Connect component tests.
 *
 * `renderWithIntl` wraps the unit under test in `NextIntlClientProvider` with
 * the real English messages, so components calling `useTranslations` render
 * exactly as they do in the app. See docs/connect/TESTING-STRATEGY.md.
 */

function Providers({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" messages={en}>
      {children}
    </NextIntlClientProvider>
  );
}

export function renderWithIntl(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return render(ui, { wrapper: Providers, ...options });
}

export * from '@testing-library/react';
