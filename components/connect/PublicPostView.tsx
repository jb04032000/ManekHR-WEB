/**
 * PublicPostView - a read-only, provider-free render of a single post.
 *
 * The interactive `PostCard` depends on the Ant `App` / TanStack Query / socket
 * providers that only exist inside the authenticated Connect shell, so it
 * cannot mount on the logged-out public permalink (`/p/[id]`). This component
 * is the public mirror: a Server Component (zero client JS) that renders the
 * post's content - author, body, media, tags, view count - with no reaction /
 * comment / realtime affordances. Conversion back into the app is the page's
 * job (the Join-Connect CTA), not this renderer's.
 */

import { FileText } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import ConnectAvatar from './ConnectAvatar';
import TrustBadgeRow from './TrustBadgeRow';
// Per-item "Sample" disclosure pill on seeded demo content (post.isDemo). Mirrors
// PostCard's marker so the public permalink also discloses sample posts.
import SampleBadge from './SampleBadge';
// Renders @mentions as clickable chips (client island inside this Server
// Component). Shared with PostCard, PostComments, ActivityCommentList.
import MentionText from './MentionText';
import type { HydratedFeedItem } from '@/features/connect/feed.types';

/** Clip duration seconds -> `m:ss`. */
function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function PublicPostView({ post }: { post: HydratedFeedItem }) {
  const t = useTranslations('connect.feed.post');
  const format = useFormatter();
  const authorName = post.author?.name ?? t('fallbackAuthor');

  return (
    <article
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px 0' }}>
        {/* ConnectAvatar adds the author's "open to" ring/dot; status null =>
            bare DsAvatar (unchanged). openStatus is hydrated on post.author via
            getPeople (PersonRef.openStatus). ConnectAvatar is a client island
            inside this Server Component, which is fine. */}
        <ConnectAvatar
          name={authorName}
          src={post.author?.avatar ?? undefined}
          size={44}
          status={post.author?.openStatus ?? null}
        />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--cr-text)' }}>
              {authorName}
            </span>
            {post.authorErpLinked && <TrustBadgeRow badges={['erp']} max={1} size="sm" />}
            {post.isDemo && <SampleBadge size="sm" />}
          </div>
          <div style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>
            {post.author?.headline ? `${post.author.headline} · ` : ''}
            {format.relativeTime(new Date(post.createdAt))}
          </div>
        </div>
      </div>

      {/* Body */}
      {post.body.trim() && (
        <p
          style={{
            margin: '12px 16px 0',
            fontSize: 15,
            lineHeight: 1.6,
            color: 'var(--cr-text-2)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <MentionText text={post.body} mentions={post.mentions} />
        </p>
      )}

      {/* Media */}
      {post.kind === 'voice' && post.audio ? (
        <div style={{ margin: '12px 16px 0' }}>
          <audio
            controls
            // Hide the native controls download button. Attribute-only (Server
            // Component -> no onContextMenu handler).
            controlsList="nodownload"
            src={post.audio.url}
            style={{ width: '100%', height: 54 }}
            aria-label={t('voiceLabel', { duration: formatDuration(post.audio.durationSec) })}
          />
          {post.audio.transcript && (
            <div
              style={{
                marginTop: 8,
                padding: 10,
                background: 'var(--cr-surface-2)',
                borderRadius: 'var(--cr-radius-md)',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--cr-text-3)',
              }}
            >
              <span style={{ fontWeight: 600 }}>{t('transcript')}</span> {post.audio.transcript}
            </div>
          )}
        </div>
      ) : post.kind === 'video' && post.media[0] ? (
        <div style={{ margin: '12px 0 0' }}>
          <video
            controls
            // Hide the native download button + PiP. Attribute-only (no
            // onContextMenu): this is a Server Component, so it cannot carry
            // event handlers. Mirrors the client players' noDownloadVideoProps.
            controlsList="nodownload"
            disablePictureInPicture
            src={post.media[0].url}
            style={{ width: '100%', maxHeight: 460, background: '#000' }}
          />
        </div>
      ) : post.kind === 'document' && post.media.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '12px 16px 0' }}>
          {post.media.map((doc, i) => (
            <a
              key={`${doc.url}-${i}`}
              href={doc.url}
              target="_blank"
              rel="noopener noreferrer"
              className="no-underline"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                border: '1px solid var(--cr-border)',
                borderRadius: 'var(--cr-radius-md)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--cr-text-2)',
              }}
            >
              <FileText size={16} aria-hidden />
              {doc.caption?.trim() || t('documentLabel')}
            </a>
          ))}
        </div>
      ) : post.kind === 'photo' && post.media.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: post.media.length === 1 ? '1fr' : '1fr 1fr',
            gap: 2,
            marginTop: 12,
          }}
        >
          {post.media.slice(0, 4).map((item, i) => (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded R2 asset; next/image adds no optimisation here
            <img
              key={`${item.url}-${i}`}
              src={item.url}
              alt={item.caption?.trim() || t('imageAlt')}
              loading="lazy"
              // Discourage save: block drag-save (attribute) + the iOS long-press
              // "Save Image" callout (CSS). Attribute/CSS-only because this is a
              // Server Component (no onContextMenu handler for desktop right-click,
              // unlike the client-side noDownloadImageProps).
              draggable={false}
              style={{
                display: 'block',
                width: '100%',
                aspectRatio: post.media.length === 1 ? '16 / 10' : '1 / 1',
                objectFit: 'cover',
                WebkitTouchCallout: 'none',
              }}
            />
          ))}
        </div>
      ) : null}

      {/* Hashtag + intent pills */}
      {(post.hashtags.length > 0 || post.tags.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, margin: '12px 16px 0' }}>
          {post.hashtags.map((tag) => (
            <span
              key={`h-${tag}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--cr-primary)',
                background: 'var(--cr-wash-indigo)',
                padding: '3px 9px',
                borderRadius: 'var(--cr-radius-full)',
              }}
            >
              #{tag}
            </span>
          ))}
          {post.tags.map((tag) => (
            <span
              key={`t-${tag}`}
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--cr-text-4)',
                background: 'var(--cr-surface-2)',
                padding: '3px 9px',
                borderRadius: 'var(--cr-radius-full)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* No view count here. View counts are author-only (LinkedIn model) and the
          author sees them on their own PostCard; this provider-free mirror serves
          the logged-out permalink + repost embeds, where a count must never show.
          Keep in sync with PostCard's `isOwnPost`-gated chip. */}

      <div style={{ height: 16 }} />
    </article>
  );
}
