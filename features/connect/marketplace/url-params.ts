/**
 * URL-param coercion for the `/connect/marketplace` browse page (M1.6.1).
 *
 * The marketplace is a listings-only view of the same federated search backend
 * the `/connect/search` page uses. Its Server Component folds the Next.js
 * `searchParams` into the typed `SearchConnectAllInput` the `searchConnectAll`
 * action consumes, always pinned to `type: 'listings'` so the request never
 * fans out to people or jobs.
 *
 * Coercion reuses the exact primitives the search page exports (`readScalar`,
 * `readCategory`, `readNonNegativeNumber`) so a `category` / `price` facet
 * behaves identically on both surfaces - the marketplace just narrows the read
 * to the listing facets (no people facets like skills / openToWork).
 */

import { readCategory, readNonNegativeNumber, readScalar } from '../search/url-params';
import { MARKETPLACE_SORTS, SERVICE_CATEGORY_SLUGS, isServiceCategory } from '../search.types';
import type { SearchConnectAllInput, SearchFilters } from '../search.types';

/** The slider ceiling. Reaching it means "no upper price limit", so the
 *  `priceMax` param is dropped rather than pinned to the ceiling. */
export const PRICE_MAX = 100000;

/** Raw, untyped Next.js Server-Component searchParams for `/connect/marketplace`. */
export interface MarketplaceBrowseRawParams {
  q?: string | string[];
  category?: string | string[];
  district?: string | string[];
  priceMin?: string | string[];
  priceMax?: string | string[];
  /** Seller-tag single-select facet -> `?tag=<slug>`. */
  tag?: string | string[];
  /** Verified-sellers-only toggle -> `?verified=1`. */
  verified?: string | string[];
  /** Sort order -> `?sort=<MarketplaceSort>`. */
  sort?: string | string[];
}

/**
 * Fold the URL params into the listings-pinned search input. `filters` is
 * omitted entirely when no listing facet is present so the action's downstream
 * param object stays minimal (and a bare `/connect/marketplace` short-circuits
 * to the browse landing rather than an empty search round-trip).
 */
export function readMarketplaceBrowseInput(raw: MarketplaceBrowseRawParams): SearchConnectAllInput {
  const q = (readScalar(raw.q) ?? '').trim();

  const filters: SearchFilters = {};
  const category = readCategory(raw.category);
  if (category !== undefined) filters.category = category;
  const district = readScalar(raw.district);
  if (district !== undefined && district.length > 0) filters.district = district;
  const priceMin = readNonNegativeNumber(raw.priceMin);
  if (priceMin !== undefined) filters.priceMin = priceMin;
  const priceMax = readNonNegativeNumber(raw.priceMax);
  if (priceMax !== undefined) filters.priceMax = priceMax;
  // Tag single-select: `?tag=<slug>`. We pass it as a one-element array so the
  // backend DTO (which accepts `tags[]`) gets the correct shape, and widening to
  // multi-select later needs zero backend-DTO changes.
  const tag = readScalar(raw.tag);
  if (tag !== undefined && tag.trim().length > 0) filters.tags = [tag.trim()];
  // Verified-sellers-only toggle. Accept `1` or `true` so the URL stays terse.
  const verified = readScalar(raw.verified);
  if (verified === '1' || verified === 'true') filters.verified = true;

  const input: SearchConnectAllInput = { q, type: 'listings' };
  if (Object.keys(filters).length > 0) input.filters = filters;
  // Sort: validated against the known set so a stray `?sort=` never reaches the
  // backend. Absent or unknown leaves the backend default (recent).
  const sort = readScalar(raw.sort);
  if (sort && (MARKETPLACE_SORTS as readonly string[]).includes(sort)) {
    input.sort = sort as (typeof MARKETPLACE_SORTS)[number];
  }
  return input;
}

/**
 * Services browse (`/connect/services`, Slice B3) input reader. Same coercion as
 * `readMarketplaceBrowseInput`, but the category is CLAMPED to a service category:
 * a `?category=` that is not a service slug (e.g. `machinery`) is dropped, so the
 * services route can never be steered into showing a non-service category. The
 * service-type sub-filter maps to the existing single-select `?category=` BE
 * filter (services are just listings with a service category) - no new endpoint.
 *
 * Note: with no service category picked, the page blends the whole service set via
 * `withServicesBlend` (below) so the surface shows "all services" by default rather
 * than a pick-a-type prompt. The BE `categoryIn` set keeps products out (only the
 * service slugs are sent), so the services surface is never steered into products.
 */
export function readServicesBrowseInput(raw: MarketplaceBrowseRawParams): SearchConnectAllInput {
  const input = readMarketplaceBrowseInput(raw);
  // Drop a non-service category so /connect/services stays service-scoped.
  if (input.filters?.category !== undefined && !isServiceCategory(input.filters.category)) {
    const rest: SearchFilters = { ...input.filters };
    delete rest.category;
    input.filters = Object.keys(rest).length > 0 ? rest : undefined;
  }
  return input;
}

/**
 * Apply the "all services" blend to a services-browse input. When NO single
 * service type is selected (no `category`), set `categoryIn` to the full service
 * category set so `/connect/services` shows a blended result across every service
 * category at once - instead of forcing the buyer to pick a type first. When a
 * single service type IS selected, leave the input untouched: the single
 * `category` filter narrows to that one type (the BE drops `categoryIn` when
 * absent), so the type strip narrows exactly like the marketplace category facet.
 *
 * Pure: takes the read input, returns a new input (does not mutate). Products
 * never bleed in because `categoryIn` is the service set only. Call this in the
 * Server Component after `readServicesBrowseInput`.
 */
export function withServicesBlend(input: SearchConnectAllInput): SearchConnectAllInput {
  // A single service type is picked -> narrow to it; no blend.
  if (input.filters?.category !== undefined) return input;
  const filters: SearchFilters = { ...input.filters, categoryIn: [...SERVICE_CATEGORY_SLUGS] };
  return { ...input, filters };
}

/**
 * Map a price-range slider `[min, max]` value to the `priceMin` / `priceMax`
 * params. A bound sitting at a slider extreme is dropped - `0` is no floor and
 * `PRICE_MAX` is no ceiling - so an untouched slider never silently narrows the
 * search. Pure: the slider component applies the result to the URL.
 */
export function priceRangeToParams(value: [number, number]): {
  priceMin?: number;
  priceMax?: number;
} {
  const [min, max] = value;
  const out: { priceMin?: number; priceMax?: number } = {};
  if (min > 0) out.priceMin = min;
  if (max < PRICE_MAX) out.priceMax = max;
  return out;
}
