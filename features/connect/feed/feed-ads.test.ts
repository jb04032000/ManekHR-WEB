import { describe, expect, it } from 'vitest';
import {
  AD_INTERVAL,
  FIRST_AD_AFTER,
  FIRST_PAID_AD_AFTER,
  HOUSE_PROMOS,
  buildFeedRows,
  type FeedSponsoredCard,
} from './feed-ads';
import type { HydratedFeedItem } from '../feed.types';

/** Synthetic posts -- only `_id` matters to the interleaver. */
const posts = (n: number): HydratedFeedItem[] =>
  Array.from({ length: n }, (_, i) => ({ _id: `p${i + 1}` }) as unknown as HydratedFeedItem);

const houseRowIndices = (rows: ReturnType<typeof buildFeedRows>): number[] =>
  rows.flatMap((r, i) => (r.type === 'ad' ? [i] : []));

const anyAdRowIndices = (rows: ReturnType<typeof buildFeedRows>): number[] =>
  rows.flatMap((r, i) => (r.type === 'ad' || r.type === 'sponsored' ? [i] : []));

const sponsoredRows = (rows: ReturnType<typeof buildFeedRows>) =>
  rows.filter((r): r is Extract<typeof r, { type: 'sponsored' }> => r.type === 'sponsored');

// Minimal sponsored-card fixtures (buildFeedRows only reads kind, campaignId, and
// post._id for the dedup guard).
const sponsoredPost = (postRef = 'promoted-1', campaignId = 'c-post'): FeedSponsoredCard =>
  ({
    kind: 'post',
    impressionToken: 't',
    campaignId,
    post: { _id: postRef } as unknown as HydratedFeedItem,
  }) as FeedSponsoredCard;
const sponsoredListing = (campaignId = 'c-listing'): FeedSponsoredCard =>
  ({
    kind: 'listing',
    impressionToken: 't',
    campaignId,
    listing: {},
  }) as unknown as FeedSponsoredCard;
const sponsoredJob = (campaignId = 'c-job'): FeedSponsoredCard =>
  ({ kind: 'job', impressionToken: 't', campaignId, job: {} }) as unknown as FeedSponsoredCard;

describe('buildFeedRows - cadence + house promos (unchanged behavior)', () => {
  it('places no ad inside the first FIRST_AD_AFTER posts', () => {
    const rows = buildFeedRows(posts(FIRST_AD_AFTER - 1), HOUSE_PROMOS);
    expect(rows.every((r) => r.type === 'post')).toBe(true);
  });

  it('places the first house ad immediately after post #FIRST_AD_AFTER', () => {
    const rows = buildFeedRows(posts(FIRST_AD_AFTER), HOUSE_PROMOS);
    expect(rows).toHaveLength(FIRST_AD_AFTER + 1);
    expect(rows[FIRST_AD_AFTER].type).toBe('ad');
  });

  it('repeats every AD_INTERVAL posts and never places two ads adjacently', () => {
    const rows = buildFeedRows(posts(40), HOUSE_PROMOS);
    const ads = houseRowIndices(rows);
    expect(ads.length).toBeGreaterThan(1);
    for (let i = 1; i < ads.length; i += 1) {
      expect(ads[i] - ads[i - 1]).toBe(AD_INTERVAL + 1);
    }
  });

  it('keeps ad density under the 30% Better Ads ceiling', () => {
    const rows = buildFeedRows(posts(50), HOUSE_PROMOS);
    expect(houseRowIndices(rows).length / rows.length).toBeLessThan(0.3);
  });

  it('returns posts unchanged when there are no promos', () => {
    const rows = buildFeedRows(posts(20), []);
    expect(rows).toHaveLength(20);
    expect(rows.every((r) => r.type === 'post')).toBe(true);
  });

  it('rotates house promos round-robin and preserves every post once in order', () => {
    const rows = buildFeedRows(posts(40), HOUSE_PROMOS);
    const adIds = rows.flatMap((r) => (r.type === 'ad' ? [r.promo.id] : []));
    expect(adIds.slice(0, HOUSE_PROMOS.length)).toEqual(HOUSE_PROMOS.map((p) => p.id));
    const postIds = rows.flatMap((r) => (r.type === 'post' ? [r.post._id] : []));
    expect(postIds).toEqual(posts(40).map((p) => p._id));
  });
});

