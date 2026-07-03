'use client';

/**
 * PromotedGridListingCard - a funded first-party PROMOTED listing rendered as a
 * NORMAL marketplace grid card (ListingGridCard) so it is visually identical to
 * its organic neighbours and degrades gracefully on thin data, instead of the
 * compact rail card. The "Promoted" disclosure rides ListingGridCard's `promoted`
 * chip; the SHARED MRC viewability + click beacons (useAdBeacons) still fire for
 * billing.
 *
 * Used by MarketplaceGridAdCell for the in-grid `marketplace_grid` slot; the
 * desktop-only `xl` rail still uses the compact PromotedListingAdCard.
 *
 * Maps the hydrated ListingDetail (what the auction resolves) to the slim
 * ConnectListingRef shape ListingGridCard renders. Keep the mapping in sync with
 * ConnectListingRef (features/connect/search.types.ts) and ListingDetail
 * (features/connect/marketplace/marketplace.types.ts).
 */

import { ListingGridCard } from '@/components/connect';
import { useAdBeacons } from '../ads/use-ad-beacons';
import type { ConnectListingRef } from '../search.types';
import type { PromotedListingResolved } from './PromotedListingAdCard';

/** ListingDetail (full, auction-resolved) -> ConnectListingRef (slim grid card). */
function toListingRef(listing: PromotedListingResolved['listing']): ConnectListingRef {
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
    // district string (casing preserved, like the search card).
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

export default function PromotedGridListingCard({
  listing,
  impressionToken,
  campaignId,
}: PromotedListingResolved) {
  // MRC viewability + click beacons (billing). cardRef on the wrapper measures
  // viewability; onClick bubbles up from ListingGridCard's stretched detail link
  // (carousel arrows stopPropagation, so they never count as ad clicks).
  // Links: lib/analytics-events.ts; placement marketplace_grid, kind 'boost'.
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'marketplace_grid',
    kind: 'boost',
    campaignId,
  });

  return (
    <div ref={cardRef} onClick={onClick} className="h-full w-full">
      <ListingGridCard listing={toListingRef(listing)} source="grid" promoted />
    </div>
  );
}
