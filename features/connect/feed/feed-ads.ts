/**
 * feed-ads -- the in-feed sponsored slot model (no React, pure + testable).
 *
 * The feed column carries occasional sponsored cards (mobile has no side rail at
 * all; desktop keeps the rail too). This module owns the placement cadence + the
 * house-promo inventory; `FeedList` weaves the rows and the per-kind cards render
 * them.
 *
 * Cadence is research-backed (see PROGRESS "Mobile in-feed ads"):
 *  - First ad only AFTER the 4th post (never inside the first three).
 *  - Then one ad per 6 posts, never two adjacent.
 *  - => ~14% of rows are ads, comfortably under the Coalition for Better Ads
 *    mobile 30% ad-density ceiling.
 *
 * Phase 1 "boosts in the feed": a single UNIFIED sponsored slot carries ANY boost
 * kind (post / profile / listing / job / rfq). The Server Component resolves up to
 * a couple of `FeedSponsoredCard`s from the `feed_sponsored` auction (best match
 * per viewer, deduped per page) and passes them here; `buildFeedRows` drops them
 * into the cadence slots in order. Remaining slots fall back to house promos (when
 * enabled). A sponsored POST whose id already appears organically on the page is
 * dropped so the same content never shows twice.
 */

import type { HydratedFeedItem } from '../feed.types';
import type { ConnectPerson } from '@/components/connect';
import type { ListingDetail } from '../marketplace/marketplace.types';
import type { Job } from '../jobs/jobs.types';
import type { RfqDetail } from '../rfq/rfq.types';

/**
 * A fully-resolved in-feed sponsored card, passed from the Server Component down
 * to FeedList. Carries the hydrated entity (so the card renders in the initial
 * HTML, zero waterfall) + the decision tokens the MRC beacons need. The `kind`
 * discriminant selects which native card renders. The feed slot is one auction;
 * any kind can win it.
 */
//
// `isDemo` on each variant: true when the sponsored unit is seeded sample content
// (denormalized from the advertiser's User.isDemo). Carried at the top level so the
// native card reads one source for the SampleBadge instead of reaching into the
// nested entity. Optional; absent = real. Keep in sync with the BE feed_sponsored
// decide response + every other Connect isDemo mirror.
export type FeedSponsoredCard =
  | {
      kind: 'post';
      impressionToken: string;
      campaignId: string;
      post: HydratedFeedItem;
      isDemo?: boolean;
    }
  | {
      kind: 'profile';
      impressionToken: string;
      campaignId: string;
      intent: 'open_to_work' | 'hiring';
      person: ConnectPerson;
      isDemo?: boolean;
    }
  | {
      kind: 'listing';
      impressionToken: string;
      campaignId: string;
      listing: ListingDetail;
      isDemo?: boolean;
    }
  | { kind: 'job'; impressionToken: string; campaignId: string; job: Job; isDemo?: boolean }
  | { kind: 'rfq'; impressionToken: string; campaignId: string; rfq: RfqDetail; isDemo?: boolean };

/** First HOUSE ad slot AFTER this many posts (so the first 3 posts are ad-free). */
export const FIRST_AD_AFTER = 4;
/**
 * First PAID-boost slot AFTER this many posts. Lower than `FIRST_AD_AFTER` so a
 * genuine, advertiser-funded boost can serve in a short / sparse feed (it would
 * otherwise never appear when the feed has fewer than `FIRST_AD_AFTER + 1` posts,
 * with house ads off in production). Only REAL paid sponsored cards use this
 * earlier gate; house promos keep the conservative `FIRST_AD_AFTER` gate, so this
 * does NOT make filler ads appear earlier. Kept >= 1 so the very first post is
 * never an ad. ~paid density stays well under the Better Ads ceiling.
 */
export const FIRST_PAID_AD_AFTER = 2;
/** One ad per this many posts after the first. ~14% density at 6. */
export const AD_INTERVAL = 6;

export type HousePromoId = 'network' | 'profile' | 'explore';

export interface HousePromo {
  /** Stable id; also the i18n key suffix (`connect.feed.ads.<id>.*`) and the
   *  icon key resolved in `FeedAdCard`. */
  id: HousePromoId;
  /** Real in-app destination. No dead links. */
  href: string;
}

/**
 * v1 house-promo inventory, rotated round-robin across the ad slots. Every
 * destination is a live route. Replace this with a real ad-provider feed later;
 * `buildFeedRows` and `FeedAdCard` are inventory-agnostic.
 */
export const HOUSE_PROMOS: readonly HousePromo[] = [
  { id: 'network', href: '/connect/network?tab=suggestions' },
  { id: 'profile', href: '/connect/profile' },
  { id: 'explore', href: '/connect/search' },
];

