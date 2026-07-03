'use client';

/**
 * ActivityCommentList - the Comments panel of the profile Activity tab.
 *
 * The owner's own comments, newest-first, each linking to the post it sits on.
 * Reuses the feed's `useInfiniteQuery` + `useWindowVirtualizer` pattern, but the
 * row is a light `ActivityCommentItem` (the comment text + a link to the parent
 * post), not a full `PostCard`. Client-fetched like `ActivityPostList`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { MessageCircle } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectEmptyState } from '@/components/connect';
import { SkeletonCard, SkeletonLine } from '@/components/connect/Skeleton';
// Renders @mentions in the comment body as clickable chips. Shared renderer used
// by PostCard, PublicPostView, PostComments.
import MentionText from '@/components/connect/MentionText';
import { getMyActivityComments } from '../feed.actions';
import type { HydratedActivityComment, HydratedActivityCommentsPage } from '../feed.types';

/** Trim a parent-post body to a one-line preview. */
function snippet(text: string, max = 140): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/** One comment row - the comment text, when it was posted, and a link to the
 *  post it is on (or a removed-post note when the parent is gone). */
function ActivityCommentItem({ comment }: { comment: HydratedActivityComment }) {
  const t = useTranslations('connect.profile.activity');
  const format = useFormatter();
  const authorName = comment.post?.author?.name ?? null;
  const parentBody = comment.post?.body?.trim();

  const context = comment.post ? (
    <Link
      href={`/connect/posts/${comment.postId}`}
      className="no-underline"
      style={{ fontWeight: 600, color: 'var(--cr-text-3)' }}
    >
      {authorName ? t('comment.on', { name: authorName }) : t('comment.onPost')}
    </Link>
  ) : (
    <span style={{ color: 'var(--cr-text-4)' }}>{t('comment.onDeleted')}</span>
  );

  return (
    <article
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          color: 'var(--cr-text-4)',
        }}
      >
        <MessageCircle size={13} aria-hidden />
        {context}
        <span aria-hidden>·</span>
        <span>{format.relativeTime(new Date(comment.createdAt))}</span>
      </div>

      <p
        style={{
          margin: '8px 0 0',
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--cr-text-2)',
          whiteSpace: 'pre-wrap',
        }}
      >
        <MentionText text={comment.body} mentions={comment.mentions} />
      </p>

      {/* Quoted preview of the post the comment is on - context for the reader. */}
      {comment.post && parentBody && (
        <Link
          href={`/connect/posts/${comment.postId}`}
          className="no-underline"
          style={{
            display: 'block',
            marginTop: 10,
            paddingLeft: 10,
            borderLeft: '2px solid var(--cr-border-strong)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--cr-text-4)',
          }}
        >
          {snippet(parentBody)}
        </Link>
      )}
    </article>
  );
}

export default function ActivityCommentList() {
  const t = useTranslations('connect.profile.activity');
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const { data, error, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isPending } =
    useInfiniteQuery({
      queryKey: ['connect-activity', 'comments'],
      queryFn: async ({ pageParam }) => {
        const res = await getMyActivityComments(pageParam);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedActivityCommentsPage) =>
        last.caughtUp ? undefined : (last.nextCursor ?? undefined),
    });

  const comments = data?.pages.flatMap((page) => page.comments) ?? [];

  const virtualizer = useWindowVirtualizer({
    count: comments.length,
    estimateSize: () => 140,
    overscan: 4,
    scrollMargin,
    getItemKey: (index) => comments[index]._id,
  });

  useEffect(() => {
    if (!listRef.current) return;
    const rect = listRef.current.getBoundingClientRect();
    setScrollMargin(rect.top + window.scrollY);
  }, [comments.length]);

  const virtualItems = virtualizer.getVirtualItems();
  useEffect(() => {
    const last = virtualItems[virtualItems.length - 1];
    if (last && last.index >= comments.length - 3 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  }, [virtualItems, comments.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const retry = useCallback(() => router.refresh(), [router]);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label={t('loading')}>
        {Array.from({ length: 3 }, (_, i) => (
          <SkeletonCard key={i}>
            <SkeletonLine w={180} h={11} />
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonLine w="92%" h={12} />
              <SkeletonLine w="60%" h={12} />
            </div>
          </SkeletonCard>
        ))}
      </div>
    );
  }

  if (error && comments.length === 0) {
    return (
      <div
        role="status"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          padding: 'var(--cr-space-lg) 0',
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--cr-text-4)',
        }}
      >
        <span>{t('loadError')}</span>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={retry}>
          {t('retry')}
        </DsButton>
      </div>
    );
  }

  if (comments.length === 0) {
    return (
      <ConnectEmptyState
        variant="inline"
        icon={<MessageCircle size={24} aria-hidden />}
        title={t('empty.comments.title')}
        description={t('empty.comments.body')}
        primaryAction={{ label: t('empty.cta'), href: '/connect/feed' }}
      />
    );
  }

  return (
    <div>
      <div ref={listRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualItems.map((item) => (
          <div
            key={comments[item.index]._id}
            data-index={item.index}
            ref={virtualizer.measureElement}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
              paddingBottom: 12,
            }}
          >
            <ActivityCommentItem comment={comments[item.index]} />
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
