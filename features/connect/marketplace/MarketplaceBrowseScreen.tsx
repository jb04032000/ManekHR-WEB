'use client';

/**
 * MarketplaceBrowseScreen - the interactive surface for `/connect/marketplace`
 * (M1.6.1, redesigned to the canonical Connect marketplace prototype via the
 * open-design skill). The Server Component (`page.tsx`) reads the URL, runs the
 * listings-pinned federated search, and hands down a discriminated `state`:
 *
 *   - `browse`  -> the category-first landing prompt. Shown when there is no
 *     query and no facet.
 *   - `recent`  -> recent listings on the bare landing (real products on
 *     arrival).
 *   - `results` -> a `ListingGridCard` grid, or the empty-for-filters state when
 *     a real query / facet matched nothing.
 *   - `error`   -> a recoverable failure with a Retry that re-runs the page.
 *
 * The redesign adds the prototype chrome on top of that logic, all of it driven
 * by the existing URL params (no new client state beyond local drafts):
 *
 *   - a prominent search band that owns `?q=` (the facet rail's keyword is off);
 *   - a dismissible "how buying works" strip (`HowBuyingWorks`);
 *   - a results toolbar with the real listing count and the backend-backed sort
 *     (`?sort=`, server-applied in the `results` state);
 *   - removable active-filter chips.
 *
 * Honest data only: no fabricated seller name, rating filter, response time, or
 * grade pills - the prototype's invented signals are intentionally dropped, the
 * same call the Company directory made.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  ArrowLeft,
  Plus,
  Rocket,
  Search,
  SearchX,
  Store,
  TriangleAlert,
  Wrench,
  X,
} from 'lucide-react';
import { Select } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { InfoTooltip } from '@/components/ui';
import {
  ConnectEmptyState,
  ConnectErrorBoundary,
  ConnectPage,
  ListingGridCard,
  Rail,
  RailPanel,
} from '@/components/connect';
import {
  categoryLabel,
  MARKETPLACE_SORTS,
  type ConnectListingRef,
  type MarketplaceSort,
  type SearchConnectAllInput,
  type SearchQueryEcho,
} from '../search.types';
import { browseRecentListings, searchConnectAll } from '../search.actions';
import ListingFacetPanel from './ListingFacetPanel';
import CategoryStrip from './CategoryStrip';
// Dismissible "sample content" disclosure strip at the top of the marketplace.
import SampleContentBanner from '@/components/connect/SampleContentBanner';
import { formatRupees } from './format';
import PromotedListingAdCard, { type PromotedListingResolved } from './PromotedListingAdCard';
// Mobile inline ad (Google-only here): the boost already pins atop the grid on
// every width, but the Google connect.right.top slot lives in the xl rail; this
// surfaces it for phone/tablet without duplicating the boost.
import MobileAdInline from '../ads/MobileAdInline';
import MarketplaceGridAdCell from './MarketplaceGridAdCell';
import { isGridAdSlot, isGridFirstPartyTopSlot } from './marketplace-grid-ads';
import { env } from '@/lib/env';
// Google (AdSense) rail slots - reuses the shared connect.right.* placements +
// AdSlot seam (same as ConnectRightRail). Renders nothing until AdSense is wired,
// so it adds no box today; the first-party promoted listing card is untouched.
import AdSlot from '@/components/connect/AdSlot';

/**
 * The browse outcome handed down by the Server Component. A discriminated
 * union so each on-screen state carries exactly its own data.
 */
export type MarketplaceBrowseState =
  | { kind: 'browse' }
  | { kind: 'recent'; listings: ConnectListingRef[] }
  | { kind: 'results'; listings: ConnectListingRef[]; query: SearchQueryEcho }
  | { kind: 'error'; message: string };

