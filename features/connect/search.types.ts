/**
 * ManekHR Connect - unified search types.
 *
 * Mirrors the federated `GET /connect/search` backend contract introduced in
 * S1.5 (`FederatedSearchService`, backend commit 47bab19). The envelope is
 * back-compat: `results` stays at the top level so the legacy `ConnectSearchBar`
 * typeahead keeps reading the primary people vertical untouched, while the new
 * `type`, `query`, and `groups` fields drive the federated results page.
 */

// Type-only import (erased at compile, no runtime cycle): the backend job
// search ref is structurally the web `Job`, so a search hit renders through the
// same `JobCard` the board uses (Phase 5 - jobs searchable).
import type { Job } from './jobs/jobs.types';
import type { RatingAggregate } from './reviews/reviews.types';

/**
 * One people result. The backend resolves a `public`-visibility
 * `ConnectProfile` to its card identity: `name` / `avatar` are canonical on
 * `User`, `headline` is the profile one-liner. `avatar` and `headline` are
 * nullable because not every member has set them.
 */
export interface PersonResult {
  userId: string;
  name: string;
  avatar: string | null;
  headline: string | null;
  /**
   * The person's "open to" signal. The federated search people vertical (and
   * post authors) hydrate through the same backend `getPeopleByIds` path, so
   * this carries the real value -> drives the ConnectAvatar ring on result
   * cards. Optional + nullable. Keep in sync with backend `ConnectPersonRef`.
   */
  openStatus?: 'work' | 'hiring' | null;
  /** True for a seeded sample person (User.isDemo). Drives the SampleBadge on the
   *  result card + the demo down-rank. Optional; absent reads as a real member.
   *  Keep `isDemo` in sync with the BE ConnectPersonRef + every Connect mirror. */
  isDemo?: boolean;
}

/** Post kind - mirror of the backend `POST_KINDS`. */
export const POST_KINDS = ['text', 'photo', 'video', 'document', 'voice'] as const;
export type PostKind = (typeof POST_KINDS)[number];

/**
 * One post result (search redesign Phase B). Mirrors the backend
 * `ConnectPostResult` (`search.service.ts`): the slim post card plus the
 * hydrated author identity. Public posts only. `author` is null only when the
 * author record could not be resolved; `coverImage` is the first image / video
 * attachment or null for a text / voice post.
 */
export interface PostResult {
  postId: string;
  authorId: string;
  author: PersonResult | null;
  snippet: string;
  kind: PostKind;
  coverImage: string | null;
  reactionCount: number;
  commentCount: number;
  /** True for a seeded sample post (denormalized from the author's User.isDemo).
   *  Drives the SampleBadge on the post result card. Optional; absent = real post.
   *  Keep `isDemo` in sync with the BE post result shape + every Connect mirror. */
  isDemo?: boolean;
  /** Backend returns an ISO date string; the client parses to Date on demand. */
  createdAt: string;
}

/**
 * Selectable vertical for the results page tab strip.
 *
 *   - `all` blends every live vertical via the backend's federated query
 *     layer (people + posts + listings + jobs + storefronts + pages).
 *   - `people` narrows to the candidate / person vertical (S1.2).
 *   - `listings` narrows to the marketplace listing vertical (M1.4.2).
 *   - `jobs` narrows to the open-jobs board vertical (Phase 5).
 *   - `storefronts` narrows to the public Storefront vertical (SRCH-VERT-1).
 *     Name-search jump-to only -> deep-links `/connect/store/[slug]`.
 *   - `pages` narrows to the public Company/Institute page vertical
 *     (SRCH-VERT-1). Deep-links `/connect/company/[slug]`; the `kind` discriminant
 *     drives the institute label/badge. NOT a directory: name jump-to only.
 */
export type SearchType = 'all' | 'people' | 'posts' | 'listings' | 'jobs' | 'storefronts' | 'pages';

/**
 * Listing category - mirror of the backend `LISTING_CATEGORIES` enum in
 * `connect-listing.schema.ts`. Eight buckets covering the Gujarat textile-SMB
 * trade taxonomy.
 */
