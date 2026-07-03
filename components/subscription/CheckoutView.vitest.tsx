import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { App as AntdApp } from 'antd';
import { afterEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { CheckoutView } from './CheckoutView';
import type { PlanWithBilling } from '@/types';

// The checkout/review body is GATED while online payments are off
// (env.paymentsEnabled === false). Force the flag off so the test asserts the
// gated UX (coming-soon CTA + gated coupon). Mirrors the deployed default.
// Ported from the retired PaymentCheckoutModal.vitest.tsx (modal -> page).
vi.mock('@/lib/env', () => ({
  env: { paymentsEnabled: false, isProd: false },
}));

// Minimal slice of the two namespaces CheckoutView reads: profile.subscription
// (checkout chrome + coming-soon copy) and marketing.pages.erpPricing (plan
// summary copy, reused from the cards). Mirrors app/messages/en.json. Keys not
// asserted here fall back to their key path under next-intl's test provider,
// which is fine - the suite only asserts the load-bearing strings.
const messages = {
  profile: {
    subscription: {
      comingSoon: {
        title: 'Online payments coming soon',
        body: "Self-serve payments aren't available yet. To change your plan or add credits, please contact your admin.",
        ok: 'Got it',
        tag: 'Coming soon',
      },
      checkout: {
        title: 'Review & subscribe',
        subtitle:
          'Confirm your plan, choose how to pay, and complete payment. You can change or cancel anytime.',
        orderSummary: 'Order summary',
        stepsAriaLabel: 'Checkout progress',
        step1: 'Choose plan',
        step2: 'Review & pay',
        step3: 'Confirmation',
        sectionPlanTitle: 'Your plan',
        sectionPayTitle: 'How would you like to pay?',
        sectionPaymentMethodTitle: 'Payment method',
        changePlan: 'Change plan',
        planTermAnnual: 'ANNUAL',
        bothBillSame: 'Both options bill the same yearly subscription',
        billingHeading: 'How would you like to pay?',
        payYearly: 'Pay yearly',
        payYearlySub: 'One payment of {amount} today',
        bestValue: 'Best value',
        saveAmount: 'Save {amount}',
        payMonthly: 'Pay monthly',
        payMonthlySub: '{amount}/mo for {months} months · first charge today',
        zeroInterest: '0% interest',
        payYearlyPrice: 'One payment · {amount}',
        payMonthlyPrice: '{amount}/mo · 0% interest',
        yearlyPrice: 'Yearly price',
        upfrontDiscount: 'Upfront discount ({percent}%)',
        subtotal: 'Subtotal',
        gst: 'GST ({percent}%)',
        gstInclusive: 'incl. GST ({percent}%)',
        perMonthSubline: '{amount}/mo × {months} · {yearTotal}/year total',
        totalOneTime: 'Total (one payment)',
        totalPerMonth: 'Per month',
        totalDueToday: 'Total due today',
        billedAnnually: 'Billed annually · renews {date}',
        lineAnnual: '{plan}',
        lineMembers: 'Up to {count} members',
        lineMembersUnlimited: 'Unlimited members',
        // NOTE: `totalSubMonthly` was removed (orphaned - production now uses
        // dueTodaySubMonthly + autoRenewNoteMonthly for the monthly summary).
        totalSubOneTime: 'One-time annual payment',
        // Monthly schedule sub-line: first installment + months + full-year
        // roll-up. Mirrors the production key the summary renders for monthly.
        dueTodaySubMonthly: '{amount}/mo × {months} months · {yearTotal} total',
        autoRenewNote:
          'Auto-renews at {amount}/year on {date}. Cancel anytime before renewal from your account settings.',
        // Monthly auto-renew note (full-year roll-up + per-month + date).
        autoRenewNoteMonthly:
          'Renews at {yearTotal}/year ({amount}/mo) on {date}. Cancel anytime before renewal from your account settings.',
        notChargedYet: "You won't be charged until you confirm on the next screen.",
        transactionsEncrypted: 'All transactions are encrypted',
        methodCard: 'Card',
        methodUpi: 'UPI',
        methodNetBanking: 'Net banking',
        paymentMethodLegend: 'Card details',
        nameOnCard: 'Name on card',
        cardNumber: 'Card number',
        cardExpiry: 'Expiry (MM/YY)',
        cardCvv: 'CVV',
        cardPreviewNote: 'Secure payment opens when you continue, powered by Razorpay.',
        couponHeading: 'Have a coupon?',
        couponPlaceholder: 'Enter code',
        couponApply: 'Apply',
        couponGated: 'Coupons activate when online payments go live.',
        proceedToPay: 'Proceed to pay',
        proceedToPayAmount: 'Proceed to pay · {amount}',
        proceedToPayMonthly: 'Proceed to pay · {amount}/mo',
        paySecurelyAmount: 'Pay securely · {amount}',
        comingSoonInline: 'Online payments coming soon — contact your admin to change plans.',
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
    monthlyPrice: 833,
    yearlyPrice: 9999,
    upfrontDiscountPercent: 0,
    installmentsEnabled: true,
    installmentMonths: 12,
    gstRatePercent: 18,
    isPriceTaxInclusive: false,
    entitlements: { maxMembersPerWorkspace: 100 },
    ...overrides,
  } as PlanWithBilling;
}

function renderView(plan: PlanWithBilling = makePlan()) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <AntdApp>
        <CheckoutView plan={plan} />
      </AntdApp>
    </NextIntlClientProvider>,
  );
}

// The Order summary region (the price-breakdown card). The total label/value is
// intentionally echoed in the mobile sticky bottom bar too, so breakdown asserts
// scope HERE to address the one true breakdown without matching the bar's echo.
function orderSummary() {
  return screen.getByRole('region', { name: 'Order summary' });
}

describe('CheckoutView (dedicated checkout page body)', () => {
  it('renders the plan name, the Annual tag, the staff cap, and at least one feature', () => {
    renderView();
    expect(screen.getAllByText('Growth').length).toBeGreaterThanOrEqual(1);
    // The plan card carries an ANNUAL term tag next to the plan name.
    expect(screen.getByText('ANNUAL')).toBeInTheDocument();
    // Tagline + staff cap + a curated feature bullet all render.
    expect(screen.getByText('For teams running payroll')).toBeInTheDocument();
    expect(screen.getByText('Up to 100 team members')).toBeInTheDocument();
    expect(screen.getByText('Full payroll (PF, ESI, PT, TDS)')).toBeInTheDocument();
  });

  it('shows BOTH pay tiles: yearly with a Best-value badge (no discount) + sub-line, monthly with 0% interest + per-month figure', () => {
    renderView();
    expect(screen.getByText('Pay yearly')).toBeInTheDocument();
    expect(screen.getByText('Pay monthly')).toBeInTheDocument();
    // discount = 0 -> the yearly badge is "Best value", never a fake savings number.
    expect(screen.getByText('Best value')).toBeInTheDocument();
    expect(screen.queryByText(/^Save /)).not.toBeInTheDocument();
    // Monthly tile = "0% interest" badge + the real per-month charge in its sub-line.
    expect(screen.getByText('0% interest')).toBeInTheDocument();
    // Yearly sub-line = one payment of the yearly total (₹11,799).
    expect(screen.getByText('One payment of ₹11,799 today')).toBeInTheDocument();
    // Monthly sub-line = ₹983/mo for 12 months.
    expect(screen.getByText('₹983/mo for 12 months · first charge today')).toBeInTheDocument();
  });

  it('shows a real "Save ₹X" badge (not Best value) when an upfront discount is configured', () => {
    // 10% off 9,999 -> save 1,000 (pre-GST). The badge surfaces the rupee saving.
    renderView(makePlan({ upfrontDiscountPercent: 10 }));
    expect(screen.getByText('Save ₹1,000')).toBeInTheDocument();
    expect(screen.queryByText('Best value')).not.toBeInTheDocument();
  });

  it('hides the monthly option when installments are disabled', () => {
    renderView(makePlan({ installmentsEnabled: false }));
    expect(screen.getByText('Pay yearly')).toBeInTheDocument();
    expect(screen.queryByText('Pay monthly')).not.toBeInTheDocument();
  });

  it('order summary (default yearly): Subtotal + GST + "Total due today" with the right amounts, plus the renews-date line', () => {
    renderView();
    const summary = orderSummary();
    // Subtotal (post-discount taxable base = ₹9,999) + GST line (18% -> ₹1,800).
    expect(within(summary).getByText('Subtotal')).toBeInTheDocument();
    expect(within(summary).getByText('GST (18%)')).toBeInTheDocument();
    // Total due today = 9,999 + 1,800 = ₹11,799, the prominent total.
    const totalRow = within(summary).getByText('Total due today').closest('div');
    expect(within(totalRow as HTMLElement).getByText(/₹11,799/)).toBeInTheDocument();
    // The "Billed annually · renews <date>" sub line is present.
    expect(within(summary).getByText(/Billed annually · renews/)).toBeInTheDocument();
  });

  it('switching yearly -> monthly updates the order-summary Total sub-line (one-time -> per-month schedule)', () => {
    renderView();
    // Default (yearly) total sub-line = "One-time annual payment".
    expect(within(orderSummary()).getByText('One-time annual payment')).toBeInTheDocument();
    // Yearly mode also shows NO discount line and no monthly schedule sub-line.
    expect(within(orderSummary()).queryByText(/× 12 months/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Pay monthly'));
    const summary = orderSummary();
    // After switching, the one-time sub-line is gone and the monthly schedule
    // sub-line appears: first installment (₹983) × 12 months · full-year total.
    expect(within(summary).queryByText('One-time annual payment')).not.toBeInTheDocument();
    // 833 + 18% = ₹983/mo; full year 983*12 = ₹11,796 total.
    expect(within(summary).getByText('₹983/mo × 12 months · ₹11,796 total')).toBeInTheDocument();
    // Due-today is the first installment, not a discounted yearly figure, and no
    // upfront-discount line appears in monthly (no discount on the default plan).
    const totalRow = within(summary).getByText('Total due today').closest('div');
    expect(within(totalRow as HTMLElement).getByText(/₹983/)).toBeInTheDocument();
    expect(within(summary).queryByText(/Upfront discount/)).not.toBeInTheDocument();
  });

  // Finding 1 (failing-test-first) at the vitest sibling: the existing inclusive
  // test (above) only covers YEARLY. Add the MONTHLY inclusive case asserting
  // the breakdown reconciles - Subtotal (carved base roll-up) + GST === total.
  it('honors a tax-inclusive plan in MONTHLY: Subtotal + GST === full-year total', () => {
    // Inclusive 18%, yearly 9999. perMonthBase round(9999/12)=833. Inclusive:
    // carved base round(833/1.18)=706, gst 833-706=127, total 833.
    // Full-year: base 706*12=8472, gst 127*12=1524, total 833*12=9996.
    // 8472 + 1524 === 9996 (must reconcile; pre-fix the subtotal was 9996).
    renderView(makePlan({ isPriceTaxInclusive: true, yearlyPrice: 9999 }));
    fireEvent.click(screen.getByText('Pay monthly'));
    const summary = orderSummary();
    // Inclusive GST label shown (carved out of the per-month amount).
    expect(within(summary).getByText('incl. GST (18%)')).toBeInTheDocument();
    // Subtotal = carved taxable base roll-up ₹8,472 (NOT the gross ₹9,996).
    const subtotalRow = within(summary).getByText('Subtotal').closest('div');
    expect(within(subtotalRow as HTMLElement).getByText('₹8,472')).toBeInTheDocument();
    // GST roll-up = ₹1,524.
    const gstRow = within(summary).getByText('incl. GST (18%)').closest('div');
    expect(within(gstRow as HTMLElement).getByText('₹1,524')).toBeInTheDocument();
    // The two rows add up to the full-year total (₹9,996) - reconciliation.
    const num = (el: HTMLElement) => Number(el.textContent!.replace(/[^0-9]/g, ''));
    const subtotal = num(within(subtotalRow as HTMLElement).getByText('₹8,472'));
    const gst = num(within(gstRow as HTMLElement).getByText('₹1,524'));
    expect(subtotal + gst).toBe(9996);
    // Due today = first installment (₹833), the carved per-month total.
    const totalRow = within(summary).getByText('Total due today').closest('div');
    expect(within(totalRow as HTMLElement).getByText('₹833')).toBeInTheDocument();
  });

  it('renders an "Order summary" heading on the page', () => {
    renderView();
    expect(screen.getAllByText('Order summary').length).toBeGreaterThanOrEqual(1);
  });

  it('gates the coupon Apply with an inline note and applies no discount', () => {
    renderView();
    const apply = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(apply);
    expect(screen.getByText('Coupons activate when online payments go live.')).toBeInTheDocument();
    // No discount line appears (the gated coupon must not fake a discount).
    expect(screen.queryByText(/Upfront discount/)).not.toBeInTheDocument();
  });

  it('gates the Pay action: all Pay buttons are disabled (no charge possible)', () => {
    renderView();
    // The CTA is echoed in the desktop order card AND the mobile bottom bar, so
    // assert ALL Pay buttons are disabled (gated) - neither can charge. (The
    // separate "coming soon" line was removed per owner; gating is the disabled
    // button + the "won't be charged" reassurance.)
    const pays = screen.getAllByRole('button', { name: /Pay securely/i });
    expect(pays.length).toBeGreaterThanOrEqual(1);
    pays.forEach((p) => expect(p).toBeDisabled());
    expect(screen.queryByText(/Online payments coming soon/)).not.toBeInTheDocument();
  });

  it('Pay CTA carries the total amount (yearly default)', () => {
    renderView();
    // Scope to the desktop order-summary CTA (the bottom bar echoes the label).
    const pay = within(orderSummary()).getByRole('button', { name: /Pay securely/i });
    expect(pay).toHaveTextContent('Pay securely · ₹11,799');
  });

  it('renders the card form as a DISABLED visual preview (inputs disabled, never wired)', () => {
    renderView();
    // The "Name on card" input exists but is disabled - it never collects data.
    const nameOnCard = screen.getByLabelText('Name on card');
    expect(nameOnCard).toBeDisabled();
    // The preview note explains the real (Razorpay) collection happens later.
    expect(screen.getByText(/Secure payment opens when you continue/)).toBeInTheDocument();
  });

  it('does NOT render the Billing-details (GSTIN) section (flagged off until GST invoicing ships)', () => {
    renderView();
    // The GSTIN/business-name/invoice-email fields are implemented but commented
    // out behind SHOW_BILLING_DETAILS=false, so none of their controls render.
    expect(screen.queryByText(/GSTIN/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Registered business name/i)).not.toBeInTheDocument();
  });

  it('honors a tax-inclusive plan: total equals the yearly price, GST carved out', () => {
    // Inclusive 9,999 @ 18% -> base 8,474, gst 1,525, total 9,999.
    renderView(makePlan({ isPriceTaxInclusive: true, yearlyPrice: 9999 }));
    const summary = orderSummary();
    const total = within(summary).getByText('Total due today').closest('div');
    expect(within(total as HTMLElement).getByText(/₹9,999/)).toBeInTheDocument();
    expect(within(summary).getByText('incl. GST (18%)')).toBeInTheDocument();
  });
});
