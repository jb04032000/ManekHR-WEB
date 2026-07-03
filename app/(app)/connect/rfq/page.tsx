import type { Metadata } from 'next';
import { Suspense } from 'react';
import {
  listRfqBoard,
  getRfqBoardFacets,
  listMyRfqs,
  listMyQuotes,
  getRfqBoardStats,
} from '@/features/connect/rfq/rfq.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';
import { resolvePromotedRailRfq } from '@/features/connect/ads/promoted-rfq-rail';
import RfqBoard, { type RfqTab } from '@/features/connect/rfq/RfqBoard';
import RfqHubSkeleton from '@/features/connect/rfq/RfqHubSkeleton';
import {
  EMPTY_BOARD_STATS,
  type BoardFilters,
  type RfqStatusBucket,
} from '@/features/connect/rfq/rfq.types';
import type { ListingCategory } from '@/features/connect/search.types';

export const metadata: Metadata = {
  title: 'Quote requests',
  robots: { index: false, follow: false },
};

const BOARD_PAGE_SIZE = 20;

/** Pull the first value for a key out of the searchParams bag. */
function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
function csv(v: string | string[] | undefined): string[] | undefined {
  const s = one(v);
  if (!s) return undefined;
  const out = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}
function num(v: string | string[] | undefined): number | undefined {
  const s = one(v);
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * URL -> BoardFilters. The address bar is the source of truth for the board tab
 * (see useRfqBoardFilters). Keep key names in sync with filtersToSearch in the
 * hook so a deep link / back-forward seeds the exact same state.
 */
function parseBoardFilters(sp: Record<string, string | string[] | undefined>): BoardFilters {
  const sort = one(sp.sort);
  const statuses = csv(sp.statuses)?.filter((s): s is RfqStatusBucket =>
    ['open', 'closing-soon', 'awarded'].includes(s),
  );
  return {
    q: one(sp.q) || undefined,
    category: (one(sp.category) as ListingCategory) || undefined,
    districts: csv(sp.districts),
    statuses: statuses && statuses.length ? statuses : undefined,
    budgetMin: num(sp.budgetMin),
    budgetMax: num(sp.budgetMax),
    includeNegotiable: one(sp.negotiable) === '1' || undefined,
    matchedToMyWork: one(sp.matched) === '1' || undefined,
    notQuotedByMe: one(sp.noQuote) === '1' || undefined,
    postedWithinDays: num(sp.posted),
    sort: sort === 'budget' || sort === 'closing' ? sort : 'recent',
  };
}

/** The active tab from `?tab=` (survives leaving + returning). Unknown -> board. */
function parseTab(v: string | string[] | undefined): RfqTab {
  const t = one(v);
  return t === 'mine' || t === 'myQuotes' ? t : 'board';
}

/**
 * `/connect/rfq` -- the RFQ hub. The board tab is server-driven: SSR seeds page
 * 1 of results + the facet counts from the URL filters, then useRfqBoardFilters
 * takes over on the client (URL via history.replaceState, no SSR re-run per
 * tap). My requests / My quotes are seeded from their own arrays. The Suspense
 * fallback shows the tab-matching skeleton once searchParams resolve;
 * loading.tsx covers the instant before.
 */
export default async function ConnectRfqPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseBoardFilters(sp);
  const initialTab = parseTab(sp.tab);
  return (
    <Suspense fallback={<RfqHubSkeleton tab={initialTab} />}>
      <RfqHubContent filters={filters} initialTab={initialTab} />
    </Suspense>
  );
}

async function RfqHubContent({
  filters,
  initialTab,
}: {
  filters: BoardFilters;
  initialTab: RfqTab;
}) {
  const [boardRes, facetsRes, mineRes, quotesRes, statsRes, meRes, promoted, promotedRfq] =
    await Promise.all([
      listRfqBoard({ ...filters, limit: BOARD_PAGE_SIZE, skip: 0 }),
      getRfqBoardFacets(filters),
      listMyRfqs(),
      listMyQuotes(),
      getRfqBoardStats(),
      getMyConnectProfile(),
      // First-party promoted listing for the right rail (cross-sell; own ad
      // engine; the Google AdSlots ride ConnectRightRail and fill from env config).
      resolvePromotedRailListing('rfq_board'),
      // First-party promoted RFQ pinned atop the board (rfq boost), on its own
      // placement so it does not cannibalize the rfq_board listing auction above.
      resolvePromotedRailRfq('rfq_promoted'),
    ]);
  // The viewer's own user id: RfqCard swaps Send quote for View quotes on the
  // viewer's OWN requests (you do not quote your own request).
  const viewerId = meRes.ok ? meRes.data.userId : '';
  return (
    <RfqBoard
      filters={filters}
      initialTab={initialTab}
      initialResults={boardRes.ok ? boardRes.data : []}
      initialFacets={facetsRes.ok ? facetsRes.data : null}
      mine={mineRes.ok ? mineRes.data : []}
      myQuotes={quotesRes.ok ? quotesRes.data : []}
      stats={statsRes.ok ? statsRes.data : EMPTY_BOARD_STATS}
      viewerId={viewerId}
      promoted={promoted}
      promotedRfq={promotedRfq}
    />
  );
}
