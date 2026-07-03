'use client';

/**
 * PublicActivityList - the full list of another member's PUBLIC posts, behind
 * the "Show all activity" link on their profile (`/u/[slug]/activity`).
 *
 * Visitor surface: posts only. No Posts / Comments / Reactions tabs (those are
 * the owner-only `/connect/profile/activity` view) - comments + reactions are
 * never served to a non-owner. Rows reuse the shared `ActivityCard` (kind icon +
 * snippet + time), so there is no `PostCard`, no realtime socket, no per-row
 * fetch. The first page is server-seeded (`initialPage`); "Show more" pages in
 * the rest via `getPublicActivity`. Works logged-out (the endpoint is public).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { getPublicActivity } from '../feed.actions';
import type { HydratedFeedPage } from '../feed.types';
import ActivityCard from './ActivityCard';

interface PublicActivityListProps {
  /** Profile slug (handle or ObjectId) - the public-activity query key + cursor. */
  slug: string;
  /** The profile owner's display name - used in the empty state. */
  name: string;
  /** The server-fetched first page (SSR seed) - avoids a client refetch on mount. */
  initialPage: HydratedFeedPage;
}

export default function PublicActivityList({ slug, name, initialPage }: PublicActivityListProps) {
  const t = useTranslations('connect.profile.activity');

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery(
    {
      queryKey: ['connect-public-activity', slug],
      queryFn: async ({ pageParam }) => {
        const res = await getPublicActivity(slug, pageParam);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedFeedPage) =>
        last.caughtUp ? undefined : (last.nextCursor ?? undefined),
      initialData: { pages: [initialPage], pageParams: [undefined as string | undefined] },
      // The SSR-seeded first page is authoritative - never auto-refetch it on
      // mount. TanStack treats initialData as stale-at-epoch by default, which
      // would fire a redundant fetch and discard the server seed; pinning
      // staleTime avoids that. Load-more pages are fetched explicitly via
      // fetchNextPage.
      staleTime: Infinity,
    },
  );

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];

  // No posts at all. The first page is server-seeded, so an empty list means a
  // genuinely empty profile, not a fetch failure - show the visitor empty hint.
  // Only a failed client refetch with an empty seed sets `error` here, in which
  // case offer a retry (refetch page 1).
  if (posts.length === 0) {
    if (error) {
      return (
        <div className="flex flex-col items-start gap-3">
          <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('loadError')}
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="inline-flex rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            {t('retry')}
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-1">
        <p className="m-0 text-[14px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
          {t('empty.posts.title')}
        </p>
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('empty.posts.visitorBody', { name })}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5">
        {posts.map((post) => (
          <ActivityCard key={post._id} post={post} />
        ))}
      </div>

      {/* A load-more failure keeps the already-loaded posts and offers an inline
          retry, rather than replacing the whole list with a full-page error. */}
      {error ? (
        <div className="flex flex-col items-center gap-2">
          <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('loadError')}
          </p>
          <button
            type="button"
            onClick={() => void fetchNextPage()}
            className="rounded-full border border-border-light px-4 py-2 text-[13px] font-semibold text-subtle transition-colors hover:bg-surface-2"
          >
            {t('retry')}
          </button>
        </div>
      ) : hasNextPage ? (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="self-center rounded-full border border-border-light px-4 py-2 text-[13px] font-semibold text-subtle transition-colors hover:bg-surface-2 disabled:opacity-60"
        >
          {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
        </button>
      ) : (
        <p className="m-0 text-center text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('caughtUp')}
        </p>
      )}
    </div>
  );
}
