import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { ErpPricingTable, type ErpPlanView } from '@/components/marketing/ErpPricingTable';

// The table pulls the locale-aware marketing nav (MarketingButton -> @/i18n/
// navigation -> next-intl/navigation -> extensionless next/navigation), which
// Vitest's ESM resolver cannot load. Stub the local nav module with a plain
// anchor so the link renders without booting next-intl's navigation factory.
vi.mock('@/i18n/navigation', () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={typeof href === 'string' ? href : '#'} {...rest}>
      {children}
    </a>
  ),
  redirect: vi.fn(),
  usePathname: () => '/erp/pricing',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  getPathname: () => '/erp/pricing',
}));

// Light render test for the public ERP pricing cards. Mirrors the slice of the
// marketing.pages.erpPricing namespace the table reads (single source of truth;
// keep in sync with app/messages/en.json). Focus: the 1-year-term price block
// (yearly / upfront-discount / installment) + tagline, shared with PlanCard.
const messages = {
  marketing: {
    pages: {
      erpPricing: {
        mostPopular: 'Most popular',
        recommendedBadge: 'Recommended',
        // Monthly-headline price-block copy (shared with PlanCard). The monthly
        // installment is the big figure (perMonth = "/mo"); the yearly commitment
        // is the muted subtext (billedYearlyAmount).
        perMonth: '/mo',
        perYear: '/year',
        billedYearly: 'Billed yearly',
        // The ₹ yearly total moved to the in-app checkout/review screen, so this
        // subtext no longer interpolates {price} - just the billing cadence.
        billedYearlyAmount: 'Billed yearly · auto-renews',
        freeForever: 'Free forever',
        upfrontSave: 'Pay yearly upfront, save {percent}%',
        // Optional/configurable GST note (shown only when the plan has GST on).
        plusGst: '+{rate}% GST',
        gstIncluded: 'incl. GST ({rate}%)',
        staffCap: 'Up to {count} team members',
        // Unlimited sentinel (maxMembers < 0) renders this instead of leaking "-1".
        staffCapUnlimited: 'Unlimited team members',
        ctaFree: 'Get started free',
        ctaTrial: 'Start free trial',
        plans: {
          free: {
            name: 'Free',
            tagline: 'For small teams getting organized',
            f1: 'Staff records & profiles',
            f2: 'Daily attendance',
            f3: 'Shift scheduling',
            f4: 'Salary & payments tracking',
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
          business: {
            name: 'Business',
            tagline: 'For multi-location & factory teams',
            everything: 'Everything in Growth, plus',
            f1: 'Machines & production tracking',
            f2: 'Statutory exports',
            f3: 'Biometric & geo punch-in',
            f4: 'Multi-location support',
            f5: 'Bulk tools & imports',
            f6: 'Advanced reports & analytics',
          },
        },
        selector: {
          heading: 'Not sure which plan?',
          sub: 'Tell us your team size.',
          ariaLabel: 'Select your team size',
          recommend: 'We recommend the {plan} plan.',
          recommendCustom: 'For teams over 500, talk to us.',
          bands: {
            b5: 'Up to 5',
            b25: 'Up to 25',
            b100: 'Up to 100',
            b500: 'Up to 500',
            b500plus: '500+',
          },
        },
      },
    },
  },
};

afterEach(cleanup);

function makeView(overrides: Partial<ErpPlanView> = {}): ErpPlanView {
  return {
    tier: 'growth',
    monthlyPrice: 999,
    yearlyPrice: 9999,
    maxMembers: 100,
    upfrontDiscountPercent: 0,
    installmentsEnabled: true,
    installmentMonths: 12,
    // GST defaults: ON at 18%, tax-exclusive (matches the plan defaults).
    gstEnabled: true,
    gstRatePercent: 18,
    isPriceTaxInclusive: false,
    ...overrides,
  };
}

function renderTable(plans: ErpPlanView[], locale = 'en') {
  return render(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <ErpPricingTable plans={plans} />
    </NextIntlClientProvider>,
  );
}

describe('ErpPricingTable', () => {
  it('leads with the monthly figure as the headline and the yearly cadence (no ₹ total) as subtext', () => {
    renderTable([makeView({ tier: 'growth', yearlyPrice: 9999 })]);

    // Monthly installment (₹833 = 9,999 / 12) is the big headline with "/mo".
    expect(screen.getByText(/₹833/)).toBeInTheDocument();
    expect(screen.getByText('/mo')).toBeInTheDocument();
    // Billed-yearly subtext shows the cadence but NOT the ₹ yearly total - that
    // moved to the in-app checkout/review screen.
    const subtext = screen.getByText(/Billed yearly/);
    expect(subtext.textContent ?? '').toContain('auto-renews');
    expect(subtext.textContent ?? '').not.toContain('₹9,999');
    expect(screen.queryByText(/₹9,999/)).not.toBeInTheDocument();
    // Tagline under the name.
    expect(screen.getByText('For teams running payroll')).toBeInTheDocument();
    // No upfront-save line when discount is 0.
    expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
  });

  it('shows the upfront-save line only when there is an upfront discount', () => {
    renderTable([makeView({ tier: 'growth', yearlyPrice: 9999, upfrontDiscountPercent: 10 })]);

    // Monthly is still the headline; the yearly cadence stays in the subtext
    // (no ₹ yearly total - that moved to checkout).
    expect(screen.getByText(/₹833/)).toBeInTheDocument();
    expect(screen.getByText('/mo')).toBeInTheDocument();
    const subtext = screen.getByText(/Billed yearly/);
    expect(subtext.textContent ?? '').toContain('auto-renews');
    expect(subtext.textContent ?? '').not.toContain('₹9,999');
    // Optional upfront-save line (real text, not colour-only).
    expect(screen.getByText('Pay yearly upfront, save 10%')).toBeInTheDocument();
  });

  it('renders "Free forever" with no monthly/yearly/discount lines for the Free tier', () => {
    renderTable([makeView({ tier: 'free', monthlyPrice: 0, yearlyPrice: 0 })]);

    expect(screen.getByText('Free forever')).toBeInTheDocument();
    expect(screen.queryByText('/mo')).not.toBeInTheDocument();
    expect(screen.queryByText(/Billed yearly/)).not.toBeInTheDocument();
    expect(screen.queryByText(/save/i)).not.toBeInTheDocument();
  });

  // ── Optional/configurable GST note ─────────────────────────────────────
  it('shows "+X% GST" when GST is enabled and tax-exclusive', () => {
    renderTable([makeView({ tier: 'growth', gstEnabled: true, gstRatePercent: 18 })]);
    expect(screen.getByText('+18% GST')).toBeInTheDocument();
  });

  it('shows "incl. GST (X%)" when GST is enabled and tax-inclusive', () => {
    renderTable([
      makeView({ tier: 'growth', gstEnabled: true, gstRatePercent: 18, isPriceTaxInclusive: true }),
    ]);
    expect(screen.getByText('incl. GST (18%)')).toBeInTheDocument();
  });

  it('renders NO GST note when GST is disabled for the plan', () => {
    renderTable([makeView({ tier: 'growth', gstEnabled: false, gstRatePercent: 18 })]);
    expect(screen.queryByText(/GST/)).not.toBeInTheDocument();
  });

  // ── Admin-editable card content (marketing.tagline + featureHighlights) ──────
  // When an admin sets per-plan card copy it overrides the static i18n defaults,
  // localized to the active locale; a blank/absent field falls back to the static
  // t('plans.<tier>.*') copy. Mirrors PlanCard.vitest.tsx.
  it('renders the admin tagline + feature bullets when set (overriding the static copy)', () => {
    renderTable([
      makeView({
        tier: 'growth',
        marketing: {
          tagline: { en: 'Admin custom tagline' },
          featureHighlights: [{ en: 'Custom bullet one' }, { en: 'Custom bullet two' }],
        },
      }),
    ]);

    // Admin copy renders; the static defaults for this tier do NOT.
    expect(screen.getByText('Admin custom tagline')).toBeInTheDocument();
    expect(screen.getByText('Custom bullet one')).toBeInTheDocument();
    expect(screen.getByText('Custom bullet two')).toBeInTheDocument();
    expect(screen.queryByText('For teams running payroll')).not.toBeInTheDocument();
    expect(screen.queryByText('Full payroll (PF, ESI, PT, TDS)')).not.toBeInTheDocument();
  });

  it('renders the admin tagline in the active locale (gu-en) when provided', () => {
    renderTable(
      [
        makeView({
          tier: 'growth',
          marketing: {
            tagline: { en: 'English tagline', 'gu-en': 'Gujarati-roman tagline' },
          },
        }),
      ],
      'gu-en',
    );

    expect(screen.getByText('Gujarati-roman tagline')).toBeInTheDocument();
    expect(screen.queryByText('English tagline')).not.toBeInTheDocument();
  });

  // ── Unlimited staff cap (maxMembers < 0 sentinel) ────────────────────────
  // The Business/unlimited plan carries maxMembers = -1 (unlimited sentinel).
  // It must render "Unlimited team members", never leak the raw "-1".
  it('renders "Unlimited team members" (not "-1") when maxMembers is the -1 sentinel', () => {
    renderTable([makeView({ tier: 'business', maxMembers: -1 })]);

    expect(screen.getByText('Unlimited team members')).toBeInTheDocument();
    expect(screen.queryByText(/-1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Up to -1/)).not.toBeInTheDocument();
  });

  it('still renders the "Up to {count}" form for a finite cap', () => {
    renderTable([makeView({ tier: 'growth', maxMembers: 100 })]);

    expect(screen.getByText('Up to 100 team members')).toBeInTheDocument();
    expect(screen.queryByText('Unlimited team members')).not.toBeInTheDocument();
  });

  it('falls back to the static tagline + features when marketing is unset', () => {
    renderTable([makeView({ tier: 'growth' })]);

    // Static defaults render (no admin override present).
    expect(screen.getByText('For teams running payroll')).toBeInTheDocument();
    expect(screen.getByText('Full payroll (PF, ESI, PT, TDS)')).toBeInTheDocument();
  });
});
