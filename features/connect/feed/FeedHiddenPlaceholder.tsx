'use client';

/**
 * FeedHiddenPlaceholder - the inline "Post hidden - Undo" card (Phase 7d).
 *
 * When a reader hides a post, FeedList keeps the row but swaps the PostCard for
 * this slim placeholder so the hide feels instant AND reversible in place (no
 * toast to chase). Tapping Undo restores the original card and lifts the hide on
 * the backend. Links: FeedList.tsx (owns the hiddenIds set + the undo call),
 * feed.actions `removeNegativeSignal`.
 */

import { useTranslations } from 'next-intl';
import { EyeOff } from 'lucide-react';

interface FeedHiddenPlaceholderProps {
  /** Restore the card + lift the hide on the backend. */
  onUndo: () => void;
}

export default function FeedHiddenPlaceholder({ onUndo }: FeedHiddenPlaceholderProps) {
  const t = useTranslations('connect.feed.post');
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 'var(--cr-radius-lg)',
        border: '1px solid var(--cr-border)',
        background: 'var(--cr-surface-2)',
        color: 'var(--cr-text-3)',
        fontSize: 13.5,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
        <EyeOff size={15} aria-hidden />
        {t('hidden.label')}
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          fontSize: 13.5,
          fontWeight: 700,
          color: 'var(--cr-primary)',
          padding: '4px 6px',
          borderRadius: 'var(--cr-radius-sm)',
        }}
      >
        {t('undo')}
      </button>
    </div>
  );
}
