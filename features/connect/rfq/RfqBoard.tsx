'use client';

/**
 * The RFQ hub, rebuilt 2026-06-10 to the Jobs-board bar: a KPI strip (with real
 * viewer-aware sub-signals), URL-synced tabs (Open board / My requests / My
 * quotes), and a SERVER-DRIVEN open board - search band, counted category
 * chips, a counted filter rail (status buckets / districts / budget+negotiable
 * / viewer scopes / posted), active-filter chips, sort, paged results with
 * Load more. The old in-memory filtering is gone; useRfqBoardFilters fetches
 * through GET board + board/facets on every committed change. Board-only model
 * (no seller notifications, owner-locked 2026-05-30); no fabricated signals.
 * The "how it works" steps strip was removed (owner decision 2026-06-10).
 *
 * Cross-module links:
 * - useRfqBoardFilters (state + URL + fetch engine; clone of jobs useBoardFilters).
 * - useBoardBuyers -> network getPeople (buyer name/avatar per card).
 * - RfqFilterRail / RfqCard / MyQuoteCard / RfqCardSkeleton (anatomy parts).
 * - app/connect/rfq/page.tsx SSR-seeds filters/results/facets/stats/tab.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Drawer, message } from 'antd';
import {
  type LucideIcon,
  ClipboardList,
  FileText,
  LayoutGrid,
  PlusCircle,
  Search,
  Send,
  SlidersHorizontal,
  Sparkles,
  X,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage, RailPanel } from '@/components/connect';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import EntityAdRail from '@/features/connect/ads/EntityAdRail';
import type { PromotedListingResolved } from '@/features/connect/marketplace/PromotedListingAdCard';
import PromotedRfqAdCard from './PromotedRfqAdCard';
import type { PromotedRfqResolved } from '@/features/connect/ads/promoted-rfq-rail';
import { KpiStrip, KpiCard } from '@/components/connect/KpiStrip';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { parseApiError } from '@/lib/utils';
import { LISTING_CATEGORIES } from '../search.types';
import RfqCard from './RfqCard';
import RfqCardSkeleton from './RfqCardSkeleton';
import MyQuoteCard from './MyQuoteCard';
import RfqComposer from './RfqComposer';
import RfqFilterRail from './RfqFilterRail';
import { createRfq } from './rfq.actions';
import { useRfqBoardFilters, filtersToSearch } from './useRfqBoardFilters';
import { useBoardBuyers } from './useBoardBuyers';
import type {
  Rfq,
  MyQuoteView,
  CreateRfqPayload,
  BoardFilters,
  BoardFacets,
  BoardStats,
  RfqStatusBucket,
} from './rfq.types';

export type RfqTab = 'board' | 'mine' | 'myQuotes';

interface Props {
  filters: BoardFilters;
  initialTab: RfqTab;
  initialResults: Rfq[];
  initialFacets: BoardFacets | null;
  mine: Rfq[];
  myQuotes: MyQuoteView[];
  stats: BoardStats;
  /** The viewer's own user id (hides Send quote on their own requests). */
  viewerId: string;
  /** First-party promoted listing for the right rail (own ad engine; null = none). */
  promoted?: PromotedListingResolved | null;
  /** First-party promoted RFQ pinned atop the board (rfq boost; null = none). */
  promotedRfq?: PromotedRfqResolved | null;
}

