/**
 * CheckoutView - GST conditional display (optional-per-plan GST feature).
 *
 * Asserts the order summary shows the GST line ONLY when the plan's GST is
 * enabled (default), and shows NO GST line (Total === Subtotal) when the
 * plan has `gstEnabled: false`. The math lives in lib/pricing; this guards the
 * UI gating so a GST-off plan never surfaces a tax line.
 *
 * Cross-module link: components/subscription/CheckoutView.tsx <-> the backend
 * Plan.gstEnabled flag (carried through types Plan + PlanD1Extensions).
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithIntl, screen, within } from '@/test-utils/render';
import type { PlanWithBilling } from '@/types';
import { CheckoutView } from './CheckoutView';

// Payments gate is off in tests; we only care about the breakdown rendering.
vi.mock('@/components/subscription/PaymentsComingSoon', () => ({
  usePaymentsGate: () => ({ paymentsEnabled: false, guard: (fn: () => void) => fn() }),
}));

// Minimal public ERP plan; installments off so the per-month tile never renders
// and the summary is the single yearly figure we assert against.
function makePlan(over: Partial<PlanWithBilling> = {}): PlanWithBilling {
  return {
    _id: 'p1',
    name: 'Growth',
    tier: 'growth',
    product: 'erp',
    isActive: true,
    monthlyPrice: 0,
    yearlyPrice: 10000,
    installmentsEnabled: false,
    upfrontDiscountPercent: 0,
    entitlements: {
      maxWorkspaces: 1,
      maxMembersPerWorkspace: 100,
      maxTotalMembers: 100,
      modules: [],
      features: {
        export: false,
        apiAccess: false,
        advancedRbac: false,
        customRoles: false,
        shifts: false,
        bills: false,
      },
    },
    ...over,
  } as PlanWithBilling;
}

describe('CheckoutView GST gating', () => {
  it('renders the GST line when GST is enabled (default 18%)', () => {
    renderWithIntl(<CheckoutView plan={makePlan({ gstEnabled: true, gstRatePercent: 18 })} />);
    // GST line label "GST (18%)" must be present.
    expect(screen.getByText(/GST \(18%\)/)).toBeInTheDocument();
  });

  it('treats undefined gstEnabled as ON (matches backend contract)', () => {
    renderWithIntl(<CheckoutView plan={makePlan({ gstRatePercent: 18 })} />);
    expect(screen.getByText(/GST \(18%\)/)).toBeInTheDocument();
  });

  it('renders NO GST line and Total === Subtotal when gstEnabled is false', () => {
    renderWithIntl(<CheckoutView plan={makePlan({ gstEnabled: false, gstRatePercent: 18 })} />);
    // No GST label of any form.
    expect(screen.queryByText(/GST/)).not.toBeInTheDocument();
    // Subtotal value and the prominent total are the same number (no tax added).
    // yearly 10000 -> base 10000, total 10000.
    const region = screen.getByRole('region', { name: /order summary/i });
    expect(within(region).getAllByText(/₹\s?10,000/).length).toBeGreaterThanOrEqual(2);
  });
});

/**
 * CheckoutView - the Order summary must FOLLOW the selected pay option.
 *
 * The bug: the summary always rendered the YEARLY-upfront breakdown (discount
 * line + discounted total) even when "Pay monthly" was selected, so monthly
 * users saw the 10% discount and the discounted yearly grand total as "Total
 * due today", internally inconsistent with their actual first-installment
 * charge. These tests assert the summary swaps to the monthly view (no discount
 * line, first-installment due today, Pay button = first installment).
 *
 * Cross-module link: components/subscription/CheckoutView.tsx <-> lib/pricing
 * (upfront/monthly math). The radios are custom role="radio" tiles labelled by
 * their visible "Pay yearly" / "Pay monthly" title.
 */
