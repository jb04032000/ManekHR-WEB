/**
 * search-context - resolve the contextual default search scope from the active
 * route (checklist §3 / spec §3.3 #7).
 *
 * The global search bar is rendered in the shared Connect header on every
 * Connect surface. When the member is inside the Marketplace, a bare query
 * should default to Products (listings); inside Jobs it should default to Jobs.
 * Everywhere else it stays "all" (the blended federated view).
 *
 * Used by:
 *   - components/connect/ConnectSearchBar.tsx (desktop typeahead) - so the
 *     "see all" jump carries the right `type`.
 *   - features/connect/search/SearchResultsScreen.tsx - the zero-result popular
 *     categories adapt to the same context.
 *
 * Keep the path prefixes in sync with the real Connect route tree
 * (app/connect/marketplace, app/connect/jobs).
 */

import type { SearchType } from '../search.types';

/**
 * The contextual default vertical for a given pathname. Returns the `type` the
 * search bar should pre-select when the member has not chosen one. `'all'` is
 * the neutral default (blended federation).
 */
export function searchScopeForPath(pathname: string | null | undefined): SearchType {
  if (!pathname) return 'all';
  // Marketplace surface -> Products (listings) scope. Covers the landing and
  // every sub-route (listing detail, mine, inquiries, new, edit, preview).
  if (pathname.startsWith('/connect/marketplace')) return 'listings';
  // Jobs board -> Jobs scope (board landing + a job detail page).
  if (pathname.startsWith('/connect/jobs')) return 'jobs';
  // The dedicated results page and everywhere else keep the blended default.
  return 'all';
}
