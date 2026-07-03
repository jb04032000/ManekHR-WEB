'use client';

/**
 * TrendingTags - the trending-list panel rendered in the rail on
 * `/connect/search`. Dumb component: the Server Component (`page.tsx`)
 * fetches the trending list via `getTrendingTags()` and hands the array
 * down. Each row links to `/connect/search?q=#<slug>&type=people` so a tap
 * re-runs the page with the hashtag in the query (which the federated layer
 * folds into `query.tags` and the screen shows as a removable chip).
 *
 * The label for each tag falls through the active locale, then the curated
 * `en` label, then the canonical slug. That last fallback is the open-tag
 * path - a user-coined tag the curator has not yet localized still renders
 * as a clickable row, just under its slug.
 */

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { TrendingTag } from '../search.types';

interface TrendingTagsProps {
  tags: TrendingTag[];
}

/** Look up the most appropriate label for the active locale. */
function labelFor(tag: TrendingTag, locale: string): string {
  return tag.labels[locale] ?? tag.labels.en ?? tag.slug;
}

/** Build the `/connect/search?q=#<slug>` URL for a tag-jump click. */
function hrefFor(slug: string): string {
  const params = new URLSearchParams();
  params.set('q', `#${slug}`);
  params.set('type', 'people');
  return `/connect/search?${params.toString()}`;
}

export default function TrendingTags({ tags }: TrendingTagsProps) {
  const t = useTranslations('connect.search.trending');
  const locale = useLocale();

  if (tags.length === 0) {
    return (
      <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
        {t('empty')}
      </p>
    );
  }

  return (
    <ul
      role="list"
      aria-label={t('listAria')}
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {tags.map((tag, index) => {
        const label = labelFor(tag, locale);
        // Ranked list: a numbered lead (top 3 accented in primary, the rest
        // muted) replaces the old per-row trending icon, which was redundant with
        // the panel's "Trending" title. The row now has a real hover wash (the
        // previous inline `transition: background` had no matching :hover rule).
        return (
          <li key={tag.slug}>
            <Link
              href={hrefFor(tag.slug)}
              aria-label={t('tagAria', { label, count: tag.usageCount })}
              className="no-underline transition-colors hover:bg-[var(--cr-surface-2)]"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 8px',
                borderRadius: 'var(--cr-radius-sm)',
                color: 'var(--cr-text-2)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 16,
                    textAlign: 'center',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: index < 3 ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                  }}
                >
                  {index + 1}
                </span>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                </span>
              </span>
              <span
                aria-hidden
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: 'var(--cr-text-4)',
                  flexShrink: 0,
                }}
              >
                {tag.usageCount}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
