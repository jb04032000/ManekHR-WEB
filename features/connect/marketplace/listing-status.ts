/**
 * Single source of truth for a listing's SELLER-FACING display status and the
 * "is it live" gate. Shared by the storefront console's stat tiles
 * (ManageStorefrontScreen) and the product manager (OwnerListingsManager) so the
 * two surfaces can never drift (they used to compute "live" three different ways).
 *
 * "Live" here means exactly what a buyer sees on the public store + marketplace:
 * `status === 'active' && moderationStatus === 'approved' && has a cover photo`.
 * A cover photo is the ONLY hard requirement to be live (it is the public grid's
 * gate). Price and description are quality signals - a soft, non-blocking
 * "add details" nudge - NOT a visibility blocker.
 *
 * Keep in sync with the backend public gate (`listing.service`
 * `listPublicByStorefront`: status active + moderationStatus approved) and the
 * backend storefront `live` stat (which also counts active + approved + photo).
 */
import type { OwnerListing } from './marketplace.types';

/** The seller-facing badge/filter status (derived, not a raw backend field). */
export type ListingDisplayStatus =
  | 'live'
  | 'needsPhoto'
  | 'pending'
  | 'draft'
  | 'paused'
  | 'rejected'
  | 'expired';

export const hasPhoto = (l: OwnerListing): boolean => !!(l.images && l.images.length);
export const hasDescription = (l: OwnerListing): boolean => !!l.description?.trim();
// A price stance counts as set when it is "negotiable" or carries a number.
export const hasPrice = (l: OwnerListing): boolean =>
  l.priceType === 'negotiable' || typeof l.priceMin === 'number';

/**
 * The one place that turns a listing into its seller-facing status. A cover photo
 * is the only hard requirement to be live; an active + approved listing without
 * one shows "Needs photo" (the single thing blocking buyer visibility). Every
 * other state mirrors the raw lifecycle (draft / paused / rejected / expired /
 * in-review), and a rejected/pending moderation verdict wins over `active` so a
 * not-yet-public listing never reads as "Live".
 */
export function listingDisplayStatus(l: OwnerListing): ListingDisplayStatus {
  if (l.status === 'draft') return 'draft';
  if (l.status === 'paused') return 'paused';
  if (l.status === 'expired') return 'expired';
  if (l.status === 'rejected' || l.moderationStatus === 'rejected') return 'rejected';
  if (l.status === 'pending_review' || l.moderationStatus === 'pending') return 'pending';
  // status === 'active' && moderationStatus === 'approved' from here.
  return hasPhoto(l) ? 'live' : 'needsPhoto';
}

/** Buyer-visible == matches the public store / marketplace gate exactly. */
export const isLive = (l: OwnerListing): boolean => listingDisplayStatus(l) === 'live';

/** Active + approved but no cover photo - the only thing blocking visibility. */
export const isNeedsPhoto = (l: OwnerListing): boolean => listingDisplayStatus(l) === 'needsPhoto';

/**
 * Live but thin: a soft, non-blocking nudge to add price/description. NOT a
 * status - the product is already live and visible; this only suggests a richer
 * listing sells better.
 */
export const needsDetails = (l: OwnerListing): boolean =>
  isLive(l) && (!hasDescription(l) || !hasPrice(l));
