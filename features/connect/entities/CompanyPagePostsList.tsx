'use client';

/**
 * CompanyPagePostsList - a company page's posts (the Posts section on the public
 * `/company/[slug]` page + the owner's manage console). Shows FULL posts (body +
 * media), not teaser snippets - the LinkedIn-style read.
 *
 * Two render modes:
 *  - Manage (owner, `manage` + `viewerId`): the full interactive `PostCard` from
 *    the feed, so the owner can react / comment / edit / delete their page posts
 *    inline. Lives inside the Connect shell, which provides the Ant App / Query /
 *    socket context `PostCard` needs. Non-public posts carry a "Connections only"
 *    tag so the owner knows which ones buyers cannot see.
 *  - Public (everyone else, incl. logged-out `/company/[slug]`): the read-only,
 *    provider-free `PublicPostView`, wrapped in a link to the post permalink
 *    (where a signed-in visitor can react / comment). Safe without the shell.
 *
 * First page is server-seeded; "Show more" pages in the rest via
 * `getCompanyPagePosts` (the manage route uses the owner-gated `/manage/posts`).
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Lock } from 'lucide-react';
import { PostCard, PublicPostView } from '@/components/connect';
import { getCompanyPagePosts } from '../feed.actions';
import type { HydratedFeedPage } from '../feed.types';

interface Props {
  pageId: string;
  /** Page name - used in the empty hint. */
  name: string;
  /** SSR-seeded first page. */
  initialPage: HydratedFeedPage;
  /** Owner manage console: page the rest via the owner-gated route so a hidden
   *  draft's posts still load, and render the interactive `PostCard`. */
  manage?: boolean;
  /** The signed-in owner's userId (manage only) - enables the interactive card. */
  viewerId?: string;
}

export default function CompanyPagePostsList({
  pageId,
  name,
  initialPage,
  manage,
  viewerId,
}: Props) {
  const t = useTranslations('connect.companyPage');
  const tAct = useTranslations('connect.profile.activity');

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useInfiniteQuery(
    {
      queryKey: ['connect-company-page-posts', pageId, manage ? 'manage' : 'public'],
      queryFn: async ({ pageParam }) => {
        const res = await getCompanyPagePosts(pageId, pageParam, { manage });
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedFeedPage) =>
        last.caughtUp ? undefined : (last.nextCursor ?? undefined),
      initialData: { pages: [initialPage], pageParams: [undefined as string | undefined] },
      staleTime: Infinity,
    },
  );

  const posts = data?.pages.flatMap((page) => page.posts) ?? [];
  const interactive = !!manage && !!viewerId;

  if (posts.length === 0) {
    return (
      <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
        {t('postsEmpty', { name })}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {posts.map((post) =>
          interactive ? (
            <div key={post._id} className="flex flex-col gap-1.5">
              {post.visibility === 'connections' && (
                <span
                  className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-4)' }}
                >
                  <Lock size={10} aria-hidden />
                  {tAct('connectionsOnly')}
                </span>
              )}
              <PostCard
                post={post}
                viewerId={viewerId as string}
                onboarded
                onDeleted={() => void refetch()}
              />
            </div>
          ) : (
            // Read-only full post; the whole card links to the permalink where a
            // signed-in visitor can react / comment.
            <Link key={post._id} href={`/connect/posts/${post._id}`} className="block no-underline">
              <PublicPostView post={post} />
            </Link>
          ),
        )}
      </div>
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          aria-label={t('postsLoadMoreAria', { name })}
          className="self-center rounded-full px-4 py-2 text-[13px] font-semibold transition-colors disabled:opacity-60"
          style={{ border: '1px solid var(--cr-border)', color: 'var(--cr-text-2)' }}
        >
          {isFetchingNextPage ? t('postsLoadingMore') : t('postsLoadMore')}
        </button>
      )}
      {error && (
        <p
          role="alert"
          className="m-0 text-center text-[12px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('postsLoadError')}
        </p>
      )}
    </div>
  );
}
