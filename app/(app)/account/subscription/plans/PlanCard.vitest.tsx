import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntdApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { PlanCard } from '@/app/(app)/account/subscription/plans/PlanCard';
import type { PlanWithBilling } from '@/types';

// Minimal slice of the marketing.pages.erpPricing namespace the card reuses
// (single source of truth - no duplicate copy). Mirrors app/messages/en.json so
// we can assert on the real rendered strings + ICU interpolation.
const messages = {
  marketing: {
    pages: {
      erpPricing: {
        mostPopular: 'Most popular',
        staffCap: 'Up to {count} team members',
        // Unlimited sentinel (maxMembers < 0) renders this instead of "-1".
        staffCapUnlimited: 'Unlimited team members',
        // New MONTHLY-headline price-block copy (shared with the public
        // ErpPricingTable). Mirrors app/messages/en.json. The monthly installment
        // is the big figure (perMonth = "/mo"); the yearly commitment is the
        // muted subtext (billedYearlyAmount).
        perMonth: '/mo',
        perYear: '/year',
        billedYearly: 'Billed yearly',
        // The ₹ yearly total moved to the checkout/review screen, so this subtext
        // no longer interpolates {price} - it's the bare billing cadence.
        billedYearlyAmount: 'Billed yearly · auto-renews',
        freeForever: 'Free forever',
        upfrontSave: 'Pay yearly upfront, save {percent}%',
        // Optional/configurable GST note (shown only when the plan has GST on).
        plusGst: '+{rate}% GST',
        gstIncluded: 'incl. GST ({rate}%)',
        plans: {
          free: {
            name: 'Free',
            tagline: 'For small teams getting organized',
            f1: 'Staff records & profiles',
            f2: 'Daily attendance',
            f3: 'Basic shift scheduling',
            f4: 'Basic salary view',
          },
          starter: {
            name: 'Starter',
            tagline: 'For teams managing time & leave',
            everything: 'Everything in Free, plus',
            f1: 'Leave management & holidays',
            f2: 'Missed-punch regularization',
            f3: 'Full attendance & shifts',
          },
          growth: {
            name: 'Growth',
            tagline: 'For teams running payroll',
            everything: 'Everything in Starter, plus',
            f1: 'Full payroll (PF, ESI, PT, TDS)',
            f2: 'Payslips & statutory compliance',
            f3: 'Salary components & increments',
          },
        },
      },
    },
  },
};

afterEach(cleanup);

function makePlan(overrides: Partial<PlanWithBilling> = {}): PlanWithBilling {
  return {
    _id: 'plan_growth',
    name: 'Growth',
    tier: 'growth',
    isActive: true,
    monthlyPrice: 999,
    yearlyPrice: 9999,
    upfrontDiscountPercent: 0,
    installmentsEnabled: true,
    installmentMonths: 12,
    // GST defaults: ON at 18%, tax-exclusive (matches the plan defaults).
    gstEnabled: true,
    gstRatePercent: 18,
    isPriceTaxInclusive: false,
    entitlements: { maxMembersPerWorkspace: 100 },
    ...overrides,
  } as PlanWithBilling;
}

