'use client';

/**
 * PageFacetPanel - the facet strip for the `/connect/search` Pages + Storefronts
 * tabs (SRCH-VERT-1). Up to two knobs, both reducing to existing backend DTO
 * params:
 *
 *   - `pageKind` single-select pills (All / Business / Institute) -> `?pageKind=`.
 *     ONLY rendered on the Pages tab (`showPageKind`). Tapping "All" (or the
 *     active pill again) clears it. Drives the institute/business split.
 *   - `district` free-text scalar (debounced 300 ms) -> `?district=`. Shared
 *     with the people / listings verticals (same param), so it narrows both
 *     Pages and Storefronts.
 *
 * The Storefronts tab reuses this panel with `showPageKind={false}` so it shows
 * the shared district facet only (pageKind is meaningless there). The header
 * `ConnectSearchBar` owns `?q=`, so this panel has no keyword field and
 * clear-all never wipes the active search text. Mirrors `JobFacetPanel` (pills)
 * + `FacetPanel` (debounced district).
 */

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input } from 'antd';
import { Check } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import type { ConnectPageKind } from '../search.types';

const DISTRICT_DEBOUNCE_MS = 300;

/** The selectable page-kind pills. `null` = the "All" pill (clears the facet). */
const PAGE_KIND_OPTIONS: ReadonlyArray<{ value: ConnectPageKind | null; labelKey: string }> = [
  { value: null, labelKey: 'all' },
  { value: 'business', labelKey: 'business' },
  { value: 'institute', labelKey: 'institute' },
];

interface PageFacetPanelProps {
  /**
   * Show the business/institute pageKind pills. True on the Pages tab, false on
   * the Storefronts tab (storefronts have no kind). Default true.
   */
  showPageKind?: boolean;
}

export default function PageFacetPanel({ showPageKind = true }: PageFacetPanelProps) {
  const t = useTranslations('connect.search.pageFacets');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlPageKind = searchParams.get('pageKind');
  const urlDistrict = searchParams.get('district') ?? '';

  const [districtDraft, setDistrictDraft] = useState(urlDistrict);
  // Reset the local draft from the URL on external navigation (back button, tab
  // click) so a stale draft does not linger. Render-time previous-value pattern.
  const [prevUrlDistrict, setPrevUrlDistrict] = useState(urlDistrict);
  if (urlDistrict !== prevUrlDistrict) {
    setPrevUrlDistrict(urlDistrict);
    setDistrictDraft(urlDistrict);
  }

  const pushWith = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  // District debounced sync (mirrors FacetPanel). Only fires on a real divergence.
  useEffect(() => {
    if (districtDraft === urlDistrict) return;
    const timer = setTimeout(() => {
      pushWith((params) => {
        const trimmed = districtDraft.trim();
        if (trimmed) params.set('district', trimmed);
        else params.delete('district');
      });
    }, DISTRICT_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [districtDraft, urlDistrict, pushWith]);

  const handleKindClick = useCallback(
    (value: ConnectPageKind | null) => {
      pushWith((params) => {
        // The "All" pill (value null) clears; re-tapping the active pill clears too.
        if (value === null || urlPageKind === value) params.delete('pageKind');
        else params.set('pageKind', value);
      });
    },
    [pushWith, urlPageKind],
  );

  const handleClearAll = useCallback(() => {
    pushWith((params) => {
      params.delete('pageKind');
      params.delete('district');
    });
  }, [pushWith]);

  // On the Storefronts tab (showPageKind=false) the pageKind pills are hidden,
  // so an inherited `?pageKind=` (e.g. switched over from the Pages tab) does
  // not count toward the visible facet state here.
  const hasAnyFacet = (showPageKind && Boolean(urlPageKind)) || urlDistrict.length > 0;

  return (
    <section aria-label={t('title')} className="cn-facet-bar">
      {showPageKind && (
        <div
          role="group"
          aria-label={t('kindGroupAria')}
          style={{ flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 6 }}
        >
          {PAGE_KIND_OPTIONS.map(({ value, labelKey }) => {
            const active = value === null ? !urlPageKind : urlPageKind === value;
            return (
              <button
                key={labelKey}
                type="button"
                aria-pressed={active}
                onClick={() => handleKindClick(value)}
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
                {t(`kind.${labelKey}`)}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        <label
          htmlFor="page-facet-district"
          style={{
            display: 'block',
            fontSize: 12.5,
            fontWeight: 600,
            color: 'var(--cr-text-2)',
            marginBottom: 4,
          }}
        >
          {t('districtLabel')}
        </label>
        <Input
          id="page-facet-district"
          placeholder={t('districtPlaceholder')}
          value={districtDraft}
          onChange={(e) => setDistrictDraft(e.target.value)}
          allowClear
        />
      </div>

      {hasAnyFacet && (
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
