/**
 * Search results sponsored-row rule (placement target map).
 *
 * Search is trust-sensitive: at most ONE sponsored listing row, clearly
 * labelled, and NEVER the very first result. This pure helper owns that rule so
 * SearchResultsScreen stays declarative and the placement is unit-testable
 * without rendering. Used by SearchResultsScreen.listingRows.
 */

/**
 * The index at which to splice the single sponsored row into the organic
 * listing rows, or null to inject none.
 *
 *  - null when there is no eligible promoted listing, OR no organic listing to
 *    precede it (so the sponsored row can never be the first result).
 *  - 1 (the second position) otherwise: never first, at most one.
 */
export function sponsoredSearchRowIndex(listingCount: number, hasPromoted: boolean): number | null {
  if (!hasPromoted || listingCount < 1) return null;
  return 1;
}
