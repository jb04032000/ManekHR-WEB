'use client';

/**
 * ZeroResultSuggestions - the helpful empty state on `/connect/search` when a
 * real query matched nothing across every vertical (checklist §3 / spec §3.3
 * #6).
 *
 * Instead of a dead end, it offers three recovery paths:
 *   - a plain "no results for X" line plus a "did you mean" broaden hint,
 *   - popular categories (real searches, curated from the textile vocabulary;
 *     the set adapts to the active context - Marketplace surfaces product
 *     categories, Jobs surfaces role categories),
 *   - a "search everything instead" affordance that drops the active vertical
 *     filter and re-runs across all verticals (the most common reason a scoped
 *     search comes back empty).
 *
 * Tapping a popular category navigates to a fresh search; the zero-result query
 * itself is logged by the parent (`SearchResultsScreen`) via the
 * `searchNoResults` analytics event - this component is presentation only.
 *
 * Links: SearchResultsScreen.tsx (renders this in the empty branch);
 * search-context.ts (the same context detection the bar uses).
 */

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { SearchX } from 'lucide-react';
import type { SearchType } from '../search.types';

interface ZeroResultSuggestionsProps {
  /** The raw query that matched nothing - echoed in the headline copy. */
  query: string;
  /** The active vertical when the search came back empty. Drives whether the
   *  "search everything" broaden affordance shows (only when scoped away from
   *  `all`) and which popular categories surface. */
  activeType: SearchType;
}

/**
 * Curated popular searches per context. These are REAL search terms drawn from
 * the Gujarat textile vocabulary (the same seeds the mobile sheet uses), not
 * placeholders. `q` is the canonical term sent to search; `key` resolves the
 * localized label under `connect.search.zeroResult.categories.<key>`.
 */
const POPULAR: Record<'listings' | 'jobs' | 'all', readonly { key: string; q: string }[]> = {
  // Marketplace context: product / material categories.
  listings: [
    { key: 'saree', q: 'saree' },
    { key: 'zariWork', q: 'zari' },
    { key: 'embroidery', q: 'embroidery' },
    { key: 'rawMaterial', q: 'raw material' },
    { key: 'machinery', q: 'machinery' },
    { key: 'dyeing', q: 'dyeing' },
  ],
  // Jobs context: role / trade searches.
  jobs: [
    { key: 'karigar', q: 'karigar' },
    { key: 'embroidery', q: 'embroidery' },
    { key: 'tailor', q: 'tailor' },
    { key: 'machineOperator', q: 'machine operator' },
    { key: 'helper', q: 'helper' },
    { key: 'designer', q: 'designer' },
  ],
  // Blended context: a spread across the trade.
  all: [
    { key: 'zariWork', q: 'zari' },
    { key: 'saree', q: 'saree' },
    { key: 'embroidery', q: 'embroidery' },
    { key: 'karigar', q: 'karigar' },
    { key: 'machinery', q: 'machinery' },
    { key: 'designer', q: 'designer' },
  ],
};

export default function ZeroResultSuggestions({ query, activeType }: ZeroResultSuggestionsProps) {
  const t = useTranslations('connect.search.zeroResult');
  const router = useRouter();

  // Map the active vertical to one of the three curated buckets. People / posts
  // verticals fall back to the blended `all` set (no people/post-specific seeds).
  const popular = useMemo(() => {
    if (activeType === 'listings') return POPULAR.listings;
    if (activeType === 'jobs') return POPULAR.jobs;
    return POPULAR.all;
  }, [activeType]);

  const runQuery = useCallback(
    (q: string) => {
      router.push(`/connect/search?q=${encodeURIComponent(q)}`);
    },
    [router],
  );

  // "Search everything instead" - drop the scoped vertical and re-run blended.
  // Only meaningful when the member is scoped away from `all`.
  const broaden = useCallback(() => {
    router.push(`/connect/search?q=${encodeURIComponent(query)}`);
  }, [router, query]);

  const showBroaden = activeType !== 'all' && query.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 'var(--cr-space-md)',
        padding: 'var(--cr-space-xl) var(--cr-space-md)',
      }}
    >
      <span
        aria-hidden
        style={{
          display: 'grid',
          placeItems: 'center',
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--cr-surface-2)',
          color: 'var(--cr-text-4)',
        }}
      >
        <SearchX size={22} />
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 420 }}>
        <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text)' }}>
          {t('title', { query })}
        </h2>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'var(--cr-text-4)' }}>
          {t('hint')}
        </p>
      </div>

      {showBroaden && (
        <button
          type="button"
          onClick={broaden}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 16px',
            borderRadius: 'var(--cr-radius-full)',
            border: '1px solid var(--cr-primary)',
            background: 'transparent',
            color: 'var(--cr-primary)',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {t('broaden')}
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)' }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
          }}
        >
          {t('popularTitle')}
        </p>
        <ul
          aria-label={t('popularTitle')}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 8,
            listStyle: 'none',
            margin: 0,
            padding: 0,
            maxWidth: 420,
          }}
        >
          {popular.map((item) => (
            <li key={item.key} style={{ display: 'inline-flex' }}>
              <button
                type="button"
                onClick={() => runQuery(item.q)}
                style={{
                  padding: '6px 14px',
                  borderRadius: 'var(--cr-radius-full)',
                  border: '1px solid var(--cr-border-light)',
                  background: 'var(--cr-surface-2)',
                  color: 'var(--cr-text-2)',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {t(`categories.${item.key}` as Parameters<typeof t>[0])}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