interface MarketplaceBrowseScreenProps {
  /** The current `?q=` value, already trimmed. Empty string when absent. */
  query: string;
  state: MarketplaceBrowseState;
  /**
   * Surface mode (Slice B3). `'marketplace'` (default) is the original buyer
   * browse at /connect/marketplace. `'services'` is the dedicated Services browse
   * (/connect/services): same grid + card + facet rail, but the hero copy, the
   * CategoryStrip set (service categories only), and the in-screen links switch
   * to the service surface. Both own the SAME URL params + reuse the SAME federated
   * listings action - services are just listings with a service category, so the
   * service-type sub-filter maps to the existing single-select `?category=` BE
   * filter (no new endpoint).
   */
  mode?: 'marketplace' | 'services';
  /**
   * The marketplace-rail promoted listing (M2.2), resolved by the Server
   * Component. `null` (a no-fill / no eligible boost) renders no rail ad.
   */
  promotedListing?: PromotedListingResolved | null;
  /**
   * The marketplace-grid promoted listing, resolved by the Server Component for
   * the `marketplace_grid` placement. Injected as an in-grid ad cell; `null`
   * falls back to a Google unit when configured, else no cell (the no-gap rule).
   */
  gridPromotedListing?: PromotedListingResolved | null;
  /**
   * Tag-slug to listing count from the backend listing search (tagCounts facet).
   * Passed down to `ListingFacetPanel` for the "Product types" chip group.
   */
  tagCounts?: Record<string, number>;
  /**
   * Category-slug to listing count (facet distribution). Passed to `CategoryStrip`
   * so each pill shows its real count. Corpus-wide on the bare landing, narrowed
   * to the active filter set on the search path.
   */
  categoryCounts?: Record<string, number>;
  /**
   * Lowercased-district to listing count (facet distribution). Passed to
   * `ListingFacetPanel` for the "Location" top-N chip group.
   */
  districtCounts?: Record<string, number>;
  /** Full match count (all pages) for infinite scroll: hasMore = loaded < total. */
  total?: number;
  /** Page size the SSR used; the client reuses it for each appended page. */
  pageSize?: number;
  /**
   * The SSR search input (q + filters + sort) for the RESULTS path, so the client
   * can fetch the next page with the same query. Absent on the bare/recent landing
   * (the client pages via browseRecentListings instead).
   */
  searchInput?: SearchConnectAllInput | null;
}