describe('CheckoutView pay-option-dependent summary', () => {
  // Plan with a 10% upfront discount AND installments on so both tiles render.
  // yearly 10000, 10% discount -> upfront base 9000; GST 18% -> yearly total
  // 10620. Monthly (no discount): perMonthBase round(10000/12)=833, +18% GST ->
  // perMonthTotal 983; full year 983*12 = 11796.
  function discountPlan(over: Partial<PlanWithBilling> = {}): PlanWithBilling {
    return makePlan({
      yearlyPrice: 10000,
      upfrontDiscountPercent: 10,
      installmentsEnabled: true,
      installmentMonths: 12,
      gstEnabled: true,
      gstRatePercent: 18,
      ...over,
    });
  }

  // Select a pay tile by its visible title ("Pay yearly" / "Pay monthly").
  function selectOption(title: RegExp) {
    fireEvent.click(screen.getByRole('radio', { name: title }));
  }

  it('YEARLY selected: shows the upfront-discount line and discounted total on the Pay button', () => {
    renderWithIntl(<CheckoutView plan={discountPlan()} />);
    // Yearly is the default; the upfront-discount line is present.
    expect(screen.getByText(/Upfront discount \(10%\)/)).toBeInTheDocument();
    const region = screen.getByRole('region', { name: /order summary/i });
    // Discounted yearly total (10620) is the "Total due today" (also echoed in
    // the auto-renew note in yearly mode), so it appears more than once.
    expect(within(region).getAllByText(/₹\s?10,620/).length).toBeGreaterThanOrEqual(1);
    // Pay button carries the discounted yearly total.
    expect(screen.getAllByRole('button', { name: /₹\s?10,620/ }).length).toBeGreaterThanOrEqual(1);
  });

  it('MONTHLY selected: NO discount line, due-today is the first installment (not the yearly total)', () => {
    renderWithIntl(<CheckoutView plan={discountPlan()} />);
    selectOption(/Pay monthly/);

    // The upfront-discount line must NOT appear anywhere in the summary.
    expect(screen.queryByText(/Upfront discount/)).not.toBeInTheDocument();

    const region = screen.getByRole('region', { name: /order summary/i });
    // Total due today === the first installment (983), NOT the yearly total.
    // (983 legitimately recurs in the schedule + auto-renew sub-lines too.)
    expect(within(region).getAllByText(/₹\s?983/).length).toBeGreaterThanOrEqual(1);
    // The prominent "Total due today" value is the installment, not the yearly total.
    expect(within(region).getByText(/Total due today/)).toBeInTheDocument();
    // The discounted yearly grand total (10620) must NOT appear at all.
    expect(within(region).queryByText(/₹\s?10,620/)).not.toBeInTheDocument();
    // Pay button shows the first installment, not the yearly total.
    expect(screen.getAllByRole('button', { name: /₹\s?983/ }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole('button', { name: /₹\s?10,620/ })).not.toBeInTheDocument();
    // A schedule sub-line referencing the full-year roll-up (11,796) is shown
    // (also echoed in the auto-renew note).
    expect(within(region).getAllByText(/11,796/).length).toBeGreaterThanOrEqual(1);
  });

  it('MONTHLY with GST off: due today === per-month base and no GST line', () => {
    renderWithIntl(<CheckoutView plan={discountPlan({ gstEnabled: false })} />);
    selectOption(/Pay monthly/);

    const region = screen.getByRole('region', { name: /order summary/i });
    // No GST line at all.
    expect(within(region).queryByText(/GST/)).not.toBeInTheDocument();
    // No discount line either.
    expect(within(region).queryByText(/Upfront discount/)).not.toBeInTheDocument();
    // perMonthBase round(10000/12) = 833 is the due-today (no GST added);
    // it also recurs in the schedule + auto-renew sub-lines.
    expect(within(region).getAllByText(/₹\s?833/).length).toBeGreaterThanOrEqual(1);
    // No installment-with-GST figure (983) should appear when GST is off.
    expect(within(region).queryByText(/₹\s?983/)).not.toBeInTheDocument();
  });

  // Finding 1 (the failing-test-first): for INCLUSIVE GST the monthly summary
  // must reconcile - Subtotal (carved taxable base roll-up) + GST roll-up ===
  // the full-year total. Before the fix the subtotal used the GROSS per-month
  // base, so Subtotal + GST overshot the total (double-counted tax).
  it('MONTHLY with INCLUSIVE GST: Subtotal + GST === full-year total (reconciles)', () => {
    // yearly 10000, perMonthBase round(10000/12)=833. Inclusive 18%:
    // carved base round(833/1.18)=706, gst 833-706=127, total 833.
    // Full-year: base 706*12=8472, gst 127*12=1524, total 833*12=9996.
    // 8472 + 1524 === 9996 (must reconcile).
    renderWithIntl(<CheckoutView plan={discountPlan({ isPriceTaxInclusive: true })} />);
    selectOption(/Pay monthly/);

    const region = screen.getByRole('region', { name: /order summary/i });
    // Inclusive label is shown (GST carved out of the per-month amount).
    expect(within(region).getByText('incl. GST (18%)')).toBeInTheDocument();
    // Subtotal row = carved taxable base roll-up (8,472), NOT the gross 9,996.
    const subtotalRow = within(region).getByText('Subtotal').closest('div');
    expect(within(subtotalRow as HTMLElement).getByText(/₹\s?8,472/)).toBeInTheDocument();
    // GST roll-up = ₹1,524.
    const gstRow = within(region).getByText('incl. GST (18%)').closest('div');
    expect(within(gstRow as HTMLElement).getByText(/₹\s?1,524/)).toBeInTheDocument();
    // 8,472 + 1,524 === 9,996 (full-year total). The reconciliation: parse the
    // shown numbers and assert they add up, so a regression that brings back the
    // gross-base subtotal fails here.
    const num = (el: HTMLElement) => Number(el.textContent!.replace(/[^0-9]/g, ''));
    const subtotal = num(within(subtotalRow as HTMLElement).getByText(/₹\s?8,472/));
    const gst = num(within(gstRow as HTMLElement).getByText(/₹\s?1,524/));
    expect(subtotal + gst).toBe(9996);
    // The full-year roll-up (9,996) appears in the schedule/auto-renew sub-lines.
    expect(within(region).getAllByText(/9,996/).length).toBeGreaterThanOrEqual(1);
    // Due today is the first installment (833), not the yearly figure.
    const totalRow = within(region).getByText('Total due today').closest('div');
    expect(within(totalRow as HTMLElement).getByText(/₹\s?833/)).toBeInTheDocument();
  });
});
