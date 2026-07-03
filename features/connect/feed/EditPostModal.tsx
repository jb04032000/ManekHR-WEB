'use client';

/**
 * EditPostModal - edit one of your own posts (Phase 7c / Wave 6).
 *
 * A focused modal: a textarea seeded with the post's current body. On save it
 * calls `editPost`, which re-parses hashtags + stamps `editedAt` server-side and
 * returns the updated post; the caller updates the card in place (new body + an
 * "edited" label) without a refetch. v1 edits the text body only.
 */

import { useState } from 'react';
import { App as AntApp, Input } from 'antd';
import PhotoLayoutChooser from '@/components/connect/PhotoLayoutChooser';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { editPost } from '../feed.actions';
import type { HydratedFeedItem, PostMediaLayout } from '../feed.types';

/** Mirrors the backend post body cap. */
const MAX_BODY = 3000;

interface EditPostModalProps {
  open: boolean;
  /** The post being edited - its current body seeds the textarea. */
  post: HydratedFeedItem;
  onCancel: () => void;
  /** Fired after a successful edit with the new body + editedAt (+ the layout
   *  when a photo post's grid/slideshow choice changed) so the card can reflect
   *  the change in place (no refetch). */
  onSaved: (updated: {
    body: string;
    editedAt: string | null;
    mediaLayout?: PostMediaLayout;
  }) => void;
}

export default function EditPostModal({ open, post, onCancel, onSaved }: EditPostModalProps) {
  const t = useTranslations('connect.feed.post.edit');
  const tc = useTranslations('connect.feed.composer');
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();
  const [body, setBody] = useState(post.body);
  const [submitting, setSubmitting] = useState(false);
  // A photo post with 2+ photos can flip grid <-> slideshow here too.
  const showLayout = post.kind === 'photo' && post.media.length >= 2;
  const [mediaLayout, setMediaLayout] = useState<PostMediaLayout>(post.mediaLayout ?? 'grid');

  // A text post cannot be emptied (matches the backend guard); a photo / voice
  // post may carry an empty body. An unchanged body is a no-op submit.
  const emptyTextPost = post.kind === 'text' && !body.trim();
  const layoutChanged = showLayout && mediaLayout !== (post.mediaLayout ?? 'grid');
  const unchanged = body.trim() === post.body.trim() && !layoutChanged;

  const submit = async () => {
    if (submitting || emptyTextPost || unchanged) return;
    setSubmitting(true);
    const res = await editPost(post._id, {
      // Only send body when it actually changed, so a layout-only flip stays
      // display-only and does not re-stamp editedAt on the backend.
      ...(body.trim() !== post.body.trim() ? { body: body.trim() } : {}),
      ...(showLayout ? { mediaLayout } : {}),
    });
    setSubmitting(false);
    if (!res.ok) {
      const msg = res.error || t('error');
      message.error(msg);
      announce(msg, { assertive: true });
      return;
    }
    message.success(t('done'));
    // The backend always stamps editedAt on a successful edit; carry it through
    // as-is (no client-clock fabrication). `null` simply leaves the label off.
    onSaved({
      body: res.data.post.body,
      editedAt: res.data.post.editedAt ?? null,
      mediaLayout: res.data.post.mediaLayout,
    });
  };

  return (
    <DsModal
      open={open}
      onCancel={onCancel}
      title={t('title')}
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={onCancel} disabled={submitting}>
            {t('cancel')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            loading={submitting}
            disabled={emptyTextPost || unchanged}
            onClick={() => void submit()}
          >
            {t('save')}
          </DsButton>
        </div>
      }
    >
      {announcer}
      <Input.TextArea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={t('placeholder')}
        autoSize={{ minRows: 3, maxRows: 10 }}
        maxLength={MAX_BODY}
        aria-label={t('title')}
      />

      {/* Photo layout choice - grid vs slideshow, shown only for a 2+ photo post. */}
      {showLayout && (
        <div style={{ marginTop: 16 }}>
          <div
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)', marginBottom: 8 }}
          >
            {tc('layout.label')}
          </div>
          <PhotoLayoutChooser value={mediaLayout} onChange={setMediaLayout} />
        </div>
      )}
    </DsModal>
  );
}
