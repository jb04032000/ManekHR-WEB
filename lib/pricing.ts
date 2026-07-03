// Pure pricing-math for the 1-year ERP plan term. Backs both the in-app
// PlanCard (app/account/subscription/plans/PlanCard.tsx) and the marketing
// ErpPricingTable (components/marketing/ErpPricingTable.tsx); they share the
// marketing.pages.erpPricing i18n namespace. No I/O — display math only.
//
// Pricing model: a plan is sold as a 1-year term. The customer pays either
//   - UPFRONT: one payment with a small discount, or
//   - MONTHLY: 12 installments at 0% interest (yearly price / 12).
// All amounts are whole rupees. Keep in sync with the seeded plan prices
// (9999 / 24999 / 49999) and any installment/discount copy in the components.

// Clamp a percentage into the valid 0..100 band so callers can pass raw config
// values without each guarding the bounds.
function clampPercent(percent: number): number {
  if (percent < 0) return 0;
  if (percent > 100) return 100;
  return percent;
}

// Per-month cost when the yearly term is split into `months` installments.
// Guards months <= 0 (avoids divide-by-zero / negative spread) by returning 0.
export function monthlyInstallment(yearlyPriceRupees: number, months: number): number {
  if (months <= 0) return 0;
  return Math.round(yearlyPriceRupees / months);
}

// One-time upfront price after applying the (clamped) discount percent.
export function upfrontPrice(yearlyPriceRupees: number, discountPercent: number): number {
  return Math.round(yearlyPriceRupees * (1 - clampPercent(discountPercent) / 100));
}

// Rupees saved by paying upfront vs the full yearly price.
export function upfrontSavings(yearlyPriceRupees: number, discountPercent: number): number {
  return yearlyPriceRupees - upfrontPrice(yearlyPriceRupees, discountPercent);
}

// Whether an upfront discount is actually offered (drives "Pay upfront, save X%").
export function hasUpfrontDiscount(discountPercent: number): boolean {
  return discountPercent > 0;
}

// Tax split for a single rupee amount, used by the checkout/review screen
// (components/subscription/CheckoutView.tsx) to line-item the GST.
// Backs the "subtotal -> + GST -> total" breakdown for both the yearly-upfront
// and per-month options; this is display math only (no I/O, whole-rupee rounding).
//
// `isInclusive` decides which way the split runs:
//   - INCLUSIVE: `amount` already contains GST. We carve the base back out
//     (base = round(amount / (1 + gst%))) and take gst = amount - base so that
//     base + gst === amount exactly (the total never drifts from what's shown).
//   - EXCLUSIVE: `amount` is the taxable base. GST is computed on top
//     (gst = round(amount * gst%)) and total = base + gst.
// gstPercent is clamped to >= 0 so a stray negative never produces negative tax.
export interface GstBreakdown {
  /** Pre-tax (taxable) amount in whole rupees. */
  base: number;
  /** GST amount in whole rupees. */
  gst: number;
  /** Amount actually charged in whole rupees (base + gst). */
  total: number;
}

export function gstBreakdown(
  amountRupees: number,
  gstPercent: number,
  isInclusive: boolean,
): GstBreakdown {
  const rate = gstPercent < 0 ? 0 : gstPercent;
  if (isInclusive) {
    // Carve the base out of a tax-inclusive amount; total stays the input.
    const base = Math.round(amountRupees / (1 + rate / 100));
    return { base, gst: amountRupees - base, total: amountRupees };
  }
  // Add GST on top of a tax-exclusive base.
  const gst = Math.round((amountRupees * rate) / 100);
  return { base: amountRupees, gst, total: amountRupees + gst };
}
