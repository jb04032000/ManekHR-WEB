'use client';

/**
 * UnifiedConversationPane -- the per-person conversation (the only inbox chat
 * now): ALL of the pair's subjects (job applications / inquiries / quotes) show
 * up as INLINE context cards interleaved with chat messages, in one time-ordered
 * stream. Replaces the legacy per-thread ConversationPane + pinned card.
 *
 * Data: one `getPersonTimeline(otherUserId)` query (the BE merges the pair's
 * threads). Sends (text / photo / voice) go to the active-subject thread, or the
 * DM lane by default (created lazily). Realtime: the inbox socket fires
 * INBOX_CHANGED_EVENT on every incoming message -> we refetch the timeline.
 *
 * Cross-module: ContextCardInline (reuses ContextCard) for context items,
 * MessageBubble for messages; uploads via uploadService (connect-inbox-media);
 * block/report reuse blockInboxUser / reportInboxThread + ReportDialog. Watch:
 * per-thread mark-read (one call per visible thread), not one global call.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dropdown, Modal, message as antdMessage } from 'antd';
import { ArrowLeft, ImagePlus, Mic, MoreVertical, SendHorizontal, X } from 'lucide-react';
import { DsAvatar } from '@/components/ui';
import useAnnouncer from '@/components/connect/useAnnouncer';
import VoiceNoteRecorder from '@/components/connect/VoiceNoteRecorder';
import { uploadService } from '@/lib/services/upload.service';
import { getUploadPolicy } from '@/lib/upload-policies.helpers';
import {
  blockInboxUser,
  getPersonTimeline,
  markInboxRead,
  reportInboxThread,
  sendInboxMessage,
  startInboxDm,
} from './inbox.actions';
import { clearThreadUnread, inboxKeys } from './inbox-cache';
import {
  appendOptimisticToTimeline,
  makeOptimisticMessage,
  removeOptimisticFromTimeline,
} from './inbox-compose';
import { messageDayBucket } from './inbox-format';
import { INBOX_CHANGED_EVENT } from './useInboxBadge';
import MessageBubble from './MessageBubble';
// "Sample" disclosure pill in the conversation header for a seeded demo party.
import SampleBadge from '@/components/connect/SampleBadge';
import ContextCardInline from './ContextCardInline';
import ReportDialog from './ReportDialog';
import type {
  InboxReportReason,
  InboxThread,
  PersonTimeline,
  PersonTimelineItem,
  SendMessageInput,
} from './inbox.types';

interface UnifiedConversationPaneProps {
  otherUserId: string;
  viewerId: string;
  onBack: () => void;
}

// The inbox photo picker offers ONLY the image types the `connect-inbox-media`
// upload policy allows (jpeg/png/webp) -- no video / audio / other files. Derived
// from the policy (not a hardcoded list) so it stays in sync; uploadService then
// compresses (webp, <=1920px) + size/mime pre-checks, and the BE re-validates.
const INBOX_PHOTO_ACCEPT = getUploadPolicy('connect-inbox-media')
  .mimeTypes.filter((m) => m.startsWith('image/'))
  .join(',');

/** A client message id, with a fallback for environments lacking `randomUUID`. */
function genClientMsgId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `cmid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** A stable `YYYY-MM-DD` bucket key for the day-separator comparison. */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toISOString().slice(0, 10);
}

/** True when two adjacent timeline items are both messages from the same (real,
 *  non-system) sender -- used to stack a run tightly with one tail at the end. */
function isSameSenderRun(
  a: PersonTimelineItem | undefined,
  b: PersonTimelineItem | undefined,
): boolean {
  return (
    a?.type === 'message' &&
    b?.type === 'message' &&
    a.message.senderUserId !== null &&
    a.message.senderUserId === b.message.senderUserId
  );
}

export default function UnifiedConversationPane({
  otherUserId,
  viewerId,
  onBack,
}: UnifiedConversationPaneProps) {
  const t = useTranslations('connect.inbox');
  const queryClient = useQueryClient();
  const { announce, announcer } = useAnnouncer();
  const [toast, toastCtx] = antdMessage.useMessage();
  const [modal, modalCtx] = Modal.useModal();
  const [now] = useState(() => Date.now());
  const [reportOpen, setReportOpen] = useState(false);
  const [reporting, setReporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: inboxKeys.person(otherUserId),
    queryFn: async () => {
      const res = await getPersonTimeline(otherUserId);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    staleTime: 30_000,
  });

  const timeline: PersonTimeline = useMemo(
    () => data ?? { party: null, items: [], threads: [] },
    [data],
  );
  const party = timeline.party;
  const partyName = party?.name ?? t('list.unknownParty');
  const profileHref = party?.userId ? `/connect/u/${party.userId}` : null;

  // Per-thread read watermark of the OTHER party -> drives my sent-message read
  // receipts (blue double-tick). Live-bumped by the inbox:read socket event via
  // applyReadReceipt in InboxProvider.
  const otherReadSeqByThread = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of timeline.threads) m.set(c.threadId, c.otherLastReadSeq);
    return m;
  }, [timeline.threads]);

  // Mark every visible thread read on (re)load -- unread is per underlying thread.
  // Also zero each thread's unread in the thread-list cache so the left-pane row
  // badge clears immediately: that list query is staleTime:Infinity / never
  // refetches, so without this local cache write the "N unread" badge would stick
  // until a full reload even though the server is now marked read.
  useEffect(() => {
    let touched = false;
    for (const c of timeline.threads) {
      if (c.newestSeq > 0) {
        void markInboxRead(c.threadId, c.newestSeq);
        queryClient.setQueryData<InboxThread[]>(inboxKeys.threads('all'), (old) =>
          clearThreadUnread(old, c.threadId),
        );
        touched = true;
      }
    }
    if (touched && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(INBOX_CHANGED_EVENT));
    }
  }, [timeline.threads, queryClient]);

  // Refetch on a realtime nudge (the socket fires this on every incoming message).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = () => void refetch();
    window.addEventListener(INBOX_CHANGED_EVENT, handler);
    return () => window.removeEventListener(INBOX_CHANGED_EVENT, handler);
  }, [refetch]);

  // Jump to the latest item on first render / on new items.
  const logRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline.items.length]);

  // Replies go to the plain chat (DM) lane, created lazily on first send. The
  // subject cards above stay the record of each job / inquiry / quote.
  const dmThreadId = timeline.threads.find((c) => c.channelType === 'dm')?.threadId ?? null;

  // Resolve the target thread + send. Returns true on success (the composer
  // clears) or false (the composer restores the draft).
  //
  // Optimistic echo (Approach A): drop the line into the person-timeline cache
  // instantly with a pending state so the sender sees it (faded + "Sending...")
  // with no round-trip; the success refetch then reconciles it to the server row
  // (which carries the tick). A failure removes the echo and restores the draft.
  // Mirrors the optimistic core in inbox-compose (built for the legacy per-thread
  // pane); the unified pane needs the PersonTimeline variant.
  const onSend = useCallback(
    async (input: SendMessageInput, localPreviews?: string[]): Promise<boolean> => {
      const personKey = inboxKeys.person(otherUserId);
      const echo = makeOptimisticMessage({
        threadId: dmThreadId ?? 'pending-dm',
        senderUserId: viewerId,
        clientMsgId: input.clientMsgId,
        body: input.body ?? '',
        media: input.media?.map((m, i) => ({
          url: m.url,
          mime: m.mime,
          width: m.width ?? null,
          height: m.height ?? null,
          scanStatus: 'pending' as const,
          // Echo-only local blob so the sender sees the real photo while it
          // sends (remote url is not scan-ready yet). Aligned to media index.
          ...(localPreviews?.[i] ? { localPreviewUrl: localPreviews[i] } : {}),
        })),
        audioUrl: input.audioUrl ?? null,
        audioDurationSec: input.audioDurationSec ?? null,
        createdAt: new Date().toISOString(),
      });
      queryClient.setQueryData<PersonTimeline>(personKey, (old) =>
        old ? appendOptimisticToTimeline(old, echo) : old,
      );

      const rollback = (error?: string) => {
        queryClient.setQueryData<PersonTimeline>(personKey, (old) =>
          old ? removeOptimisticFromTimeline(old, input.clientMsgId) : old,
        );
        toast.error(error || t('composer.sendFailed'));
        announce(t('composer.sendFailed'), { assertive: true });
      };

      let target = dmThreadId;
      if (!target) {
        const created = await startInboxDm(otherUserId);
        if (!created.ok) {
          rollback(created.error);
          return false;
        }
        target = created.data._id;
      }
      const res = await sendInboxMessage(target, input);
      if (res.ok) {
        await refetch();
        return true;
      }
      rollback(res.error);
      return false;
    },
    [dmThreadId, otherUserId, viewerId, queryClient, refetch, toast, announce, t],
  );

  // ── Block / report (per person; report targets the most-recent thread) ──────
  const reportThreadId = timeline.threads[0]?.threadId ?? null;
  const doBlock = useCallback(() => {
    if (!party?.userId) return;
    void modal.confirm({
      title: t('block.title', { name: partyName }),
      content: t('block.body'),
      okText: t('block.confirm'),
      cancelText: t('block.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await blockInboxUser(party.userId);
        if (res.ok) {
          toast.success(t('block.blocked', { name: partyName }));
          onBack();
        } else {
          toast.error(res.error || t('block.failed'));
        }
      },
    });
  }, [party?.userId, partyName, modal, t, toast, onBack]);

  const doReport = useCallback(
    async (reason: InboxReportReason, detail: string) => {
      if (!reportThreadId) return;
      setReporting(true);
      try {
        const res = await reportInboxThread(reportThreadId, reason, detail || undefined);
        if (res.ok) {
          setReportOpen(false);
          toast.success(t('report.submitted'));
        } else {
          toast.error(res.error || t('report.failed'));
        }
      } finally {
        setReporting(false);
      }
    },
    [reportThreadId, t, toast],
  );

  const menuItems = party?.userId
    ? [
        ...(reportThreadId
          ? [{ key: 'report', label: t('header.report'), onClick: () => setReportOpen(true) }]
          : []),
        { key: 'block', label: t('header.block'), danger: true, onClick: doBlock },
      ]
    : [];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        height: '100%',
        position: 'relative',
      }}
    >
      {announcer}
      {toastCtx}
      {modalCtx}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderBottom: '1px solid var(--cr-border-light)',
          background: 'var(--cr-surface)',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label={t('conversation.backToList')}
          className="md:hidden"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 36,
            height: 36,
            flexShrink: 0,
            border: 'none',
            background: 'transparent',
            color: 'var(--cr-text-2)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={20} aria-hidden />
        </button>
        {profileHref ? (
          <Link
            href={profileHref}
            className="cn-identity no-underline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flex: 1,
              minWidth: 0,
              color: 'inherit',
            }}
          >
            <Identity
              name={partyName}
              avatar={party?.avatar ?? null}
              handle={party?.handle ?? null}
              isDemo={party?.isDemo}
            />
          </Link>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <Identity
              name={partyName}
              avatar={party?.avatar ?? null}
              handle={party?.handle ?? null}
              isDemo={party?.isDemo}
            />
          </div>
        )}
        {menuItems.length > 0 && (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <button
              type="button"
              aria-label={t('header.more')}
              className="cn-iconbtn"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: '50%',
                border: 'none',
                color: 'var(--cr-text-2)',
                cursor: 'pointer',
              }}
            >
              <MoreVertical size={20} aria-hidden />
            </button>
          </Dropdown>
        )}
      </div>

      {/* Merged timeline */}
      <div ref={logRef} className="cn-chat-log" style={{ flex: 1, overflowY: 'auto' }}>
        <div
          style={{
            maxWidth: 760,
            margin: '0 auto',
            minHeight: '100%',
            padding: '8px 14px 12px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {isLoading ? (
            <p style={{ margin: 'auto', fontSize: 13, color: 'var(--cr-text-4)' }}>
              {t('conversation.loading')}
            </p>
          ) : isError ? (
            <p style={{ margin: 'auto', fontSize: 13, color: 'var(--cr-text-4)' }}>
              {t('conversation.errorBody')}
            </p>
          ) : timeline.items.length === 0 ? (
            <p
              style={{
                margin: 'auto',
                fontSize: 13.5,
                color: 'var(--cr-text-4)',
                textAlign: 'center',
              }}
            >
              {t('conversation.emptyBody')}
            </p>
          ) : (
            timeline.items.map((item, i) => {
              const prev = timeline.items[i - 1];
              const next = timeline.items[i + 1];
              const showDay = !prev || dayKey(prev.createdAt) !== dayKey(item.createdAt);
              const bucket = messageDayBucket(item.createdAt, now);
              const key = item.type === 'message' ? `m-${item.message._id}` : `c-${item.threadId}`;
              // Group a run of same-sender messages (no context/day break between)
              // so it stacks tightly with a single tail at the end -- WhatsApp-style.
              const firstOfGroup = showDay || !isSameSenderRun(prev, item);
              const lastOfGroup =
                !next ||
                dayKey(next.createdAt) !== dayKey(item.createdAt) ||
                !isSameSenderRun(item, next);
              return (
                <div key={key} style={{ display: 'contents' }}>
                  {showDay && (
                    <div
                      style={{
                        alignSelf: 'center',
                        margin: '10px 0 2px',
                        padding: '4px 12px',
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'var(--cr-text-3)',
                        background: 'var(--cr-surface)',
                        border: '1px solid var(--cr-border-light)',
                        borderRadius: 'var(--cr-radius-full)',
                        boxShadow: '0 1px 2px rgba(40, 30, 10, 0.05)',
                      }}
                    >
                      {bucket === 'today'
                        ? t('conversation.today')
                        : bucket === 'yesterday'
                          ? t('conversation.yesterday')
                          : new Date(item.createdAt).toLocaleDateString()}
                    </div>
                  )}
                  {item.type === 'context' ? (
                    <ContextCardInline item={item} />
                  ) : (
                    <MessageBubble
                      message={item.message}
                      viewerId={viewerId}
                      firstOfGroup={firstOfGroup}
                      lastOfGroup={lastOfGroup}
                      read={
                        item.message.senderUserId === viewerId &&
                        item.message.seq > 0 &&
                        (otherReadSeqByThread.get(item.threadId) ?? 0) >= item.message.seq
                      }
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <UnifiedComposer onSend={onSend} announce={announce} />

      <ReportDialog
        open={reportOpen}
        submitting={reporting}
        onClose={() => setReportOpen(false)}
        onSubmit={(reason, detail) => void doReport(reason, detail)}
      />
    </div>
  );
}

// ── Composer (text + photo + voice) ──────────────────────────────────────────

interface ComposerPhoto {
  url: string;
  previewUrl: string;
  mime: string;
  sizeBytes: number;
}

/** Text / photo / voice composer. Owns input + upload; the parent's `onSend`
 *  resolves the target thread, sends, and refreshes. Mirrors the legacy
 *  MessageComposer UX (gold voice button morphs into Send when there's content). */
function UnifiedComposer({
  onSend,
  announce,
}: {
  onSend: (input: SendMessageInput, localPreviews?: string[]) => Promise<boolean>;
  announce: (message: string, opts?: { assertive?: boolean }) => void;
}) {
  const t = useTranslations('connect.inbox');
  const [toast, toastCtx] = antdMessage.useMessage();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<ComposerPhoto | null>(null);
  const [voice, setVoice] = useState<{ url: string; durationSec: number } | null>(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSend = !sending && (text.trim().length > 0 || !!photo || !!voice);

  const handlePhotoPick = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      setUploading(true);
      try {
        const res = await uploadService.uploadSingle(file, { category: 'connect-inbox-media' });
        setPhoto((prev) => {
          if (prev?.previewUrl) uploadService.revokePreviewUrl(prev.previewUrl);
          return {
            url: res.url,
            previewUrl: uploadService.getFilePreviewUrl(file),
            mime: res.mimeType || file.type,
            sizeBytes: res.fileSize,
          };
        });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t('composer.uploadFailed'));
        announce(t('composer.uploadFailed'), { assertive: true });
      } finally {
        setUploading(false);
      }
    },
    [announce, t, toast],
  );

  const send = useCallback(async () => {
    if (sending) return;
    const body = text.trim();
    if (body.length === 0 && !photo && !voice) return;
    const input: SendMessageInput = {
      clientMsgId: genClientMsgId(),
      ...(body ? { body } : {}),
      ...(photo
        ? { media: [{ url: photo.url, mime: photo.mime, sizeBytes: photo.sizeBytes }] }
        : {}),
      ...(voice ? { audioUrl: voice.url, audioDurationSec: voice.durationSec } : {}),
    };
    const draft = { text, photo, voice };
    // Clear immediately (optimistic UX); restore on failure.
    setText('');
    setPhoto(null);
    setVoice(null);
    setVoiceMode(false);
    setSending(true);
    try {
      const ok = await onSend(input, photo ? [photo.previewUrl] : undefined);
      if (!ok) {
        setText(draft.text);
        setPhoto(draft.photo);
        setVoice(draft.voice);
      } else if (draft.photo?.previewUrl) {
        // Sent + reconciled: the echo no longer references the blob -> free it.
        uploadService.revokePreviewUrl(draft.photo.previewUrl);
      }
    } finally {
      setSending(false);
    }
  }, [sending, text, photo, voice, onSend]);

  return (
    <div style={{ borderTop: '1px solid var(--cr-border-light)', background: 'var(--cr-surface)' }}>
      {toastCtx}

      {voiceMode && (
        <div style={{ padding: '12px 14px 0' }}>
          <VoiceNoteRecorder
            category="connect-inbox-media"
            onRecorded={({ url, durationSec }) => setVoice({ url, durationSec })}
            onClear={() => setVoice(null)}
          />
          <button
            type="button"
            onClick={() => {
              setVoice(null);
              setVoiceMode(false);
            }}
            style={{
              marginTop: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--cr-text-3)',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t('composer.cancelVoice')}
          </button>
        </div>
      )}

      {photo && (
        <div style={{ padding: '12px 14px 0' }}>
          {/* Contained attachment chip (thumbnail + label + remove) so the
              pending photo reads as one intentional unit, not floating parts. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 8,
              borderRadius: 'var(--cr-radius-lg)',
              border: '1px solid var(--cr-border-light)',
              background: 'var(--cr-surface-2)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- local preview of a just-uploaded chat photo */}
            <img
              src={photo.previewUrl}
              alt={t('composer.photoAttached')}
              style={{
                width: 48,
                height: 48,
                flexShrink: 0,
                objectFit: 'cover',
                borderRadius: 'var(--cr-radius-md)',
              }}
            />
            <span
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--cr-text-2)',
              }}
            >
              {t('composer.photoAttached')}
            </span>
            <button
              type="button"
              onClick={() => {
                if (photo.previewUrl) uploadService.revokePreviewUrl(photo.previewUrl);
                setPhoto(null);
              }}
              aria-label={t('composer.removePhoto')}
              className="cn-iconbtn"
              style={{
                display: 'grid',
                placeItems: 'center',
                width: 40,
                height: 40,
                flexShrink: 0,
                borderRadius: '50%',
                border: 'none',
                background: 'transparent',
                color: 'var(--cr-text-2)',
                cursor: 'pointer',
              }}
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          padding: '10px 10px calc(10px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={INBOX_PHOTO_ACCEPT}
          onChange={handlePhotoPick}
          style={{ display: 'none' }}
          aria-hidden
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          aria-label={t('composer.addPhoto')}
          title={t('composer.addPhoto')}
          className="cn-iconbtn"
          style={iconBtn}
        >
          <ImagePlus size={22} aria-hidden />
        </button>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={1}
          placeholder={t('composer.placeholder')}
          aria-label={t('composer.inputAria')}
          style={{
            flex: 1,
            resize: 'none',
            maxHeight: 120,
            minHeight: 46,
            padding: '12px 16px',
            borderRadius: 23,
            border: '1px solid var(--cr-border)',
            background: 'var(--cr-surface)',
            color: 'var(--cr-text)',
            fontSize: 15,
            lineHeight: 1.4,
            fontFamily: 'inherit',
          }}
        />

        <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setVoiceMode((v) => !v)}
            disabled={sending}
            aria-label={t('composer.recordVoice')}
            aria-pressed={voiceMode}
            title={t('composer.recordVoice')}
            style={{
              ...trailingBtn,
              background: voiceMode
                ? 'var(--cr-primary)'
                : 'radial-gradient(120% 120% at 30% 20%, var(--cn-gold-bright, #e6bb52), var(--cn-gold, #c79a3a))',
              color: voiceMode ? '#fff' : '#4a350a',
              boxShadow: '0 6px 16px rgba(199, 154, 58, 0.4)',
              opacity: canSend ? 0 : 1,
              transform: canSend ? 'scale(0.4)' : 'scale(1)',
              pointerEvents: canSend ? 'none' : 'auto',
            }}
          >
            <Mic size={24} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={!canSend}
            aria-label={t('composer.send')}
            title={t('composer.send')}
            style={{
              ...trailingBtn,
              background: 'var(--cr-primary)',
              color: '#fff',
              boxShadow: '0 6px 16px rgba(44, 61, 130, 0.4)',
              opacity: canSend ? 1 : 0,
              transform: canSend ? 'scale(1)' : 'scale(0.4)',
              pointerEvents: canSend ? 'auto' : 'none',
            }}
          >
            <SendHorizontal size={20} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function Identity({
  name,
  avatar,
  handle,
  isDemo,
}: {
  name: string;
  avatar: string | null;
  handle: string | null;
  /** Seeded demo correspondent -> show the Sample disclosure beside the name. */
  isDemo?: boolean;
}) {
  return (
    <>
      <DsAvatar name={name} src={avatar ?? undefined} size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <h2
            className="cn-identity-name"
            style={{
              margin: 0,
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--cr-text)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name}
          </h2>
          {isDemo && <SampleBadge size="sm" />}
        </div>
        {handle && <p style={{ margin: 0, fontSize: 12, color: 'var(--cr-text-4)' }}>@{handle}</p>}
      </div>
    </>
  );
}

/** A small pill selecting the reply lane (active = the current send target). */
const iconBtn: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 44,
  height: 44,
  flexShrink: 0,
  borderRadius: '50%',
  border: 'none',
  background: 'transparent',
  color: 'var(--cr-text-2)',
  cursor: 'pointer',
};

const trailingBtn: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  placeItems: 'center',
  width: 48,
  height: 48,
  borderRadius: '50%',
  border: 'none',
  cursor: 'pointer',
  transition: 'opacity 0.15s ease, transform 0.15s ease',
};
