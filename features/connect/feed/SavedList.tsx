'use client';

/**
 * SavedList - the caller's saved (bookmarked) posts (Phase 7c / Wave 6).
 *
 * Seeded with the server-rendered first page, then `useInfiniteQuery` pulls
 * further save-time-cursor pages as the reader nears the end. Rows are
 * window-virtualized like the main feed. Un-saving a post from its overflow
 * menu prunes it from the live list immediately - a Saved list should never
 * keep showing a post the viewer just removed. No realtime, no impressions, no
 * ranking: a private list.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Bookmark } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState, PostCard } from '@/components/connect';
import { getSaved } from '../feed.actions';
import { removeFromFeedCache, type FeedInfiniteData } from './feed-cache';
import type { HydratedFeedItem, HydratedFeedPage } from '../feed.types';

interface SavedListProps {
  /** The server-rendered first page - seeds the query so there is no flash. */
  initialPage: HydratedFeedPage;
  /** The signed-in viewer - forwarded to each `PostCard` for its comment thread. */
  viewerId: string;
  /** Whether the viewer has completed Connect onboarding. Gates write actions. */
  onboarded: boolean;
}

export default function SavedList({ initialPage, viewerId, onboarded }: SavedListProps) {
  const t = useTranslations('connect.saved');
  const router = useRouter();
  const queryClient = useQueryClient();
  const listRef = useRef<HTMLDivElement>(null);
  // The list sits below the page header; the window virtualizer needs that
  // document offset to place rows. Measured after mount.
  const [scrollMargin, setScrollMargin] = useState(0);

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching } =
    useInfiniteQuery({
      queryKey: ['connect-saved'],
      queryFn: async ({ pageParam }) => {
        const res = await getSaved(pageParam);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedFeedPage) =>
        last.caughtUp ? undefined : (last.nextCursor ?? undefined),
      initialData: { pages: [initialPage], pageParams: [undefined] },
    });

  const posts = data.pages.flatMap((page) => page.posts);

  // Un-saving prunes the post from the live list (the backend already removed
  // the bookmark, so the next page fetch stays consistent). Re-saving from here
  // is a no-op for the list - the post is already shown.
  const handleSaveChange = useCallback(
    (saved: boolean, post: HydratedFeedItem) => {
      if (saved) return;
      queryClient.setQueryData<FeedInfiniteData>(['connect-saved'], (old) =>
        removeFromFeedCache(old, (p) => p._id === post._id),
      );
    },
    [queryClient],
  );

  // Author deleted their post - prune it from the saved list immediately.
  const handleDeleted = useCallback(
    (deleted: HydratedFeedItem) => {
      queryClient.setQueryData<FeedInfiniteData>(['connect-saved'], (old) =>
        removeFromFeedCache(old, (p) => p._id === deleted._id),
      );
    },
    [queryClient],
  );

  const virtualizer = useWindowVirtualizer({
    count: posts.length,
    estimateSize: () => 360,
    overscan: 3,
    scrollMargin,
    // Key measurements by stable post id, not array index, so removing a post
    // (un-save) does not misalign cached heights and cause overlap or gaps.
    getItemKey: (index) => posts[index]._id,
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
  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= posts.length - 3 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualItems, posts.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const retry = useCallback(() => router.refresh(), [router]);

  if (posts.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<Bookmark size={24} aria-hidden />}
        title={t('empty.title')}
        description={t('empty.body')}
        primaryAction={{ label: t('empty.cta'), href: '/connect/feed' }}
      />
    );
  }

  return (
    <div>
      <div ref={listRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualItems.map((item) => (
          <div
            key={posts[item.index]._id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              paddingBottom: 14,
            }}
          >
            <PostCard
              post={posts[item.index]}
              viewerId={viewerId}
              onboarded={onboarded}
              onSaveChange={handleSaveChange}
              onDeleted={handleDeleted}
            />
          </div>
        ))}
      </div>

      {/* End-of-list states. */}
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