export default function RfqBoard({
  filters: initialFilters,
  initialTab,
  initialResults,
  initialFacets,
  mine,
  myQuotes,
  stats,
  viewerId,
  promoted = null,
  promotedRfq = null,
}: Props) {
  const t = useTranslations('connect.rfq');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const { announce, announcer } = useAnnouncer();
  const [tab, setTab] = useState<RfqTab>(initialTab);
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // syncUrl only on the board tab: off-board the hook's filter querystring is
  // empty and would clobber the `?tab=` param (dropping the active tab).
  const board = useRfqBoardFilters(initialFilters, initialResults, initialFacets, tab === 'board');
  const buyers = useBoardBuyers(board.results);

  // Search box is COMMIT-on-submit, not search-as-you-type: typing only updates
  // this local draft; the API call (board.setFilter -> hook fetch) fires on the
  // Search button or Enter. Avoids one request per keystroke at scale. The draft
  // re-syncs to the committed query whenever it changes externally (the active-
  // filter "q" chip X, or Clear all), so the box and the results never diverge.
  const [queryDraft, setQueryDraft] = useState(initialFilters.q ?? '');
  useEffect(() => {
    setQueryDraft(board.filters.q ?? '');
  }, [board.filters.q]);
  const commitSearch = () => board.setFilter({ q: queryDraft.trim() || undefined });
  const clearSearch = () => {
    setQueryDraft('');
    board.setFilter({ q: undefined });
  };

  const hasSupply = stats.supplyCategories.length > 0;

  // The viewer's live-quoted request ids -> the card's "Update quote" state.
  const quotedRfqIds = useMemo(
    () =>
      new Set(
        myQuotes
          .filter(
            (q) => q.status === 'sent' || q.status === 'shortlisted' || q.status === 'accepted',
          )
          .map((q) => q.rfqId),
      ),
    [myQuotes],
  );

  // Category chip counts come from the facets (own field removed), so each chip
  // answers "how many if I pick this"; All = the sum (category-free total).
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of board.facets?.category ?? []) counts[e.value] = e.count;
    return counts;
  }, [board.facets]);
  const allCount = useMemo(
    () => Object.values(categoryCounts).reduce((a, b) => a + b, 0),
    [categoryCounts],
  );

  /** Keep the tab in the URL (survives back/forward + sharing) without an SSR
   *  re-run: ?tab= replaces the filter qs off-board, restores it on board. */
  const switchTab = (next: RfqTab) => {
    setTab(next);
    const qs =
      next === 'board'
        ? filtersToSearch(board.filters)
        : new URLSearchParams({ tab: next }).toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(window.history.state, '', url);
  };

  const handlePost = async (payload: CreateRfqPayload) => {
    setPosting(true);
    try {
      const res = await createRfq(payload);
      if (!res.ok) {
        msgApi.error(res.error);
        announce(res.error, { assertive: true });
        return;
      }
      void msgApi.success(t('postSuccess'));
      announce(t('postSuccess'));
      setComposerOpen(false);
      router.push(`/connect/rfq/${res.data._id}`);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setPosting(false);
    }
  };

  // Active-filter chips above the results (each removable; mirrors the rail).
  const activeChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    const f = board.filters;
    if (f.category)
      chips.push({
        key: 'category',
        label: tCat(f.category),
        clear: () => board.setFilter({ category: undefined }),
      });
    for (const d of f.districts ?? [])
      chips.push({
        key: `district-${d}`,
        label: d,
        clear: () =>
          board.setFilter({
            districts: (f.districts ?? []).filter((x) => x !== d).length
              ? (f.districts ?? []).filter((x) => x !== d)
              : undefined,
          }),
      });
    const bucketLabel: Record<RfqStatusBucket, string> = {
      open: t('status.open'),
      'closing-soon': t('closingSoon'),
      awarded: t('status.awarded'),
    };
    for (const s of f.statuses ?? [])
      chips.push({
        key: `status-${s}`,
        label: bucketLabel[s],
        clear: () =>
          board.setFilter({
            statuses: (f.statuses ?? []).filter((x) => x !== s).length
              ? (f.statuses ?? []).filter((x) => x !== s)
              : undefined,
          }),
      });
    if (f.budgetMin != null || f.budgetMax != null)
      chips.push({
        key: 'budget',
        label: t('budgetLabel', {
          value: `${f.budgetMin != null ? `₹${f.budgetMin.toLocaleString('en-IN')}` : ''}${f.budgetMin != null && f.budgetMax != null ? ' - ' : ''}${f.budgetMax != null ? `₹${f.budgetMax.toLocaleString('en-IN')}` : '+'}`,
        }),
        clear: () =>
          board.setFilter({
            budgetMin: undefined,
            budgetMax: undefined,
            includeNegotiable: undefined,
          }),
      });
    if (f.matchedToMyWork)
      chips.push({
        key: 'matched',
        label: t('filters.matchedToMyWork'),
        clear: () => board.setFilter({ matchedToMyWork: undefined }),
      });
    if (f.notQuotedByMe)
      chips.push({
        key: 'noQuote',
        label: t('filters.notQuotedByMe'),
        clear: () => board.setFilter({ notQuotedByMe: undefined }),
      });
    if (f.postedWithinDays != null)
      chips.push({
        key: 'posted',
        label: t(
          f.postedWithinDays === 1
            ? 'filters.posted24h'
            : f.postedWithinDays === 7
              ? 'filters.postedWeek'
              : 'filters.postedMonth',
        ),
        clear: () => board.setFilter({ postedWithinDays: undefined }),
      });
    if (f.q?.trim())
      chips.push({
        key: 'q',
        label: `"${f.q.trim()}"`,
        clear: () => board.setFilter({ q: undefined }),
      });
    return chips;
  }, [board, t, tCat]);

  // The board URL each card was opened from, so the detail page's "Back to
  // board" can restore the exact origin tab + filters (was a fixed tab before).
  // Board tab keeps its live filters; the other two tabs carry just `?tab=`.
  const boardOriginHref = useMemo(() => {
    const qs = filtersToSearch(board.filters);
    return qs ? `/connect/rfq?${qs}` : '/connect/rfq';
  }, [board.filters]);
  const mineOriginHref = '/connect/rfq?tab=mine';
  const myQuotesOriginHref = '/connect/rfq?tab=myQuotes';

  const tabs: Array<{ key: RfqTab; label: string; count: number }> = [
    { key: 'board', label: t('tabBoard'), count: stats.openTotal },
    { key: 'mine', label: t('tabMine'), count: mine.length },
    { key: 'myQuotes', label: t('tabMyQuotes'), count: myQuotes.length },
  ];

  const rail = (
    <RfqFilterRail
      filters={board.filters}
      facets={board.facets}
      setFilter={board.setFilter}
      onClearAll={board.clearAll}
      hasSupply={hasSupply}
    />
  );

  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {ctx}
        {announcer}
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-[22px] font-bold" style={{ color: 'var(--cr-text)' }}>
              {t('boardTitle')}
            </h1>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('boardSubtitle')}
            </p>
          </div>
          <DsButton dsVariant="primary" onClick={() => setComposerOpen(true)}>
            <PlusCircle size={16} aria-hidden /> {t('postCta')}
          </DsButton>
        </header>

        {/* KPI strip - real counts from board/stats; the hints are viewer-aware
            sub-signals (supply match, quotes received, shortlisted/won). */}
        <KpiStrip className="mb-4">
          <KpiCard
            icon={ClipboardList}
            tone="indigo"
            value={stats.openTotal}
            label={t('kpi.openRequests')}
            hint={hasSupply ? t('kpi.matchHint', { count: stats.matchesMyWork }) : undefined}
          />
          <KpiCard
            icon={Sparkles}
            tone="amber"
            value={stats.newToday}
            label={t('kpi.newToday')}
            hint={t('kpi.newTodayHint')}
          />
          <KpiCard
            icon={FileText}
            tone="gold"
            value={stats.myOpenRequests}
            label={t('kpi.myRequests')}
            hint={t('kpi.quotesReceivedHint', { count: stats.quotesOnMyOpen })}
          />
          <KpiCard
            icon={Send}
            tone="green"
            value={stats.myQuotesTotal}
            label={t('kpi.myQuotes')}
            hint={t('kpi.myQuotesHint', {
              shortlisted: stats.myQuotesShortlisted,
              won: stats.myQuotesWon,
            })}
          />
        </KpiStrip>

        {/* Underline tabs (URL-synced via switchTab). */}
        <div
          role="tablist"
          aria-label={t('viewSwitcherAria')}
          className="mb-4 flex gap-1"
          style={{ borderBottom: '1px solid var(--cr-divider)' }}
        >
          {tabs.map((tb) => {
            const active = tab === tb.key;
            return (
              <button
                key={tb.key}
                role="tab"
                aria-selected={active}
                onClick={() => switchTab(tb.key)}
                className="inline-flex cursor-pointer items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold"
                style={{
                  color: active ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                  borderBottom: `2px solid ${active ? 'var(--cr-primary)' : 'transparent'}`,
                  marginBottom: -1,
                }}
              >
                {tb.label}
                <span
                  className="rounded-full px-1.5 text-[11px] font-bold"
                  style={{
                    background: active ? 'var(--cr-primary-light)' : 'var(--cr-surface-3)',
                    color: active ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                  }}
                >
                  {tb.count}
                </span>
              </button>
            );
          })}
        </div>

        {tab === 'board' && (
          <>
            {/* Search band: typing debounces through the hook; the button is an
                explicit commit affordance for the mock's Search action. */}
            <div
              className="mb-3 flex items-center gap-2 rounded-[var(--cr-radius-lg)] py-1.5 pr-1.5 pl-3.5"
              style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
            >
              <Search size={18} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
              <input
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitSearch();
                  }
                }}
                aria-label={t('searchLabel')}
                placeholder={t('searchPlaceholder')}
                className="min-w-0 flex-1 border-0 bg-transparent text-[14px] outline-none"
                style={{ color: 'var(--cr-text)' }}
              />
              {queryDraft && (
                <button
                  type="button"
                  onClick={clearSearch}
                  aria-label={t('clearSearchAria')}
                  className="grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  <X size={16} aria-hidden />
                </button>
              )}
              <DsButton dsVariant="primary" dsSize="sm" onClick={commitSearch}>
                <Search size={14} aria-hidden /> {t('searchCta')}
              </DsButton>
            </div>

            {/* Category chips with live facet counts. */}
            <nav
              aria-label={t('categoryStripAria')}
              className="mb-4 flex gap-2 overflow-x-auto pb-1.5"
            >
              <CategoryPill
                icon={LayoutGrid}
                label={t('allCategories')}
                count={allCount}
                active={!board.filters.category}
                onClick={() => board.setFilter({ category: undefined })}
              />
              {LISTING_CATEGORIES.map((c) => (
                <CategoryPill
                  key={c}
                  label={tCat(c)}
                  count={categoryCounts[c] ?? 0}
                  active={board.filters.category === c}
                  onClick={() =>
                    board.setFilter({ category: board.filters.category === c ? undefined : c })
                  }
                />
              ))}
            </nav>

            {/* Mobile: the rail lives in a drawer (live filters; the rail is
                identical to the desktop one). */}
            <div className="mb-3 lg:hidden">
              <DsButton dsVariant="secondary" onClick={() => setFiltersOpen(true)}>
                <SlidersHorizontal size={15} aria-hidden /> {t('filters.title')}
              </DsButton>
            </div>
            <Drawer
              open={filtersOpen}
              onClose={() => setFiltersOpen(false)}
              placement="left"
              size={320}
              title={t('filters.title')}
              destroyOnHidden
            >
              {rail}
            </Drawer>

            {/* grid-cols-1 base + min-w-0 results column: the bare `grid` with
                only a lg: column def falls back to a non-shrinkable `auto` track
                on mobile, which the results content inflates past the viewport.
                Same mobile-overflow guard as /connect/marketplace. */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
              <div className="hidden lg:block">{rail}</div>
              <div className="min-w-0">
                {/* Result header: live total + supply-match signal + sort. */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px]" style={{ color: 'var(--cr-text-3)' }}>
                    {t('resultsCount', { count: board.total })}
                    {hasSupply &&
                      board.facets != null &&
                      ` · ${t('matchesCount', { count: board.facets.matchedToMyWork })}`}
                  </span>
                  <label
                    className="flex items-center gap-1.5 text-[12px]"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {t('sortLabel')}
                    <select
                      value={board.filters.sort ?? 'recent'}
                      onChange={(e) =>
                        board.setFilter({ sort: e.target.value as BoardFilters['sort'] })
                      }
                      className="rounded-[var(--cr-radius-md)] px-2 py-1 text-[12.5px]"
                      style={{
                        border: '1px solid var(--cr-border)',
                        background: 'var(--cr-surface)',
                        color: 'var(--cr-text-2)',
                      }}
                    >
                      <option value="recent">{t('sortBy.recent')}</option>
                      <option value="budget">{t('sortBy.budget')}</option>
                      <option value="closing">{t('sortBy.closing')}</option>
                    </select>
                  </label>
                </div>

                {activeChips.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2" aria-label={t('activeFiltersAria')}>
                    {activeChips.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={c.clear}
                        aria-label={t('removeFilterAria', { label: c.label })}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full py-0.5 pr-1.5 pl-2.5 text-[12px] font-semibold"
                        style={{
                          background: 'var(--cr-primary-light)',
                          color: 'var(--cr-primary)',
                          border: '1px solid var(--cr-primary-border)',
                        }}
                      >
                        {c.label}
                        <X size={13} aria-hidden />
                      </button>
                    ))}
                  </div>
                )}

                {board.error ? (
                  <ConnectEmptyState
                    variant="inline"
                    icon={<ClipboardList size={24} aria-hidden />}
                    title={t('loadErrorTitle')}
                    description={board.error}
                    primaryAction={{ label: t('retry'), onClick: board.retry }}
                  />
                ) : board.loading ? (
                  <div className="grid gap-3" aria-busy>
                    {Array.from({ length: 4 }, (_, i) => (
                      <RfqCardSkeleton key={i} />
                    ))}
                  </div>
                ) : board.results.length === 0 ? (
                  <ConnectEmptyState
                    variant="inline"
                    icon={<ClipboardList size={24} aria-hidden />}
                    title={t('emptyBoardTitle')}
                    description={t('emptyBoardBody')}
                    primaryAction={{ label: t('filters.clear'), onClick: board.clearAll }}
                  />
                ) : (
                  <>
                    {/* Promoted RFQ pinned atop the board (rfq boost; own ad
                        engine). Hidden once filters narrow the board so it never
                        contradicts an active search; shown on the default view. */}
                    {promotedRfq && activeChips.length === 0 && (
                      <div className="mb-3">
                        <PromotedRfqAdCard
                          rfq={promotedRfq.rfq}
                          impressionToken={promotedRfq.impressionToken}
                          campaignId={promotedRfq.campaignId}
                        />
                      </div>
                    )}
                    <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('boardListAria')}>
                      {board.results.map((r) => (
                        <li key={r._id}>
                          <RfqCard
                            rfq={r}
                            buyer={buyers[r._id]}
                            viewerId={viewerId}
                            supplyCategories={stats.supplyCategories}
                            alreadyQuoted={quotedRfqIds.has(r._id)}
                            originHref={boardOriginHref}
                          />
                        </li>
                      ))}
                    </ul>
                    {board.hasMore && (
                      <div className="mt-4 flex flex-col items-center gap-1.5">
                        {board.loadMoreError && (
                          <span className="text-[12px]" style={{ color: 'var(--cr-danger)' }}>
                            {board.loadMoreError}
                          </span>
                        )}
                        <DsButton
                          dsVariant="secondary"
                          onClick={board.loadMore}
                          loading={board.loadingMore}
                        >
                          {t('loadMore')}
                        </DsButton>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {tab === 'mine' &&
          (mine.length === 0 ? (
            <ConnectEmptyState
              icon={<ClipboardList size={24} aria-hidden />}
              title={t('emptyMineTitle')}
              description={t('emptyMineBody')}
              primaryAction={{ label: t('postCta'), onClick: () => setComposerOpen(true) }}
            />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('mineListAria')}>
              {mine.map((r) => (
                <li key={r._id}>
                  <RfqCard rfq={r} viewerId={viewerId} showOwnerStats originHref={mineOriginHref} />
                </li>
              ))}
            </ul>
          ))}

        {tab === 'myQuotes' &&
          (myQuotes.length === 0 ? (
            <ConnectEmptyState
              icon={<ClipboardList size={24} aria-hidden />}
              title={t('emptyMyQuotesTitle')}
              description={t('emptyMyQuotesBody')}
            />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0" aria-label={t('myQuotesListAria')}>
              {myQuotes.map((q) => (
                <li key={q._id}>
                  <MyQuoteCard view={q} originHref={myQuotesOriginHref} />
                </li>
              ))}
            </ul>
          ))}

        <RfqComposer
          open={composerOpen}
          submitting={posting}
          onClose={() => setComposerOpen(false)}
          onSubmit={handlePost}
        />
      </main>

      {/* Ad-ready right rail (canonical EntityAdRail): Google AdSlots
          (connect.right.* via env) + the first-party promoted listing, with the
          "how requests work" panel as the floor so the rail never collapses. */}
      <EntityAdRail
        promoted={promoted}
        floorPanel={
          <RailPanel title={t('rail.title')}>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
              {t('rail.body')}
            </p>
          </RailPanel>
        }
      />
    </ConnectPage>
  );
}

function CategoryPill({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon?: LucideIcon;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-full px-3.5 text-[12.5px] font-semibold whitespace-nowrap transition-colors"
      style={{
        border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
        background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
        color: active ? '#fff' : 'var(--cr-text-2)',
      }}
    >
      {Icon && <Icon size={15} aria-hidden />}
      {label}
      <span
        className="text-[11px]"
        style={{ color: active ? 'rgba(255,255,255,0.7)' : 'var(--cr-text-5)' }}
      >
        {count}
      </span>
    </button>
  );
}