export const LISTING_CATEGORIES = [
  'weaving',
  'dyeing',
  'printing',
  'embroidery-zari',
  'job-work',
  'raw-material',
  'machinery',
  'finished-goods',
  // Institutes Phase 1: a training-course listing. Drives the marketplace
  // CategoryStrip pill + ListingGridCard / ListingDetailScreen course rendering.
  'course',
  // Service categories (Slice B1/B3). Mirror of the BE LISTING_CATEGORIES service
  // slugs. These MUST be here so `readCategory` accepts `?category=<service>` -
  // services are just listings with one of these categories, so the Services
  // browse service-type sub-filter and the marketplace category facet both rely
  // on this whitelist. Keep in sync with the BE LISTING_CATEGORIES + the web
  // marketplace.types.ts NEW_SERVICE_CATEGORIES.
  'consulting',
  'maintenance',
  'machine-repair',
  'testing',
  'installation',
  'transport',
  'logistics',
  'contractor',
] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

/**
 * The category pills the MARKETPLACE browse strip shows (the original 9: the 8
 * textile trades + `course`). Kept separate from `LISTING_CATEGORIES` so adding
 * the service categories to the filter whitelist (above, for `readCategory`)
 * did NOT silently add 8 service pills to the marketplace strip - the Services
 * browse owns those via `SERVICE_CATEGORY_SLUGS`. Any `?category=` value is still
 * a valid filter; this only governs which pills render on the marketplace strip.
 */
export const MARKETPLACE_CATEGORY_PILLS = [
  'weaving',
  'dyeing',
  'printing',
  'embroidery-zari',
  'job-work',
  'raw-material',
  'machinery',
  'finished-goods',
  'course',
] as const;

/**
 * The service-listing category slugs the Services browse (`/connect/services`,
 * Slice B3) offers as its service-type sub-filter. Mirror of the backend
 * `SERVICE_CATEGORIES` browse set (listing.schema.ts): the 8 NEW service
 * categories PLUS the pre-existing service-ish trades. Services are just
 * listings with one of these categories, so the service-type filter maps
 * straight to the existing single-select `?category=` BE filter - no new
 * endpoint. Order puts the dedicated service categories first so the most
 * "service" reads lead the strip. Keep in sync with the BE SERVICE_CATEGORIES
 * + the web marketplace.types.ts SERVICE_CATEGORIES.
 */
export const SERVICE_CATEGORY_SLUGS = [
  'consulting',
  'maintenance',
  'machine-repair',
  'testing',
  'installation',
  'transport',
  'logistics',
  'contractor',
  'job-work',
  'dyeing',
  'printing',
  'embroidery-zari',
] as const;
export type ServiceCategorySlug = (typeof SERVICE_CATEGORY_SLUGS)[number];

/** True when a category slug belongs to the Services browse set (Slice B3). */
export function isServiceCategory(value: string | null | undefined): value is ServiceCategorySlug {
  return (
    value !== null &&
    value !== undefined &&
    (SERVICE_CATEGORY_SLUGS as readonly string[]).includes(value)
  );
}

/**
 * Display label for a listing category. The category is now a dynamic string
 * (sellers may use one of the known 8 OR their own term): a known slug renders
 * its localized label, a custom slug renders humanized (dashes to spaces, first
 * letter capitalized).
 */
