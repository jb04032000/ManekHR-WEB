import type { SearchConnectAllInput } from './search.types';

/** True when any facet is set; used to decide if a blank-q browse is valid.
 *  CN-SRCH-5 (feed harden Bucket 9): single shared definition so the
 *  `/connect/search` page and `searchConnectAll` (in `search.actions.ts`)
 *  can never drift (the page's old duplicate omitted providingServices /
 *  verified / categoryIn, so a facet-only browse on those wrongly hit the
 *  "no query" prompt). Kept in a plain (non-`'use server'`) module because a
 *  Server Actions file may only export async functions. */
export function hasAnyFilter(filters: SearchConnectAllInput['filters']): boolean {
  if (!filters) return false;
  return Boolean(
    (filters.skills && filters.skills.length > 0) ||
    (filters.district && filters.district.length > 0) ||
    filters.openToWork !== undefined ||
    filters.providingServices !== undefined ||
    filters.category !== undefined ||
    // A blank-q services browse with only the blended `categoryIn` set is valid
    // (the /connect/services "all services" default flows past this guard to the BE).
    (filters.categoryIn && filters.categoryIn.length > 0) ||
    filters.priceMin !== undefined ||
    filters.priceMax !== undefined ||
    filters.kind !== undefined ||
    filters.verified !== undefined ||
    (filters.tags && filters.tags.length > 0) ||
    // SRCH-VERT-1: a bare `?type=pages&pageKind=institute` browse is valid.
    filters.pageKind !== undefined,
  );
}
