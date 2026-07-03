'use client';

/**
 * PhotoLayoutChooser - the grid vs slideshow picker for a multi-photo post.
 *
 * Two selectable cards (icon + label), shared by the Composer and the Edit Post
 * modal so the choice looks and behaves identically in both. Uses the same
 * `aria-pressed` button pattern as the composer's attachment-mode picker (a
 * binary visual toggle, keyboard-operable via Tab + Enter / Space). The caller
 * shows it only for a photo post with 2+ photos.
 *
 * JIT shared component (Phase 3). Rendered in isolation on `/design-system`.
 */

import { GalleryHorizontalEnd, LayoutGrid, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { PostMediaLayout } from '@/features/connect/feed.types';

const OPTIONS: { value: PostMediaLayout; labelKey: 'grid' | 'slideshow'; icon: LucideIcon }[] = [
  { value: 'grid', labelKey: 'grid', icon: LayoutGrid },
  { value: 'carousel', labelKey: 'slideshow', icon: GalleryHorizontalEnd },
];

export default function PhotoLayoutChooser({
  value,
  onChange,
}: {
  value: PostMediaLayout;
  onChange: (next: PostMediaLayout) => void;
}) {
  const t = useTranslations('connect.feed.composer.layout');
  return (
    <div role="group" aria-label={t('label')} style={{ display: 'flex', gap: 8 }}>
      {OPTIONS.map(({ value: optionValue, labelKey, icon: Icon }) => {
        const selected = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            aria-pressed={selected}
            className="inline-flex items-center justify-center gap-2 transition"
            style={{
              flex: 1,
              padding: '10px 12px',
              borderRadius: 'var(--cr-radius-md)',
              border: `1.5px solid ${selected ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
              background: selected ? 'var(--cr-wash-indigo)' : 'transparent',
              color: selected ? 'var(--cr-primary)' : 'var(--cr-text-2)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <Icon size={16} aria-hidden />
            {t(labelKey)}
          </button>
        );
      })}
    </div>
  );
}
