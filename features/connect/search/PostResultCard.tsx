'use client';

/**
 * PostResultCard - a feed post in the search results (search redesign Phase C).
 *
 * Static by design: it links through to the post at `/connect/posts/[id]`
 * rather than mounting the heavy interactive feed `PostCard` (which opens a
 * realtime socket per row). Shows the author identity, a body snippet, an
 * optional cover thumbnail, and the reaction / comment tallies. Mirrors the
 * Connect card aesthetic (inline `--cr-*` tokens) used across the surface.
 */

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Heart, ImageOff, MessageCircle } from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import type { PostResult } from '../search.types';

export default function PostResultCard({ post }: { post: PostResult }) {
  const t = useTranslations('connect.search.post');
  const authorName = post.author?.name ?? '';

  return (
    <Link
      href={`/connect/posts/${post.postId}`}
      aria-label={t('cardAria', { author: authorName })}
      style={{
        display: 'flex',
        gap: 12,
        padding: '14px 4px',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <DsAvatar name={authorName} src={post.author?.avatar ?? undefined} size={44} />

      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cr-text)' }}>
            {authorName}
          </span>
          {post.author?.headline ? (
            <span
              style={{
                fontSize: 12,
                color: 'var(--cr-text-4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {post.author.headline}
            </span>
          ) : null}
        </div>

        {post.snippet ? (
          <p
            style={{
              margin: '3px 0 0',
              fontSize: 13.5,
              lineHeight: 1.5,
              color: 'var(--cr-text-2)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {post.snippet}
          </p>
        ) : null}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            marginTop: 6,
            fontSize: 12,
            color: 'var(--cr-text-4)',
          }}
        >
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={t('reactions', { count: post.reactionCount })}
          >
            <Heart size={13} aria-hidden />
            {post.reactionCount}
          </span>
          <span
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            aria-label={t('comments', { count: post.commentCount })}
          >
            <MessageCircle size={13} aria-hidden />
            {post.commentCount}
          </span>
        </div>
      </div>

      {post.coverImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- user-uploaded post image of unknown dimensions; the established Connect pattern is <img> + object-fit
        <img
          src={post.coverImage}
          alt=""
          aria-hidden
          style={{
            width: 64,
            height: 64,
            objectFit: 'cover',
            borderRadius: 'var(--cr-radius-sm)',
            border: '1px solid var(--cr-border-light)',
            background: 'var(--cr-surface-2)',
            flexShrink: 0,
          }}
        />
      ) : post.kind === 'photo' || post.kind === 'video' ? (
        <span
          aria-hidden
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 64,
            height: 64,
            borderRadius: 'var(--cr-radius-sm)',
            border: '1px solid var(--cr-border-light)',
            background: 'var(--cr-surface-2)',
            color: 'var(--cr-text-4)',
            flexShrink: 0,
          }}
        >
          <ImageOff size={20} />
        </span>
      ) : null}
    </Link>
  );
}