export function categoryLabel(value: string, label: (key: string) => string): string {
  return (LISTING_CATEGORIES as readonly string[]).includes(value)
    ? label(value)
    : value.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Asking-price expression for a listing. */
export type ListingPriceType = 'fixed' | 'range' | 'negotiable';

/** Pricing / order unit for a listing. */
export type ListingUnit =
  | 'per-meter'
  | 'per-piece'
  | 'per-kg'
  | 'per-set'
  | 'per-dozen'
  | 'per-order';

/**
 * One listing result. Mirrors the backend `ConnectListingRef` shape
 * (`listing-search.helpers.ts`) - the slim card the marketplace surface
 * renders. `coverImage` is the first uploaded image or `null`; `district`
 * preserves the original casing the seller typed.
 */
export interface ConnectListingRef {
  listingId: string;
  ownerUserId: string;
  title: string;
  description: string;
  category: string;
  priceType: ListingPriceType;
  priceMin: number | null;
  priceMax: number | null;
  unit: ListingUnit | null;
  district: string;
  coverImage: string | null;
  /** All uploaded image URLs (cover first); drives the card's hover carousel. */
  images?: string[];
  /**
   * True when the listing has a product video. Drives a small play badge on the
   * card cover (the cover image is NOT swapped for the poster - images stay the
   * cover). Mirror of the backend `ConnectListingRef.hasVideo`.
   */
  hasVideo?: boolean;
  /** Seller trust marker (M2.3) - drives the "Verified" badge on the card. */
  verified: boolean;
  /** Seller rating aggregate (R2) - drives the compact star row; absent when unrated. */
  rating?: RatingAggregate;
  /** Minimum order quantity; `null`/absent when the seller did not set one. */
  moq?: number | null;
  /**
   * Course detail on the slim card (Institutes Phase 1) - present only on a
   * `course`-category listing, `null` otherwise. Mirrors the BE slim
   * `ConnectListingRef.courseDetails`; lets the grid card render duration / mode /
   * fee in place of MOQ / price without a detail fetch.
   */
  courseDetails?: {
    durationLabel: string;
    batchStart: string | null;
    mode: 'online' | 'offline' | 'hybrid';
    feeType: 'fixed' | 'range' | 'free';
    seats: number | null;
    certificate: boolean;
    skillsTaught: string[];
  } | null;
  /**
   * Shop Collection ids this product belongs to. Populated on the STOREFRONT
   * read path so the public store can filter its grid by collection; empty on
   * the global marketplace / search cards.
   */
  collectionIds?: string[];
  /** True for a seeded sample listing (denormalized from the owner's User.isDemo).
   *  Drives the SampleBadge on the listing card. Optional; absent = real listing.
   *  Keep `isDemo` in sync with the BE ConnectListingRef + every Connect mirror. */
  isDemo?: boolean;
  /** Backend returns an ISO date string; the client parses to Date on demand. */
  createdAt: string;
}

/**
 * One storefront result (SRCH-VERT-1). Mirrors the backend federated
 * `storefronts[]` entry. This is a name-search jump-to row: the public store
 * lives at `/connect/store/[slug]` (the same in-app storefront route the
 * marketplace + Following tab link to - keep in sync if that route moves).
 * `logo`, `description`, and `district` are nullable because not every owner
 * has filled them. `categories` is the store's self-declared trade buckets,
 * surfaced as a compact sub-line when present.
 */
export interface StorefrontResult {
  storefrontId: string;
  ownerUserId: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  categories: string[];
  district: string | null;
  /** True for a seeded sample storefront (denormalized from the owner's
   *  User.isDemo). Drives the SampleBadge on the storefront row. Optional; absent =
   *  real store. Keep `isDemo` in sync with the BE + every Connect mirror. */
  isDemo?: boolean;
  /** Backend returns an ISO date string; the client parses to Date on demand. */
  createdAt: string;
}

/**
 * One company / institute page result (SRCH-VERT-1). Mirrors the backend
 * federated `pages[]` entry. Deep-links `/connect/company/[slug]` (the in-app
 * CompanyPageView route the PostCard + jobs employer link already use - keep in
 * sync if it moves). `kind` discriminates a plain business page from an
 * institute page; the `institute` value drives the institute label / badge on
 * the result card + typeahead row. `logo`, `about`, and `district` are nullable
 * because not every owner has set them.
 */
export type ConnectPageKind = 'business' | 'institute';

export interface PageResult {
  pageId: string;
  ownerUserId: string;
  name: string;
  slug: string;
  kind: ConnectPageKind;
  logo: string | null;
  about: string | null;
  district: string | null;
  /** True for a seeded sample company/institute page (denormalized from the owner's
   *  User.isDemo). Drives the SampleBadge on the page row. Optional; absent = real
   *  page. Keep `isDemo` in sync with the BE + every Connect mirror. */
  isDemo?: boolean;
  /** Backend returns an ISO date string; the client parses to Date on demand. */
  createdAt: string;
}

/**
 * Every backend vertical the federation can return today or in the future.
 * Used to type `SearchGroup.type` so adding `storefronts` or `pages` later
 * widens by one literal with no other change.
 */
export type SearchVertical = 'people' | 'posts' | 'listings' | 'jobs' | 'storefronts' | 'pages';

/**
 * Backend echo of the parsed query, returned with every search response.
 *
 *   - `raw` is what the member typed (preserved verbatim for "Showing results
 *     for X" copy and analytics).
 *   - `text` is the canonical-folded search string (alias to canonical slug,
 *     hashtags appended). When `text !== raw`, the screen surfaces a small
 *     canonicalization echo so the member sees the alias resolution.
 *   - `tags` are the canonical slugs the backend extracted from any
 *     `#hashtags` in the query, after alias folding. Rendered as removable
 *     chips on the results page.
 */
export interface SearchQueryEcho {
  raw: string;
  text: string;
  tags: string[];
}

/**
 * One vertical's slice of a federated response. Discriminated by `type` so a
 * consumer narrows the row shape from the tag - people groups carry
 * `PersonResult[]`, listing groups carry `ConnectListingRef[]`. Jobs will
 * extend this union when its index lands.
 */
export type SearchGroup =
  | { type: 'people'; results: PersonResult[] }
  | { type: 'posts'; results: PostResult[] }
  | { type: 'listings'; results: ConnectListingRef[] }
  | { type: 'jobs'; results: Job[] }
  // SRCH-VERT-1: the two new public verticals. Storefront rows carry
  // StorefrontResult[]; page rows carry PageResult[] (business + institute).
  | { type: 'storefronts'; results: StorefrontResult[] }
  | { type: 'pages'; results: PageResult[] };

/**
 * Federated search response envelope. See backend
 * `FederatedSearchService.search`.
 *
 *   - `results` is the primary (people) vertical at the top level for legacy
 *     `ConnectSearchBar` typeahead back-compat.
 *   - `listings` is the primary (listings) vertical at the top level (M1.4.2).
 *     Empty when the active vertical is people-only.
 *   - `type` echoes which selectable vertical the response is scoped to.
 *   - `query` carries the canonicalization echo.
 *   - `groups` lists each queried vertical's results in weight order. People
 *     sits above listings when both are present (`type=all`).
 */
export interface SearchResponse {
  results: PersonResult[];
  posts: PostResult[];
  listings: ConnectListingRef[];
  jobs: Job[];
  /**
   * Public Storefront vertical (SRCH-VERT-1). Empty unless the active vertical
   * is `storefronts` or `all`. Each entry deep-links `/connect/store/[slug]`.
   */
  storefronts: StorefrontResult[];
  /**
   * Public Company/Institute page vertical (SRCH-VERT-1). Empty unless the
   * active vertical is `pages` or `all`. Each entry deep-links
   * `/connect/company/[slug]`; `kind` drives the institute badge.
   */
  pages: PageResult[];
  type: SearchType;
  query: SearchQueryEcho;
  groups: SearchGroup[];
  /** Full listings match count (all pages) for the marketplace infinite scroll
   *  (hasMore = offset + listings.length < listingsTotal). 0 on a blank-q
   *  short-circuit. Listings vertical only. */
  listingsTotal?: number;
  /** Full people match count (all pages) for the people-tab infinite scroll
   *  (Phase 2; hasMore = offset + results.length < peopleTotal). Leak-free
   *  (block-filtered count, clamped). 0 on a blank-q short-circuit. */
  peopleTotal?: number;
  /** Full posts match count (all pages) for the posts-tab infinite scroll
   *  (Phase 3; hasMore = posts.length < postsTotal). Leak-free (block-filtered
   *  count, clamped). 0 on a blank-q short-circuit. */
  postsTotal?: number;
  /** Full jobs match count (all pages) for the jobs-tab infinite scroll
   *  (Phase 3; hasMore = jobs.length < jobsTotal). Leak-free (block-filtered
   *  count, clamped). 0 on a blank-q short-circuit. */
  jobsTotal?: number;
  /** Full storefronts match count (all pages) for the storefronts-tab infinite
   *  scroll (Phase 3; hasMore = storefronts.length < storefrontsTotal). Leak-free
   *  (block-filtered count, clamped). 0 on a blank-q short-circuit. */
  storefrontsTotal?: number;
  /** Full pages match count (all pages) for the pages-tab infinite scroll
   *  (Phase 3; hasMore = pages.length < pagesTotal). Leak-free (block-filtered
   *  count, clamped). 0 on a blank-q short-circuit. */
  pagesTotal?: number;
  /**
   * Tag-slug to listing count, returned by the backend listing search when the
   * `type=listings` vertical is active. Used to populate the "Product types"
   * filter-chip group in `ListingFacetPanel`. Absent (undefined) on the people
   * and posts verticals, and on a blank-q short-circuit.
   */
  tagCounts?: Record<string, number>;
  /**
   * Category-slug to listing count (Meili facet distribution). Drives the real
   * counts on the marketplace top `CategoryStrip` pills. Absent on a blank-q
   * short-circuit; empty `{}` on the Mongo fallback. Bounded to the 8 known
   * category slugs.
   */
  categoryCounts?: Record<string, number>;
  /**
   * Lowercased-district to listing count (Meili facet distribution). Drives the
   * marketplace Location filter top-N chips in `ListingFacetPanel`. Absent on a
   * blank-q short-circuit; empty `{}` on the Mongo fallback. Keys are
   * lowercased (the indexed district casing); the UI title-cases for display.
   */
  districtCounts?: Record<string, number>;
}

/**
 * Optional facet filters the results page sends to the backend DTO. Each maps
 * one-to-one to a `SearchQueryDto` field; the DTO accepts them additively
 * alongside `q` and `type`. People vertical reads skills / district /
 * openToWork; listings vertical reads category / district / priceMin /
 * priceMax. `district` is shared - same field, both verticals.
 */
export interface SearchFilters {
  skills?: string[];
  district?: string;
  openToWork?: boolean;
  /**
   * People vertical: narrow to members with the "Providing services" intent on.
   * Mirrors `openToWork`; the backend reads `?providingServices=true`.
   */
  providingServices?: boolean;
  category?: string;
  /**
   * A SET of canonical category slugs blended into ONE listings result (OR
   * semantics - a listing in ANY of these surfaces). Powers the `/connect/services`
   * "all services" default: with no single service type picked, the page sends the
   * whole `SERVICE_CATEGORY_SLUGS` set so the buyer sees every service category at
   * once instead of a pick-a-type prompt. Mirrors the BE `SearchQueryDto.categoryIn`
   * (lowercase slugs, capped 40); when both `category` and `categoryIn` are sent,
   * `categoryIn` wins server-side. Keep in sync with the BE DTO + search.actions
   * serialization (forwarded as a repeated query param).
   */
  categoryIn?: string[];
  priceMin?: number;
  priceMax?: number;
  /**
   * Verified-sellers-only filter (listings vertical). When true, the backend
   * returns only listings whose seller carries the `verified` trust flag.
   */
  verified?: boolean;
  /** Posts content-kind facet (text / photo / video / document / voice). */
  kind?: PostKind;
  /**
   * Seller-tag filter for the listing vertical. Single-select in v1 (mirrors
   * category); the backend accepts an array so widening to multi-select later
   * is a zero-schema-change frontend change.
   */
  tags?: string[];
  /**
   * Page-kind filter for the pages vertical (SRCH-VERT-1). `business` /
   * `institute` narrows the company-page results; the backend reads
   * `?pageKind=`. Absent = both kinds. `district` is shared with the people /
   * listings verticals (same field) and also narrows storefronts + pages.
   */
  pageKind?: ConnectPageKind;
}

/**
 * Input for the federated `searchConnectAll` server action. Lives here, not in
 * `search.actions.ts`, because a `'use server'` module may only export async
 * functions, not types.
 */
/**
 * Marketplace listing sort order. Mirrors the backend listings-search `sort`
 * param. `recent` (newest first) is the default. `top_rated` orders by the
 * seller rating aggregate; the backend falls back to `recent` when a real
 * rating sort is not available, so the value is always safe to send.
 */
export const MARKETPLACE_SORTS = [
  'recent',
  'price_low',
  'price_high',
  'verified_first',
  'top_rated',
] as const;
export type MarketplaceSort = (typeof MARKETPLACE_SORTS)[number];

export interface SearchConnectAllInput {
  q: string;
  type?: SearchType;
  filters?: SearchFilters;
  /** Listings-vertical sort order (marketplace). Absent = backend default (recent). */
  sort?: MarketplaceSort;
  /** Listings page size (marketplace infinite scroll). Absent = backend default. */
  limit?: number;
  /** Listings page offset (skip N). Pairs with `limit`. */
  offset?: number;
}

/**
 * One Connect tag row as returned by the tag endpoints. Mirrors the backend
 * `ConnectTagView` shape (`tag.service.ts`, S1.3 / S1.4). Used by both
 * `getTrendingTags` (S1.6.5 rail panel) and `searchTags` (S1.6.6 typeahead
 * autocomplete) since the BE returns the same shape for both.
 *
 *   - `slug` is the canonical tag id (e.g. `zari`) - the form the action
 *     forwards when the member clicks a chip.
 *   - `labels` is a locale -> label map (`{ en: 'Zari', gu: '...', ... }`);
 *     the client falls back through the active locale, `en`, and finally the
 *     slug itself when no localized label is present.
 *   - `usageCount` is the all-time usage tally for the tag.
 *   - `trendingScore` is the velocity-over-baseline value the S1.4 cron
 *     writes; the trending list is already sorted by it on the server.
 *   - `category` is the curated bucket the tag belongs to (`generic` for an
 *     open / user-coined tag) - kept on the view for future grouping.
 */
export interface ConnectTagView {
  slug: string;
  labels: Record<string, string | undefined>;
  category: string;
  usageCount: number;
  trendingScore: number;
}

/**
 * Back-compat alias for the S1.6.5 trending consumer site that imported
 * `TrendingTag`. The canonical name going forward is `ConnectTagView`.
 */
export type TrendingTag = ConnectTagView;
