'use client';

/**
 * ActivityCard - one rich, STATIC activity entry: an action verb ("Posted",
 * "Shared 3 photos", "Recorded a voice note", "Reposted"), a body snippet, a
 * media preview (photo strip / video tile / document chip / voice clip), and the
 * engagement tallies (reactions / comments / reposts), linking to the full post.
 *
 * Shared by the profile `ActivityPreview` teaser and the public
 * `/u/[slug]/activity` list, so both render the same card (ENGINEERING-STANDARDS
 * #5). Deliberately read-only: NO `PostCard` here, so it opens no realtime
 * socket / impression observer and makes no client fetch. A repost previews its
 * embedded ROOT `original`; the verb still reads "Reposted".
 */

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import {
  FileText,
  Heart,
  Image as ImageIcon,
  MessageCircle,
  Mic,
  Play,
  Repeat2,
  Video,
} from 'lucide-react';
import type { HydratedFeedItem, PostKind } from '../feed.types';

/** Trim a post body to a short two-line preview. */
function snippet(text: string, max = 180): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
}

/** Clip duration seconds to `m:ss`. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Small glyph for the action verb line. */
function VerbIcon({ kind, repost }: { kind: PostKind; repost: boolean }) {
  const size = 14;
  if (repost) return <Repeat2 size={size} aria-hidden />;
  switch (kind) {
    case 'photo':
      return <ImageIcon size={size} aria-hidden />;
    case 'video':
      return <Video size={size} aria-hidden />;
    case 'document':
      return <FileText size={size} aria-hidden />;
    case 'voice':
      return <Mic size={size} aria-hidden />;
    default:
      return <MessageCircle size={size} aria-hidden />;
  }
}

/** One muted engagement stat (count + icon), hidden when zero. */
function Stat({ count, label, icon }: { count: number; label: string; icon: ReactNode }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex items-center gap-1" style={{ color: 'var(--cr-text-4)' }}>
      {icon}
      <span aria-label={label}>{count}</span>
    </span>
  );
}

