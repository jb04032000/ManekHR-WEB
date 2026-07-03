'use client';

/**
 * PostComments - the comment thread under a feed post (Phase 3 - Feed, F7).
 *
 * `useInfiniteQuery` loads the thread one keyset page at a time (same data layer
 * as `FeedList`); top-level comments are newest-first and a "View more comments"
 * button appends the next (older) page. One level of replies; the viewer can add
 * a comment or reply and delete their own. After any write the loaded pages
 * re-fetch - keeps author hydration + counts correct. Live count merge arrives
 * with Socket.IO in Wave 5. Pages come from `listComments` -> backend keyset
 * envelope (`common/keyset-cursor`).
 */

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App as AntApp } from 'antd';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useFormatter, useTranslations } from 'next-intl';
import { Trash2 } from 'lucide-react';
import ConnectAvatar from '@/components/connect/ConnectAvatar';
import DsButton from '@/components/ui/DsButton';
import useAnnouncer from '@/components/connect/useAnnouncer';
// Renders @mentions in a comment body as clickable chips. Shared renderer used
// by PostCard, PublicPostView, ActivityCommentList.
import MentionText from '@/components/connect/MentionText';
// The @-typeahead comment input - tags people / pages / shops into a comment.
import MentionTextArea, { type PickedMention } from '@/components/connect/MentionTextArea';
import { addComment, deleteComment, listComments } from '../feed.actions';
// @mention picker analytics (entity type + surface only, no PII).
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import type { HydratedComment, HydratedCommentsPage } from '../feed.types';

interface PostCommentsProps {
  postId: string;
  /** The signed-in viewer - drives which comments show a Delete control. */
  viewerId: string;
  /** Whether the viewer has completed Connect onboarding. When false, write
   *  actions (add comment, reply) redirect to `/connect/onboarding`. */
  onboarded: boolean;
}

