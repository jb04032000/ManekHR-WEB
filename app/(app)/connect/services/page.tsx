import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { searchConnectAll } from '@/features/connect/search.actions';
import MarketplaceBrowseScreen, {
  type MarketplaceBrowseState,
} from '@/features/connect/marketplace/MarketplaceBrowseScreen';
import {
  readServicesBrowseInput,
  withServicesBlend,
  type MarketplaceBrowseRawParams,
} from '@/features/connect/marketplace/url-params';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/services` - the Services discovery surface (Slice B3). Buyers find
 * service providers by service type + location. It REUSES the marketplace browse
 * end-to-end: the same `MarketplaceBrowseScreen` (in `mode="services"`), the same
 * `ListingGridCard`, the same `ListingFacetPanel`, and the SAME federated
 * `searchConnectAll` listings action - services are just listings with a service
 * category, so the service-type sub-filter maps straight to the existing
 * single-select `?category=` backend filter (no new endpoint).
 *
 * Cross-module: shares the marketplace listing engine + search backend; the
 * service-type set is `SERVICE_CATEGORY_SLUGS` (search.types.ts, mirror of the BE
 * `SERVICE_CATEGORIES`). Keep the service category set in sync there.
 *
 * Landing behavior: with no service type picked we blend ALL service categories
 * via the BE `categoryIn` set (`withServicesBlend`), so the page shows every
 * service category at once - a true "all services" default, not a pick-a-type
 * prompt. Products never bleed in because `categoryIn` carries only the service
 * slugs. Picking a service type swaps to the single `category` filter, narrowing
 * to that one type. A genuinely empty corpus falls through to the honest empty
 * state in `MarketplaceBrowseScreen` (results with zero listings).
 */
interface ServicesPageProps {
  searchParams: Promise<MarketplaceBrowseRawParams>;
}

/** SSR page-1 size; the client reuses it for each infinite-scroll page. */
const SERVICES_PAGE_SIZE = 24;

export async function generateMetadata({ searchParams }: ServicesPageProps): Promise<Metadata> {
  const t = await getTranslations('connect.marketplace.services');
  const { q } = readServicesBrowseInput(await searchParams);
  // Service browse is buyer-facing discovery; mirror the marketplace noindex
  // stance for the signed-in app surface (the marketing page carries the SEO).
  return {
    title: q ? t('metaTitleQuery', { query: q }) : t('metaTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function ConnectServicesPage({ searchParams }: ServicesPageProps) {
  const rawParams = await searchParams;
  // With no service type picked, blend the whole service-category set so the page
  // shows ALL services by default (not a pick-a-type prompt). A picked service type
  // leaves the single `category` filter in place to narrow to that one type.
  const input = withServicesBlend(readServicesBrowseInput(rawParams));
  const query = input.q;

  // One id per render shared by the rail + grid ad resolves so the backend dedupes
  // a campaign across the two slots (same fairness contract as the marketplace).
  const adPageId = crypto.randomUUID();

  // Always run the listings search now: either the blended "all services" set
  // (no type picked) or the single service `category` (type picked). Both flow to
  // the same federated listings action; an empty corpus shows the honest empty
  // state, never a products-bleeding recent-all list.
  const [searchRes, promotedListing, gridPromotedListing] = await Promise.all([
    searchConnectAll({ ...input, limit: SERVICES_PAGE_SIZE }),
    resolvePromotedRailListing('marketplace_rail', adPageId),
    resolvePromotedRailListing('marketplace_grid', adPageId),
  ]);
  const state: MarketplaceBrowseState = searchRes.ok
    ? { kind: 'results', listings: searchRes.data.listings, query: searchRes.data.query }
    : { kind: 'error', message: searchRes.error };
  const tagCounts = searchRes.ok ? searchRes.data.tagCounts : undefined;
  // Category + district facet counts reflect the active filter set (Meili facet
  // distribution); the CategoryStrip sums only the service slugs for its "All
  // services" tally so the count stays honest to what the strip filters by.
  const categoryCounts = searchRes.ok ? searchRes.data.categoryCounts : undefined;
  const districtCounts = searchRes.ok ? searchRes.data.districtCounts : undefined;

  return (
    <MarketplaceBrowseScreen
      query={query}
      mode="services"
      state={state}
      promotedListing={promotedListing}
      gridPromotedListing={gridPromotedListing}
      tagCounts={tagCounts}
      categoryCounts={categoryCounts}
      districtCounts={districtCounts}
      total={searchRes.ok ? (searchRes.data.listingsTotal ?? 0) : 0}
      pageSize={SERVICES_PAGE_SIZE}
      searchInput={input}
    />
  );
}