export default function MarketplaceBrowseScreen({
  query,
  state,
  mode = 'marketplace',
  promotedListing,
  gridPromotedListing,
  tagCounts,
  categoryCounts,
  districtCounts,
  total = 0,
  pageSize = 24,
  searchInput = null,
}: MarketplaceBrowseScreenProps) {
  const t = useTranslations('connect.marketplace');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Services mode (Slice B3): swap a small set of hero / empty / tile copy and the
  // "list" tile target without forking the screen. Only the keys whose copy must
  // differ are overridden (via `tx`), reading the `services.*` sub-block; every
  // other key (error / loading / toolbar / rail) reuses the marketplace copy
  // directly. `tx` is intentionally limited to keys that EXIST under services.*
  // so it never trips next-intl's missing-key guard.
  const isServices = mode === 'services';
  const tx = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      isServices ? t(`services.${key}`, values) : t(key, values),
    [isServices, t],
  );
  // The "list a service" tile deep-links the create form with a service category
  // preselected so a seller lands straight on the service field set.
  const listTileHref = isServices
    ? '/connect/marketplace/new?category=consulting'
    : '/connect/marketplace/new';

  // SSR page-1 listings (the recent landing OR a results hit; browse/error none).
  const baseListings = useMemo(
    () => (state.kind === 'recent' || state.kind === 'results' ? state.listings : []),
    [state],
  );

  // --- Infinite scroll: append later pages on scroll (the marketplace can have
  // far more products than one page; see BE listings pagination). ---
  const [extraListings, setExtraListings] = useState<ConnectListingRef[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  // Reset the appended pages whenever the SSR result set changes (a new query /
  // filter re-runs the server component and seeds a fresh page 1).
  const baseSig = `${state.kind}:${query}:${searchParams.toString()}`;
  const [prevSig, setPrevSig] = useState(baseSig);
  if (baseSig !== prevSig) {
    setPrevSig(baseSig);
    setExtraListings([]);
    setLoadMoreError(null);
  }

  const listings = useMemo(
    () => [...baseListings, ...extraListings],
    [baseListings, extraListings],
  );
  const resultCount = listings.length;
  const hasMore = listings.length < total;

  const loadMore = useCallback(async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    const offset = baseListings.length + extraListings.length;
    try {
      // Same path the SSR used: searchInput present -> the federated search leg;
      // absent -> the recent landing. Both page via limit/offset + return more.
      const res = searchInput
        ? await searchConnectAll({ ...searchInput, limit: pageSize, offset })
        : await browseRecentListings({ limit: pageSize, offset });
      if (!res.ok) {
        setLoadMoreError(res.error);
        return;
      }
      setExtraListings((prev) => [...prev, ...res.data.listings]);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, baseListings.length, extraListings.length, searchInput, pageSize]);

  // IntersectionObserver sentinel: load the next page when the grid bottom nears.
  // Skips while loading or after an error (the error shows a manual Retry).
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loadingMore || loadMoreError) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: '600px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadingMore, loadMoreError, loadMore]);

  const subtitle = useMemo(() => {
    if (state.kind === 'browse') return tx('subtitleBrowse');
    if (state.kind === 'recent') return tx('subtitleRecent');
    if (state.kind === 'error') return t('subtitleError');
    return query
      ? tx('subtitleResultsQuery', { count: resultCount, query })
      : tx('subtitleResults', { count: resultCount });
  }, [state, resultCount, query, t, tx]);

  /** Push a new URL with a caller-defined param mutation applied. */
  const pushParam = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  // Search band owns `?q=`. Local draft synced from the prop on external nav
  // (back button, chip removal) via the previous-value render pattern.
  const [searchDraft, setSearchDraft] = useState(query);
  const [prevQuery, setPrevQuery] = useState(query);
  if (query !== prevQuery) {
    setPrevQuery(query);
    setSearchDraft(query);
  }
  const submitSearch = useCallback(() => {
    pushParam((params) => {
      const trimmed = searchDraft.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
    });
  }, [pushParam, searchDraft]);

  // Sort: server-applied in the results state. Default `recent` drops the param.
  const sort = (searchParams.get('sort') as MarketplaceSort | null) ?? 'recent';
  const onSortChange = useCallback(
    (value: MarketplaceSort) => {
      pushParam((params) => {
        if (value === 'recent') params.delete('sort');
        else params.set('sort', value);
      });
    },
    [pushParam],
  );

  // Active-filter chips. Each carries its own removal so the buyer can peel a
  // single facet without opening the rail.
  const chips = useMemo(() => {
    const out: { key: string; label: string; remove: () => void }[] = [];
    if (query) {
      out.push({
        key: 'q',
        label: `"${query}"`,
        remove: () => {
          setSearchDraft('');
          pushParam((p) => p.delete('q'));
        },
      });
    }
    const cat = searchParams.get('category');
    if (cat) {
      out.push({
        key: 'category',
        label: categoryLabel(cat, tCat),
        remove: () => pushParam((p) => p.delete('category')),
      });
    }
    const tag = searchParams.get('tag');
    if (tag) {
      out.push({ key: 'tag', label: tag, remove: () => pushParam((p) => p.delete('tag')) });
    }
    const district = searchParams.get('district');
    if (district) {
      out.push({
        key: 'district',
        label: district,
        remove: () => pushParam((p) => p.delete('district')),
      });
    }
    const pMin = searchParams.get('priceMin');
    const pMax = searchParams.get('priceMax');
    if (pMin || pMax) {
      const min = Number(pMin) || 0;
      const label = pMax
        ? t('activeFilters.price', { min: formatRupees(min), max: formatRupees(Number(pMax)) })
        : t('activeFilters.priceOpen', { min: formatRupees(min) });
      out.push({
        key: 'price',
        label,
        remove: () =>
          pushParam((p) => {
            p.delete('priceMin');
            p.delete('priceMax');
          }),
      });
    }
    if (searchParams.get('verified') === '1') {
      out.push({
        key: 'verified',
        label: t('activeFilters.verified'),
        remove: () => pushParam((p) => p.delete('verified')),
      });
    }
    return out;
  }, [query, searchParams, t, tCat, pushParam]);

  const showGridGoogleAd = Boolean(
    env.adSenseClientId && env.adSenseSlots['connect.marketplace.grid'],
  );

  // The product grid. A funded first-party PROMOTED listing (resolved by the
  // page for the `marketplace_grid` placement) is PINNED at the TOP of the grid -
  // the very first cell, row 1, on ALL breakpoints including mobile - so a paid
  // boost is the most visible unit (not buried 12 cards down, and not dependent
  // on the desktop-only `xl` rail). It renders as a normal ListingGridCard (via
  // MarketplaceGridAdCell -> PromotedGridListingCard) with a "Promoted" chip, so a
  // paid unit looks identical to organic cards, plus the shared MRC impression/
  // click beacons (useAdBeacons). The grid markup is
  // single-column on mobile and auto-fill multi-column above, so a top cell shows
  // identically at every breakpoint.
  //
  // Google/house FALLBACK cells still interleave deeper in the grid at the
  // `isGridAdSlot` cadence (~1 per 12 cards, never in row 1) when AdSense is
  // configured, but only when there is NO first-party top boost - we never show
  // both a paid boost and a Google filler ad on the same grid (keeps it clean and
  // honours the one-promoted-unit intent). No cell is mounted when no source is
  // available, so the grid never shows an empty hole.
  const gridChildren = useMemo(() => {
    const out: ReactNode[] = [];

    // 1) Pin the first-party promoted boost at the TOP (all breakpoints).
    const hasTopBoost = isGridFirstPartyTopSlot(gridPromotedListing);
    if (hasTopBoost && gridPromotedListing) {
      out.push(
        <li key="mk-ad-top" className="flex">
          <MarketplaceGridAdCell promoted={gridPromotedListing} />
        </li>,
      );
    }

    // 2) The product cards, with Google fallback cells interleaved deeper down -
    // but only when there is no paid top boost (avoid mixing a paid boost with a
    // Google filler in the same grid).
    listings.forEach((listing, i) => {
      out.push(
        <li key={listing.listingId} className="flex">
          {/* source="grid" attributes the listing view to the marketplace grid
              in the funnel analytics (ViewBeacon listingViewed). */}
          <ListingGridCard listing={listing} source="grid" />
        </li>,
      );
      const count = i + 1;
      if (!hasTopBoost && showGridGoogleAd && isGridAdSlot(count)) {
        out.push(
          <li key={`mk-ad-${i}`} className="flex">
            <MarketplaceGridAdCell />
          </li>,
        );
      }
    });
    return out;
  }, [listings, gridPromotedListing, showGridGoogleAd]);

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {/* Sample-content disclosure strip (launch period); self-hides when
            dismissed / disabled. */}
        <SampleContentBanner />
        {/* Marketplace hero band: pulls the heading, the value-prop subtitle, and
            the ?q= search into one warm band so the page title earns its place
            instead of echoing the shell "Marketplace" chip (the owner's repeated-
            name fix). Buyer-only by design - seller actions (List a product / My
            listings / Inquiries) live in the "Your business" sidebar group, NOT
            here; the MarketplaceBrowseScreen.test "omits seller actions" case
            locks that, so none are added. Warm-soft direction rendered in cr-
            tokens (--cr-wash-gold), one accent, no new palette. */}
        <header
          className="mb-4 overflow-hidden"
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            // A warm gold hairline + a diagonal gold->surface fade (gold pooled
            // top-left, dissolving to white) reads lighter and more premium than
            // the old flat vertical wash. Tokens only, no new palette.
            border: '1px solid var(--cr-gold-100, var(--cr-border))',
            background: 'linear-gradient(135deg, var(--cr-gold-100) 0%, var(--cr-surface) 62%)',
            padding: 'var(--cr-space-lg) var(--cr-space-lg) var(--cr-space-md)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 26,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: 'var(--cr-text)',
              }}
            >
              {tx('title')}
            </h1>
            <InfoTooltip
              text={tx('helpTitle')}
              body={<p style={{ margin: 0 }}>{tx('help')}</p>}
              ariaLabel={tx('helpTitle')}
            />
          </div>
          <p style={{ margin: '5px 0 0', fontSize: 14, color: 'var(--cr-text-2)' }}>{subtitle}</p>

          {/* Cross-surface entry point (Slice B3). Marketplace links OUT to the
              Services browse; Services links back to the full marketplace. The
              link reuses the same gold accent as the hero so it reads as a hero
              affordance, not a stray chip. */}
          <Link
            href={isServices ? '/connect/marketplace' : '/connect/services'}
            className="mt-2.5 inline-flex items-center gap-1.5 text-[12.5px] font-semibold no-underline"
            style={{ color: 'var(--cn-gold, #b8860b)' }}
          >
            {isServices ? <ArrowLeft size={14} aria-hidden /> : <Wrench size={14} aria-hidden />}
            {isServices ? t('services.backToMarketplace') : t('services.entryPoint')}
          </Link>

          {/* Search band: owns ?q=. The facet rail keyword is off so they do not
              duplicate. Sits on a white surface inside the gold band so it reads
              as the hero's primary action. */}
          <div
            className="mt-4 flex items-center gap-2"
            style={{
              background: 'var(--cr-surface)',
              border: '1px solid var(--cr-border)',
              borderRadius: 'var(--cr-radius-lg)',
              padding: '8px 8px 8px 14px',
              boxShadow: '0 1px 2px rgba(16,24,40,0.05)',
            }}
          >
            <Search size={18} aria-hidden style={{ color: 'var(--cr-text-4)', flex: 'none' }} />
            <input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitSearch();
              }}
              placeholder={tx('search.placeholder')}
              aria-label={tx('search.aria')}
              className="min-w-0 flex-1 border-none bg-transparent text-[14.5px] outline-none"
              style={{ color: 'var(--cr-text)' }}
            />
            {/* Clear: empties the box AND the committed `?q=` so results reset
                (mirrors the "q" active-filter chip removal). Shown only with text. */}
            {searchDraft && (
              <button
                type="button"
                aria-label={t('search.clear')}
                onClick={() => {
                  setSearchDraft('');
                  pushParam((p) => p.delete('q'));
                }}
                className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full border-none bg-transparent"
                style={{ color: 'var(--cr-text-4)' }}
              >
                <X size={16} aria-hidden />
              </button>
            )}
            <DsButton dsVariant="primary" dsSize="sm" onClick={submitSearch}>
              {t('search.button')}
            </DsButton>
          </div>
        </header>

        {/* Category icon strip (owns the category facet). Counts come from the
            backend facet distribution (real). In services mode it renders only
            the service categories as the service-type sub-filter and pushes to
            /connect/services. */}
        <CategoryStrip categoryCounts={categoryCounts} mode={mode} />

        {/* `min-w-0` on both grid children is the mobile-overflow guard: a CSS
            grid track sizes to its widest child's min-content, so without it the
            facet panel or the results column inflates the single mobile column
            and pushes every card (and the whole page) off-screen. `grid-cols-1`
            makes the mobile column an explicit shrinkable `minmax(0,1fr)` track
            (a bare `grid` with only a `lg:` column def falls back to a
            non-shrinkable `auto` track on mobile). Mirrors the /connect/profile
            fix. */}
        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div className="min-w-0">
            <ListingFacetPanel
              showKeyword={false}
              tagCounts={tagCounts}
              districtCounts={districtCounts}
            />
          </div>

          <div className="min-w-0">
            <ConnectErrorBoundary>
              {state.kind === 'browse' ? (
                <ConnectEmptyState
                  variant="inline"
                  icon={<Store size={24} aria-hidden />}
                  title={tx('browseTitle')}
                  description={tx('browseBody')}
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
              ) : state.kind === 'results' && state.listings.length === 0 ? (
                <ConnectEmptyState
                  variant="inline"
                  icon={<SearchX size={24} aria-hidden />}
                  title={t('emptyTitle')}
                  description={query ? tx('emptyBodyQuery', { query }) : tx('emptyBody')}
                />
              ) : (
                <div>
                  {/* Results toolbar. The count is shown ONCE per state to avoid
                    repeating it: the `results` subtitle already carries the count
                    ("N listings for X"), so here results shows only Sort; the
                    `recent` subtitle has no count, so recent shows the count here. */}
                  <div className="mb-3.5 flex flex-wrap items-center gap-3">
                    {state.kind === 'recent' && (
                      <span className="text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                        {t('toolbar.resultsCount', { count: resultCount })}
                      </span>
                    )}
                    {state.kind === 'results' && (
                      // Sort group: full-width on phones (so the select does not crowd
                      // the toolbar < 380px), inline + auto-width from sm up. The parent
                      // row is flex-wrap, so this drops to its own line when needed.
                      <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: 'var(--cr-text-4)' }}
                        >
                          {t('toolbar.sortLabel')}
                        </span>
                        <Select<MarketplaceSort>
                          size="small"
                          value={sort}
                          onChange={onSortChange}
                          // Fluid: fills the row on a phone (flex-1), caps at 200 on
                          // wider screens so it does not stretch the desktop toolbar.
                          className="flex-1 sm:flex-none"
                          style={{ minWidth: 0, maxWidth: 200 }}
                          aria-label={t('toolbar.sortLabel')}
                          // `top_rated` is deferred: the backend folds it to
                          // `recent` until the seller rating is denormalized onto
                          // listings, so we do not offer a silently no-op sort.
                          options={MARKETPLACE_SORTS.filter((s) => s !== 'top_rated').map((s) => ({
                            value: s,
                            label: t(`toolbar.sort.${s}`),
                          }))}
                        />
                      </div>
                    )}
                  </div>

                  {chips.length > 0 && (
                    <div className="mb-3.5 flex flex-wrap gap-2">
                      {chips.map((c) => (
                        <span
                          key={c.key}
                          className="inline-flex items-center gap-1.5 text-[12px] font-semibold"
                          style={{
                            height: 28,
                            padding: '0 6px 0 11px',
                            borderRadius: 'var(--cr-radius-full)',
                            border: '1px solid var(--cr-border-light)',
                            background: 'var(--cr-wash-indigo, #eef2fb)',
                            color: 'var(--cr-text-2)',
                          }}
                        >
                          {c.label}
                          <button
                            type="button"
                            aria-label={t('activeFilters.remove', { label: c.label })}
                            onClick={c.remove}
                            className="grid cursor-pointer place-items-center rounded-full border-none bg-transparent p-0.5"
                            style={{ color: 'var(--cr-text-4)' }}
                          >
                            <X size={13} aria-hidden />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <ul
                    aria-label={tx('resultsAria')}
                    className="m-0 grid list-none p-0"
                    style={{
                      // `min(100%, 220px)` so the 220px column floor collapses to
                      // the container width on a narrow phone instead of forcing a
                      // 220px track wider than the viewport (one clean column on
                      // mobile, auto-fill multi-column from ~220px up).
                      gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 220px), 1fr))',
                      gap: 'var(--cr-space-md)',
                    }}
                  >
                    {gridChildren}
                    {/* Close the grid with a "list your product" tile so the surface
                    never looks bare and sellers have a path in. */}
                    <li className="flex">
                      <Link
                        href={listTileHref}
                        className="flex h-full w-full flex-col items-center justify-center gap-2 text-center no-underline transition-colors hover:border-[var(--cr-primary)]"
                        style={{
                          minHeight: 220,
                          border: '1.5px dashed var(--cr-border)',
                          borderRadius: 'var(--cr-radius-lg)',
                          color: 'var(--cr-text-4)',
                          padding: 24,
                        }}
                      >
                        <span
                          aria-hidden
                          className="grid place-items-center rounded-full"
                          style={{
                            width: 38,
                            height: 38,
                            background: 'var(--cr-wash-indigo)',
                            color: 'var(--cr-primary)',
                          }}
                        >
                          <Plus size={20} />
                        </span>
                        <span
                          className="text-[12.5px] font-bold"
                          style={{ color: 'var(--cr-text-2)' }}
                        >
                          {tx('listProductTile')}
                        </span>
                      </Link>
                    </li>
                  </ul>

                  {/* Infinite-scroll sentinel: the IntersectionObserver watches this
                    and fetches the next page; a spinner shows while loading, a
                    Retry on failure. Rendered only while more pages remain. */}
                  {hasMore && (
                    <div ref={sentinelRef} className="mt-5 flex justify-center">
                      {loadMoreError ? (
                        <DsButton
                          dsVariant="ghost"
                          dsSize="sm"
                          onClick={() => {
                            setLoadMoreError(null);
                            void loadMore();
                          }}
                        >
                          {t('loadMoreRetry')}
                        </DsButton>
                      ) : (
                        <span className="text-[12.5px]" style={{ color: 'var(--cr-text-4)' }}>
                          {t('loadingMore')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </ConnectErrorBoundary>
          </div>
        </div>
        {/* Mobile-only Google unit (the boost already shows atop the grid on all
            widths, so pass null = Google-only). The rail is hidden below xl. */}
        <MobileAdInline promoted={null} />
      </main>

      <Rail side="right">
        {/* House promo: nudge sellers to boost a listing (real boost engine ->
            /connect/boosts; boost is CPM-priced in that flow, so NO fabricated
            "/week" price here - only the honest "Pause anytime", which the
            pause/resume endpoints back). A first-party house ad in the rail's
            promo zone, leading the rail like the reference. */}
        <div
          style={{
            borderRadius: 'var(--cr-radius-lg)',
            border: '1px solid var(--cr-gold-100, #f6ebc4)',
            background: 'var(--cr-wash-gold)',
            padding: 14,
          }}
        >
          <span
            aria-hidden
            className="grid place-items-center"
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--cr-surface)',
              boxShadow: '0 1px 3px rgba(16,24,40,0.08)',
              color: 'var(--cn-gold, #b8860b)',
            }}
          >
            <Rocket size={18} />
          </span>
          <h3 className="m-0 mt-2.5 text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
            {t('rail.boostTitle')}
          </h3>
          <p className="m-0 mt-1 text-[12px] leading-relaxed" style={{ color: 'var(--cr-text-2)' }}>
            {t('rail.boostBody')}
          </p>
          <Link
            href="/connect/boosts"
            className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold no-underline transition-[filter] duration-150 hover:brightness-[1.04]"
            style={{
              background: 'var(--cr-grad-gold, var(--cn-gold, #c79a3a))',
              color: '#fff',
              boxShadow: '0 1px 3px rgba(140,112,25,0.28)',
            }}
          >
            <Rocket size={14} aria-hidden /> {t('rail.boostCta')}
          </Link>
          <p
            className="m-0 mt-2 text-center text-[11px] font-semibold"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('rail.boostNote')}
          </p>
        </div>

        {promotedListing ? <PromotedListingAdCard {...promotedListing} /> : null}

        {/* Google AdSense rail slot (third-party fill) above the safety panel.
            Reuses connect.right.top; renders nothing when AdSense is unconfigured,
            so it is shift-free + a no-op today. The grid Google cell uses a
            separate placement (connect.marketplace.grid), so no duplication. */}
        <AdSlot placement="connect.right.top" />

        {/* Buyer-safety panel. The "how buying works" steps already live in the
            dismissible HowBuyingWorks strip above the grid, so the rail no longer
            repeats them (dedupe) - it carries distinct safety guidance instead,
            keeping the honest "ManekHR does not handle payment" line from the
            retired tips body. Links to nothing; pure guidance. */}
        <RailPanel title={t('rail.safeTitle')}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {[t('rail.safe1'), t('rail.safe2'), t('rail.safe3')].map((tip) => (
              <li
                key={tip}
                className="flex items-start gap-2 text-[12.5px] leading-relaxed"
                style={{ color: 'var(--cr-text-4)' }}
              >
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ marginTop: 6, background: 'var(--cn-gold, #c79a3a)' }}
                />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </RailPanel>

        {/* Second Google AdSense rail slot (connect.right.mid) below the safety
            panel - the rail has room for two units, matching ConnectRightRail's
            top+mid pair. No-op until AdSense is wired. */}
        <AdSlot placement="connect.right.mid" />
      </Rail>
    </ConnectPage>
  );
}
