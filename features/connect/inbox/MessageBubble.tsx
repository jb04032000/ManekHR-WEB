'use client';

/**
 * MessageBubble -- one message in the conversation log (Phase 7, I3b).
 *
 * Memoized: a long log only re-renders the rows whose props changed. Three
 * shapes: a centered system notice (no sender), a left "them" bubble, and a
 * right "me" bubble. Text keeps newlines; a photo renders its images; a voice
 * note renders a native audio player with a labelled control. An optimistic
 * (unsent) own message shows a "sending" hint until the server row reconciles.
 *
 * Meta (time + sent tick) sits INSIDE the bubble at the bottom-right (WhatsApp
 * style). For text it floats over the last line via a fixed-width spacer that
 * reserves room so the meta never overlaps the words; media-only bubbles drop
 * the meta onto a tight trailing line. Grouping (firstOfGroup/lastOfGroup, set
 * by UnifiedConversationPane) only controls the tail corner + top gap so a run
 * of same-sender messages stacks tightly. Keep the reserve widths roughly in
 * sync with the meta font size if either changes.
 */

import { memo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Image as ImageIcon, Mic } from 'lucide-react';
import { Image as AntImage } from 'antd';
import type { InboxMessage } from './inbox.types';
import { isPendingMessage } from './inbox-compose';
// Shared "discourage download" props (right-click + drag guard) for member media.
import { noDownloadAudioProps, noDownloadImageProps } from '@/lib/connect/media-guard';

/**
 * One chat photo. Shows a soft placeholder while loading and NEVER collapses to
 * the browser's broken-image glyph: a freshly-uploaded remote url is not
 * scan-ready for a moment, so on error it keeps a neutral fallback box. The
 * pending optimistic row passes a local blob preview (see UnifiedConversationPane
 * / InboxMessageMedia.localPreviewUrl) so the sender sees the real image instantly
 * while it sends. Remount on url change (key) naturally retries once confirmed.
 *
 * Once loaded, a click opens the AntD full-screen preview lightbox (zoom / rotate
 * / keyboard, focus-trapped) via a hidden, controlled `<Image>` - the same viewer
 * the Connect feed uses (see components/connect/PostCard PostPhotoGrid). We keep
 * the custom `<img>` for inline display to preserve the pending/retry behavior and
 * drive the lightbox off a separate controlled Image; keep the two `src` in sync.
 */
