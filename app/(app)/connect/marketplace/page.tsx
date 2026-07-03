import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { browseRecentListings, searchConnectAll } from '@/features/connect/search.actions';
import MarketplaceBrowseScreen, {
  type MarketplaceBrowseState,
} from '@/features/connect/marketplace/MarketplaceBrowseScreen';
import {
  readMarketplaceBrowseInput,
  type MarketplaceBrowseRawParams,
} from '@/features/connect/marketplace/url-params';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/marketplace` - the buyer-facing marketplace browse page (M1.6.1).
 *
 * A Server Component (ENGINEERING-STANDARDS #7). It folds the URL params
 * through `readMarketplaceBrowseInput` to a listings-pinned
 * `SearchConnectAllInput`, then decides which state to render:
 *
 *   - A bare browse (no query, no facet) short-circuits the action call and
 *     renders the category-first landing prompt. The federated action would
 *     return an empty envelope for a blank query anyway, so this saves a
 *     round-trip and gives the buyer a clear starting point.
 *   - Otherwise it runs the listings search and hands the `listings` vertical
 *     plus the query echo to `MarketplaceBrowseScreen`.
 */
interface MarketplacePageProps {
  searchParams: Promise<MarketplaceBrowseRawParams>;
}

/** SSR page-1 size; the client reuses it for each infinite-scroll page. */
const MARKETPLACE_PAGE_SIZE = 24;

export async function generateMetadata({ searchParams }: MarketplacePageProps): Promise<Metadata> {
  const t = await getTranslations('connect.marketplace');
  const { q } = readMarketplaceBrowseInput(await searchParams);
  return { title: q ? t('metaTitleQuery', { query: q }) : t('metaTitle') };
}

export default async function ConnectMarketplacePage({ searchParams }: MarketplacePageProps) {
  const rawParams = await searchParams;
  const input = readMarketplaceBrowseInput(rawParams);
  const query = input.q;

  // One id per page render shared by the rail + grid ad resolves below, so the
  // backend dedupes a campaign across the two slots (fairness C5): the same
  // boosted listing can win the rail OR the grid cell, never both at once.
  const adPageId = crypto.randomUUID();

  // A bare landing (no query AND no facet): the federated search returns empty
  // for a blank query, so instead of an empty prompt we show RECENT listings so
  // the marketplace has products on arrival. The facet panel stays mounted, so
  // the buyer can still narrow by category / district / price / keyword.
  const hasAnyFilter = Boolean(
    input.filters &&
    (input.filters.category !== undefined ||
      (input.filters.district && input.filters.district.length > 0) ||
      input.filters.priceMin !== undefined ||
      input.filters.priceMax !== undefined ||
      input.filters.verified !== undefined ||
      (input.filters.tags && input.filters.tags.length > 0)),
  );

  if (!query && !hasAnyFilter) {
    const [recentRes, promotedListing, gridPromotedListing] = await Promise.all([
      browseRecentListings({ limit: MARKETPLACE_PAGE_SIZE }),
      resolvePromotedRailListing('marketplace_rail', adPageId),
      resolvePromotedRailListing('marketplace_grid', adPageId),
    ]);
    // The recent browse now also carries corpus-wide category + district facet
    // counts (BE $facet aggregation) so the bare landing shows real counted
    // Category pills + Location chips before any search runs.
    const recent = recentRes.ok ? recentRes.data : null;
    const state: MarketplaceBrowseState =
      recent && recent.listings.length > 0
        ? { kind: 'recent', listings: recent.listings }
        : { kind: 'browse' };
    return (
      <MarketplaceBrowseScreen
        query=""
        state={state}
        promotedListing={promotedListing}
        gridPromotedListing={gridPromotedListing}
        categoryCounts={recent?.categoryCounts}
        districtCounts={recent?.districtCounts}
        total={recent?.total ?? 0}
        pageSize={MARKETPLACE_PAGE_SIZE}
      />
    );
  }

  const [searchRes, promotedListing, gridPromotedListing] = await Promise.all([
    searchConnectAll({ ...input, limit: MARKETPLACE_PAGE_SIZE }),
    resolvePromotedRailListing('marketplace_rail', adPageId),
    resolvePromotedRailListing('marketplace_grid', adPageId),
  ]);
  const state: MarketplaceBrowseState = searchRes.ok
    ? { kind: 'results', listings: searchRes.data.listings, query: searchRes.data.query }
    : { kind: 'error', message: searchRes.error };
  const tagCounts = searchRes.ok ? searchRes.data.tagCounts : undefined;
  // Category + district facet counts reflect the active filter set on the search
  // path (Meili facet distribution), so the counts narrow as the buyer filters.
  const categoryCounts = searchRes.ok ? searchRes.data.categoryCounts : undefined;
  const districtCounts = searchRes.ok ? searchRes.data.districtCounts : undefined;

  return (
    <MarketplaceBrowseScreen
      query={query}
      state={state}
      promotedListing={promotedListing}
      gridPromotedListing={gridPromotedListing}
      tagCounts={tagCounts}
      categoryCounts={categoryCounts}
      districtCounts={districtCounts}
      total={searchRes.ok ? (searchRes.data.listingsTotal ?? 0) : 0}
      pageSize={MARKETPLACE_PAGE_SIZE}
      searchInput={input}
    />
  );
}