function renderCard(props: Partial<React.ComponentProps<typeof PlanCard>> = {}, locale = 'en') {
  const plan = props.plan ?? makePlan();
  const merged: React.ComponentProps<typeof PlanCard> = {
    plan,
    tierColor: 'blue',
    isThisActive: false,
    isThisQueued: false,
    isDowngrade: false,
    buttonDisabled: false,
    onSelect: vi.fn(),
    onCancelQueued: vi.fn(),
    ...props,
  };
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AntdApp>
        <PlanCard {...merged} />
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

describe('PlanCard', () => {
  it('renders the Most popular badge, staff cap, and first feature for the Growth plan', () => {
    renderCard({ plan: makePlan() });

    // Most-popular badge (Growth only) - text, not icon-only.
    expect(screen.getByText('Most popular')).toBeInTheDocument();
    // Staff cap interpolated from entitlements.maxMembersPerWorkspace.
    expect(screen.getByText('Up to 100 team members')).toBeInTheDocument();
    // At least the first curated feature bullet.
    expect(screen.getByText('Full payroll (PF, ESI, PT, TDS)')).toBeInTheDocument();
    // "Everything in X, plus" cumulative line.
    expect(screen.getByText('Everything in Starter, plus')).toBeInTheDocument();
  });

  it('renders "Unlimited team members" (not "-1") when the cap is the -1 sentinel', () => {
    // Cast the partial entitlements: the card only reads maxMembersPerWorkspace,
    // and makePlan already casts the whole plan to PlanWithBilling.
    renderCard({
      plan: makePlan({
        entitlements: { maxMembersPerWorkspace: -1 } as PlanWithBilling['entitlements'],
      }),
    });

    expect(screen.getByText('Unlimited team members')).toBeInTheDocument();
    expect(screen.queryByText(/Up to -1/)).not.toBeInTheDocument();
  });

  it('shows the Current plan state (badge + disabled CTA, not Subscribe) when it is the active plan', () => {
    renderCard({ plan: makePlan(), isThisActive: true, buttonDisabled: true });

    // Current-plan wording appears in BOTH the top badge and the CTA label, so
    // there are two matches - assert both exist (badge + status CTA).
    expect(screen.getAllByText('Current plan').length).toBeGreaterThanOrEqual(2);
    // CTA reflects current-plan and is disabled - not a Subscribe button.
    const cta = screen.getByRole('button', { name: /Current plan/i });
    expect(cta).toBeDisabled();
    expect(screen.queryByRole('button', { name: /^Subscribe$/i })).not.toBeInTheDocument();
  });

  it('shows the Subscribe CTA for a non-current paid plan', () => {
    renderCard({ plan: makePlan(), isThisActive: false, buttonDisabled: false });

    expect(screen.getByRole('button', { name: /Subscribe/i })).toBeInTheDocument();
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
  });

  it('leads with the MONTHLY figure as the headline and shows the yearly commitment (no ₹ total) as subtext', () => {
    // Monthly installment is the big psychological-light figure; the yearly
    // commitment is the muted subtext. Math comes from lib/pricing
    // (833 = 9,999 / 12). Plans are still SOLD yearly - the subtext says so, but
    // the ₹ yearly TOTAL now lives on the checkout/review screen, not here.
    renderCard({
      plan: makePlan({
        upfrontDiscountPercent: 0,
        yearlyPrice: 9999,
        installmentsEnabled: true,
        installmentMonths: 12,
      }),
    });

    // Monthly headline figure (₹833) with the "/mo" suffix.
    const headline = screen.getByText(/₹833/);
    expect(headline).toBeInTheDocument();
    expect(screen.getByText('/mo')).toBeInTheDocument();
    // Billed-yearly subtext shows the cadence (Billed yearly · auto-renews) but
    // NOT the ₹ yearly total (₹9,999) - that moved to checkout.
    const subtext = screen.getByText(/Billed yearly/);
    expect(subtext.textContent ?? '').toContain('auto-renews');
    expect(subtext.textContent ?? '').not.toContain('₹9,999');
    // The ₹833 headline is the only ₹ figure on the card now (no yearly total).
    expect(screen.queryByText(/₹9,999/)).not.toBeInTheDocument();
    // No upfront-save line when the discount is 0 (clean default).
    expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
  });

  it('shows the upfront-save line only when there is an upfront discount', () => {
    // Monthly is still the headline; the optional upfront-save line appears as a
    // secondary muted line. percent comes through verbatim.
    renderCard({
      plan: makePlan({
        upfrontDiscountPercent: 10,
        yearlyPrice: 9999,
        installmentsEnabled: true,
        installmentMonths: 12,
      }),
    });

    // Monthly is still the headline.
    expect(screen.getByText(/₹833/)).toBeInTheDocument();
    expect(screen.getByText('/mo')).toBeInTheDocument();
    // Billed-yearly subtext still present (cadence only, no ₹ yearly total).
    const subtext = screen.getByText(/Billed yearly/);
    expect(subtext.textContent ?? '').toContain('auto-renews');
    expect(subtext.textContent ?? '').not.toContain('₹9,999');
    // Optional upfront-save line (text, not colour-only).
    expect(screen.getByText('Pay yearly upfront, save 10%')).toBeInTheDocument();
  });

  it('renders the plan tagline under the name', () => {
    renderCard({ plan: makePlan() });

    expect(screen.getByText('For teams running payroll')).toBeInTheDocument();
  });

  // ── Admin-editable card content (marketing.tagline + featureHighlights) ──────
  // Admin per-plan card copy overrides the static i18n defaults, localized to the
  // active locale; a blank/absent field falls back to the static copy. Mirrors
  // ErpPricingTable.vitest.tsx.
  it('renders the admin tagline + feature bullets when set (overriding the static copy)', () => {
    renderCard({
      plan: makePlan({
        marketing: {
          tagline: { en: 'Admin custom tagline' },
          featureHighlights: [{ en: 'Custom bullet one' }, { en: 'Custom bullet two' }],
        },
      }),
    });

    expect(screen.getByText('Admin custom tagline')).toBeInTheDocument();
    expect(screen.getByText('Custom bullet one')).toBeInTheDocument();
    expect(screen.getByText('Custom bullet two')).toBeInTheDocument();
    // Static defaults for this tier must NOT render when an admin override exists.
    expect(screen.queryByText('For teams running payroll')).not.toBeInTheDocument();
    expect(screen.queryByText('Full payroll (PF, ESI, PT, TDS)')).not.toBeInTheDocument();
  });

  it('renders the admin tagline in the active locale (gu-en) when provided', () => {
    renderCard(
      {
        plan: makePlan({
          marketing: { tagline: { en: 'English tagline', 'gu-en': 'Gujarati-roman tagline' } },
        }),
      },
      'gu-en',
    );

    expect(screen.getByText('Gujarati-roman tagline')).toBeInTheDocument();
    expect(screen.queryByText('English tagline')).not.toBeInTheDocument();
  });

  it('falls back to the static tagline + features when marketing is unset', () => {
    renderCard({ plan: makePlan() });

    expect(screen.getByText('For teams running payroll')).toBeInTheDocument();
    expect(screen.getByText('Full payroll (PF, ESI, PT, TDS)')).toBeInTheDocument();
  });

  it('drops the dangling auto-renew sentence and the old per-year/installment stack', () => {
    // The old card showed a struck-through yearly stack + a standalone
    // installment line + a dangling "Auto-renews yearly — we'll email you before
    // renewal." sentence under the CTA. All of that is gone; the monthly headline
    // + concise billed-yearly subtext supersede it.
    renderCard({
      plan: makePlan({
        upfrontDiscountPercent: 0,
        yearlyPrice: 9999,
        installmentsEnabled: true,
        installmentMonths: 12,
      }),
    });

    // The dangling auto-renew sentence must NOT render anywhere.
    expect(
      screen.queryByText("Auto-renews yearly — we'll email you before renewal."),
    ).not.toBeInTheDocument();
    // The old separate "or ₹833/mo × 12, 0% interest" installment line is gone
    // (the monthly figure is now the headline, not a secondary line).
    expect(screen.queryByText(/0% interest/i)).not.toBeInTheDocument();
    // No struck-through yearly price (the yearly figure now lives inline in the
    // muted subtext, not as a strike-through).
    expect(screen.queryByText(/\/year/)).not.toBeInTheDocument();
  });

  it('shows the free-forever label and no monthly/yearly/discount copy for the Free tier', () => {
    renderCard({
      plan: makePlan({
        _id: 'plan_free',
        name: 'Free',
        tier: 'free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        upfrontDiscountPercent: 0,
        installmentsEnabled: true,
      }),
    });

    expect(screen.getByText('Free forever')).toBeInTheDocument();
    // No /mo headline, no billed-yearly subtext, no upfront-save line for free.
    expect(screen.queryByText('/mo')).not.toBeInTheDocument();
    expect(screen.queryByText(/Billed yearly/)).not.toBeInTheDocument();
    expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
    // Free tier has no price line, so no GST note either.
    expect(screen.queryByText(/GST/)).not.toBeInTheDocument();
  });

  // ── Optional/configurable GST note ─────────────────────────────────────
  it('shows "+X% GST" when GST is enabled and tax-exclusive', () => {
    renderCard({ plan: makePlan({ gstEnabled: true, gstRatePercent: 18 }) });
    expect(screen.getByText('+18% GST')).toBeInTheDocument();
  });

  it('shows "incl. GST (X%)" when GST is enabled and tax-inclusive', () => {
    renderCard({
      plan: makePlan({ gstEnabled: true, gstRatePercent: 18, isPriceTaxInclusive: true }),
    });
    expect(screen.getByText('incl. GST (18%)')).toBeInTheDocument();
  });

  it('renders NO GST note when GST is disabled for the plan', () => {
    renderCard({ plan: makePlan({ gstEnabled: false, gstRatePercent: 18 }) });
    expect(screen.queryByText(/GST/)).not.toBeInTheDocument();
  });
});