export default function PostComments({ postId, viewerId, onboarded }: PostCommentsProps) {
  const t = useTranslations('connect.feed.comments');
  const format = useFormatter();
  const router = useRouter();
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();
  const [replyTo, setReplyTo] = useState<string | null>(null);

  const { data, isPending, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['connect-post-comments', postId],
      queryFn: async ({ pageParam }) => {
        const res = await listComments(postId, pageParam);
        if (!res.ok) throw new Error(res.error);
        return res.data;
      },
      initialPageParam: undefined as string | undefined,
      getNextPageParam: (last: HydratedCommentsPage) => last.nextCursor ?? undefined,
    });

  // Flatten the loaded keyset pages back into the flat list the thread renders
  // (each page = its top-level comments newest-first + their replies).
  const comments = useMemo<HydratedComment[]>(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  );

  const submit = useCallback(
    async (body: string, mentions: PickedMention[], parentId?: string): Promise<boolean> => {
      if (!onboarded) {
        router.push('/connect/onboarding');
        return false;
      }
      // Thread the tagged @mentions through to the write action; empty -> omit so
      // the payload stays clean (addComment treats undefined as "no mentions").
      const res = await addComment(postId, body, parentId, mentions.length ? mentions : undefined);
      if (!res.ok) {
        const msg = res.error || t('sendError');
        message.error(msg);
        announce(msg, { assertive: true });
        return false;
      }
      setReplyTo(null);
      await refetch();
      return true;
    },
    [onboarded, router, postId, message, t, refetch, announce],
  );

  const remove = useCallback(
    async (commentId: string) => {
      const res = await deleteComment(commentId);
      if (!res.ok) {
        const msg = res.error || t('deleteError');
        message.error(msg);
        announce(msg, { assertive: true });
        return;
      }
      await refetch();
    },
    [message, t, refetch, announce],
  );

  if (isPending) {
    return <p style={threadNote}>{t('loading')}</p>;
  }
  if (isError) {
    return (
      <div style={{ ...threadNote, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{t('loadError')}</span>
        <DsButton dsVariant="ghost" dsSize="sm" onClick={() => void refetch()}>
          {t('retry')}
        </DsButton>
      </div>
    );
  }

  const topLevel = comments.filter((c) => c.parentId === null);

  const renderComment = (comment: HydratedComment, isReply: boolean) => {
    const name = comment.author?.name ?? t('fallbackAuthor');
    return (
      <div
        key={comment._id}
        style={{ display: 'flex', gap: 8, marginInlineStart: isReply ? 36 : 0 }}
      >
        <Link href={`/connect/u/${comment.authorId}`} aria-label={name} className="no-underline">
          {/* ConnectAvatar adds the comment author's "open to" ring/dot; status
              null => bare DsAvatar (unchanged). openStatus is hydrated on
              comment.author via getPeople (PersonRef.openStatus). */}
          <ConnectAvatar
            name={name}
            src={comment.author?.avatar ?? undefined}
            size={isReply ? 26 : 30}
            status={comment.author?.openStatus ?? null}
          />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              background: 'var(--cr-surface-2)',
              borderRadius: 'var(--cr-radius-md)',
              padding: '8px 11px',
            }}
          >
            <Link
              href={`/connect/u/${comment.authorId}`}
              className="no-underline"
              style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--cr-text)' }}
            >
              {name}
            </Link>
            <p
              style={{
                margin: '2px 0 0',
                fontSize: 13,
                lineHeight: 1.5,
                color: 'var(--cr-text-2)',
              }}
            >
              <MentionText text={comment.body} mentions={comment.mentions} />
            </p>
          </div>
          <div style={{ display: 'flex', gap: 12, padding: '4px 4px 0', fontSize: 11 }}>
            <span style={{ color: 'var(--cr-text-4)' }}>
              {format.relativeTime(new Date(comment.createdAt))}
            </span>
            {!isReply && (
              <button
                type="button"
                onClick={() => {
                  if (!onboarded) {
                    router.push('/connect/onboarding');
                    return;
                  }
                  setReplyTo(comment._id);
                }}
                style={linkBtn}
              >
                {t('reply')}
              </button>
            )}
            {comment.authorId === viewerId && (
              <button
                type="button"
                onClick={() => void remove(comment._id)}
                style={{ ...linkBtn, color: 'var(--cr-error)' }}
              >
                <Trash2 size={11} aria-hidden /> {t('delete')}
              </button>
            )}
          </div>
          {replyTo === comment._id && (
            <div style={{ marginTop: 6 }}>
              <CommentBox
                placeholder={t('replyPlaceholder')}
                onSubmit={(b, m) => submit(b, m, comment._id)}
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 16px 4px' }}>
      {announcer}
      <CommentBox placeholder={t('placeholder')} onSubmit={(b, m) => submit(b, m)} />

      {topLevel.length === 0 ? (
        <p style={threadNote}>{t('empty')}</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {topLevel.map((comment) => {
            const replies = comments.filter((c) => c.parentId === comment._id);
            const hasReplies = replies.length > 0;
            return (
              <div key={comment._id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Parent row. When it has replies, drop a thread spine out of the
                    bottom of the avatar so the parent<->reply link reads at a glance
                    (was ambiguous before - replies only had an indent). */}
                <div style={{ position: 'relative' }}>
                  {hasReplies && <span style={threadSpineParent} aria-hidden />}
                  {renderComment(comment, false)}
                </div>
                {replies.map((reply, i) => (
                  <div key={reply._id} style={{ position: 'relative' }}>
                    {/* Rounded elbow curving the spine across the gutter into this
                        reply's avatar. */}
                    <span style={threadElbow} aria-hidden />
                    {/* Spine carries on to the next reply - skipped after the last
                        one so the line stops at the final reply's elbow. */}
                    {i < replies.length - 1 && <span style={threadSpineReply} aria-hidden />}
                    {renderComment(reply, true)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Load-more: append the next (older) page of top-level comments. Mirrors
          FeedList's getNextPageParam, with a button trigger instead of scroll. */}
      {hasNextPage && (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          loading={isFetchingNextPage}
          onClick={() => void fetchNextPage()}
          style={{ alignSelf: 'flex-start' }}
        >
          {isFetchingNextPage ? t('loadingMore') : t('viewMore')}
        </DsButton>
      )}
    </div>
  );
}

/** A comment / reply input - an @-typeahead textarea + a Post button. Tracks the
 *  tagged @mentions alongside the body and hands both to `onSubmit`; clears both
 *  on success. Mentions reconcile atomically inside MentionTextArea. */
function CommentBox({
  placeholder,
  onSubmit,
}: {
  placeholder: string;
  onSubmit: (body: string, mentions: PickedMention[]) => Promise<boolean>;
}) {
  const t = useTranslations('connect.feed.comments');
  const [body, setBody] = useState('');
  const [mentions, setMentions] = useState<PickedMention[]>([]);
  const [busy, setBusy] = useState(false);

  const send = useCallback(async () => {
    const trimmed = body.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    const ok = await onSubmit(trimmed, mentions);
    setBusy(false);
    if (ok) {
      setBody('');
      setMentions([]);
    }
  }, [body, mentions, busy, onSubmit]);

  return (
    <div style={{ display: 'flex', gap: 6 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MentionTextArea
          value={body}
          mentions={mentions}
          onChange={(v, m) => {
            setBody(v);
            setMentions(m);
          }}
          placeholder={placeholder}
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={1000}
          aria-label={placeholder}
          onPickerOpen={() => trackEvent(ConnectEvents.mentionPickerOpened, { surface: 'comment' })}
          onMentionAdd={(m) =>
            trackEvent(ConnectEvents.mentionAdded, { entity: m.type, surface: 'comment' })
          }
        />
      </div>
      <DsButton
        dsVariant="primary"
        dsSize="sm"
        loading={busy}
        disabled={!body.trim()}
        onClick={send}
      >
        {t('post')}
      </DsButton>
    </div>
  );
}

const threadNote: React.CSSProperties = {
  margin: 0,
  padding: '12px 16px',
  fontSize: 12.5,
  color: 'var(--cr-text-4)',
};

/* Comment thread connector (parent <-> reply link line).
 * Pure-CSS spine + elbow drawn in the empty left gutter, so the line stays
 * continuous however many lines a comment body wraps and however many replies
 * a comment has. Geometry is tied to the avatar sizes/indent in renderComment -
 * keep in sync if those change: parent avatar 30 (center x15), reply avatar 26
 * at indent 36 (avatar left edge x36, center y13). Spine sits at x15; reply body
 * starts at x>=36 so nothing overlaps. Lines are decorative -> aria-hidden +
 * pointer-events:none. */
const THREAD_COLOR = 'var(--cr-border-strong)';

// Vertical line dropping from the PARENT avatar's bottom, across the 10px column
// gap (bottom:-10), into the first reply's elbow.
const threadSpineParent: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: 30, // parent avatar bottom (size 30, sits at row top)
  bottom: -10, // bridge the flex column gap to the first reply row
  width: 2,
  background: THREAD_COLOR,
  pointerEvents: 'none',
};

// Spine continuing from one reply down to the NEXT reply. Starts at this reply's
// avatar center; rendered only when another reply follows.
const threadSpineReply: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: 13, // reply avatar center (size 26)
  bottom: -10,
  width: 2,
  background: THREAD_COLOR,
  pointerEvents: 'none',
};

// Rounded elbow: vertical down the gutter then a curved turn into the reply
// avatar (left/bottom borders + bottom-left radius). Width 22 = x14 -> x36 edge.
const threadElbow: React.CSSProperties = {
  position: 'absolute',
  left: 14,
  top: 0,
  width: 22,
  height: 13, // down to the reply avatar center
  borderLeft: `2px solid ${THREAD_COLOR}`,
  borderBottom: `2px solid ${THREAD_COLOR}`,
  borderBottomLeftRadius: 8,
  pointerEvents: 'none',
};

const linkBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  background: 'transparent',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--cr-text-4)',
};
