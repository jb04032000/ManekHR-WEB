import { describe, it, expect } from 'vitest';
import {
  isGridAdSlot,
  isGridFirstPartyTopSlot,
  GRID_AD_FIRST_AFTER,
  GRID_AD_INTERVAL,
  GRID_MAX_COLUMNS,
} from './marketplace-grid-ads';

describe('isGridAdSlot', () => {
  it('injects no ad before the first-after threshold', () => {
    for (let n = 1; n < GRID_AD_FIRST_AFTER; n++) {
      expect(isGridAdSlot(n)).toBe(false);
    }
  });

  it('injects the first ad exactly at the first-after threshold', () => {
    expect(isGridAdSlot(GRID_AD_FIRST_AFTER)).toBe(true);
  });

  it('then injects once per interval', () => {
    expect(isGridAdSlot(GRID_AD_FIRST_AFTER + GRID_AD_INTERVAL)).toBe(true);
    expect(isGridAdSlot(GRID_AD_FIRST_AFTER + 2 * GRID_AD_INTERVAL)).toBe(true);
    // Off-cadence counts are false.
    expect(isGridAdSlot(GRID_AD_FIRST_AFTER + 1)).toBe(false);
    expect(isGridAdSlot(GRID_AD_FIRST_AFTER + GRID_AD_INTERVAL - 1)).toBe(false);
  });

  it('keeps the first sponsored cell out of the first row (>= max columns)', () => {
    // The first slot fires after GRID_AD_FIRST_AFTER cards, so the ad cell is the
    // (GRID_AD_FIRST_AFTER + 1)-th cell, which is beyond row 1 at any column count.
    expect(GRID_AD_FIRST_AFTER).toBeGreaterThanOrEqual(GRID_MAX_COLUMNS);
  });

  it('serves at most ~1 sponsored cell per 12 cards over a long grid', () => {
    let ads = 0;
    const cards = 100;
    for (let n = 1; n <= cards; n++) if (isGridAdSlot(n)) ads++;
    // Density ceiling: never more than one per interval.
    expect(ads).toBeLessThanOrEqual(Math.ceil(cards / GRID_AD_INTERVAL));
  });
});

describe('isGridFirstPartyTopSlot', () => {
  it('pins the top slot when a promoted listing is resolved', () => {
    expect(isGridFirstPartyTopSlot({ listing: {}, impressionToken: 't', campaignId: 'c' })).toBe(
      true,
    );
  });

  it('does not pin a top slot when no promoted listing resolved', () => {
    expect(isGridFirstPartyTopSlot(null)).toBe(false);
    expect(isGridFirstPartyTopSlot(undefined)).toBe(false);
  });
});
