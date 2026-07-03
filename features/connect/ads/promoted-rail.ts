import { decideListingAd } from './ads.actions';
import { getPublicListing } from '../marketplace/marketplace.actions';
import type { PromotedListingResolved } from '../marketplace/PromotedListingAdCard';

/**
 * Resolve the first-party promoted-listing ad for a rail placement: run the ad
 * decision for `placementKey`, then hydrate the winning listing via the public
 * endpoint (which only returns an active + approved listing, so a paused /
 * unpublished boost target safely yields no ad). Any miss returns null and the
 * rail renders no first-party ad. Never throws into the page render.
 *
 * Shared by the marketplace rail (`marketplace_rail`), the company page
 * (`company_page`), and the storefront page (`storefront_page`). The placement
 * must be a seeded `AdPlacement` (surface `rail`) for the backend to return a
 * decision; an unseeded placement just yields null.
 */
export async function resolvePromotedRailListing(
  placementKey: string,
  // Optional per-page-render id (fairness C5). Pass the SAME id for every slot
  // on one page (e.g. marketplace rail + grid) so a campaign serves at most once
  // across them. Omit on single-slot pages (dedupe is then a no-op).
  pageRequestId?: string,
): Promise<PromotedListingResolved | null> {
  try {
    const decideRes = await decideListingAd(placementKey, pageRequestId);
    const decision = decideRes.ok ? decideRes.data : null;
    if (!decision) return null;
    const listingRes = await getPublicListing(decision.listingRef);
    if (!listingRes.ok) return null;
    return {
      listing: listingRes.data,
      impressionToken: decision.impressionToken,
      campaignId: decision.campaignId,
    };
  } catch {
    return null;
  }
}
