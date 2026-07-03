import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntApp } from 'antd';
import { afterEach, describe, expect, it } from 'vitest';
import React from 'react';
import { TrialPromoBanner } from '@/components/subscription/TrialPromoBanner';

// Real slice of the marketing.pages.erpPricing namespace the banner reads
// (single source of truth; keep in sync with app/messages/en.json). The {days}
// placeholder must interpolate; the default headline is used only when no admin
// override is supplied.
const messages = {
  marketing: {
    pages: {
      erpPricing: {
        trialBanner: {
          headline: 'Sign up and get {days} days of full access, free. No card needed.',
          cta: 'See plans',
        },
      },
    },
  },
};

afterEach(cleanup);

function renderBanner(props: React.ComponentProps<typeof TrialPromoBanner>) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AntApp>
        <TrialPromoBanner {...props} />
      </AntApp>
    </NextIntlClientProvider>,
  );
}

describe('TrialPromoBanner', () => {
  it('renders the localized headline with {days} interpolated when enabled and no override', () => {
    renderBanner({ enabled: true, headlineOverride: '', days: 45 });
    // The default headline renders with the trial length filled in.
    expect(
      screen.getByText(/Sign up and get 45 days of full access, free\. No card needed\./),
    ).toBeInTheDocument();
  });

  it('renders the admin override text (and NOT the default headline) when override is non-empty', () => {
    renderBanner({ enabled: true, headlineOverride: 'Custom promo', days: 45 });
    expect(screen.getByText('Custom promo')).toBeInTheDocument();
    // The localized default must not appear when an override is supplied.
    expect(screen.queryByText(/Sign up and get/)).not.toBeInTheDocument();
  });

  it('renders nothing when disabled', () => {
    renderBanner({ enabled: false, headlineOverride: '', days: 45 });
    // Component returns null - no alert (only the inert AntApp wrapper remains).
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
  });

  it('renders nothing when days is 0 (no valid trial length)', () => {
    renderBanner({ enabled: true, headlineOverride: '', days: 0 });
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
    expect(screen.queryByText(/free trial/i)).not.toBeInTheDocument();
  });
});
