'use client';

/**
 * QuoteRepostModal - "repost with your thoughts" (Phase 7c - Wave S).
 *
 * A focused modal: a textarea for the quote + a read-only preview of the post
 * being quoted (the ROOT original). On submit it calls `repostPost` with the
 * quote, which the backend stores as the new repost's body. Distinct from a
 * plain repost (no body, toggle-able) - a quote-repost is always a new post.
 */

import { useState } from 'react';
import { App as AntApp, Input } from 'antd';
import { useTranslations } from 'next-intl';
import { DsModal } from '@/components/ui/DsModal';
import DsButton from '@/components/ui/DsButton';
import { PublicPostView } from '@/components/connect';
import useAnnouncer from '@/components/connect/useAnnouncer';
import { repostPost } from '../feed.actions';
import type { HydratedFeedItem } from '../feed.types';

/** Mirrors the backend `RepostDto` quote cap. */
const MAX_QUOTE = 3000;

interface QuoteRepostModalProps {
  open: boolean;
  /** The ROOT post being quoted - previewed read-only. */
  original: HydratedFeedItem;
  onCancel: () => void;
  /** Fired after a successful quote-repost so the card can reconcile counts. */
  onPosted: () => void;
}

export default function QuoteRepostModal({
  open,
  original,
  onCancel,
  onPosted,
}: QuoteRepostModalProps) {
  const t = useTranslations('connect.feed.post.repost');
  const { message } = AntApp.useApp();
  const { announce, announcer } = useAnnouncer();
  const [quote, setQuote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const body = quote.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    const res = await repostPost(original._id, body);
    setSubmitting(false);
    if (!res.ok) {
      const msg = res.error || t('error');
      message.error(msg);
      announce(msg, { assertive: true });
      return;
    }
    message.success(t('done'));
    setQuote('');
    onPosted();
  };

  return (
    <DsModal
      open={open}
      onCancel={onCancel}
      title={t('quoteTitle')}
      width={560}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <DsButton dsVariant="ghost" dsSize="sm" onClick={onCancel} disabled={submitting}>
            {t('quoteCancel')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            loading={submitting}
            disabled={!quote.trim()}
            onClick={() => void submit()}
          >
            {t('quoteSubmit')}
          </DsButton>
        </div>
      }
    >
      {announcer}
      <Input.TextArea
        value={quote}
        onChange={(e) => setQuote(e.target.value)}
        placeholder={t('quotePlaceholder')}
        autoSize={{ minRows: 3, maxRows: 8 }}
        maxLength={MAX_QUOTE}
        aria-label={t('quotePlaceholder')}
      />
      <div style={{ marginTop: 12 }}>
        <PublicPostView post={original} />
      </div>
    </DsModal>
  );
}
