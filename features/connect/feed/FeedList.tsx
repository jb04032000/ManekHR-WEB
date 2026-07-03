'use client';

/**
 * FeedList - the virtualized, infinitely-scrolling post list (Phase 3 - Feed).
 *
 * Seeded with the server-rendered first page, then `useInfiniteQuery` fetches
 * further `postedAt`-cursor pages as the reader nears the end. Rows are
 * window-virtualized (`@tanstack/react-virtual`) so a long scroll never piles
 * up DOM. The list shows an honest end - "You're caught up" - never an endless
 * loader (design doc §14).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useTranslations } from 'next-intl';
import { UsersRound } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState, PostCard } from '@/components/connect';
import { getFeed, getPublicPost, removeNegativeSignal } from '../feed.actions';
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import { useFeedRealtime, type NewPostEvent } from './useConnectSocket';
import { useFeedImpressions } from './useFeedImpressions';
import FeedHiddenPlaceholder from './FeedHiddenPlaceholder';
import { prependToFeedCache, removeFromFeedCache, type FeedInfiniteData } from './feed-cache';
import { buildFeedRows, HOUSE_PROMOS, type HousePromoId, type FeedSponsoredCard } from './feed-ads';
import FeedAdCard from './FeedAdCard';
import AdCard from '@/features/connect/ads/AdCard';
import PromotedProfileAdCard from '@/features/connect/ads/PromotedProfileAdCard';
import PromotedListingFeedCard from '@/features/connect/ads/PromotedListingFeedCard';
import PromotedJobFeedCard from '@/features/connect/ads/PromotedJobFeedCard';
import PromotedRfqFeedCard from '@/features/connect/ads/PromotedRfqFeedCard';
import type {
  FeedTab,
  HydratedFeedItem,
  HydratedFeedPage,
  NegativeSignalKind,
} from '../feed.types';

// House promos gated OFF 2026-06-16 (owner request): the in-feed ad slot stays
// EMPTY unless there is a real boosted post to show, so a promo label appears
// only on genuinely boosted posts. Flip to `true` to restore the house-promo
// fallback rotation (see buildFeedRows in feed-ads.ts). The promoted (boosted)
// post path is unaffected either way. NOTE: with house ads off, a genuine PAID
// boost now opens the first sponsored slot early (FIRST_PAID_AD_AFTER, see
// feed-ads.ts) so a funded boost can serve even in a short / sparse feed; this
// flag stays false, so that earlier slot only ever carries a real paid card.
const HOUSE_ADS_ENABLED = false;

/**
 * Renders one in-feed sponsored card by its kind (Phase 1). The entity is already
 * hydrated server-side; each kind has its own native, full-width feed card. A post
 * boost reuses the existing AdCard promoted branch; everything else is a dedicated
 * Promoted* feed card. All fire the shared MRC beacons.
 */
function SponsoredFeedCard({
  card,
  viewerId,
  onboarded,
}: {
  card: FeedSponsoredCard;
  viewerId: string;
  onboarded: boolean;
}) {
  switch (card.kind) {
    case 'post':
      return (
        <AdCard
          type="promoted"
          post={card.post}
          impressionToken={card.impressionToken}
          campaignId={card.campaignId}
          viewerId={viewerId}
          onboarded={onboarded}
        />
      );
    case 'profile':
      return (
        <PromotedProfileAdCard
          person={card.person}
          impressionToken={card.impressionToken}
          campaignId={card.campaignId}
          kind={card.intent}
        />
      );
    case 'listing':
      return (
        <PromotedListingFeedCard
          listing={card.listing}
          impressionToken={card.impressionToken}
          campaignId={card.campaignId}
        />
      );
    case 'job':
      return (
        <PromotedJobFeedCard
          job={card.job}
          impressionToken={card.impressionToken}
          campaignId={card.campaignId}
        />
      );
    case 'rfq':
      return (
        <PromotedRfqFeedCard
          rfq={card.rfq}
          impressionToken={card.impressionToken}
          campaignId={card.campaignId}
        />
      );
    default:
      return null;
  }
}

