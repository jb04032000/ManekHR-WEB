'use client';

/**
 * SearchResultsScreen - the interactive surface for `/connect/search`.
 *
 * The Server Component (`page.tsx`) reads the URL params, runs the federated
 * search, and hands down a discriminated `state`. This client island renders:
 *
 *   - the screen header (title + help tooltip + adaptive subtitle),
 *   - the `ModuleTabs` strip (all / people / posts / listings / jobs;
 *     `?type=` URL-synced) that lets the member jump between verticals,
 *   - the canonical-echo line "Showing results for X" when the backend folded
 *     an alias (`query.text !== query.raw`),
 *   - the tag chips for every canonical slug the backend extracted from the
 *     query (`#zardozi` -> `zari` chip, removable),
 *   - the matching body state: prompt when there is no query, the empty state
 *     when a real query matched nobody, a recoverable error, or the per-vertical
 *     results (people / posts / listings / jobs).
 *
 * People results reuse `PersonCard`; listings reuse `ListingCard`; posts reuse
 * `PostResultCard`; jobs reuse `JobCard` (the same card the board renders).
 */

import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search, TriangleAlert, X } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { InfoTooltip } from '@/components/ui';
import {
  ConnectEmptyState,
  ConnectErrorBoundary,
  ConnectPage,
  ListingCard,
  ModuleTabs,
  PersonCard,
  Rail,
  RailPanel,
} from '@/components/connect';
import type { ConnectPerson, ModuleTab } from '@/components/connect';
import PersonCardActions from '../network/PersonCardActions';
import type {
  ConnectListingRef,
  PageResult,
  PersonResult,
  PostResult,
  SearchConnectAllInput,
  SearchResponse,
  SearchType,
  StorefrontResult,
  TrendingTag,
} from '../search.types';
// searchConnectAll powers the listings-tab infinite scroll (Phase 1 of the
// progressive-loading ADR): each appended page is the SAME federated fetch the
// SSR ran, so the per-viewer block filter + author-active gates re-run at
// hydration on every page (no FE leak surface).
import { searchConnectAll } from '../search.actions';
// Shared load-on-scroll engine for the focused single-vertical tabs (listings =
// Phase 1, people = Phase 2). Carries the never-ending-scroll end-guard.
import {
  useVerticalInfiniteScroll,
  type VerticalInfiniteScroll,
} from './useVerticalInfiniteScroll';
import JobCard from '../jobs/JobCard';
// Type-only: the federated jobs hit shape (the jobs tab infinite-scrolls Job[]).
import type { Job } from '../jobs/jobs.types';
// Sponsored search row (placement search_results): one labelled promoted listing,
// server-resolved, never the first result. Reuses the marketplace promoted card
// (its "Promoted" disclosure + MRC view/click beacons).
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '../marketplace/PromotedListingAdCard';
// Mobile inline ad (Google-only here): the sponsored listing row already serves
// in-results on every width; this surfaces the Google connect.right.top slot
// (which lives in the xl rail) for phone/tablet without duplicating it.
import MobileAdInline from '../ads/MobileAdInline';
import FacetPanel from './FacetPanel';
import ListingFacetPanel from '../marketplace/ListingFacetPanel';
import PostFacetPanel from './PostFacetPanel';
import JobFacetPanel from './JobFacetPanel';
// SRCH-VERT-1: the Pages-tab facet strip (pageKind business/institute + shared district).
import PageFacetPanel from './PageFacetPanel';
import PostResultCard from './PostResultCard';
// SRCH-VERT-1: the two new public-vertical result cards. Storefront -> /connect/store,
// page -> /connect/company (institute badge driven by page.kind).
import StorefrontResultCard from './StorefrontResultCard';
import PageResultCard from './PageResultCard';
// SearchResultSection: the framed white card (or bare header) that groups one
// vertical's rows in the redesigned results layout. Search-specific (not a DS atom).
import SearchResultSection from './SearchResultSection';
// Dismissible "sample content" disclosure strip at the top of search results.
import SampleContentBanner from '@/components/connect/SampleContentBanner';
import TrendingTags from './TrendingTags';
import ZeroResultSuggestions from './ZeroResultSuggestions';
// Google (AdSense) rail slots - reuses the shared connect.right.* placements +
// AdSlot seam (same as ConnectRightRail). Renders nothing until AdSense is wired,
// so it adds no box today; the in-results sponsored listing row is untouched.
import AdSlot from '@/components/connect/AdSlot';
import { removeTagFromQuery } from './url-params';
import { sponsoredSearchRowIndex } from './search-ads';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';

/**
 * The search outcome handed down by the Server Component. A discriminated
 * union so each on-screen state carries exactly its own data.
 *
 *   - `no-query` is the empty-input prompt with no backend round-trip.
 *   - `results` carries the full federated `SearchResponse` envelope
 *     (results, type, query echo, per-vertical groups) so the screen can
 *     render tag chips + the canonicalization echo alongside the list.
 *   - `error` is the recoverable failure with a Retry button.
 */