export default function ActivityCard({ post }: { post: HydratedFeedItem }) {
  const t = useTranslations('connect.profile.activity');
  const format = useFormatter();

  const isRepost = Boolean(post.repostOf);
  // A repost previews the embedded original's content; the verb stays "Reposted".
  const content = post.original ?? post;
  const verbLabel = isRepost
    ? t('verb.reposted')
    : content.kind === 'photo'
      ? t('verb.photo', { count: content.media.length })
      : content.kind === 'video'
        ? t('verb.video')
        : content.kind === 'document'
          ? t('verb.document')
          : content.kind === 'voice'
            ? t('verb.voice')
            : t('verb.posted');

  // The repost wrapper's own quote text wins; otherwise the previewed content's body.
  const previewBody = post.body.trim() || content.body.trim();

  return (
    <Link
      href={`/connect/posts/${post._id}`}
      className="block rounded-lg no-underline transition-colors hover:bg-surface-2"
      style={{ border: '1px solid var(--cr-border-light)' }}
    >
      <article className="flex flex-col gap-2 p-3">
        {/* Action verb + time */}
        <div
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold"
          style={{ color: 'var(--cr-text-4)' }}
        >
          <VerbIcon kind={content.kind} repost={isRepost} />
          <span style={{ color: 'var(--cr-text-3)' }}>{verbLabel}</span>
          <span aria-hidden>·</span>
          <span>{format.relativeTime(new Date(post.createdAt))}</span>
        </div>

        {/* Body snippet */}
        {previewBody && (
          <p
            className="m-0 text-[14px]"
            style={{
              color: 'var(--cr-text-2)',
              lineHeight: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {snippet(previewBody)}
          </p>
        )}

        <MediaPreview
          post={content}
          documentLabel={t('documentLabel')}
          altText={t('previewMedia')}
        />

        {/* Engagement tallies (static) */}
        {(content.reactionCount > 0 ||
          content.commentCount > 0 ||
          (content.repostCount ?? 0) > 0) && (
          <div className="flex items-center gap-3 text-[12.5px] font-medium">
            <Stat
              count={content.reactionCount}
              label={t('stats.reactions', { count: content.reactionCount })}
              icon={<Heart size={13} aria-hidden />}
            />
            <Stat
              count={content.commentCount}
              label={t('stats.comments', { count: content.commentCount })}
              icon={<MessageCircle size={13} aria-hidden />}
            />
            <Stat
              count={content.repostCount ?? 0}
              label={t('stats.reposts', { count: content.repostCount ?? 0 })}
              icon={<Repeat2 size={13} aria-hidden />}
            />
          </div>
        )}
      </article>
    </Link>
  );
}

/** The kind-specific media preview - compact, static (no players, no fetch). */
function MediaPreview({
  post,
  documentLabel,
  altText,
}: {
  post: HydratedFeedItem;
  documentLabel: string;
  altText: string;
}) {
  if (post.kind === 'photo' && post.media.length > 0) {
    // A compact, cropped teaser that mirrors the feed's `PostPhotoGrid` geometry
    // (1 = full 16:10, 2-4 = a 2-col square grid, 5+ = a "+N" tile on the 4th):
    // one consistent grid at every photo count, not a ragged thumbnail strip.
    // Static + link-through (the whole card is a Link to the post), so no AntD
    // lightbox here - a tap opens the post. `max-width` keeps it teaser-sized
    // inside the card rather than full feed-post width.
    const shown = post.media.slice(0, 4);
    const overflow = post.media.length - shown.length;
    const single = shown.length === 1;
    return (
      <div
        className="overflow-hidden rounded-md"
        style={{
          display: 'grid',
          gridTemplateColumns: single ? '1fr' : '1fr 1fr',
          gap: 2,
          maxWidth: 320,
        }}
      >
        {shown.map((img, i) => (
          <div
            key={`${img.url}-${i}`}
            className="relative overflow-hidden"
            style={{ aspectRatio: single ? '16 / 10' : '1 / 1' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 asset */}
            <img
              src={img.url}
              alt={img.caption?.trim() || altText}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            {overflow > 0 && i === shown.length - 1 && (
              <div
                aria-hidden
                className="absolute inset-0 grid place-items-center text-[18px] font-bold text-white"
                style={{ background: 'rgba(14,24,68,0.55)' }}
              >
                +{overflow}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (post.kind === 'video' && post.media[0]) {
    return (
      <div
        className="relative grid place-items-center overflow-hidden rounded-md"
        style={{ width: 128, height: 72, background: 'var(--cr-text)' }}
      >
        <span
          className="grid h-8 w-8 place-items-center rounded-full"
          style={{ background: 'rgba(255,255,255,0.92)', color: 'var(--cr-text)' }}
        >
          <Play size={16} aria-hidden fill="currentColor" />
        </span>
      </div>
    );
  }

  if (post.kind === 'document' && post.media.length > 0) {
    const doc = post.media[0];
    return (
      <span
        className="inline-flex max-w-full items-center gap-2 self-start rounded-md px-3 py-2 text-[13px] font-semibold"
        style={{
          border: '1px solid var(--cr-border)',
          color: 'var(--cr-text-2)',
          background: 'var(--cr-surface-2)',
        }}
      >
        <FileText size={15} aria-hidden style={{ flexShrink: 0 }} />
        <span className="truncate">{doc.caption?.trim() || documentLabel}</span>
      </span>
    );
  }

  if (post.kind === 'voice' && post.audio) {
    return (
      <span
        className="inline-flex items-center gap-2.5 self-start rounded-full py-1.5 pr-3.5 pl-2.5"
        style={{ background: 'var(--cr-surface-2)', border: '1px solid var(--cr-border-light)' }}
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-full"
          style={{ background: 'var(--cr-primary)', color: '#ffffff' }}
        >
          <Mic size={14} aria-hidden />
        </span>
        {/* Faux waveform - decorative, conveys "voice clip" at a glance. */}
        <span aria-hidden className="flex items-end gap-[3px]" style={{ height: 16 }}>
          {[8, 14, 6, 16, 10, 13, 7].map((h, i) => (
            <span
              key={i}
              style={{
                width: 2.5,
                height: h,
                borderRadius: 2,
                background: 'var(--cr-text-4)',
                display: 'block',
              }}
            />
          ))}
        </span>
        <span
          className="text-[12.5px] font-semibold tabular-nums"
          style={{ color: 'var(--cr-text-3)' }}
        >
          {formatDuration(post.audio.durationSec)}
        </span>
      </span>
    );
  }

  return null;
}
