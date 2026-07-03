'use server';

/**
 * Connect search - server actions.
 *
 * Two exports, two contracts, one shared HTTP path:
 *
 *   - `searchConnect(q)` is the legacy back-compat call used by
 *     `ConnectSearchBar` (the global typeahead). It hits
 *     `GET /connect/search?q=` and returns just the `PersonResult[]` from the
 *     primary people vertical at `envelope.results`. Kept byte-identical in
 *     its call shape so the typeahead does not have to change when the
 *     federated envelope (S1.5) lands.
 *
 *   - `searchConnectAll(input)` is the new federated call used by the
 *     `/connect/search` results page (S1.6.2 +). It forwards the full filter
 *     set (`type`, `skills`, `district`, `openToWork`) and returns the whole
 *     `SearchResponse` envelope (`results`, `type`, `query`, `groups`) so the
 *     screen can render tag chips, the canonical query echo, and per-vertical
 *     groups.
 *
 * Both flow through `fetchSearchEnvelope`, which calls the httpOnly-authed
 * `serverHttp` client + `unwrapServer`, then normalizes the envelope with
 * defensive defaults (a staging cache may still serve the pre-S1.5 partial
 * shape). Both short-circuit a blank / whitespace-only query with no
 * round-trip, mirroring the backend. Both funnel axios / network errors
 * through `toError` and return a discriminated `ActionResult`, never
 * throwing to the caller.
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { hasAnyFilter } from './search.helpers';
import type { ActionResult } from './profile.types';
import type {
  ConnectListingRef,
  ConnectTagView,
  PersonResult,
  SearchConnectAllInput,
  SearchResponse,
  SearchType,
  TrendingTag,
} from './search.types';

function toError(e: unknown): string {
  if (isAxiosError(e)) {
    const data = e.response?.data as { error?: { message?: string }; message?: string } | undefined;
    return data?.error?.message ?? data?.message ?? e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

/**
 * Shape of the `axios.get` `params` for `/connect/search`. Mirrors the backend
 * `SearchQueryDto` field-for-field. Array, boolean, and scalar fields are
 * forwarded as-is. The exact URL serialization (repeated key vs CSV) is
 * axios's default plus the backend's class-transformer parser.
 */
interface SearchRequestParams {
  q: string;
  type?: SearchType;
  skills?: string[];
  district?: string;
  openToWork?: boolean;
  /** People vertical: narrow to members offering services / job-work. */
  providingServices?: boolean;
  category?: string;
  /** A SET of category slugs to blend into one listings result (OR semantics).
   *  Powers the `/connect/services` "all services" default. Forwarded as a
   *  repeated query param (`categoryIn=a&categoryIn=b`); the BE coerces repeated
   *  | comma values to an array and lowercases each. `categoryIn` wins over the
   *  single `category` server-side. */
  categoryIn?: string[];
  priceMin?: number;
  priceMax?: number;
  kind?: string;
  /** Verified-sellers-only filter (listings vertical). */
  verified?: boolean;
  /** Listings sort order (recent | price_low | price_high | verified_first | top_rated). */
  sort?: string;
  /** Seller-tag filter (single or multi slug). Forwarded as a repeated param. */
  tags?: string[];
  /** Page-kind facet for the pages vertical (SRCH-VERT-1): business | institute. */
  pageKind?: string;
  /** Listings page size (marketplace infinite scroll). */
  limit?: number;
  /** Listings page offset (skip N). */
  offset?: number;
}

/**
 * The empty envelope returned by the blank-`q` short-circuit and by the
 * defensive fallback when the backend returns a partial response. Keeps the
 * results page free of `undefined` checks on `query.tags`, `groups`,
 * `listings`, etc.
 */
function emptyEnvelope(raw: string): SearchResponse {
  return {
    results: [],
    posts: [],
    listings: [],
    listingsTotal: 0,
    peopleTotal: 0,
    postsTotal: 0,
    jobsTotal: 0,
    storefrontsTotal: 0,
    pagesTotal: 0,
    jobs: [],
    // SRCH-VERT-1: the two new public verticals default empty on the short-circuit.
    storefronts: [],
    pages: [],
    type: 'all',
    query: { raw, text: raw, tags: [] },
    groups: [],
  };
}

/**
 * Issue the federated `GET /connect/search` and normalize the envelope.
 * Missing fields fall back to safe defaults so a pre-S1.5 staging cache cannot
 * crash the screen on `query.tags.map(...)` etc.
 */
