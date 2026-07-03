'use client';

/**
 * ActivityPostList - the Posts and Reactions panels of the profile Activity tab.
 *
 * The owner's own authored posts (`type='posts'`) or the posts they have liked
 * (`type='reactions'`), newest-first, rendered as the lightweight, static
 * `ActivityCard` - the same card the profile teaser and the public
 * `/u/[slug]/activity` list use. Rendered in normal document flow (no
 * virtualizer): a profile's activity is a paged, bounded list, and the window
 * virtualizer mis-measured row heights inside the page grid (leaving large gaps).
 * `useInfiniteQuery` + an explicit "show more", client-fetched (the profile loads
 * server-side; activity is a below-the-fold section). No `PostCard`, so no
 * realtime socket per row; tapping a card opens the post for full actions.
 */

import { useCallback } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, Heart } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState } from '@/components/connect';
import { SkeletonCard, SkeletonLine } from '@/components/connect/Skeleton';
import { getMyActivity } from '../feed.actions';
import type { HydratedFeedPage } from '../feed.types';
import ActivityCard from './ActivityCard';

interface ActivityPostListProps {
  /** Which post-shaped activity view to render. */
  type: 'posts' | 'reactions';
}

export default function ActivityPostList({ type }: ActivityPostListProps) {
  const t = useTranslations('connect.profile.activity');
  const router = useRouter();

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } =
    useInfiniteQuery({
      queryKey: ['connect-activity', type],
      queryFn: async ({ pageParam }) => {
        const res = await getMyActivity(type, pageParam);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedFeedPage) =>
        last.caughtUp ? undefined : (last.nextCursor ?? undefined),
    });

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  const retry = useCallback(() => router.refresh(), [router]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-2.5" role="status" aria-label={t('loading')}>
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonCard key={i} style={{ borderColor: 'var(--cr-border-light)', padding: 12 }}>
            <SkeletonLine w={150} h={11} />
            <div style={{ marginTop: 10 }}>
              <SkeletonLine w="75%" h={13} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    );
  }

  if (error && posts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-[13px]" role="status">
        <span style={{ color: 'var(--cr-text-4)' }}>{t('loadError')}</span>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={retry}>
          {t('retry')}
        </DsButton>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={
          type === 'reactions' ? (
            <Heart size={24} aria-hidden />
          ) : (
            <FileText size={24} aria-hidden />
          )
        }
        title={t(`empty.${type}.title`)}
        description={t(`empty.${type}.body`)}
        primaryAction={{ label: t('empty.cta'), href: '/connect/feed' }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {posts.map((post) => (
        <ActivityCard key={post._id} post={post} />
      ))}

      {error ? (
        <div className="flex flex-col items-center gap-2 py-2 text-center text-[13px]">
          <span style={{ color: 'var(--cr-text-4)' }}>{t('loadError')}</span>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={() => void fetchNextPage()}>
            {t('retry')}
          </DsButton>
        </div>
      ) : hasNextPage ? (
        <div className="flex justify-center pt-1">
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? t('loadingMore') : t('loadMore')}
          </DsButton>
        </div>
      ) : (
        <p
          className="py-2 text-center text-[12px] font-semibold"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('caughtUp')}
        </p>
      )}
    </div>
  );
}
