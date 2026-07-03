/**
 * gstBreakdown — GST-off / zero-rate behaviour.
 *
 * Backs the optional-per-plan GST feature: when a plan disables GST (the
 * CheckoutView passes a 0 rate, or the display is gated off entirely), the
 * math must yield zero GST and a total equal to the base — never a stray
 * rounding artifact. Display gating lives in CheckoutView; this guards the math.
 *
 * Cross-module link: lib/pricing.ts gstBreakdown <-> components/subscription/
 * CheckoutView.tsx (which decides whether to show the GST line at all).
 */
import { describe, it, expect } from 'vitest';
import { gstBreakdown } from './pricing';

describe('gstBreakdown — zero rate (GST off)', () => {
  it('exclusive: rate 0 yields gst 0 and total === base', () => {
    const { base, gst, total } = gstBreakdown(10000, 0, false);
    expect(base).toBe(10000);
    expect(gst).toBe(0);
    expect(total).toBe(10000);
  });

  it('inclusive: rate 0 yields gst 0 and total === base (no carve-out)', () => {
    const { base, gst, total } = gstBreakdown(10000, 0, true);
    expect(base).toBe(10000);
    expect(gst).toBe(0);
    expect(total).toBe(10000);
  });

  it('negative rate is clamped to 0 (no negative tax)', () => {
    const { gst, total } = gstBreakdown(10000, -5, false);
    expect(gst).toBe(0);
    expect(total).toBe(10000);
  });

  it('still computes GST normally when a positive rate is given', () => {
    const { base, gst, total } = gstBreakdown(10000, 18, false);
    expect(base).toBe(10000);
    expect(gst).toBe(1800);
    expect(total).toBe(11800);
  });
});