function ChatImage({ src, alt }: { src: string; alt: string }) {
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [previewOpen, setPreviewOpen] = useState(false);
  const canOpen = status === 'loaded';
  return (
    <div
      role={canOpen ? 'button' : undefined}
      tabIndex={canOpen ? 0 : undefined}
      aria-label={canOpen ? alt : undefined}
      onClick={canOpen ? () => setPreviewOpen(true) : undefined}
      onKeyDown={
        canOpen
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setPreviewOpen(true);
              }
            }
          : undefined
      }
      style={{
        position: 'relative',
        borderRadius: 'var(--cr-radius-md)',
        overflow: 'hidden',
        background: 'var(--cr-surface-2)',
        minWidth: status === 'loaded' ? undefined : 150,
        minHeight: status === 'loaded' ? undefined : 110,
        cursor: canOpen ? 'pointer' : undefined,
      }}
    >
      {status !== 'loaded' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            placeItems: 'center',
            color: 'var(--cr-text-4)',
          }}
        >
          <ImageIcon size={26} aria-hidden />
        </div>
      )}
      {status !== 'error' && (
        // eslint-disable-next-line @next/next/no-img-element -- user chat photo; next/image adds no value for a remote/blob url
        <img
          src={src}
          alt={alt}
          onLoad={() => setStatus('loaded')}
          onError={() => setStatus('error')}
          // Block right-click "Save image as" + drag-save on the chat photo.
          {...noDownloadImageProps}
          style={{
            display: 'block',
            maxWidth: '100%',
            maxHeight: 280,
            objectFit: 'cover',
            opacity: status === 'loaded' ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}
      {/* Hidden, lightbox-only: the browser reuses the already-cached inline image,
          so this adds no extra fetch. Controlled so the click above opens it. */}
      {canOpen && (
        <AntImage
          src={src}
          alt={alt}
          style={{ display: 'none' }}
          styles={{ root: { display: 'none' } }}
          // Block right-click "Save image as" + drag-save in the lightbox.
          {...noDownloadImageProps}
          preview={{ open: previewOpen, src, onOpenChange: (v) => setPreviewOpen(v) }}
        />
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: InboxMessage;
  viewerId: string;
  /** First bubble of a same-sender run -> extra top gap. */
  firstOfGroup?: boolean;
  /** Last bubble of a same-sender run -> tail corner + timestamp/tick. */
  lastOfGroup?: boolean;
  /** My sent message has been read by the other party -> blue double-tick.
   *  Computed by UnifiedConversationPane from the thread's otherLastReadSeq. */
  read?: boolean;
}

/** Seconds -> `m:ss`. */
function formatDuration(totalSeconds: number | null): string {
  const s = Math.max(0, Math.round(totalSeconds ?? 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function MessageBubbleImpl({
  message,
  viewerId,
  firstOfGroup = true,
  lastOfGroup = true,
  read = false,
}: MessageBubbleProps) {
  const t = useTranslations('connect.inbox');
  const locale = useLocale();

  const time = (() => {
    const d = new Date(message.createdAt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  })();

  // System channel: a centered, read-only platform notice (no bubble chrome).
  if (message.kind === 'system' || message.senderUserId === null) {
    return (
      <div
        style={{
          alignSelf: 'center',
          maxWidth: '90%',
          margin: '4px 0',
          padding: '8px 14px',
          borderRadius: 'var(--cr-radius-md)',
          background: 'var(--cr-surface-2)',
          color: 'var(--cr-text-3)',
          fontSize: 12.5,
          lineHeight: 1.5,
          textAlign: 'center',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {message.body}
        {time && (
          <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: 'var(--cr-text-4)' }}>
            {time}
          </span>
        )}
      </div>
    );
  }

  const mine = message.senderUserId === viewerId;
  const pending = mine && isPendingMessage(message);
  const hasText = message.body.trim().length > 0;
  // The last bubble of a same-sender run gets a sharp "tail" corner on the
  // sender's side; grouped bubbles keep fully-rounded corners.
  const R = 18;
  const bubbleRadius = mine
    ? `${R}px ${R}px ${lastOfGroup ? 6 : R}px ${R}px`
    : `${R}px ${R}px ${R}px ${lastOfGroup ? 6 : R}px`;

  // Time + tick, shown inside every bubble. Muted to recede from the message.
  // Both bubbles are light now (own = soft indigo, theirs = white), so the meta
  // is a muted grey on both -- own a touch darker for the indigo tint.
  const metaColor = mine ? 'var(--cr-text-3)' : 'var(--cr-text-4)';
  // Horizontal room reserved on the last text line for the absolutely-placed
  // meta, so the time never crowds the words. Sized per state -- "read" carries
  // the wider double-tick; erring large just pins the meta further right (the
  // safe direction). Keep above the real meta width incl. wider-digit locales.
  const metaReserve = !mine ? 58 : read ? 86 : 78;
  // Read receipt: single muted tick = sent, blue double-tick = read by the other
  // party (a strong blue that reads clearly on the light indigo own-bubble).
  const metaInner = (
    <>
      {pending ? t('bubble.sending') : time}
      {mine && !pending && (
        <span
          role="img"
          aria-label={read ? t('bubble.read') : t('bubble.sent')}
          style={{ display: 'inline-flex', flexShrink: 0, color: read ? '#2563eb' : 'inherit' }}
        >
          {read ? (
            <svg
              viewBox="0 0 22 16"
              width="19"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m1 8 4 4 8-9" />
              <path d="m8 8 4 4 8-9" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 16"
              width="15"
              height="11"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="m2 8 4 4 8-9" />
            </svg>
          )}
        </span>
      )}
    </>
  );

  return (
    <div
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: 'min(82%, 520px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: mine ? 'flex-end' : 'flex-start',
        marginTop: firstOfGroup ? 10 : 2,
      }}
    >
      <div
        style={{
          position: 'relative',
          padding: message.kind === 'photo' ? 4 : '7px 11px',
          borderRadius: bubbleRadius,
          background: mine ? 'var(--cr-indigo-100)' : 'var(--cr-surface)',
          color: mine ? 'var(--cr-indigo-800)' : 'var(--cr-text)',
          border: mine ? 'none' : '1px solid var(--cr-border-light)',
          boxShadow: '0 1px 1.5px rgba(40, 30, 10, 0.06)',
          opacity: pending ? 0.75 : 1,
          fontSize: 14.5,
          lineHeight: 1.4,
          wordBreak: 'break-word',
          overflow: 'hidden',
        }}
      >
        {message.kind === 'photo' && message.media.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 320 }}>
            {message.media.map((m, i) => (
              <ChatImage
                key={`${m.url}-${i}`}
                // While pending, prefer the local blob preview (the remote url is
                // not scan-ready yet) so "Sending..." shows the real photo.
                src={pending && m.localPreviewUrl ? m.localPreviewUrl : m.url}
                alt={t('bubble.photoAlt')}
              />
            ))}
          </div>
        )}

        {message.kind === 'voice' && message.audioUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
              <Mic size={15} aria-hidden />
              {t('bubble.voiceNote')}
              {message.audioDurationSec ? (
                <span style={{ fontWeight: 400, opacity: 0.85 }}>
                  {formatDuration(message.audioDurationSec)}
                </span>
              ) : null}
            </span>
            <audio
              controls
              // Hide the native download button + block right-click save on the
              // voice note. Shared with every Connect media player.
              {...noDownloadAudioProps}
              src={message.audioUrl}
              aria-label={t('bubble.voiceNote')}
              style={{ width: '100%', height: 34 }}
            />
          </div>
        )}

        {hasText && (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              marginTop: message.kind === 'photo' || message.kind === 'voice' ? 6 : 0,
              padding: message.kind === 'photo' ? '0 6px 2px' : 0,
            }}
          >
            {message.body}
            {/* Reserve room on the last line so the absolutely-placed meta below
                never crowds the words (see metaReserve). */}
            <span aria-hidden style={{ display: 'inline-block', width: metaReserve }} />
          </div>
        )}

        {hasText ? (
          <span
            style={{
              position: 'absolute',
              right: message.kind === 'photo' ? 12 : 11,
              bottom: message.kind === 'photo' ? 8 : 6,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
              fontSize: 10.5,
              lineHeight: 1,
              whiteSpace: 'nowrap',
              color: metaColor,
              userSelect: 'none',
            }}
          >
            {metaInner}
          </span>
        ) : (
          <span
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: 3,
              marginTop: 4,
              paddingRight: message.kind === 'photo' ? 6 : 0,
              fontSize: 10.5,
              lineHeight: 1,
              color: metaColor,
              userSelect: 'none',
            }}
          >
            {metaInner}
          </span>
        )}
      </div>
    </div>
  );
}

const MessageBubble = memo(MessageBubbleImpl);
export default MessageBubble;