export type SearchScreenState =
  | { kind: 'no-query' }
  | (SearchResponse & { kind: 'results' })
  | { kind: 'error'; message: string };

interface SearchResultsScreenProps {
  /** The current `?q=` value, already trimmed. Empty string when absent. */
  query: string;
  state: SearchScreenState;
  /**
   * Trending tags handed down from the Server Component (parallel-fetched
   * with the search action). Optional so existing call sites that pre-date
   * S1.6.5 continue to work; defaults to an empty list (TrendingTags
   * renders the empty-state message in that case).
   */
  trendingTags?: TrendingTag[];
  /**
   * Tag-slug to listing count from the backend search envelope (`tagCounts`
   * field). Threaded down to `ListingFacetPanel` so the "Product types" chip
   * group renders on the listings tab exactly as it does on the marketplace
   * page. Absent when the search envelope carries no tag counts (e.g. the
   * people-only vertical).
   */
  tagCounts?: Record<string, number>;
  /**
   * One server-resolved sponsored listing for the search_results placement.
   * Rendered as a single "Promoted" row, never the first result, only on the
   * listings + all verticals. Null when no eligible boost (the common case).
   */
  promotedListing?: PromotedListingResolved | null;
  /**
   * The SSR search input (q + type + filters) for the focused LISTINGS tab, so
   * the client can fetch the next listings page with the same query. Absent on
   * the no-query prompt. Listings infinite scroll only (Phase 1); the people /
   * posts / jobs / storefronts / pages tabs are not paginated yet (Phase 2+).
   */
  searchInput?: SearchConnectAllInput | null;
  /**
   * Listings page size the SSR used for page 1; the client reuses it for each
   * appended infinite-scroll page so offsets stay aligned. Mirrors the
   * marketplace `pageSize`.
   */
  pageSize?: number;
}

/** Map a backend `PersonResult` to the `PersonCard` (`ConnectPerson`) shape. */
function toPerson(result: PersonResult): ConnectPerson {
  return {
    userId: result.userId,
    name: result.name,
    headline: result.headline ?? undefined,
    avatarUrl: result.avatar ?? undefined,
    // "open to" ring - federated people vertical hydrates via getPeopleByIds.
    openStatus: result.openStatus ?? null,
  };
}

// Full-bleed result row inside a SearchResultSection panel: comfortable padding,
// a hairline divider (suppressed on the last row) + a color-only hover wash, via
// the `.cn-search-row` utility in globals.css (guaranteed dividers/hover rather
// than an unproven Tailwind arbitrary border-color). PERSON rows carry their own
// padding here (PersonCard has none); CARD rows (post / storefront / page) only
// need a horizontal inset since those cards bring their own vertical padding.
const SEARCH_ROW_CLASS = 'cn-search-row';
const SEARCH_ROW_STYLE_PERSON = { padding: '12px 16px' } as const;
const SEARCH_ROW_STYLE_CARD = { padding: '0 12px' } as const;

