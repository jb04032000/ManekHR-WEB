'use client';

/**
 * Composer - the post-composition sheet (Phase 3 - Feed).
 *
 * A modal sheet over the feed. A body textarea plus one optional attachment
 * mode - photo, video, document, or a voice note. The post `kind` derives from
 * the active mode (`text` when none). The shell is reused by the P4 / P5
 * product / job composers.
 *
 * JIT shared component (Phase 3). Rendered in isolation on `/design-system`.
 */

import { useCallback, useEffect, useState } from 'react';
import { App as AntApp, Select } from 'antd';
import { FileText, ImagePlus, Mic, Video, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import DsButton from '@/components/ui/DsButton';
import { DsModal } from '@/components/ui/DsModal';
// The @-typeahead body field - tags people / pages / shops into the post.
import MentionTextArea from './MentionTextArea';
import MediaUploadGrid from './MediaUploadGrid';
import VoiceNoteRecorder from './VoiceNoteRecorder';
import PhotoLayoutChooser from './PhotoLayoutChooser';
import { createPost } from '@/features/connect/feed.actions';
// @mention picker analytics (entity type + surface only, no PII).
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import { listMyCompanyPages } from '@/features/connect/entities/company-page.actions';
import type { CompanyPage } from '@/features/connect/entities/entities.types';
import type {
  FeedItem,
  PostKind,
  PostMediaLayout,
  PostMediaType,
} from '@/features/connect/feed.types';

interface ComposerProps {
  open: boolean;
  onClose: () => void;
  /** Called after a post publishes, with the freshly-created post so the caller
   *  can prepend it to the feed instantly (no full refresh). */
  onPosted?: (post: FeedItem) => void;
  /**
   * Mode to open in. Lets a caller launch the composer straight into Photo /
   * Video / Voice from a feed quick-shortcut. Defaults to `none` (text). The
   * caller should remount (via `key`) per open so this re-seeds.
   */
  initialMode?: AttachMode;
  /** Publish AS this company page (the manage screen passes the page id). When
   *  set, the post is attributed to the page + fans out to its followers. */
  companyPageId?: string;
}

const MAX_BODY = 3000;

/** The attachment modes - `none` is a plain text post. */
export type AttachMode = 'none' | 'photo' | 'video' | 'document' | 'voice';

/** Mode → the post `kind` it produces once it has content. */
const MODE_KIND: Record<Exclude<AttachMode, 'none'>, PostKind> = {
  photo: 'photo',
  video: 'video',
  document: 'document',
  voice: 'voice',
};

/** Photo / video / document mode → the `PostMedia.type` for its uploads. */
const MEDIA_TYPE: Record<'photo' | 'video' | 'document', PostMediaType> = {
  photo: 'image',
  video: 'video',
  document: 'document',
};

export default function Composer({
  open,
  onClose,
  onPosted,
  initialMode = 'none',
  companyPageId,
}: ComposerProps) {
  const t = useTranslations('connect.feed.composer');
  const { message } = AntApp.useApp();

  const [body, setBody] = useState('');
  // @mentions tagged in the body. Submitted as `createPost({ mentions })` and
  // reconciled atomically by MentionTextArea (a tag whose token is edited away
  // drops out). Shape mirrors the action's `mentions[]` item.
  const [mentions, setMentions] = useState<
    { type: 'profile' | 'company' | 'storefront'; refId: string; display: string }[]
  >([]);
  const [mode, setMode] = useState<AttachMode>(initialMode);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  // Video only: {videoUrl -> posterUrl} captured by MediaUploadGrid. Attached as
  // posterUrl on submit so the feed paints a still instead of a black box.
  const [posterByUrl, setPosterByUrl] = useState<Record<string, string>>({});
  // Author's photo display choice - only sent for a 2+ photo post.
  const [mediaLayout, setMediaLayout] = useState<PostMediaLayout>('grid');
  const [audio, setAudio] = useState<{ url: string; durationSec: number } | null>(null);
  // Bumped on reset / mode change so the uncontrolled child remounts empty.
  const [childKey, setChildKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // "Post as" identity. A fixed `companyPageId` prop (the page manage screen)
  // locks the author to that page + hides the selector. On the feed (no fixed
  // id) the caller can choose a page they own; `null` = post as themselves.
  const fixedToPage = companyPageId !== undefined;
  const [ownedPages, setOwnedPages] = useState<CompanyPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const effectivePageId = companyPageId ?? selectedPageId ?? undefined;

  // Load the caller's pages once when a free (non-fixed) composer opens, so the
  // "Post as" selector can offer them. Errors are swallowed - the selector just
  // stays personal-only.
  useEffect(() => {
    if (!open || fixedToPage || ownedPages.length > 0) return;
    let active = true;
    void listMyCompanyPages().then((res) => {
      if (active && res.ok) setOwnedPages(res.data);
    });
    return () => {
      active = false;
    };
  }, [open, fixedToPage, ownedPages.length]);

  const reset = useCallback(() => {
    setBody('');
    setMentions([]);
    setMode('none');
    setMediaUrls([]);
    setPosterByUrl({});
    setMediaLayout('grid');
    setAudio(null);
    setChildKey((k) => k + 1);
    setSelectedPageId(null);
  }, []);

  const close = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  /** Toggle an attachment mode - picking the active one clears it. */
  const pickMode = useCallback((next: Exclude<AttachMode, 'none'>) => {
    setMediaUrls([]);
    setPosterByUrl({});
    setMediaLayout('grid');
    setAudio(null);
    setChildKey((k) => k + 1);
    setMode((current) => (current === next ? 'none' : next));
  }, []);

  const hasAttachment =
    (mode === 'voice' && audio !== null) ||
    ((mode === 'photo' || mode === 'video' || mode === 'document') && mediaUrls.length > 0);
  const canSubmit = (body.trim().length > 0 || hasAttachment) && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    // When `hasAttachment` is true, TS narrows `mode` away from 'none'.
    const kind: PostKind = hasAttachment ? MODE_KIND[mode] : 'text';
    const res = await createPost({
      kind,
      body: body.trim(),
      media:
        (mode === 'photo' || mode === 'video' || mode === 'document') && mediaUrls.length > 0
          ? mediaUrls.map((url) => ({
              url,
              type: MEDIA_TYPE[mode],
              // Attach the captured poster for a video (if capture won); other
              // kinds never have one.
              ...(mode === 'video' && posterByUrl[url] ? { posterUrl: posterByUrl[url] } : {}),
            }))
          : undefined,
      audio: mode === 'voice' && audio ? audio : undefined,
      // Tagged @mentions (people / pages / shops) - omit when none so the post
      // payload stays clean. Display-side rendering is handled by MentionText.
      mentions: mentions.length ? mentions : undefined,
      // Layout is only meaningful for a multi-photo post; omit it otherwise.
      mediaLayout: mode === 'photo' && mediaUrls.length >= 2 ? mediaLayout : undefined,
      // Publish as a company page when one is fixed (manage screen) or chosen
      // (the feed "Post as" selector); omit for a personal post.
      ...(effectivePageId ? { companyPageId: effectivePageId } : {}),
    });
    setSubmitting(false);
    if (!res.ok) {
      message.error(res.error || t('postError'));
      return;
    }
    message.success(t('posted'));
    reset();
    onClose();
    onPosted?.(res.data.post);
  }, [
    canSubmit,
    hasAttachment,
    mode,
    body,
    mentions,
    mediaUrls,
    posterByUrl,
    mediaLayout,
    audio,
    message,
    t,
    reset,
    onClose,
    onPosted,
    effectivePageId,
  ]);

  const modes: { key: Exclude<AttachMode, 'none'>; label: string; icon: typeof ImagePlus }[] = [
    { key: 'photo', label: t('mode.photo'), icon: ImagePlus },
    { key: 'video', label: t('mode.video'), icon: Video },
    { key: 'document', label: t('mode.document'), icon: FileText },
    { key: 'voice', label: t('mode.voice'), icon: Mic },
  ];

  return (
    <DsModal
      open={open}
      onCancel={close}
      title={t('title')}
      width={560}
      className="cn-composer-modal"
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={close} disabled={submitting}>
            {t('cancel')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            loading={submitting}
            disabled={!canSubmit}
            onClick={submit}
          >
            {t('publish')}
          </DsButton>
        </div>
      }
    >
      {/* "Post as" - choose self or one of the caller's pages (feed only). */}
      {!fixedToPage && ownedPages.length > 0 && (
        <div style={{ marginBottom: 'var(--cr-space-md)' }}>
          <label
            htmlFor="cn-composer-author"
            className="mb-1 block text-[12px] font-semibold"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('postAsLabel')}
          </label>
          <Select
            id="cn-composer-author"
            aria-label={t('postAsLabel')}
            value={selectedPageId ?? ''}
            onChange={(v) => setSelectedPageId(v === '' ? null : v)}
            style={{ minWidth: 220 }}
            options={[
              { value: '', label: t('postAsSelf') },
              ...ownedPages.map((p) => ({ value: p._id, label: p.name })),
            ]}
          />
        </div>
      )}

      <MentionTextArea
        value={body}
        mentions={mentions}
        onChange={(v, m) => {
          setBody(v);
          setMentions(m);
        }}
        placeholder={t('placeholder')}
        autoSize={{ minRows: 3, maxRows: 10 }}
        maxLength={MAX_BODY}
        aria-label={t('bodyLabel')}
        onPickerOpen={() => trackEvent(ConnectEvents.mentionPickerOpened, { surface: 'post' })}
        onMentionAdd={(m) =>
          trackEvent(ConnectEvents.mentionAdded, { entity: m.type, surface: 'post' })
        }
      />

      {/* Attachment mode picker. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--cr-space-md)' }}>
        {modes.map(({ key, label, icon: Icon }) => {
          const active = mode === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => pickMode(key)}
              aria-pressed={active}
              className="inline-flex items-center justify-center gap-1.5"
              style={{
                minHeight: 44,
                padding: '7px 12px',
                borderRadius: 'var(--cr-radius-md)',
                border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                background: active ? 'var(--cr-wash-indigo)' : 'transparent',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                color: active ? 'var(--cr-primary)' : 'var(--cr-text-2)',
              }}
            >
              <Icon size={15} aria-hidden />
              {label}
              {active && <X size={14} aria-hidden style={{ marginInlineStart: 2, opacity: 0.7 }} />}
            </button>
          );
        })}
      </div>

      {/* The active mode's attachment UI. */}
      {(mode === 'photo' || mode === 'video' || mode === 'document') && (
        <div style={{ marginTop: 'var(--cr-space-md)' }}>
          <MediaUploadGrid
            key={childKey}
            mediaKind={MEDIA_TYPE[mode]}
            onChange={setMediaUrls}
            // Video posters: only the video mode needs the map.
            onPosters={mode === 'video' ? setPosterByUrl : undefined}
          />
        </div>
      )}
      {mode === 'voice' && (
        <div style={{ marginTop: 'var(--cr-space-md)' }}>
          <VoiceNoteRecorder key={childKey} onRecorded={setAudio} onClear={() => setAudio(null)} />
        </div>
      )}

      {/* Photo layout choice - grid (default) vs slideshow. Only meaningful, and
          only shown, once 2+ photos are attached. */}
      {mode === 'photo' && mediaUrls.length >= 2 && (
        <div style={{ marginTop: 'var(--cr-space-md)' }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)', marginBottom: 8 }}
          >
            {t('layout.label')}
          </div>
          <PhotoLayoutChooser value={mediaLayout} onChange={setMediaLayout} />
          <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--cr-text-4)' }}>
            {t('layout.help')}
          </p>
        </div>
      )}
    </DsModal>
  );
}
