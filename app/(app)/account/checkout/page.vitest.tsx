import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntdApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import type { PlanWithBilling } from '@/types';

// Payments gated off (the deployed default) so CheckoutView renders the gated UX.
vi.mock('@/lib/env', () => ({
  env: { paymentsEnabled: false, isProd: false },
}));

// Control the ?plan=<id> query per test.
let mockPlanParam: string | null = 'plan_growth';
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (k: string) => (k === 'plan' ? mockPlanParam : null),
  }),
  useRouter: () => ({ push: vi.fn() }),
}));

// Stub the data actions: one valid public ERP plan + one that must be filtered
// out (Connect product), so the page's public-ERP filter is exercised.
const growth = {
  _id: 'plan_growth',
  name: 'Growth',
  tier: 'growth',
  product: 'erp',
  isActive: true,
  isPubliclyVisible: true,
  isCustom: false,
  monthlyPrice: 833,
  yearlyPrice: 9999,
  upfrontDiscountPercent: 0,
  installmentsEnabled: true,
  installmentMonths: 12,
  gstRatePercent: 18,
  isPriceTaxInclusive: false,
  entitlements: { maxMembersPerWorkspace: 100 },
} as unknown as PlanWithBilling;

const connectPlan = {
  _id: 'plan_connect',
  name: 'Connect Pro',
  tier: 'growth',
  product: 'connect',
  isActive: true,
  isPubliclyVisible: true,
  isCustom: false,
  yearlyPrice: 4999,
} as unknown as PlanWithBilling;

vi.mock('@/lib/actions', () => ({
  getPlans: () => Promise.resolve([growth, connectPlan]),
  getMySubscription: () => Promise.resolve(null),
}));

// Minimal i18n slice for the page header + not-found + CheckoutView body.
const messages = {
  profile: {
    subscription: {
      comingSoon: { title: 'x', body: 'x', ok: 'x', tag: 'x' },
      checkout: {
        title: 'Review & subscribe',
        orderSummary: 'Order summary',
        backToPlans: 'Back to plans',
        notFoundTitle: 'That plan isn’t available',
        notFoundBody: 'We couldn’t find the plan.',
        notFoundCta: 'Browse plans',
        billingHeading: 'How would you like to pay?',
        payYearly: 'Pay yearly (one payment)',
        payYearlyPrice: 'One payment · {amount}',
        payMonthly: 'Pay monthly — 0% interest',
        payMonthlyPrice: '{amount}/mo · 0% interest',
        breakdownHeading: 'Price breakdown',
        yearlyPrice: 'Yearly price',
        upfrontDiscount: 'Upfront discount ({percent}%)',
        subtotal: 'Subtotal',
        gst: 'GST ({percent}%)',
        gstInclusive: 'incl. GST ({percent}%)',
        perMonthSubline: '{amount}/mo × {months} · {yearTotal}/year total',
        totalOneTime: 'Total (one payment)',
        totalPerMonth: 'Per month',
        couponHeading: 'Have a coupon?',
        couponPlaceholder: 'Enter code',
        couponApply: 'Apply',
        couponGated: 'Coupons activate when online payments go live.',
        proceedToPayAmount: 'Proceed to pay · {amount}',
        proceedToPayMonthly: 'Proceed to pay · {amount}/mo',
        comingSoonInline: 'Online payments coming soon.',
        staffCap: 'Up to {count} team members',
        unlimitedStaff: 'Unlimited team members',
      },
    },
  },
  marketing: {
    pages: {
      erpPricing: {
        staffCap: 'Up to {count} team members',
        plans: {
          growth: {
            tagline: 'For teams running payroll',
            everything: 'Everything in Starter, plus',
            f1: 'a',
            f2: 'b',
            f3: 'c',
          },
        },
      },
    },
  },
};

// Import AFTER mocks are registered.
import CheckoutPage from './page';

afterEach(cleanup);

function renderPage() {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AntdApp>
        <CheckoutPage />
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

describe('CheckoutPage (route)', () => {
  it('renders the checkout body for a valid ?plan= id', async () => {
    mockPlanParam = 'plan_growth';
    renderPage();
    // Header title + the plan summary from CheckoutView resolve once data loads.
    await waitFor(() => expect(screen.getByText('Review & subscribe')).toBeInTheDocument());
    expect(screen.getByText('For teams running payroll')).toBeInTheDocument();
    expect(screen.getByText('Back to plans')).toBeInTheDocument();
  });

  it('renders the not-found fallback for an unknown plan id (never crashes)', async () => {
    mockPlanParam = 'does_not_exist';
    renderPage();
    await waitFor(() => expect(screen.getByText('That plan isn’t available')).toBeInTheDocument());
    // CTA back to plans is present (AntD Button rendered inside a Link).
    expect(screen.getByText('Browse plans')).toBeInTheDocument();
    // The checkout body must NOT render for an invalid plan.
    expect(screen.queryByText('How would you like to pay?')).not.toBeInTheDocument();
  });

  it('renders the not-found fallback for a non-ERP (Connect) plan id', async () => {
    // The Connect plan is in getPlans() but filtered out as non-ERP.
    mockPlanParam = 'plan_connect';
    renderPage();
    await waitFor(() => expect(screen.getByText('That plan isn’t available')).toBeInTheDocument());
  });

  it('renders the not-found fallback when ?plan= is missing', async () => {
    mockPlanParam = null;
    renderPage();
    await waitFor(() => expect(screen.getByText('That plan isn’t available')).toBeInTheDocument());
  });
});