export type FeedRow =
  | { type: 'post'; key: string; post: HydratedFeedItem }
  | { type: 'ad'; key: string; promo: HousePromo }
  | { type: 'sponsored'; key: string; card: FeedSponsoredCard };

/**
 * Options accepted by `buildFeedRows`.
 *
 * @param sponsoredCards - Resolved sponsored cards (any boost kind), placed into
 *   the earliest ad slots in order. A `post` card whose id matches an organic
 *   post on this page is dropped (no duplicate content). When empty, slots fall
 *   back to house promos (subject to `houseAdsEnabled`).
 * @param houseAdsEnabled - When `true` (default) empty ad slots are filled with
 *   the round-robin `HOUSE_PROMOS` inventory. When `false` the slot stays EMPTY
 *   unless a real sponsored card fills it (gated off from FeedList 2026-06-16).
 */
export interface BuildFeedRowsOptions {
  sponsoredCards?: readonly FeedSponsoredCard[];
  houseAdsEnabled?: boolean;
}

/**
 * Interleave sponsored cards (and optionally house promos) into the post stream
 * at the cadence above. Pure + deterministic: never mutates the input, never
 * duplicates a post, never places an ad on the very first post or two ads
 * adjacently. With no sponsored cards and house ads off, it returns the posts
 * unchanged.
 *
 * First-slot gate: a genuine PAID boost opens the first slot at
 * `FIRST_PAID_AD_AFTER` (so it can serve in a short / sparse feed); a house promo
 * still waits until `FIRST_AD_AFTER`. Because the early slot only opens WHEN a
 * paid card is available, and paid cards fill the earliest slots first, a house
 * promo can never land in that early slot - it only ever fills slots at or after
 * `FIRST_AD_AFTER`. After the first slot the cadence repeats every `AD_INTERVAL`.
 */
export function buildFeedRows(
  posts: readonly HydratedFeedItem[],
  promos: readonly HousePromo[],
  options: BuildFeedRowsOptions = {},
): FeedRow[] {
  const { sponsoredCards = [], houseAdsEnabled = true } = options;

  // Dedupe guard: drop a sponsored POST whose id already appears organically on
  // this page (other kinds have no organic-post collision). The auction's
  // self-impression guard already keeps a user off their own boost.
  const organicRefs = new Set(posts.map((p) => p._id));
  const priorityAds = sponsoredCards.filter(
    (c) => !(c.kind === 'post' && organicRefs.has(c.post._id)),
  );

  // House promos only fill slots when enabled AND there is inventory left. When
  // house ads are off, slots only ever open to carry a real sponsored card.
  const houseAdsActive = houseAdsEnabled && promos.length > 0;
  const hasPaid = priorityAds.length > 0;
  const slotsActive = houseAdsActive || hasPaid;

  // A paid boost may open the FIRST slot earlier than a house promo. When no paid
  // card is available, the first slot keeps the conservative house gate, so filler
  // ads never appear earlier than before.
  const firstAfter = hasPaid ? FIRST_PAID_AD_AFTER : FIRST_AD_AFTER;

  const rows: FeedRow[] = [];
  // `adCount` counts EVERY ad slot (sponsored + house) so the house-promo
  // round-robin index + keys stay stable across the run.
  let adCount = 0;

  for (let i = 0; i < posts.length; i += 1) {
    rows.push({ type: 'post', key: posts[i]._id, post: posts[i] });
    const emitted = i + 1; // posts emitted so far

    if (slotsActive && emitted >= firstAfter && (emitted - firstAfter) % AD_INTERVAL === 0) {
      if (adCount < priorityAds.length) {
        // Paid sponsored cards fill the earliest slots, in the order resolved.
        const card = priorityAds[adCount];
        rows.push({ type: 'sponsored', key: `sponsored-${card.kind}-${card.campaignId}`, card });
        adCount += 1;
      } else if (houseAdsActive && emitted >= FIRST_AD_AFTER) {
        // House promo for the remaining slots - but only at / after the
        // conservative house gate, so a filler never appears in the early
        // paid-only slot. Skipped entirely when house ads are gated off, leaving
        // the slot empty so only real boosted units show.
        const promo = promos[adCount % promos.length];
        rows.push({ type: 'ad', key: `ad-${adCount}-${promo.id}`, promo });
        adCount += 1;
      }
      // When neither arm fills the slot (paid exhausted + house gated/too early)
      // the slot stays empty and `adCount` is unchanged, so cadence + house index
      // are unaffected.
    }
  }

  return rows;
}
