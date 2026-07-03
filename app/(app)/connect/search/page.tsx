import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getTrendingTags, searchConnectAll } from '@/features/connect/search.actions';
import { hasAnyFilter } from '@/features/connect/search.helpers';
import SearchResultsScreen, {
  type SearchScreenState,
} from '@/features/connect/search/SearchResultsScreen';
import { readSearchInput, type SearchPageRawParams } from '@/features/connect/search/url-params';
import type { TrendingTag } from '@/features/connect/search.types';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/search` - the Connect federated search results page.
 *
 * A Server Component (ENGINEERING-STANDARDS #7). It folds the URL search
 * params through `readSearchInput` to the typed `SearchConnectAllInput`, reads
 * the visible tab via `readSelectedTab`, and decides which state to render:
 *
 *   - When `?q=` is blank (and no facet is set), render the no-query prompt
 *     without a round-trip.
 *   - Otherwise, run `searchConnectAll` and hand the full `SearchResponse`
 *     envelope to `SearchResultsScreen` (results + type + query echo +
 *     per-vertical groups). Every vertical (people / posts / listings / jobs)
 *     now has a live backend index, so each flows through the same fetch path.
 */
interface SearchPageProps {
  searchParams: Promise<SearchPageRawParams>;
}

/**
 * SSR page-1 size for the focused single-vertical tab; the client reuses it for
 * each infinite-scroll page (progressive-loading ADR: listings = Phase 1,
 * people = Phase 2). Matches the marketplace page size so a focused tab and the
 * marketplace page page identically. Stays <= the backend DTO `limit` @Max(48).
 */
const SEARCH_PAGE_SIZE = 24;

/** All focused single-vertical tabs page on scroll (Phase 3 complete: every vertical). */
const PAGINATED_TYPES = new Set(['listings', 'people', 'posts', 'jobs', 'storefronts', 'pages']);

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const t = await getTranslations('connect.search');
  const { q } = readSearchInput(await searchParams);
  return { title: q ? t('metaTitleQuery', { query: q }) : t('metaTitle') };
}

/**
 * Fetch the trending tag list while suppressing failure to an empty array.
 * The rail panel must never break the rest of the page: a 500 on
 * `/connect/tags/trending` should just hide the list, not crash the search.
 */
async function fetchTrendingSafely(): Promise<TrendingTag[]> {
  const res = await getTrendingTags();
  return res.ok ? res.data : [];
}

export default async function ConnectSearchPage({ searchParams }: SearchPageProps) {
  const rawParams = await searchParams;
  const input = readSearchInput(rawParams);
  const query = input.q;

  // Render the no-query prompt only when there is truly nothing to search
  // (blank q AND no facets). A facet-only browse (e.g. `?type=listings&category=weaving`)
  // falls through to the federated fetch below. CN-SRCH-5: use the SHARED
  // hasAnyFilter from the action (imported) so the page's gate can never drift
  // from the action's (the old local copy omitted providingServices / verified /
  // categoryIn, wrongly showing the empty prompt for those facet-only browses).
  if (!query && !hasAnyFilter(input.filters)) {
    const trendingTags = await fetchTrendingSafely();
    return (
      <SearchResultsScreen query="" state={{ kind: 'no-query' }} trendingTags={trendingTags} />
    );
  }

  // Cap page 1 to the page size ONLY on a focused single-vertical tab (listings
  // or people), so its infinite scroll has a deterministic page size. The backend
  // applies `limit` to the active single vertical, so the blended `all` preview is
  // untouched (it never sets a type that is in PAGINATED_TYPES via this path).
  const fetchInput =
    input.type && PAGINATED_TYPES.has(input.type) ? { ...input, limit: SEARCH_PAGE_SIZE } : input;

  // Parallel fetch: federated search + trending + the one sponsored search row
  // (placement search_results). All independent, so they share the server-render
  // wait window. The promoted resolve never throws into the page (returns null on
  // any miss). Its own page id keeps it dedupe-correct if more slots are added.
  const [searchRes, trendingTags, promotedListing] = await Promise.all([
    searchConnectAll(fetchInput),
    fetchTrendingSafely(),
    resolvePromotedRailListing('search_results', crypto.randomUUID()),
  ]);
  const state: SearchScreenState = searchRes.ok
    ? { kind: 'results', ...searchRes.data }
    : { kind: 'error', message: searchRes.error };
  const tagCounts = searchRes.ok ? searchRes.data.tagCounts : undefined;

  return (
    <SearchResultsScreen
      query={query}
      state={state}
      trendingTags={trendingTags}
      tagCounts={tagCounts}
      promotedListing={promotedListing}
      // The focused listings / people tab pages with the SAME query the SSR ran;
      // the client adds its own limit/offset per page. Passed for every tab
      // (harmless elsewhere: load-more is gated on the focused vertical having
      // more leak-free rows).
      searchInput={input}
      pageSize={SEARCH_PAGE_SIZE}
    />
  );
}
