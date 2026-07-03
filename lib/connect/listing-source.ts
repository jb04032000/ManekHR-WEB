/**
 * Listing arrival-source breadcrumb.
 *
 * What it does: lets a marketplace card record HOW the user is navigating into a
 * listing detail (feed / search / grid) without polluting the listing URL with a
 * tracking query param. The card calls `markListingSource(...)` on click; the
 * detail page's `ViewBeacon` calls `consumeListingSource()` on mount to read it
 * back for the additive `connect.listing.viewed` analytics event.
 *
 * Cross-module links:
 *  - Writers: `components/connect/ListingCard.tsx`, `ListingGridCard.tsx` (onClick).
 *  - Reader: `features/connect/views/ViewBeacon.tsx` (mount effect).
 *  - Event shape: `lib/analytics-events.ts` (`ListingSource`).
 *
 * Watch: this is a module-singleton, so it only carries across an in-app client
 * navigation. A full page load (shared link, new tab, refresh) starts empty and
 * therefore reports `direct` - which is exactly the correct label for those.
 */

import type { ListingSource } from '@/lib/analytics-events';

let pending: ListingSource | null = null;

/** Record how the user is heading into a listing detail (card click). */
export function markListingSource(source: ListingSource): void {
  pending = source;
}

/**
 * Read and clear the arrival source. Defaults to `direct` when nothing was set
 * (full page load / shared link / refresh).
 */
export function consumeListingSource(): ListingSource {
  const s = pending ?? 'direct';
  pending = null;
  return s;
}