describe('buildFeedRows - unified sponsored cards (Phase 1)', () => {
  it('injects a sponsored card at the first ad slot, preserving its kind', () => {
    const rows = buildFeedRows(posts(FIRST_AD_AFTER), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredListing('c1')],
      houseAdsEnabled: false,
    });
    const sp = sponsoredRows(rows);
    expect(sp).toHaveLength(1);
    expect(sp[0].card.kind).toBe('listing');
    expect(sp[0].card.campaignId).toBe('c1');
    // No house promos when gated off.
    expect(rows.some((r) => r.type === 'ad')).toBe(false);
  });

  it('places multiple sponsored cards in the earliest slots, in order', () => {
    const rows = buildFeedRows(posts(FIRST_AD_AFTER + AD_INTERVAL + 1), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredListing('c-a'), sponsoredJob('c-b')],
      houseAdsEnabled: false,
    });
    const sp = sponsoredRows(rows);
    expect(sp.map((r) => r.card.campaignId)).toEqual(['c-a', 'c-b']);
    expect(sp.map((r) => r.card.kind)).toEqual(['listing', 'job']);
  });

  it('drops a sponsored POST whose id already appears organically (no duplicate)', () => {
    // p3 is an organic post on the page.
    const rows = buildFeedRows(posts(FIRST_AD_AFTER), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredPost('p3')],
      houseAdsEnabled: false,
    });
    // The deduped post leaves the slot empty (house ads off) -> no ad rows.
    expect(rows.every((r) => r.type === 'post')).toBe(true);
  });

  it('keeps a sponsored post whose id is NOT organic', () => {
    const rows = buildFeedRows(posts(FIRST_AD_AFTER), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredPost('promoted-x')],
      houseAdsEnabled: false,
    });
    expect(sponsoredRows(rows)).toHaveLength(1);
  });

  it('falls back to house promos in slots beyond the sponsored cards', () => {
    const rows = buildFeedRows(posts(40), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredListing('c1')],
      houseAdsEnabled: true,
    });
    const ads = anyAdRowIndices(rows);
    expect(rows[ads[0]].type).toBe('sponsored'); // first slot = sponsored
    expect(rows[ads[1]].type).toBe('ad'); // next slot = house promo
    // Cadence preserved (no two adjacent).
    for (let i = 1; i < ads.length; i += 1) {
      expect(ads[i] - ads[i - 1]).toBe(AD_INTERVAL + 1);
    }
  });

  it('no sponsored cards + house ads off => feed stays ad-free', () => {
    const rows = buildFeedRows(posts(50), HOUSE_PROMOS, {
      sponsoredCards: [],
      houseAdsEnabled: false,
    });
    expect(rows.every((r) => r.type === 'post')).toBe(true);
  });
});

describe('buildFeedRows - paid boosts in a short / sparse feed (first-slot gate fix)', () => {
  it('FIRST_PAID_AD_AFTER is earlier than the house gate but never the first post', () => {
    expect(FIRST_PAID_AD_AFTER).toBeLessThan(FIRST_AD_AFTER);
    expect(FIRST_PAID_AD_AFTER).toBeGreaterThanOrEqual(1);
  });

  it('serves a paid sponsored card in a short feed (fewer than FIRST_AD_AFTER posts)', () => {
    // A sparse feed of just FIRST_PAID_AD_AFTER posts (below the old FIRST_AD_AFTER
    // gate) now still shows the paid boost. With house ads OFF (production), the
    // old gate would have left this feed ad-free and the funded boost unseen.
    const rows = buildFeedRows(posts(FIRST_PAID_AD_AFTER), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredListing('paid-1')],
      houseAdsEnabled: false,
    });
    const sp = sponsoredRows(rows);
    expect(sp).toHaveLength(1);
    expect(sp[0].card.campaignId).toBe('paid-1');
    // The paid card sits right after FIRST_PAID_AD_AFTER posts (not the 1st post).
    const adIdx = anyAdRowIndices(rows)[0];
    expect(adIdx).toBe(FIRST_PAID_AD_AFTER);
    expect(rows[0].type).toBe('post');
  });

  it('does NOT let a HOUSE promo appear in the early paid-only slot', () => {
    // House ads ON, but NO paid card: the first ad must still wait for the
    // conservative house gate (FIRST_AD_AFTER), so filler never appears earlier.
    const rows = buildFeedRows(posts(FIRST_AD_AFTER), HOUSE_PROMOS, {
      sponsoredCards: [],
      houseAdsEnabled: true,
    });
    const firstAd = anyAdRowIndices(rows)[0];
    expect(firstAd).toBe(FIRST_AD_AFTER);
  });

  it('paid fills the early slot, then house promos resume at / after the house gate', () => {
    // firstAfter = FIRST_PAID_AD_AFTER (paid present). Slot 1 (paid) at post 2,
    // slot 2 (house) at post 2 + AD_INTERVAL >= FIRST_AD_AFTER, so the house promo
    // is never in the early paid-only position.
    const rows = buildFeedRows(posts(30), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredListing('paid-1')],
      houseAdsEnabled: true,
    });
    const ads = anyAdRowIndices(rows);
    expect(rows[ads[0]].type).toBe('sponsored');
    expect(rows[ads[1]].type).toBe('ad');
    // Every house-promo ad row corresponds to a post position >= FIRST_AD_AFTER.
    const housePostPositions = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.type === 'ad')
      // posts before this ad row = ad row index - (ads placed before it)
      .map(({ i }) => i - rows.slice(0, i).filter((x) => x.type !== 'post').length);
    for (const pos of housePostPositions) expect(pos).toBeGreaterThanOrEqual(FIRST_AD_AFTER);
  });

  it('keeps overall ad density under the 30% Better Ads ceiling with an early paid slot', () => {
    const rows = buildFeedRows(posts(50), HOUSE_PROMOS, {
      sponsoredCards: [sponsoredListing('paid-1')],
      houseAdsEnabled: true,
    });
    expect(anyAdRowIndices(rows).length / rows.length).toBeLessThan(0.3);
  });
});
