/**
 * Coerce the Server-Component `searchParams` for `/connect/search` into the
 * typed `SearchConnectAllInput` the `searchConnectAll` action consumes.
 *
 * Next.js hands each value as `string | string[] | undefined`. We must
 * normalize every shape:
 *
 *   - `q` is trimmed; the first value wins if the key was repeated.
 *   - `type` is whitelisted to the queryable backend SearchType values
 *     (`all` / `people` / `posts` / `listings` / `jobs`). An invented value
 *     (`foo`) is dropped so the action never forwards a string the backend
 *     would reject.
 *   - `skills` lifts a scalar to a single-element array; blank entries are
 *     dropped so `?skills=` does not silently filter on the empty string.
 *   - `district` is a plain scalar.
 *   - `openToWork` is strict: only the literal strings `'true'` / `'false'`
 *     coerce to a boolean; anything else is dropped.
 *   - When every facet is undefined the `filters` key is omitted so the
 *     action's downstream params object stays minimal.
 */

import {
  LISTING_CATEGORIES,
  POST_KINDS,
  type ConnectPageKind,
  type ListingCategory,
  type PostKind,
  type SearchConnectAllInput,
  type SearchFilters,
  type SearchType,
} from '../search.types';

/**
 * The set of tabs the search screen renders. Matches the queryable `SearchType`
 * one-to-one now that every vertical (people / posts / listings / jobs /
 * storefronts / pages - SRCH-VERT-1) has a live backend index.
 */
export type SelectedTab =
  | 'all'
  | 'people'
  | 'posts'
  | 'listings'
  | 'jobs'
  | 'storefronts'
  | 'pages';

const SELECTED_TABS: ReadonlyArray<SelectedTab> = [
  'all',
  'people',
  'posts',
  'listings',
  'jobs',
  'storefronts',
  'pages',
];

/** The two page-kind values the `?pageKind=` facet whitelists (SRCH-VERT-1). */
const PAGE_KINDS: ReadonlyArray<ConnectPageKind> = ['business', 'institute'];

/** Raw, untyped Next.js Server-Component searchParams for `/connect/search`. */
export interface SearchPageRawParams {
  q?: string | string[];
  type?: string | string[];
  skills?: string | string[];
  district?: string | string[];
  openToWork?: string | string[];
  providingServices?: string | string[];
  category?: string | string[];
  priceMin?: string | string[];
  priceMax?: string | string[];
  kind?: string | string[];
  /** Seller-tag single-select facet, mirroring the marketplace `?tag=<slug>`. */
  tag?: string | string[];
  /** Page-kind facet for the pages vertical (SRCH-VERT-1): business | institute. */
  pageKind?: string | string[];
}

const QUERYABLE_TYPES: ReadonlyArray<SearchType> = [
  'all',
  'people',
  'posts',
  'listings',
  'jobs',
  'storefronts',
  'pages',
];

export function readScalar(raw: string | string[] | undefined): string | undefined {
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw[0] : raw;
}

function readArray(raw: string | string[] | undefined): string[] | undefined {
  if (raw === undefined) return undefined;
  const list = Array.isArray(raw) ? raw : [raw];
  const cleaned = list.map((v) => v.trim()).filter((v) => v.length > 0);
  return cleaned.length > 0 ? cleaned : undefined;
}

function readType(raw: string | string[] | undefined): SearchType | undefined {
  const value = readScalar(raw);
  if (value === undefined) return undefined;
  return (QUERYABLE_TYPES as ReadonlyArray<string>).includes(value)
    ? (value as SearchType)
    : undefined;
}

