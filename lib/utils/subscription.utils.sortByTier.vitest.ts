import { describe, it, expect } from 'vitest';
import { sortPlansByTierOrder } from './subscription.utils';
import type { Tier } from '@/types';

// Tests for sortPlansByTierOrder — the single source of truth for plan-card
// ordering across every ERP plan listing (plans hub, marketing pricing grid,
// dashboard activation strip). Cards must follow the admin-controlled Tier
// displayOrder (lower = first), not raw DB order. Keep in sync with the backend
// getPublicTiers(), which sorts tiers by displayOrder asc.

// Minimal tier factory: only key + displayOrder drive the sort; the rest are
// filled to satisfy the Tier type.
function tier(key: string, displayOrder: number): Tier {
  return { _id: key, name: key, key, displayOrder, color: 'default', isActive: true };
}

const TIERS = [tier('free', 0), tier('starter', 1), tier('growth', 2), tier('business', 3)];

describe('sortPlansByTierOrder', () => {
  it('orders plans ascending by their tier displayOrder', () => {
    const plans = [
      { _id: 'b', tier: 'business' },
      { _id: 'f', tier: 'free' },
      { _id: 'g', tier: 'growth' },
      { _id: 's', tier: 'starter' },
    ];
    expect(sortPlansByTierOrder(plans, TIERS).map((p) => p._id)).toEqual(['f', 's', 'g', 'b']);
  });

  it('respects admin reordering (displayOrder is the source of truth)', () => {
    // Business promoted to first, free demoted to last via displayOrder alone.
    const reordered = [tier('business', 0), tier('starter', 1), tier('growth', 2), tier('free', 3)];
    const plans = [
      { _id: 'f', tier: 'free' },
      { _id: 'b', tier: 'business' },
    ];
    expect(sortPlansByTierOrder(plans, reordered).map((p) => p._id)).toEqual(['b', 'f']);
  });

  it('sorts unknown / missing tiers LAST', () => {
    const plans = [
      { _id: 'x', tier: 'mystery' },
      { _id: 'f', tier: 'free' },
      { _id: 'g', tier: 'growth' },
    ];
    expect(sortPlansByTierOrder(plans, TIERS).map((p) => p._id)).toEqual(['f', 'g', 'x']);
  });

  it('is stable for plans sharing a tier (keeps incoming order)', () => {
    const plans = [
      { _id: 's1', tier: 'starter' },
      { _id: 's2', tier: 'starter' },
      { _id: 'f', tier: 'free' },
    ];
    expect(sortPlansByTierOrder(plans, TIERS).map((p) => p._id)).toEqual(['f', 's1', 's2']);
  });

  it('does not mutate the input array', () => {
    const plans = [
      { _id: 'b', tier: 'business' },
      { _id: 'f', tier: 'free' },
    ];
    const copy = [...plans];
    sortPlansByTierOrder(plans, TIERS);
    expect(plans).toEqual(copy);
  });

  it('keeps original order when no tiers are provided (every tier unknown)', () => {
    const plans = [
      { _id: 'b', tier: 'business' },
      { _id: 'f', tier: 'free' },
    ];
    expect(sortPlansByTierOrder(plans, []).map((p) => p._id)).toEqual(['b', 'f']);
  });
});
