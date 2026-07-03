/**
 * Marketplace grid ad cadence (placement target map).
 *
 * Two distinct ad sources feed the product grid, with DIFFERENT placement rules:
 *
 *  1. A first-party PROMOTED LISTING (a funded `marketplace_grid` boost) is
 *     PINNED at the TOP of the grid - the first cell, row 1, on ALL breakpoints
 *     including mobile (see `isGridFirstPartyTopSlot`). A boosted listing that
 *     the seller paid for must be the most visible unit, not buried 12 cards
 *     down. It carries the existing "Promoted" disclosure label (the reused
 *     PromotedListingAdCard).
 *  2. House / Google fallback cells interleave at most one sponsored cell per
 *     ~12 product cards, and never in the first visible row (see `isGridAdSlot`).
 *     These are filler, so they stay out of the way.
 *
 * Both rules live here as pure functions so the screen stays declarative and the
 * cadence is unit-testable without rendering. Used by
 * MarketplaceBrowseScreen.gridChildren.
 *
 * Cross-surface note: the search results row uses a different rule (a single
 * row, never first) - this helper is grid-only.
 */

/**
 * Whether the first-party promoted listing should occupy the TOP grid slot.
 * Always true when a `marketplace_grid` boost resolved - the promoted unit pins
 * at the very top of the grid (row 1) on every breakpoint, mobile included, so a
 * paid boost is the first thing a buyer sees. Kept as a named predicate (not an
 * inline `Boolean(promoted)`) so the "pin at top" rule is explicit + testable.
 */
export function isGridFirstPartyTopSlot(promoted: unknown): boolean {
  return Boolean(promoted);
}

/**
 * Max columns the responsive grid renders at any breakpoint. The first ad must
 * sit beyond this many cards so it can never appear in row 1, whatever the
 * column count. Keep in sync with the grid's CSS column count.
 */
export const GRID_MAX_COLUMNS = 4;

/**
 * 1-based product count after which the FIRST sponsored cell may appear. Chosen
 * >= GRID_MAX_COLUMNS so the first ad is always past the first row, and large
 * enough to give the ~1-per-12 density below.
 */
export const GRID_AD_FIRST_AFTER = 12;

/** Product cards between sponsored cells thereafter (1 sponsored per ~12). */
export const GRID_AD_INTERVAL = 12;

/**
 * Whether a FALLBACK (house / Google) sponsored cell should be injected AFTER
 * `cardCount` product cards have been rendered (cardCount is 1-based: 1 = after
 * the first card).
 *
 * Returns true at the first-after threshold and then once per interval, so the
 * grid gets at most one fallback sponsored cell per `interval` cards, the first
 * never in the first row. NOTE: the first-party promoted boost no longer flows
 * through this cadence - it pins at the top via `isGridFirstPartyTopSlot`. This
 * predicate now governs ONLY the Google/house fallback cells.
 */
export function isGridAdSlot(
  cardCount: number,
  firstAfter: number = GRID_AD_FIRST_AFTER,
  interval: number = GRID_AD_INTERVAL,
): boolean {
  if (cardCount < firstAfter) return false;
  return (cardCount - firstAfter) % interval === 0;
}
