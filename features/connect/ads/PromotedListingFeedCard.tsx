'use client';

/**
 * PromotedListingFeedCard - a boosted marketplace product as a full-width feed
 * card (Phase 1).
 *
 * REDESIGN (2026-06-20): renders the REAL marketplace browse card (ListingGridCard)
 * in its `promoted` variant instead of a basic cover+title+price stub, so an
 * in-feed listing boost shows the same rich signals as the marketplace grid
 * (image carousel, category eyebrow, price + unit / Negotiable pill, MOQ,
 * district, rating, verified, course fee/duration) and never drifts from the
 * canonical card. Mirrors the marketplace-grid wrapper pattern
 * (PromotedGridListingCard): a beacon cardRef wrapper measures viewability; the
 * click beacon rides ListingGridCard's stretched detail link (carousel arrows
 * stopPropagation, so they never count as ad clicks). ListingGridCard's own
 * `promoted` chip carries the "Promoted" disclosure.
 *
 * Cross-module: ListingDetail (marketplace.types) -> ConnectListingRef
 * (search.types) mapping kept in sync with PromotedGridListingCard.toListingRef;
 * ListingGridCard (components/connect/ListingGridCard.tsx); useAdBeacons ->
 * /connect/ads/events/*.
 */

import { ListingGridCard } from '@/components/connect';
import { useAdBeacons } from './use-ad-beacons';
import type { ConnectListingRef } from '../search.types';
import type { ListingDetail } from '../marketplace/marketplace.types';

export interface PromotedListingFeedCardProps {
  listing: ListingDetail;
  impressionToken: string;
  campaignId: string;
}

/** ListingDetail (full, auction-resolved) -> ConnectListingRef (slim grid card).
 *  Keep in sync with PromotedGridListingCard.toListingRef (same mapping intent). */
function toListingRef(listing: ListingDetail): ConnectListingRef {
  return {
    listingId: listing._id,
    ownerUserId: listing.ownerUserId,
    title: listing.title,
    description: listing.description,
    category: listing.category,
    priceType: listing.priceType,
    priceMin: listing.priceMin ?? null,
    priceMax: listing.priceMax ?? null,
    unit: listing.unit ?? null,
    // ListingDetail keeps location as a sub-object; the slim card wants a flat
    // district string (casing preserved, like the search/grid card).
    district: listing.location?.district ?? '',
    coverImage: listing.images?.[0] ?? null,
    images: listing.images,
    hasVideo: (listing.videos?.length ?? 0) > 0,
    verified: listing.verified,
    rating: listing.rating,
    moq: listing.moq ?? null,
    // Course listings (Institutes) render fee/duration instead of price/MOQ; map
    // the overlapping fields, else null so a product renders the product card.
    courseDetails:
      listing.category === 'course' && listing.courseDetails
        ? {
            durationLabel: listing.courseDetails.durationLabel,
            batchStart: listing.courseDetails.batchStart ?? null,
            mode: listing.courseDetails.mode,
            feeType: listing.courseDetails.feeType,
            seats: listing.courseDetails.seats ?? null,
            certificate: listing.courseDetails.certificate,
            skillsTaught: listing.courseDetails.skillsTaught,
          }
        : null,
    createdAt: listing.createdAt ?? '',
  };
}

export default function PromotedListingFeedCard({
  listing,
  impressionToken,
  campaignId,
}: PromotedListingFeedCardProps) {
  // MRC viewability + click beacons (billing). cardRef on the wrapper measures
  // viewability; onClick bubbles up from ListingGridCard's stretched detail link
  // (carousel arrows stopPropagation, so they never count as ad clicks).
  // Links: lib/analytics-events.ts; placement feed, kind 'boost'.
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'feed',
    kind: 'boost',
    campaignId,
  });

  return (
    <div ref={cardRef} onClick={onClick}>
      <ListingGridCard listing={toListingRef(listing)} source="feed" promoted />
    </div>
  );
}