export default function SearchResultsScreen({
  query,
  state,
  trendingTags = [],
  tagCounts,
  promotedListing,
  searchInput = null,
  pageSize = 24,
}: SearchResultsScreenProps) {
  const t = useTranslations('connect.search');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The active vertical drives which facet panel renders (URL-synced, matching
  // the ModuleTabs highlight): `all` / `people` use the people facets; the
  // listings tab uses the listings facets.
  const activeType = searchParams.get('type') ?? 'all';

  // --- Focused-tab infinite scroll (progressive-loading ADR) ---
  // The focused single-vertical tab pages on scroll: listings (Phase 1) + people
  // (Phase 2). Both reuse the shared useVerticalInfiniteScroll engine, driven by
  // the leak-free total (the backend's post-suppression count) + limit/offset.
  // The blended `all` view stays a preview and is NOT paginated. `resetSig`
  // discards appended pages whenever the SSR set changes (new query / filter / tab).
  const resetSig = `${state.kind}:${query}:${searchParams.toString()}`;
  const baseListings = useMemo(() => (state.kind === 'results' ? state.listings : []), [state]);
  const basePeople = useMemo(() => (state.kind === 'results' ? state.results : []), [state]);
  const basePosts = useMemo(() => (state.kind === 'results' ? state.posts : []), [state]);
  const baseJobs = useMemo(() => (state.kind === 'results' ? state.jobs : []), [state]);
  const baseStorefronts = useMemo(
    () => (state.kind === 'results' ? state.storefronts : []),
    [state],
  );
  const basePages = useMemo(() => (state.kind === 'results' ? state.pages : []), [state]);

  // Each fetchMore re-runs the SAME federated search with a page; the per-viewer
  // block + author-active gates re-run at hydration, so paged fetches stay
  // leak-safe. A null searchInput (no-query / error states never scroll) stops
  // cleanly via the hook's empty-page end-guard.
  const fetchMoreListings = useCallback(
    async (offset: number) => {
      if (!searchInput) return { ok: true as const, rows: [] };
      const res = await searchConnectAll({ ...searchInput, limit: pageSize, offset });
      return res.ok
        ? { ok: true as const, rows: res.data.listings }
        : { ok: false as const, error: res.error };
    },
    [searchInput, pageSize],
  );
  const fetchMorePeople = useCallback(
    async (offset: number) => {
      if (!searchInput) return { ok: true as const, rows: [] };
      const res = await searchConnectAll({ ...searchInput, limit: pageSize, offset });
      return res.ok
        ? { ok: true as const, rows: res.data.results }
        : { ok: false as const, error: res.error };
    },
    [searchInput, pageSize],
  );
  const fetchMorePosts = useCallback(
    async (offset: number) => {
      if (!searchInput) return { ok: true as const, rows: [] };
      const res = await searchConnectAll({ ...searchInput, limit: pageSize, offset });
      return res.ok
        ? { ok: true as const, rows: res.data.posts }
        : { ok: false as const, error: res.error };
    },
    [searchInput, pageSize],
  );
  const fetchMoreJobs = useCallback(
    async (offset: number) => {
      if (!searchInput) return { ok: true as const, rows: [] };
      const res = await searchConnectAll({ ...searchInput, limit: pageSize, offset });
      return res.ok
        ? { ok: true as const, rows: res.data.jobs }
        : { ok: false as const, error: res.error };
    },
    [searchInput, pageSize],
  );
  const fetchMoreStorefronts = useCallback(
    async (offset: number) => {
      if (!searchInput) return { ok: true as const, rows: [] };
      const res = await searchConnectAll({ ...searchInput, limit: pageSize, offset });
      return res.ok
        ? { ok: true as const, rows: res.data.storefronts }
        : { ok: false as const, error: res.error };
    },
    [searchInput, pageSize],
  );
  const fetchMorePages = useCallback(
    async (offset: number) => {
      if (!searchInput) return { ok: true as const, rows: [] };
      const res = await searchConnectAll({ ...searchInput, limit: pageSize, offset });
      return res.ok
        ? { ok: true as const, rows: res.data.pages }
        : { ok: false as const, error: res.error };
    },
    [searchInput, pageSize],
  );

  const listingsScroll = useVerticalInfiniteScroll<ConnectListingRef>({
    baseRows: baseListings,
    total: state.kind === 'results' ? (state.listingsTotal ?? 0) : 0,
    resetKey: resetSig,
    enabled: state.kind === 'results' && state.type === 'listings',
    fetchMore: fetchMoreListings,
  });
  const peopleScroll = useVerticalInfiniteScroll<PersonResult>({
    baseRows: basePeople,
    total: state.kind === 'results' ? (state.peopleTotal ?? 0) : 0,
    resetKey: resetSig,
    enabled: state.kind === 'results' && state.type === 'people',
    fetchMore: fetchMorePeople,
  });
  const postsScroll = useVerticalInfiniteScroll<PostResult>({
    baseRows: basePosts,
    total: state.kind === 'results' ? (state.postsTotal ?? 0) : 0,
    resetKey: resetSig,
    enabled: state.kind === 'results' && state.type === 'posts',
    fetchMore: fetchMorePosts,
  });
  const jobsScroll = useVerticalInfiniteScroll<Job>({
    baseRows: baseJobs,
    total: state.kind === 'results' ? (state.jobsTotal ?? 0) : 0,
    resetKey: resetSig,
    enabled: state.kind === 'results' && state.type === 'jobs',
    fetchMore: fetchMoreJobs,
  });
  const storefrontsScroll = useVerticalInfiniteScroll<StorefrontResult>({
    baseRows: baseStorefronts,
    total: state.kind === 'results' ? (state.storefrontsTotal ?? 0) : 0,
    resetKey: resetSig,
    enabled: state.kind === 'results' && state.type === 'storefronts',
    fetchMore: fetchMoreStorefronts,
  });
  const pagesScroll = useVerticalInfiniteScroll<PageResult>({
    baseRows: basePages,
    total: state.kind === 'results' ? (state.pagesTotal ?? 0) : 0,
    resetKey: resetSig,
    enabled: state.kind === 'results' && state.type === 'pages',
    fetchMore: fetchMorePages,
  });

  // Per-vertical counts so the subtitle + empty-state copy can adapt to the
  // active tab. Listings counts feed only the listings + all branches; the
  // legacy people-only flow keeps reading state.results.length.
  const peopleCount = state.kind === 'results' ? state.results.length : 0;
  const postCount = state.kind === 'results' ? state.posts.length : 0;
  const listingCount = state.kind === 'results' ? state.listings.length : 0;
  const jobCount = state.kind === 'results' ? state.jobs.length : 0;
  // SRCH-VERT-1: storefront + page (business/institute) counts.
  const storefrontCount = state.kind === 'results' ? state.storefronts.length : 0;
  const pageCount = state.kind === 'results' ? state.pages.length : 0;

  // Leak-free per-vertical TOTALS (the Phase 2 envelope's post-suppression
  // counts). They drive the tab badges + the blended-section count chips so a
  // glance shows the true corpus size per vertical, not just the preview slice.
  // Fall back to the loaded length when a total is absent (older envelopes).
  // Note: a FOCUSED search only totals the active vertical, so the other tabs'
  // badges naturally fall to 0 (hidden) until the blended view restores them.
  const peopleTotal = state.kind === 'results' ? (state.peopleTotal ?? peopleCount) : 0;
  const postsTotal = state.kind === 'results' ? (state.postsTotal ?? postCount) : 0;
  const listingsTotal = state.kind === 'results' ? (state.listingsTotal ?? listingCount) : 0;
  const jobsTotal = state.kind === 'results' ? (state.jobsTotal ?? jobCount) : 0;
  const storefrontsTotal =
    state.kind === 'results' ? (state.storefrontsTotal ?? storefrontCount) : 0;
  const pagesTotal = state.kind === 'results' ? (state.pagesTotal ?? pageCount) : 0;

  const resultCount =
    state.kind === 'results'
      ? state.type === 'listings'
        ? // Focused listings tab: the count reflects the rows currently loaded
          // (grows as infinite scroll appends pages), matching the marketplace.
          listingsScroll.rows.length
        : state.type === 'posts'
          ? // Focused posts tab: loaded count, grows as scroll appends (Phase 3).
            postsScroll.rows.length
          : state.type === 'jobs'
            ? // Focused jobs tab: loaded count, grows as scroll appends (Phase 3).
              jobsScroll.rows.length
            : state.type === 'storefronts'
              ? // Focused storefronts tab: loaded count, grows as scroll appends (Phase 3).
                storefrontsScroll.rows.length
              : state.type === 'pages'
                ? // Focused pages tab: loaded count, grows as scroll appends (Phase 3).
                  pagesScroll.rows.length
                : state.type === 'all'
                  ? peopleCount + postCount + listingCount + jobCount + storefrontCount + pageCount
                  : // Focused people tab: loaded count, grows as scroll appends (Phase 2).
                    peopleScroll.rows.length
      : 0;

  // Additive funnel telemetry: searchPerformed once per distinct search (query +
  // active vertical), only when results actually rendered. PII RULE: we send the
  // query LENGTH, never the query text. Keyed on query+activeType so a re-render
  // does not re-fire; a new search (changed q or tab) fires once. Keyless-safe.
  //
  // Zero-result split: when a real query matched nobody across the active
  // vertical, fire searchNoResults instead so the "nothing found" funnel is
  // measurable (pairs with the backend `connect.search_no_results` event). Same
  // query+activeType keying so it fires once per distinct empty search.
  const isResults = state.kind === 'results';
  const isZeroResult = isResults && resultCount === 0 && query.length > 0;
  useEffect(() => {
    if (!isResults) return;
    trackEvent(isZeroResult ? ConnectEvents.searchNoResults : ConnectEvents.searchPerformed, {
      queryLength: query.length,
      vertical: activeType,
      resultCount,
    });
    // resultCount is derived from query+activeType+state; intentionally tracked
    // via the query/vertical keys so the event fires once per distinct search.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, activeType, isResults]);

  /** The line under the header. Adapts to the active state + vertical. */
  const subtitle = useMemo(() => {
    if (state.kind === 'no-query') return t('subtitlePrompt');
    if (state.kind === 'error') return t('subtitleError');
    if (resultCount === 0) {
      if (state.type === 'listings') return t('subtitleEmptyListings', { query });
      if (state.type === 'posts') return t('subtitleEmptyPosts', { query });
      if (state.type === 'jobs') return t('subtitleEmptyJobs', { query });
      if (state.type === 'storefronts') return t('subtitleEmptyStorefronts', { query });
      if (state.type === 'pages') return t('subtitleEmptyPages', { query });
      if (state.type === 'all') return t('subtitleEmptyAll', { query });
      return t('subtitleEmpty', { query });
    }
    if (state.type === 'listings') {
      return t('subtitleResultsListings', { count: resultCount, query });
    }
    if (state.type === 'posts') {
      return t('subtitleResultsPosts', { count: resultCount, query });
    }
    if (state.type === 'jobs') {
      return t('subtitleResultsJobs', { count: resultCount, query });
    }
    if (state.type === 'storefronts') {
      return t('subtitleResultsStorefronts', { count: resultCount, query });
    }
    if (state.type === 'pages') {
      return t('subtitleResultsPages', { count: resultCount, query });
    }
    if (state.type === 'all') {
      return t('subtitleResultsAll', { count: resultCount, query });
    }
    return t('subtitleResults', { count: resultCount, query });
  }, [state, resultCount, query, t]);

  /** The tab definitions. Labels are i18n'd; tabs always render in the same
   *  order so the strip is predictable at every screen state. SRCH-VERT-1 adds
   *  Storefronts + Pages at the end, each carrying a result count badge (only
   *  shown when the active search actually returned that vertical's rows). */
  const tabs: ModuleTab[] = useMemo(
    () => [
      { key: 'all', label: t('tabs.all') },
      // Each tab carries its leak-free vertical total as a badge; ModuleTabs
      // hides a 0/null badge (so a focused search shows only the active count).
      { key: 'people', label: t('tabs.people'), count: peopleTotal || null },
      { key: 'posts', label: t('tabs.posts'), count: postsTotal || null },
      { key: 'listings', label: t('tabs.listings'), count: listingsTotal || null },
      { key: 'jobs', label: t('tabs.jobs'), count: jobsTotal || null },
      { key: 'storefronts', label: t('tabs.storefronts'), count: storefrontsTotal || null },
      { key: 'pages', label: t('tabs.pages'), count: pagesTotal || null },
    ],
    [t, peopleTotal, postsTotal, listingsTotal, jobsTotal, storefrontsTotal, pagesTotal],
  );

  /**
   * Strip a canonical tag from the URL `q` and navigate to the cleaned URL.
   * Every other search param (`type=`, future facets) is preserved.
   */
  const handleRemoveTag = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = removeTagFromQuery(query, slug);
      if (next) {
        params.set('q', next);
      } else {
        params.delete('q');
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, query, router, searchParams],
  );

  /**
   * "Show all" jump from a blended-view section into that vertical's focused tab
   * (preview -> focused, the LinkedIn model; Phase 1b of the progressive-loading
   * ADR). Preserves `q` + every other param and only switches `?type=`.
   */
  const showAllHref = useCallback(
    (vertical: SearchType): string => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('type', vertical);
      const qs = params.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname, searchParams],
  );

  /** The shared load-on-scroll sentinel for a focused vertical tab: a spinner
   *  while the next page loads, a manual Retry on error. Rendered only while the
   *  vertical has more leak-free rows. `loadingLabel` is per-vertical copy
   *  ("Loading more listings..." vs "...people...") so the two tabs read right. */
  const scrollSentinel = (
    scroll: VerticalInfiniteScroll<unknown>,
    loadingLabel: string,
  ): ReactNode =>
    scroll.hasMore ? (
      <div
        ref={scroll.sentinelRef}
        style={{
          marginTop: 'var(--cr-space-lg)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {scroll.loadMoreError ? (
          <DsButton dsVariant="ghost" dsSize="sm" onClick={scroll.retry}>
            {t('loadMoreRetry')}
          </DsButton>
        ) : (
          <span style={{ fontSize: 12.5, color: 'var(--cr-text-4)' }}>{loadingLabel}</span>
        )}
      </div>
    ) : null;

  const showCanonicalEcho =
    state.kind === 'results' && state.query.text !== state.query.raw && state.query.text.length > 0;
  const showTagChips = state.kind === 'results' && state.query.tags.length > 0;

  /**
   * Build the listing rows with the single sponsored row injected at index 1
   * (placement search_results): never the first result, and only when there is
   * at least one organic listing to precede it. At most one sponsored row.
   */
  const listingRows = (listings: SearchResponse['listings']): ReactNode[] => {
    const rows: ReactNode[] = listings.map((listing) => (
      <li key={listing.listingId}>
        {/* source="search" tags the detail href so the view is attributed to
            the search vertical in the listing funnel analytics. */}
        <ListingCard listing={listing} source="search" />
      </li>
    ));
    const at = sponsoredSearchRowIndex(rows.length, Boolean(promotedListing));
    if (promotedListing && at !== null) {
      rows.splice(
        at,
        0,
        <li key="cn-search-sponsored">
          <PromotedListingAdCard {...promotedListing} />
        </li>,
      );
    }
    return rows;
  };

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {/* Sample-content disclosure strip (launch period); self-hides when
            dismissed / disabled. */}
        <SampleContentBanner />
        <header style={{ marginBottom: 'var(--cr-space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--cr-text)' }}>
              {t('title')}
            </h1>
            <InfoTooltip
              text={t('helpTitle')}
              body={<p style={{ margin: 0 }}>{t('help')}</p>}
              ariaLabel={t('helpTitle')}
            />
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cr-text-4)' }}>{subtitle}</p>
        </header>

        {/* Type tab strip. ModuleTabs reads `?type=` from the live URL so the
            highlighted tab always matches the URL state. */}
        <div style={{ marginBottom: 'var(--cr-space-md)' }}>
          <ModuleTabs
            tabs={tabs}
            paramName="type"
            defaultTab="all"
            ariaLabel={t('tabs.ariaLabel')}
          />
        </div>

        {/* Facet panel. The listings tab swaps in the listings facets (category
            / district / price); its keyword field is hidden because the header
            search bar above already owns q. The jobs tab shows a category-only
            facet (the one knob the backend job search reads). The posts tab has
            no facets yet, so it renders none. */}
        {activeType === 'listings' ? (
          <ListingFacetPanel showKeyword={false} tagCounts={tagCounts} />
        ) : activeType === 'jobs' ? (
          <JobFacetPanel />
        ) : activeType === 'posts' ? (
          <PostFacetPanel />
        ) : activeType === 'pages' ? (
          // SRCH-VERT-1: Pages tab gets the pageKind (business/institute) pills
          // plus the shared district facet.
          <PageFacetPanel showPageKind />
        ) : activeType === 'storefronts' ? (
          // SRCH-VERT-1: Storefronts tab reuses the same panel for the shared
          // district facet only (pageKind is meaningless for a storefront).
          <PageFacetPanel showPageKind={false} />
        ) : (
          <FacetPanel />
        )}

        {showCanonicalEcho && state.kind === 'results' && (
          <p
            style={{
              margin: '0 0 var(--cr-space-sm)',
              fontSize: 12.5,
              color: 'var(--cr-text-4)',
            }}
          >
            {t('canonicalEcho', { text: state.query.text })}
          </p>
        )}

        {showTagChips && state.kind === 'results' && (
          <ul
            role="list"
            aria-label={t('tagsAria')}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
              listStyle: 'none',
              margin: '0 0 var(--cr-space-md)',
              padding: 0,
            }}
          >
            {state.query.tags.map((slug) => (
              <li key={slug} style={{ display: 'inline-flex' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 6px 4px 10px',
                    borderRadius: 'var(--cr-radius-full)',
                    background: 'var(--cr-surface-2)',
                    color: 'var(--cr-text-2)',
                    fontSize: 12.5,
                    fontWeight: 500,
                  }}
                >
                  <span>#{slug}</span>
                  <button
                    type="button"
                    aria-label={t('removeTag', { tag: slug })}
                    onClick={() => handleRemoveTag(slug)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 18,
                      height: 18,
                      padding: 0,
                      border: 'none',
                      borderRadius: '50%',
                      background: 'transparent',
                      color: 'var(--cr-text-4)',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <ConnectErrorBoundary>
          {state.kind === 'no-query' ? (
            <ConnectEmptyState
              variant="inline"
              icon={<Search size={24} aria-hidden />}
              title={t('noQueryTitle')}
              description={t('noQueryBody')}
            />
          ) : state.kind === 'error' ? (
            <div
              role="alert"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                gap: 'var(--cr-space-sm)',
                padding: 'var(--cr-space-xl) var(--cr-space-md)',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: 'var(--cr-error-bg)',
                  color: 'var(--cr-error)',
                }}
              >
                <TriangleAlert size={22} />
              </span>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text)' }}>
                {t('errorTitle')}
              </h2>
              <p
                style={{
                  margin: 0,
                  maxWidth: 360,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('errorBody')}
              </p>
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                onClick={() => router.refresh()}
                style={{ marginTop: 'var(--cr-space-xs)' }}
              >
                {t('retry')}
              </DsButton>
            </div>
          ) : resultCount === 0 ? (
            // Zero-result recovery (checklist §3): a "no results for X" line, a
            // broaden hint, popular categories, and a "search everything" jump.
            // The zero-result query is logged via searchNoResults in the effect
            // above. The activeType (live URL ?type=) drives which popular set
            // and whether the broaden affordance shows.
            <ZeroResultSuggestions query={query} activeType={state.type} />
          ) : state.type === 'listings' ? (
            // Listings-only vertical: the full paginated list (page 1 from SSR +
            // any pages appended by infinite scroll), with the scroll sentinel.
            <>
              <ul
                aria-label={t('resultsAriaListings')}
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--cr-space-sm)',
                }}
              >
                {listingRows(listingsScroll.rows)}
              </ul>
              {scrollSentinel(listingsScroll, t('loadingMore'))}
            </>
          ) : state.type === 'posts' ? (
            // Posts-only vertical: the full paginated list (SSR page 1 + scroll-
            // appended pages) framed in a panel, with the load-on-scroll sentinel.
            <>
              <SearchResultSection headingId="cn-search-posts">
                <ul
                  aria-label={t('resultsAriaPosts')}
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}
                >
                  {postsScroll.rows.map((post) => (
                    <li
                      key={post.postId}
                      className={SEARCH_ROW_CLASS}
                      style={SEARCH_ROW_STYLE_CARD}
                    >
                      <PostResultCard post={post} />
                    </li>
                  ))}
                </ul>
              </SearchResultSection>
              {scrollSentinel(postsScroll, t('loadingMorePosts'))}
            </>
          ) : state.type === 'jobs' ? (
            // Jobs-only vertical: the full paginated list (SSR page 1 + scroll-
            // appended pages) with the load-on-scroll sentinel (Phase 3).
            <>
              <ul
                aria-label={t('resultsAriaJobs')}
                style={{
                  listStyle: 'none',
                  margin: 0,
                  padding: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--cr-space-sm)',
                }}
              >
                {jobsScroll.rows.map((job) => (
                  <li key={job._id}>
                    <JobCard job={job} />
                  </li>
                ))}
              </ul>
              {scrollSentinel(jobsScroll, t('loadingMoreJobs'))}
            </>
          ) : state.type === 'storefronts' ? (
            // Storefronts-only vertical -> /connect/store/[slug]. The full paginated
            // list (SSR page 1 + scroll-appended pages) framed in a panel + sentinel.
            <>
              <SearchResultSection headingId="cn-search-storefronts">
                <ul
                  aria-label={t('resultsAriaStorefronts')}
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}
                >
                  {storefrontsScroll.rows.map((store) => (
                    <li
                      key={store.storefrontId}
                      className={SEARCH_ROW_CLASS}
                      style={SEARCH_ROW_STYLE_CARD}
                    >
                      <StorefrontResultCard store={store} />
                    </li>
                  ))}
                </ul>
              </SearchResultSection>
              {scrollSentinel(storefrontsScroll, t('loadingMoreStorefronts'))}
            </>
          ) : state.type === 'pages' ? (
            // Company/Institute pages vertical -> /connect/company/[slug]. The full
            // paginated list (SSR page 1 + scroll-appended pages) framed + sentinel.
            <>
              <SearchResultSection headingId="cn-search-pages">
                <ul
                  aria-label={t('resultsAriaPages')}
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}
                >
                  {pagesScroll.rows.map((page) => (
                    <li
                      key={page.pageId}
                      className={SEARCH_ROW_CLASS}
                      style={SEARCH_ROW_STYLE_CARD}
                    >
                      <PageResultCard page={page} />
                    </li>
                  ))}
                </ul>
              </SearchResultSection>
              {scrollSentinel(pagesScroll, t('loadingMorePages'))}
            </>
          ) : state.type === 'all' ? (
            // Federated view: each non-empty vertical gets its own framed
            // SearchResultSection so a glance shows what came from where. Order
            // matches the backend's weight ordering (people first).
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-md)' }}>
              {state.results.length > 0 && (
                <SearchResultSection
                  headingId="cn-search-section-people"
                  title={t('allSectionPeople')}
                  count={peopleTotal}
                  showAllHref={showAllHref('people')}
                  showAllLabel={t('showAll')}
                  showAllAriaLabel={t('showAllAria', { section: t('allSectionPeople') })}
                >
                  <ul
                    aria-label={t('resultsAria')}
                    style={{ listStyle: 'none', margin: 0, padding: 0 }}
                  >
                    {state.results.map((result) => (
                      <li
                        key={result.userId}
                        className={SEARCH_ROW_CLASS}
                        style={SEARCH_ROW_STYLE_PERSON}
                      >
                        <PersonCard
                          person={toPerson(result)}
                          action={<PersonCardActions userId={result.userId} mode="full" />}
                        />
                      </li>
                    ))}
                  </ul>
                </SearchResultSection>
              )}
              {state.posts.length > 0 && (
                <SearchResultSection
                  headingId="cn-search-section-posts"
                  title={t('allSectionPosts')}
                  count={postsTotal}
                  showAllHref={showAllHref('posts')}
                  showAllLabel={t('showAll')}
                  showAllAriaLabel={t('showAllAria', { section: t('allSectionPosts') })}
                >
                  <ul
                    aria-label={t('resultsAriaPosts')}
                    style={{ listStyle: 'none', margin: 0, padding: 0 }}
                  >
                    {state.posts.map((post) => (
                      <li
                        key={post.postId}
                        className={SEARCH_ROW_CLASS}
                        style={SEARCH_ROW_STYLE_CARD}
                      >
                        <PostResultCard post={post} />
                      </li>
                    ))}
                  </ul>
                </SearchResultSection>
              )}
              {state.listings.length > 0 && (
                <SearchResultSection
                  headingId="cn-search-section-listings"
                  title={t('allSectionListings')}
                  count={listingsTotal}
                  variant="bare"
                  showAllHref={showAllHref('listings')}
                  showAllLabel={t('showAll')}
                  showAllAriaLabel={t('showAllAria', { section: t('allSectionListings') })}
                >
                  <ul
                    aria-label={t('resultsAriaListings')}
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--cr-space-sm)',
                    }}
                  >
                    {listingRows(state.listings)}
                  </ul>
                </SearchResultSection>
              )}
              {state.jobs.length > 0 && (
                <SearchResultSection
                  headingId="cn-search-section-jobs"
                  title={t('allSectionJobs')}
                  count={jobsTotal}
                  variant="bare"
                  showAllHref={showAllHref('jobs')}
                  showAllLabel={t('showAll')}
                  showAllAriaLabel={t('showAllAria', { section: t('allSectionJobs') })}
                >
                  <ul
                    aria-label={t('resultsAriaJobs')}
                    style={{
                      listStyle: 'none',
                      margin: 0,
                      padding: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--cr-space-sm)',
                    }}
                  >
                    {state.jobs.map((job) => (
                      <li key={job._id}>
                        <JobCard job={job} />
                      </li>
                    ))}
                  </ul>
                </SearchResultSection>
              )}
              {/* SRCH-VERT-1: Storefronts section in the blended view. */}
              {state.storefronts.length > 0 && (
                <SearchResultSection
                  headingId="cn-search-section-storefronts"
                  title={t('allSectionStorefronts')}
                  count={storefrontsTotal}
                  showAllHref={showAllHref('storefronts')}
                  showAllLabel={t('showAll')}
                  showAllAriaLabel={t('showAllAria', { section: t('allSectionStorefronts') })}
                >
                  <ul
                    aria-label={t('resultsAriaStorefronts')}
                    style={{ listStyle: 'none', margin: 0, padding: 0 }}
                  >
                    {state.storefronts.map((store) => (
                      <li
                        key={store.storefrontId}
                        className={SEARCH_ROW_CLASS}
                        style={SEARCH_ROW_STYLE_CARD}
                      >
                        <StorefrontResultCard store={store} />
                      </li>
                    ))}
                  </ul>
                </SearchResultSection>
              )}
              {/* SRCH-VERT-1: Company/Institute pages section in the blended view. */}
              {state.pages.length > 0 && (
                <SearchResultSection
                  headingId="cn-search-section-pages"
                  title={t('allSectionPages')}
                  count={pagesTotal}
                  showAllHref={showAllHref('pages')}
                  showAllLabel={t('showAll')}
                  showAllAriaLabel={t('showAllAria', { section: t('allSectionPages') })}
                >
                  <ul
                    aria-label={t('resultsAriaPages')}
                    style={{ listStyle: 'none', margin: 0, padding: 0 }}
                  >
                    {state.pages.map((page) => (
                      <li
                        key={page.pageId}
                        className={SEARCH_ROW_CLASS}
                        style={SEARCH_ROW_STYLE_CARD}
                      >
                        <PageResultCard page={page} />
                      </li>
                    ))}
                  </ul>
                </SearchResultSection>
              )}
            </div>
          ) : (
            // People-only vertical (the focused people tab): the full paginated
            // list (page 1 from SSR + any pages appended by infinite scroll, Phase
            // 2), with the scroll sentinel below it.
            <>
              <SearchResultSection headingId="cn-search-people">
                <ul
                  aria-label={t('resultsAria')}
                  style={{ listStyle: 'none', margin: 0, padding: 0 }}
                >
                  {peopleScroll.rows.map((result) => (
                    <li
                      key={result.userId}
                      className={SEARCH_ROW_CLASS}
                      style={SEARCH_ROW_STYLE_PERSON}
                    >
                      <PersonCard
                        person={toPerson(result)}
                        action={<PersonCardActions userId={result.userId} mode="full" />}
                      />
                    </li>
                  ))}
                </ul>
              </SearchResultSection>
              {scrollSentinel(peopleScroll, t('loadingMorePeople'))}
            </>
          )}
        </ConnectErrorBoundary>
        {/* Mobile-only Google unit (the sponsored row already serves in-results,
            so pass null = Google-only). The rail is hidden below xl. */}
        <MobileAdInline promoted={null} />
      </main>

      {/* Right rail. Slot model: more panels (recent searches, saved
          filters) drop in as siblings with no screen rewrite. */}
      <Rail side="right">
        <RailPanel title={t('trending.title')}>
          <TrendingTags tags={trendingTags} />
        </RailPanel>
        {/* Google AdSense rail slot (third-party fill) between trending + tips.
            Reuses connect.right.top; renders nothing when AdSense is unconfigured,
            so it is shift-free + a no-op today. The in-results sponsored row uses
            its own search_results placement, so no duplication. */}
        <AdSlot placement="connect.right.top" />
        <RailPanel title={t('rail.tipsTitle')}>
          <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
            {t('rail.tipsBody')}
          </p>
        </RailPanel>
        {/* Second Google AdSense rail slot (connect.right.mid) below the tips
            panel - the rail has room for two units, matching ConnectRightRail's
            top+mid pair. No-op until AdSense is wired. */}
        <AdSlot placement="connect.right.mid" />
      </Rail>
    </ConnectPage>
  );
}
