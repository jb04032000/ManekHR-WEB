'use client';

/**
 * ActivityPreview - the compact Activity teaser on a profile (LinkedIn-style).
 * Rendered inside the shared `ProfileSection` card with a "Show all activity"
 * footer.
 *
 * Shows the 2 most-recent posts as condensed one-line rows (verb + relative
 * time + a short snippet, plus one small thumbnail for a photo post) - NOT the
 * full feed cards. The full `ActivityCard` (photo grid + engagement tallies)
 * lives on the dedicated activity route reached via "Show all", so the profile
 * stays short instead of turning into a tall scroll of full posts. Static +
 * server-fed: no `PostCard`, so the profile opens no realtime socket /
 * impression observer and makes no extra client fetch.
 *
 * Reused on every profile surface: the owner's own profile (`showAllHref` ->
 * `/connect/profile/activity`) and another member's profile (`showAllHref` ->
 * the in-app `/connect/u/[slug]/activity` or the public `/u/[slug]/activity`).
 * Viewer-agnostic: the caller supplies the already-scoped `posts` + the right
 * `showAllHref`.
 */

import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { ArrowRight } from 'lucide-react';
import { ProfileSection } from '@/components/connect';
import type { HydratedFeedItem } from '../feed.types';

/** Recent items shown in the teaser; the rest live behind "Show all". */
const PREVIEW_COUNT = 2;

interface ActivityPreviewProps {
  /** The recent posts (server-fetched). The teaser renders the first few. */
  posts: HydratedFeedItem[];
  /** Where "Show all activity" goes (own profile or another member's). */
  showAllHref: string;
}

export default function ActivityPreview({ posts, showAllHref }: ActivityPreviewProps) {
  const t = useTranslations('connect.profile.activity');
  const recent = posts.slice(0, PREVIEW_COUNT);

  return (
    <ProfileSection
      title={t('title')}
      footer={
        // Always offered, even with no posts: on the owner's profile the full
        // activity route also holds their Comments / Reactions tabs, which may
        // have content when posts do not.
        <Link
          href={showAllHref}
          className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
          style={{ color: 'var(--cr-primary)' }}
        >
          {t('showAll')}
          <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('empty.posts.title')}
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {recent.map((post, i) => (
            <PreviewRow key={post._id} post={post} first={i === 0} />
          ))}
        </ul>
      )}
    </ProfileSection>
  );
}

/**
 * One condensed activity line: "verb · time", a two-line body snippet, and a
 * small square thumbnail for a photo post. The whole row links through to the
 * full post (no lightbox, no media grid - that is the full-card / activity-page
 * job). A repost previews its embedded original; the verb still reads "Reposted".
 */
function PreviewRow({ post, first }: { post: HydratedFeedItem; first: boolean }) {
  const t = useTranslations('connect.profile.activity');
  const format = useFormatter();

  const isRepost = Boolean(post.repostOf);
  const content = post.original ?? post;
  const verb = isRepost
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

  const body = (post.body.trim() || content.body.trim()).replace(/\s+/g, ' ');
  const thumb = content.kind === 'photo' ? content.media[0]?.url : undefined;

  return (
    <li>
      <Link
        href={`/connect/posts/${post._id}`}
        className={`flex items-start gap-3 py-2.5 no-underline transition-colors hover:bg-surface-2 ${
          first ? '' : 'border-t'
        }`}
        style={first ? undefined : { borderColor: 'var(--cr-border-light)' }}
      >
        <div className="min-w-0 flex-1">
          <div
            className="flex items-center gap-1.5 text-[12.5px] font-semibold"
            style={{ color: 'var(--cr-text-4)' }}
          >
            <span style={{ color: 'var(--cr-text-3)' }}>{verb}</span>
            <span aria-hidden>·</span>
            <span>{format.relativeTime(new Date(post.createdAt))}</span>
          </div>
          {body && (
            <p
              className="m-0 mt-0.5 text-[14px]"
              style={{
                color: 'var(--cr-text-2)',
                lineHeight: 1.45,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {body}
            </p>
          )}
        </div>

        {thumb && (
          <div
            className="overflow-hidden rounded-md"
            style={{ width: 52, height: 52, flexShrink: 0 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 asset */}
            <img
              src={thumb}
              alt={t('previewMedia')}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        )}
      </Link>
    </li>
  );
}
