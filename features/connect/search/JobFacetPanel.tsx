'use client';

/**
 * JobFacetPanel - the jobs facet strip for the `/connect/search` jobs tab
 * (Phase 5). Jobs filter on one knob only - the trade category - because the
 * backend job search reuses the shared `category` facet and nothing else
 * (open-only is pinned server-side). A single-select category pill row keeps
 * the surface honest: no district / price controls that the backend would
 * silently ignore.
 *
 *   - category single-select pills -> `?category=`. Tapping the active pill
 *     clears it (mirrors the listing facet behaviour + the live backend facet).
 *   - the header `ConnectSearchBar` owns `?q=`, so this panel has no keyword
 *     field and clear-all never wipes the active search text.
 */

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { LISTING_CATEGORIES, type ListingCategory } from '../search.types';

export default function JobFacetPanel() {
  const t = useTranslations('connect.search.jobFacets');
  const tCat = useTranslations('connect.search.listing.category');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlCategory = searchParams.get('category');

  const pushWith = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const handleCategoryClick = useCallback(
    (category: ListingCategory) => {
      pushWith((params) => {
        if (urlCategory === category) params.delete('category');
        else params.set('category', category);
      });
    },
    [pushWith, urlCategory],
  );

  const handleClearAll = useCallback(() => {
    pushWith((params) => params.delete('category'));
  }, [pushWith]);

  return (
    <section aria-label={t('title')} className="cn-facet-bar">
      <div
        role="group"
        aria-label={t('categoryGroupAria')}
        style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 6 }}
      >
        {LISTING_CATEGORIES.map((category) => {
          const active = urlCategory === category;
          return (
            <button
              key={category}
              type="button"
              aria-pressed={active}
              onClick={() => handleCategoryClick(category)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 12px',
                borderRadius: 'var(--cr-radius-full)',
                border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                background: active ? 'var(--cr-primary)' : 'var(--cr-surface-2)',
                color: active ? 'var(--cr-surface)' : 'var(--cr-text-2)',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {active && <Check size={13} aria-hidden />}
              {tCat(category)}
            </button>
          );
        })}
      </div>

      {Boolean(urlCategory) && (
        <div style={{ flexBasis: '100%', display: 'flex', justifyContent: 'flex-end' }}>
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            aria-label={t('clearAllAria')}
            onClick={handleClearAll}
          >
            {t('clearAll')}
          </DsButton>
        </div>
      )}
    </section>
  );
}
