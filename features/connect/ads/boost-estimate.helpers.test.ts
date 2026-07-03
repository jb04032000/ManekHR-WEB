import { describe, it, expect } from 'vitest';
import { buildBoostEstimate, ASSUMED_CPM, ASSUMED_INQUIRY_RATE } from './boost-estimate.helpers';

describe('buildBoostEstimate constants', () => {
  it('exposes a positive CPM in credits per 1000 impressions', () => {
    expect(ASSUMED_CPM).toBeGreaterThan(0);
  });

  it('exposes an inquiry rate strictly between 0 and 1', () => {
    expect(ASSUMED_INQUIRY_RATE).toBeGreaterThan(0);
    expect(ASSUMED_INQUIRY_RATE).toBeLessThan(1);
  });
});

describe('buildBoostEstimate', () => {
  it('returns a low/high reach band where low <= high and high <= audience', () => {
    const r = buildBoostEstimate({ audienceSize: 3200, budget: 300, days: 7 });
    expect(r.reachLow).toBeLessThanOrEqual(r.reachHigh);
    expect(r.reachHigh).toBeLessThanOrEqual(3200);
    expect(r.reachLow).toBeGreaterThanOrEqual(0);
  });

  it('returns an inquiry band where low <= high', () => {
    const r = buildBoostEstimate({ audienceSize: 3200, budget: 300, days: 7 });
    expect(r.inquiriesLow).toBeLessThanOrEqual(r.inquiriesHigh);
    expect(r.inquiriesLow).toBeGreaterThanOrEqual(0);
  });

  it('derives reach from impressions = budget*days/CPM*1000 when audience is not the binding cap', () => {
    // Large audience so the impression math (not the audience cap) drives reach.
    const budget = 300;
    const days = 7;
    const impressions = ((budget * days) / ASSUMED_CPM) * 1000;
    const r = buildBoostEstimate({ audienceSize: 10_000_000, budget, days });
    // The midpoint of the reach band tracks the raw impression estimate.
    const mid = (r.reachLow + r.reachHigh) / 2;
    expect(mid).toBeGreaterThan(impressions * 0.5);
    expect(mid).toBeLessThan(impressions * 1.5);
  });

  it('caps reach at the real audience size when the budget would buy more', () => {
    // Tiny audience, huge budget: reach can never exceed who is actually there.
    const r = buildBoostEstimate({ audienceSize: 400, budget: 100_000, days: 30 });
    expect(r.reachHigh).toBeLessThanOrEqual(400);
    expect(r.reachLow).toBeLessThanOrEqual(400);
  });

  it('scales reach up with a longer duration at the same daily budget', () => {
    const short = buildBoostEstimate({ audienceSize: 5_000_000, budget: 300, days: 3 });
    const long = buildBoostEstimate({ audienceSize: 5_000_000, budget: 300, days: 30 });
    expect(long.reachHigh).toBeGreaterThan(short.reachHigh);
  });

  it('ties inquiries to reach via ASSUMED_INQUIRY_RATE', () => {
    const r = buildBoostEstimate({ audienceSize: 5_000_000, budget: 600, days: 14 });
    // High inquiries are anchored on the high reach times the rate.
    const expectedHigh = Math.round(r.reachHigh * ASSUMED_INQUIRY_RATE);
    // Within the documented spread of the anchor.
    expect(r.inquiriesHigh).toBeGreaterThanOrEqual(Math.floor(expectedHigh * 0.5));
    expect(r.inquiriesHigh).toBeLessThanOrEqual(Math.ceil(expectedHigh * 1.6) + 1);
  });

  it('returns an all-zero band when budget or days is zero', () => {
    expect(buildBoostEstimate({ audienceSize: 3200, budget: 0, days: 7 })).toEqual({
      reachLow: 0,
      reachHigh: 0,
      inquiriesLow: 0,
      inquiriesHigh: 0,
    });
    expect(buildBoostEstimate({ audienceSize: 3200, budget: 300, days: 0 })).toEqual({
      reachLow: 0,
      reachHigh: 0,
      inquiriesLow: 0,
      inquiriesHigh: 0,
    });
  });

  it('returns an all-zero band when the audience is empty', () => {
    expect(buildBoostEstimate({ audienceSize: 0, budget: 300, days: 7 })).toEqual({
      reachLow: 0,
      reachHigh: 0,
      inquiriesLow: 0,
      inquiriesHigh: 0,
    });
  });

  it('returns whole-number outputs (no fractional people or inquiries)', () => {
    const r = buildBoostEstimate({ audienceSize: 3217, budget: 333, days: 7 });
    expect(Number.isInteger(r.reachLow)).toBe(true);
    expect(Number.isInteger(r.reachHigh)).toBe(true);
    expect(Number.isInteger(r.inquiriesLow)).toBe(true);
    expect(Number.isInteger(r.inquiriesHigh)).toBe(true);
  });
});