function readBoolean(raw: string | string[] | undefined): boolean | undefined {
  const value = readScalar(raw);
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

/** Read a numeric query-string value, dropping non-finite + negative entries. */
export function readNonNegativeNumber(raw: string | string[] | undefined): number | undefined {
  const value = readScalar(raw);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

/** Whitelist `?category=` to the textile listing taxonomy; unknowns drop. */
export function readCategory(raw: string | string[] | undefined): ListingCategory | undefined {
  const value = readScalar(raw);
  if (value === undefined) return undefined;
  return (LISTING_CATEGORIES as ReadonlyArray<string>).includes(value)
    ? (value as ListingCategory)
    : undefined;
}

/** Whitelist `?kind=` to the post-kind enum (posts facet); unknowns drop. */
export function readPostKind(raw: string | string[] | undefined): PostKind | undefined {
  const value = readScalar(raw);
  if (value === undefined) return undefined;
  return (POST_KINDS as ReadonlyArray<string>).includes(value) ? (value as PostKind) : undefined;
}

/** Whitelist `?pageKind=` to business | institute (pages facet); unknowns drop. */
export function readPageKind(raw: string | string[] | undefined): ConnectPageKind | undefined {
  const value = readScalar(raw);
  if (value === undefined) return undefined;
  return (PAGE_KINDS as ReadonlyArray<string>).includes(value)
    ? (value as ConnectPageKind)
    : undefined;
}

/**
 * Resolve the visible-tab selection from the URL so the tab strip highlights
 * the active vertical. Falls back to `'all'` when the param is absent or
 * unrecognized so the strip is never in a no-selection state.
 */
export function readSelectedTab(raw: SearchPageRawParams): SelectedTab {
  const value = readScalar(raw.type);
  if (value === undefined) return 'all';
  return (SELECTED_TABS as ReadonlyArray<string>).includes(value) ? (value as SelectedTab) : 'all';
}

/** Regex-escape a slug so it can be embedded into a `RegExp` literal safely. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Strip every `#<slug>` token from a raw query string. Whole-token match so a
 * different token that merely starts with the slug (`#motipearl` vs `moti`) is
 * left alone. Case-insensitive so an uppercase hashtag in the URL still
 * strips. Returns a single-space-collapsed, trimmed string so the resulting
 * `q=` value stays clean.
 */
export function removeTagFromQuery(rawQ: string, slug: string): string {
  if (slug.length === 0) return rawQ.trim();
  const pattern = new RegExp(`(?:^|\\s)#${escapeRegExp(slug)}(?=\\s|$)`, 'gi');
  return rawQ.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
}

export function readSearchInput(raw: SearchPageRawParams): SearchConnectAllInput {
  const q = (readScalar(raw.q) ?? '').trim();
  const type = readType(raw.type);

  const filters: SearchFilters = {};
  const skills = readArray(raw.skills);
  if (skills !== undefined) filters.skills = skills;
  const district = readScalar(raw.district);
  if (district !== undefined && district.length > 0) filters.district = district;
  const openToWork = readBoolean(raw.openToWork);
  if (openToWork !== undefined) filters.openToWork = openToWork;
  // Providing-services facet: mirrors openToWork strictly (only 'true'/'false').
  const providingServices = readBoolean(raw.providingServices);
  if (providingServices !== undefined) filters.providingServices = providingServices;
  const category = readCategory(raw.category);
  if (category !== undefined) filters.category = category;
  const priceMin = readNonNegativeNumber(raw.priceMin);
  if (priceMin !== undefined) filters.priceMin = priceMin;
  const priceMax = readNonNegativeNumber(raw.priceMax);
  if (priceMax !== undefined) filters.priceMax = priceMax;
  const kind = readPostKind(raw.kind);
  if (kind !== undefined) filters.kind = kind;
  // Tag single-select: `?tag=<slug>`. Passed as a one-element array so the
  // backend DTO (which accepts `tags[]`) gets the correct shape, mirroring the
  // marketplace wiring exactly. Widening to multi-select later needs zero
  // backend-DTO changes.
  const tag = readScalar(raw.tag);
  if (tag !== undefined && tag.trim().length > 0) filters.tags = [tag.trim()];
  // SRCH-VERT-1: page-kind facet (pages vertical). Whitelisted business | institute.
  const pageKind = readPageKind(raw.pageKind);
  if (pageKind !== undefined) filters.pageKind = pageKind;

  const input: SearchConnectAllInput = { q };
  if (type !== undefined) input.type = type;
  if (Object.keys(filters).length > 0) input.filters = filters;
  return input;
}
