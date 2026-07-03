import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

// SubscriptionNavTabs reads usePathname/useRouter; stub both so the static tab
// list renders without a real Next router.
vi.mock('next/navigation', () => ({
  usePathname: () => '/account/subscription',
  useRouter: () => ({ push: vi.fn() }),
}));

import { SubscriptionNavTabs } from '@/components/subscription/SubscriptionNavTabs';

// Real tab labels (profile.subscription.tabs.*) so we can assert on rendered
// copy - including that Refunds is no longer present.
const messages = {
  profile: {
    subscription: {
      tabs: {
        overview: 'Overview',
        plans: 'Plans',
        addons: 'Add-Ons',
        credits: 'Credits',
        invoices: 'Invoices',
        billingInfo: 'Billing Info',
        paymentMethod: 'Payment Method',
        refunds: 'Refunds',
        history: 'History',
      },
    },
  },
};

afterEach(cleanup);

function renderTabs() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SubscriptionNavTabs />
    </NextIntlClientProvider>,
  );
}

describe('SubscriptionNavTabs', () => {
  it('renders the remaining tabs but NOT the (manually-handled) Refunds tab', () => {
    renderTabs();
    // The surviving tabs still render.
    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Payment Method')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
    // Refunds is commented out of the nav (owner decision 2026-06-23).
    expect(screen.queryByText('Refunds')).not.toBeInTheDocument();
  });
});