interface FeedListProps {
  tab: FeedTab;
  /** The server-rendered first page - seeds the query so there is no flash. */
  initialPage: HydratedFeedPage;
  /** The signed-in viewer - forwarded to each `PostCard` for its comment thread. */
  viewerId: string;
  /** Whether the viewer has completed Connect onboarding. Forwarded to PostCard
   *  to gate write actions (react, comment). */
  onboarded: boolean;
  /**
   * Server-resolved in-feed sponsored cards (Phase 1 "boosts in the feed") - any
   * boost kind (post / profile / listing / job / rfq), resolved from the unified
   * `feed_sponsored` auction and placed into the earliest ad slots in order.
   * Empty when none. Renders on all viewports (a boost must reach mobile too).
   */
  sponsoredCards?: FeedSponsoredCard[];
}

export default function FeedList({
  tab,
  initialPage,
  viewerId,
  onboarded,
  sponsoredCards = [],
}: FeedListProps) {
  const t = useTranslations('connect.feed');
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  // The feed list sits below the header + tabs; the window virtualizer needs
  // that document offset to place rows. Measured after mount (a ref value must
  // not be read during render).
  const [scrollMargin, setScrollMargin] = useState(0);

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, refetch } =
    useInfiniteQuery({
      queryKey: ['connect-feed', tab],
      queryFn: async ({ pageParam }) => {
        const res = await getFeed(tab, pageParam);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedFeedPage) =>
        last.caughtUp ? undefined : (last.nextCursor ?? undefined),
      initialData: { pages: [initialPage], pageParams: [undefined] },
    });

  const posts = useMemo(() => data.pages.flatMap((page) => page.posts), [data]);

  // Mobile in-feed ad slots (design-decisions doc §4.3 - mobile has no rail).
  // House promos are interleaved at a research-backed cadence (feed-ads.ts);
  // dismissing one drops it from the session rotation (frequency cap). Ad rows
  // render mobile-only (FeedAdCard is wrapped `md:hidden` in the row map below),
  // so desktop / tablet are unchanged and keep the rail.
  const [dismissedAds, setDismissedAds] = useState<HousePromoId[]>([]);
  const promos = useMemo(
    () => HOUSE_PROMOS.filter((p) => !dismissedAds.includes(p.id)),
    [dismissedAds],
  );
  const rows = useMemo(
    () =>
      buildFeedRows(posts, promos, {
        sponsoredCards,
        houseAdsEnabled: HOUSE_ADS_ENABLED,
      }),
    [posts, promos, sponsoredCards],
  );
  const dismissAd = useCallback(
    (id: HousePromoId) => setDismissedAds((prev) => (prev.includes(id) ? prev : [...prev, id])),
    [],
  );

  // Cold-start framing - when every loaded For-You post is a discovery item
  // (the viewer follows no one yet), say so honestly rather than passing
  // discovery off as the viewer's network.
  const coldStart =
    tab === 'foryou' &&
    posts.length > 0 &&
    posts.every((p) => p.origin && p.origin !== 'in_network');

  // Realtime: a followed author posting flips on a "new posts" pill rather
  // than shifting the feed under the reader. Tapping it prepends the fresh
  // posts to the top; the feed never auto-shifts, so a busy network does not
  // move content under the reader. Buffer caps keep a high post volume from
  // growing memory or firing a fetch storm on tap.
  const NEW_POST_BUFFER_CAP = 30; // newest ids retained for the prepend on tap
  const NEW_POST_PREPEND_CAP = 8; // how many we hydrate and prepend per tap
  const newPostIdsRef = useRef<string[]>([]);
  const [hasNewPosts, setHasNewPosts] = useState(false);
  // Each realtime event only buffers an id (a cheap ref write) and flips the
  // pill on. setHasNewPosts is idempotent, so a burst of events never
  // re-renders or makes the pill "show every second". Duplicates are ignored.
  const onNewPost = useCallback((event: NewPostEvent) => {
    const ids = newPostIdsRef.current;
    if (ids.includes(event.postId)) return;
    ids.unshift(event.postId);
    if (ids.length > NEW_POST_BUFFER_CAP) ids.length = NEW_POST_BUFFER_CAP;
    setHasNewPosts(true);
  }, []);
  useFeedRealtime(onNewPost);

  // Tapping the pill hydrates up to the cap of the most-recent new posts by id
  // and prepends them (newest on top), mirroring the own-post prepend in
  // FeedScreen. For-You stays ranked for everything else; the prepended posts
  // are the ones the reader explicitly asked to see. prependToFeedCache
  // de-dups by id, so a post that later pages in is not duplicated.
  const applyNewPosts = useCallback(() => {
    const ids = newPostIdsRef.current.slice(0, NEW_POST_PREPEND_CAP);
    newPostIdsRef.current = [];
    setHasNewPosts(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void (async () => {
      const results = await Promise.all(ids.map((id) => getPublicPost(id)));
      const fresh = results.flatMap((r) => (r.ok ? [r.data] : []));
      if (fresh.length === 0) {
        void refetch();
        return;
      }
      queryClient.setQueryData<FeedInfiniteData>(['connect-feed', tab], (old) => {
        let next = old;
        for (let i = fresh.length - 1; i >= 0; i -= 1) next = prependToFeedCache(next, fresh[i]);
        return next;
      });
      // Reconcile to true ranked order on the next mount or load; the prepend
      // is what the reader asked to see now, not a permanent pin. refetchType
      // 'none' keeps the just-shown posts in place on the current screen.
      void queryClient.invalidateQueries({ queryKey: ['connect-feed', tab], refetchType: 'none' });
    })();
  }, [queryClient, tab, refetch]);

  // Viewport-impression batching - each PostCard reports itself once seen.
  const { reportSeen } = useFeedImpressions();

  // Posts the viewer just HID - kept in the list (so the row stays) but rendered
  // as the "Post hidden - Undo" placeholder instead of the card (Phase 7d). On
  // Undo (or a failed hide) the id leaves the map and the card returns. Keyed by
  // the signal kind that hid it (hide_post or not_interested) so the placeholder's
  // Undo lifts the RIGHT backend row - they target the same post id but are
  // distinct rows, and undoing the wrong kind would leave the post hidden on refresh.
  const [hiddenIds, setHiddenIds] = useState<Map<string, NegativeSignalKind>>(() => new Map());

  // "Show me less" - apply each control's LIST effect (the BE already persisted
  // the signal). Differs by kind (Phase 7d):
  //   - hide_post      → swap the card for an inline undo placeholder (kept in list);
  //   - not_interested → SAME as hide_post: swap in the placeholder (the BE now
  //                      hard-excludes the post too, while still dampening For-You);
  //   - mute_author    → drop every post by that author (hard exclude).
  const handleNegativeSignal = useCallback(
    (kind: NegativeSignalKind, post: HydratedFeedItem) => {
      if (kind === 'hide_post' || kind === 'not_interested') {
        setHiddenIds((prev) => new Map(prev).set(post._id, kind));
        return;
      }
      if (kind === 'mute_author') {
        queryClient.setQueryData<FeedInfiniteData>(['connect-feed', tab], (old) =>
          removeFromFeedCache(old, (p) => p.authorId === post.authorId),
        );
      }
    },
    [queryClient, tab],
  );

  // Reverse a signal's LIST effect (fired by an Undo, or a failed hide/not-interested).
  //   - hide_post / not_interested → restore the card (drop the placeholder);
  //   - mute_author → refetch so the author's posts come back.
  const handleNegativeUndo = useCallback(
    (kind: NegativeSignalKind, post: HydratedFeedItem) => {
      if (kind === 'hide_post' || kind === 'not_interested') {
        setHiddenIds((prev) => {
          const next = new Map(prev);
          next.delete(post._id);
          return next;
        });
      } else if (kind === 'mute_author') {
        void refetch();
      }
    },
    [refetch],
  );

  // The placeholder's Undo: lift the signal on the backend, then restore the card.
  // Uses the kind that hid the post (hide_post or not_interested) so the matching
  // backend row is removed and the post does not come back hidden on the next refresh.
  const undoHide = useCallback(
    async (post: HydratedFeedItem) => {
      const kind = hiddenIds.get(post._id) ?? 'hide_post';
      setHiddenIds((prev) => {
        const next = new Map(prev);
        next.delete(post._id);
        return next;
      });
      const res = await removeNegativeSignal(kind, post._id);
      if (res.ok) trackEvent(ConnectEvents.feedFeedback, { kind, action: 'undo' });
    },
    [hiddenIds],
  );

  // Author deleted their post - prune it from the live list so the card leaves
  // immediately (the server has soft-deleted it, so later pages stay filtered).
  const handleDeleted = useCallback(
    (deleted: HydratedFeedItem) => {
      queryClient.setQueryData<FeedInfiniteData>(['connect-feed', tab], (old) =>
        removeFromFeedCache(old, (p) => p._id === deleted._id),
      );
    },
    [queryClient, tab],
  );

  const virtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: (index) => (rows[index]?.type === 'ad' ? 200 : 360),
    overscan: 3,
    scrollMargin,
    // Key measurements by stable post id, not array index. The feed prepends
    // posts (own-post insert + the "new posts" pill), which shifts every index;
    // an index-keyed cache would then map cached heights to the wrong cards and
    // produce overlapping rows and gaps. Keying by id keeps each measurement
    // attached to its post across a prepend.
    getItemKey: (index) => rows[index].key,
  });

  useEffect(() => {
    if (!listRef.current) return;
    // offsetTop is relative to the nearest positioned offsetParent, not the
    // document; useWindowVirtualizer needs the document-top offset. Derive it
    // from the viewport rect plus the current scroll position.
    const rect = listRef.current.getBoundingClientRect();
    setScrollMargin(rect.top + window.scrollY);
  }, []);

  // Pull the next page as the reader nears the end of the rendered window.
  // CN-FEED-6 (feed harden Bucket 7): the `!error` term stops a FAILED page
  // fetch from immediately re-firing on every re-render while the reader sits
  // near the bottom (a runaway retry loop against a dead Retry button). The
  // reader must explicitly Retry after a failure.
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= rows.length - 3 && hasNextPage && !isFetchingNextPage && !error) {
      void fetchNextPage();
    }
  }, [virtualItems, rows.length, hasNextPage, isFetchingNextPage, error, fetchNextPage]);

  // CN-FEED-6: Retry must re-attempt the actual failed page, not `router.refresh()`
  // (a server re-render that cannot clear a CLIENT-side React Query error). Retry
  // the next page when one is pending; otherwise refetch the loaded pages.
  const retry = useCallback(() => {
    if (hasNextPage) void fetchNextPage();
    else void refetch();
  }, [hasNextPage, fetchNextPage, refetch]);

  if (posts.length === 0) {
    // Tailor the empty state to the tab. Following is a pure "people you follow"
    // timeline, so when it is empty the fix is to follow people (or switch to
    // For You to discover); For You only reads empty in the rare case of no
    // platform content, where the nudge is to explore / be the first to post.
    const isFollowing = tab === 'following';
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<UsersRound size={24} aria-hidden />}
        title={isFollowing ? t('empty.followingTitle') : t('empty.title')}
        description={isFollowing ? t('empty.followingBody') : t('empty.body')}
        primaryAction={{ label: t('empty.cta'), href: '/connect/network?tab=suggestions' }}
        secondaryAction={
          isFollowing
            ? { label: t('empty.ctaDiscover'), href: '/connect/feed' }
            : { label: t('empty.ctaCompanies'), href: '/connect/companies' }
        }
      />
    );
  }

  return (
    <div>
      {hasNewPosts && (
        <div
          role="status"
          style={{
            position: 'sticky',
            top: 12,
            zIndex: 5,
            // Float as an overlay: zero flow height so the pill never pushes the
            // feed down or clips the first card. The button hangs below the
            // sticky line and is the only interactive part.
            height: 0,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            pointerEvents: 'none',
          }}
        >
          <button
            type="button"
            onClick={applyNewPosts}
            style={{
              pointerEvents: 'auto',
              padding: '7px 16px',
              borderRadius: 'var(--cr-radius-full)',
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--cr-surface)',
              background: 'var(--cr-primary)',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
            }}
          >
            {t('newPosts')}
          </button>
        </div>
      )}
      {coldStart && (
        <div
          role="status"
          style={{
            marginBottom: 'var(--cr-space-md)',
            padding: '10px 14px',
            borderRadius: 'var(--cr-radius-md)',
            background: 'var(--cr-surface-2)',
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--cr-text-4)',
          }}
        >
          {t('coldStart')}
        </div>
      )}
      <div ref={listRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualItems.map((item) => {
          const row = rows[item.index];
          // Row-wrapper visibility: house-promo ad rows ('ad') are mobile-only
          // ('md:hidden') because the desktop / tablet side rail already carries
          // ads, so an in-column house promo there would double up. A 'sponsored'
          // row is a PAID boost and intentionally renders on ALL viewports, so the
          // className check below keys off 'ad' only. Do NOT broaden it.
          return (
            <div
              key={row.key}
              data-index={item.index}
              ref={virtualizer.measureElement}
              className={row.type === 'ad' ? 'md:hidden' : undefined}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                paddingBottom: 14,
              }}
            >
              {row.type === 'ad' ? (
                <FeedAdCard promo={row.promo} onDismiss={dismissAd} />
              ) : row.type === 'sponsored' ? (
                // A paid in-feed sponsored card (any boost kind). The hydrated
                // entity rode down from the server; pick the native card per kind.
                // Renders on ALL viewports (not md:hidden) - a boost must reach
                // mobile too.
                <SponsoredFeedCard card={row.card} viewerId={viewerId} onboarded={onboarded} />
              ) : hiddenIds.has(row.post._id) ? (
                // Hidden via the overflow menu (Hide or Not interested) - show the
                // inline undo placeholder in the card's place (Phase 7d). The row
                // stays so the list does not jump; Undo restores the card + lifts
                // the matching backend signal (undoHide reads the stored kind).
                <FeedHiddenPlaceholder onUndo={() => void undoHide(row.post)} />
              ) : (
                <PostCard
                  post={row.post}
                  viewerId={viewerId}
                  onboarded={onboarded}
                  onNegativeSignal={handleNegativeSignal}
                  onNegativeUndo={handleNegativeUndo}
                  onDeleted={handleDeleted}
                  onSeen={reportSeen}
                  // First row paints its image eagerly (LCP); the rest lazy-load.
                  priority={item.index === 0}
                  // Analytics context for the feed-impression event (additive,
                  // separate from the onSeen view-count path). position = the row
                  // index in the virtualized feed; feedTab = the active tab.
                  position={item.index}
                  feedTab={tab}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* End-of-feed states. */}
      <div
        role="status"
        style={{
          padding: 'var(--cr-space-lg) 0',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--cr-text-4)',
        }}
      >
        {error && !isFetching ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <span>{t('loadError')}</span>
            <DsButton dsVariant="ghost" dsSize="sm" onClick={retry}>
              {t('retry')}
            </DsButton>
          </div>
        ) : isFetchingNextPage ? (
          <span>{t('loadingMore')}</span>
        ) : !hasNextPage ? (
          <span style={{ fontWeight: 600 }}>{t('caughtUp')}</span>
        ) : null}
      </div>
    </div>
  );
}