async function fetchSearchEnvelope(params: SearchRequestParams): Promise<SearchResponse> {
  const http = await serverHttp();
  // Serialize array params (`skills`, `tags`) as REPEAT keys (`skills=a&skills=b`),
  // NOT axios's default bracket form (`skills[]=a`). The backend whitelists the
  // `skills` / `tags` properties and coerces repeated|comma values to an array, so
  // a bracketed `skills[]` key trips forbidNonWhitelisted with a 400. (Latent until
  // the redesign made the filter bar visible and skills were applied for real.)
  const res = await http.get('/connect/search', {
    params,
    paramsSerializer: { indexes: null },
  });
  const raw = unwrapServer<Partial<SearchResponse>>(res);
  const envelope: SearchResponse = {
    results: raw.results ?? [],
    posts: raw.posts ?? [],
    listings: raw.listings ?? [],
    jobs: raw.jobs ?? [],
    // SRCH-VERT-1: default the two new verticals so a pre-VERT-1 cache that
    // omits them cannot crash the screen on `storefronts.map(...)` etc.
    storefronts: raw.storefronts ?? [],
    pages: raw.pages ?? [],
    type: raw.type ?? 'all',
    query: raw.query ?? { raw: params.q, text: params.q, tags: [] },
    groups: raw.groups ?? [],
  };
  // tagCounts / categoryCounts / districtCounts are listing-vertical-only facet
  // distributions; carry each through when present (the marketplace reads them
  // for the Product-types, Category, and Location filter counts respectively).
  if (raw.tagCounts !== undefined) envelope.tagCounts = raw.tagCounts;
  if (raw.categoryCounts !== undefined) envelope.categoryCounts = raw.categoryCounts;
  if (raw.districtCounts !== undefined) envelope.districtCounts = raw.districtCounts;
  // Full listings match count -> marketplace infinite-scroll hasMore.
  envelope.listingsTotal = typeof raw.listingsTotal === 'number' ? raw.listingsTotal : 0;
  // Full people match count -> people-tab infinite-scroll hasMore (Phase 2).
  envelope.peopleTotal = typeof raw.peopleTotal === 'number' ? raw.peopleTotal : 0;
  // Full posts match count -> posts-tab infinite-scroll hasMore (Phase 3).
  envelope.postsTotal = typeof raw.postsTotal === 'number' ? raw.postsTotal : 0;
  // Full jobs match count -> jobs-tab infinite-scroll hasMore (Phase 3).
  envelope.jobsTotal = typeof raw.jobsTotal === 'number' ? raw.jobsTotal : 0;
  // Full storefronts match count -> storefronts-tab infinite-scroll hasMore (Phase 3).
  envelope.storefrontsTotal = typeof raw.storefrontsTotal === 'number' ? raw.storefrontsTotal : 0;
  // Full pages match count -> pages-tab infinite-scroll hasMore (Phase 3).
  envelope.pagesTotal = typeof raw.pagesTotal === 'number' ? raw.pagesTotal : 0;
  return envelope;
}

/**
 * Search Connect people by a free-text query (legacy back-compat). Used by
 * the global `ConnectSearchBar` typeahead. Returns only the primary people
 * vertical so the typeahead's `setResults(res.data)` site stays unchanged.
 */
