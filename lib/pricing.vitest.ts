import { describe, expect, it } from 'vitest';

// Tests for the shared pricing-math util. These functions back the in-app
// PlanCard and the marketing ErpPricingTable (both read marketing.pages.erpPricing).
// Pricing model: a plan is a 1-year term paid either UPFRONT (one payment, small
// discount) or in 12 monthly installments at 0% interest. Numbers below use the
// seeded yearly prices (9999 / 24999 / 49999 rupees).
import {
  gstBreakdown,
  hasUpfrontDiscount,
  monthlyInstallment,
  upfrontPrice,
  upfrontSavings,
} from './pricing';

describe('monthlyInstallment', () => {
  it('rounds the yearly price split across months (9999 over 12 = 833)', () => {
    expect(monthlyInstallment(9999, 12)).toBe(833);
  });

  it('handles the other seeded plans', () => {
    expect(monthlyInstallment(24999, 12)).toBe(2083);
    expect(monthlyInstallment(49999, 12)).toBe(4167);
  });

  it('returns 0 when months is 0 (guard)', () => {
    expect(monthlyInstallment(9999, 0)).toBe(0);
  });

  it('returns 0 when months is negative (guard)', () => {
    expect(monthlyInstallment(9999, -3)).toBe(0);
  });
});

describe('upfrontPrice', () => {
  it('applies a 10% discount to 9999 -> 8999', () => {
    expect(upfrontPrice(9999, 10)).toBe(8999);
  });

  it('equals the yearly price when discount is 0', () => {
    expect(upfrontPrice(9999, 0)).toBe(9999);
    expect(upfrontPrice(24999, 0)).toBe(24999);
  });

  it('clamps a discount above 100% to 100% (-> 0)', () => {
    expect(upfrontPrice(9999, 150)).toBe(0);
  });

  it('clamps a negative discount to 0% (-> full price)', () => {
    expect(upfrontPrice(9999, -25)).toBe(9999);
  });
});

describe('upfrontSavings', () => {
  it('is the difference between yearly and upfront (10% of 9999 = 1000)', () => {
    expect(upfrontSavings(9999, 10)).toBe(1000);
  });

  it('is 0 when there is no discount', () => {
    expect(upfrontSavings(9999, 0)).toBe(0);
  });
});

describe('hasUpfrontDiscount', () => {
  it('is false at 0%', () => {
    expect(hasUpfrontDiscount(0)).toBe(false);
  });

  it('is true for any positive discount', () => {
    expect(hasUpfrontDiscount(10)).toBe(true);
  });

  it('is false for a negative discount', () => {
    expect(hasUpfrontDiscount(-5)).toBe(false);
  });
});

describe('gstBreakdown', () => {
  it('splits an EXCLUSIVE amount: GST is added on top (9999 @ 18%)', () => {
    // exclusive: the amount IS the taxable base; GST is computed and added.
    const { base, gst, total } = gstBreakdown(9999, 18, false);
    expect(base).toBe(9999);
    expect(gst).toBe(1800); // round(9999 * 0.18) = round(1799.82)
    expect(total).toBe(11799);
  });

  it('splits an INCLUSIVE amount: GST is carved out (11799 @ 18%)', () => {
    // inclusive: the amount already contains GST; base is carved back out so
    // base + gst === the original amount exactly (no rounding drift on total).
    const { base, gst, total } = gstBreakdown(11799, 18, true);
    expect(total).toBe(11799);
    expect(base).toBe(9999); // round(11799 / 1.18) = round(9999.15)
    expect(gst).toBe(1800); // total - base
  });

  it('returns zero GST at 0% (exclusive and inclusive both pass the amount through)', () => {
    expect(gstBreakdown(9999, 0, false)).toEqual({ base: 9999, gst: 0, total: 9999 });
    expect(gstBreakdown(9999, 0, true)).toEqual({ base: 9999, gst: 0, total: 9999 });
  });

  it('clamps a negative GST percent to 0 (no negative tax)', () => {
    expect(gstBreakdown(9999, -5, false)).toEqual({ base: 9999, gst: 0, total: 9999 });
  });
});
