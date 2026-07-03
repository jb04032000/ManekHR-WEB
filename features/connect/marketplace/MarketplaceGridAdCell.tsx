'use client';

/**
 * MarketplaceGridAdCell - one in-grid ad occupying a marketplace product-grid
 * cell. Mirrors the company-directory ad cell and the AdSlot seam: a
 * server-resolved first-party promoted listing when present, otherwise the
 * Google AdSense unit. The marketplace screen only mounts a cell when one source
 * is actually configured (first-party resolved, or AdSense client + slot set),
 * so an ad cell never collapses to an empty grid hole. Both arms label
 * themselves ("Promoted" / "Sponsored") for IAB + FTC disclosure.
 */

import { env } from '@/lib/env';
import GoogleAdUnit from '@/components/connect/GoogleAdUnit';
import { type PromotedListingResolved } from '@/features/connect/marketplace/PromotedListingAdCard';
// First-party in-grid boost renders as a normal ListingGridCard (consistent with
// organic cards + graceful on thin data), NOT the compact rail card.
import PromotedGridListingCard from '@/features/connect/marketplace/PromotedGridListingCard';

interface MarketplaceGridAdCellProps {
  /** A server-resolved first-party promoted listing; when absent, render Google. */
  promoted?: PromotedListingResolved | null;
}

export default function MarketplaceGridAdCell({ promoted }: MarketplaceGridAdCellProps) {
  // First-party promoted listing renders as a full ListingGridCard (it owns its
  // own hover lift + Promoted chip), so only the Google fallback gets the wrapper
  // hover here.
  if (promoted) {
    return <PromotedGridListingCard {...promoted} />;
  }
  return (
    <div className="h-full transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]">
      <GoogleAdUnit
        client={env.adSenseClientId}
        slot={env.adSenseSlots['connect.marketplace.grid']}
        placement="connect.marketplace.grid"
      />
    </div>
  );
}