export async function searchConnect(q: string): Promise<ActionResult<PersonResult[]>> {
  const query = q.trim();
  if (!query) return { ok: true, data: [] };
  try {
    const envelope = await fetchSearchEnvelope({ q: query });
    return { ok: true, data: envelope.results };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Fetch the trending Connect tags (S1.4 velocity-over-baseline engine). The
 * backend returns `{ tags: ConnectTagView[] }` already sorted by trending
 * score, so the client just rendering top-N. Empty list when no tag has any
 * trending velocity yet (early in a workspace's life). Defensive against a
 * partial envelope: a future BE refactor or stale cache could ship `{}`.
 */
export async function getTrendingTags(): Promise<ActionResult<TrendingTag[]>> {
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/tags/trending');
    const body = unwrapServer<{ tags?: TrendingTag[] }>(res);
    return { ok: true, data: body.tags ?? [] };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Tag autocomplete for the typeahead dropdown. Hits `GET /connect/tags/search`
 * (S1.3 `tag.controller.ts`). The backend prefix-matches slug + aliases, so
 * a `q='za'` returns 'zari', 'zardozi', etc. Blank query short-circuits to
 * an empty list (mirrors the BE). Defensive against a partial envelope.
 */
export async function searchTags(q: string): Promise<ActionResult<ConnectTagView[]>> {
  const query = q.trim();
  if (!query) return { ok: true, data: [] };
  try {
    const http = await serverHttp();
    const res = await http.get('/connect/tags/search', { params: { q: query } });
    const body = unwrapServer<{ tags?: ConnectTagView[] }>(res);
    return { ok: true, data: body.tags ?? [] };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Federated search across every registered vertical. Returns the full
 * `SearchResponse` envelope so the `/connect/search` page can render the
 * canonical query echo, tag chips, and per-vertical groups (today only the
 * people vertical; listings + jobs widen this once their indexes register).
 */
export async function searchConnectAll(
  input: SearchConnectAllInput,
): Promise<ActionResult<SearchResponse>> {
  const query = input.q.trim();
  // Blank q AND no facets: nothing to search. A facet-only browse (e.g.
  // ?type=listings&category=weaving) flows past this short-circuit to the
  // backend, which handles it correctly.
  if (!query && !hasAnyFilter(input.filters)) {
    return { ok: true, data: emptyEnvelope('') };
  }
  try {
    const params: SearchRequestParams = { q: query };
    if (input.type !== undefined) params.type = input.type;
    if (input.filters?.skills !== undefined) params.skills = input.filters.skills;
    if (input.filters?.district !== undefined) params.district = input.filters.district;
    if (input.filters?.openToWork !== undefined) params.openToWork = input.filters.openToWork;
    if (input.filters?.providingServices !== undefined) {
      params.providingServices = input.filters.providingServices;
    }
    if (input.filters?.category !== undefined) params.category = input.filters.category;
    // Blended multi-category set (services "all services" default). Only sent when
    // non-empty; serialized as a repeated query param by the shared serializer.
    if (input.filters?.categoryIn !== undefined && input.filters.categoryIn.length > 0) {
      params.categoryIn = input.filters.categoryIn;
    }
    if (input.filters?.priceMin !== undefined) params.priceMin = input.filters.priceMin;
    if (input.filters?.priceMax !== undefined) params.priceMax = input.filters.priceMax;
    if (input.filters?.kind !== undefined) params.kind = input.filters.kind;
    if (input.filters?.verified !== undefined) params.verified = input.filters.verified;
    if (input.sort !== undefined) params.sort = input.sort;
    if (input.filters?.tags !== undefined && input.filters.tags.length > 0) {
      params.tags = input.filters.tags;
    }
    // SRCH-VERT-1: page-kind facet (pages vertical). Only sent when set.
    if (input.filters?.pageKind !== undefined) params.pageKind = input.filters.pageKind;
    // Listings pagination (marketplace infinite scroll). Only sent when set.
    if (input.limit !== undefined) params.limit = input.limit;
    if (input.offset !== undefined) params.offset = input.offset;
    const envelope = await fetchSearchEnvelope(params);
    return { ok: true, data: envelope };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}

/**
 * Recent public listings for the marketplace landing (before any query /
 * facet). The federated search returns empty for a blank query, so this gives
 * the landing real products. Same `ConnectListingRef` card shape as search.
 */
export interface RecentListingsBrowse {
  listings: ConnectListingRef[];
  /** Full public-corpus count -> the marketplace infinite-scroll hasMore on the landing. */
  total: number;
  /** Corpus-wide category facet counts for the bare-landing CategoryStrip pills. */
  categoryCounts: Record<string, number>;
  /** Corpus-wide (lowercased) district facet counts for the bare-landing Location chips. */
  districtCounts: Record<string, number>;
}

export async function browseRecentListings(
  opts: { limit?: number; offset?: number } = {},
): Promise<ActionResult<RecentListingsBrowse>> {
  try {
    const http = await serverHttp();
    // Paginated landing (marketplace infinite scroll). limit/offset only sent when set.
    const params: { limit?: number; offset?: number } = {};
    if (opts.limit !== undefined) params.limit = opts.limit;
    if (opts.offset !== undefined) params.offset = opts.offset;
    const res = await http.get('/connect/search/listings/recent', { params });
    // BE now returns { listings, total, categoryCounts, districtCounts }. Default
    // the fields so an older BE / stale cache returning a bare array cannot crash.
    const body = unwrapServer<Partial<RecentListingsBrowse> | ConnectListingRef[]>(res);
    const data: RecentListingsBrowse = Array.isArray(body)
      ? { listings: body, total: body.length, categoryCounts: {}, districtCounts: {} }
      : {
          listings: body.listings ?? [],
          total: body.total ?? body.listings?.length ?? 0,
          categoryCounts: body.categoryCounts ?? {},
          districtCounts: body.districtCounts ?? {},
        };
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: toError(e) };
  }
}
