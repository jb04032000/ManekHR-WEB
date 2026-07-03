'use client';

/**
 * CompanyDirectoryRail - the sticky left filter rail for `/connect/companies`.
 *
 * Real facets only: District / area (data-driven counts, single-select -> `?district=`)
 * and a Trust toggle (ERP-verified -> `?erpVerified=1`). All URL-driven (the server
 * page re-runs on change). Discrete clicks apply immediately - it is the free-text
 * keyword (the expensive query) that is gated behind the Search band's submit.
 */

import { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Switch } from 'antd';
import { Check, Search } from 'lucide-react';
import { browseCompanyLocations } from './company-page.actions';
import type { BrowseFacet, LocationSuggestion } from './entities.types';

/** How many popular districts to show before "Show more". */
const POPULAR_DISTRICTS = 8;

export default function CompanyDirectoryRail({ districts }: { districts: BrowseFacet[] }) {
  const t = useTranslations('connect.companies.rail');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeDistrict = searchParams.get('district') ?? '';
  const erpVerified = searchParams.get('erpVerified') === '1';

  // District search (long tail) + show-more for the popular list. Debounced in
  // the change handler (not an effect); the `latest` ref drops stale responses.
  const [districtQuery, setDistrictQuery] = useState('');
  const [districtResults, setDistrictResults] = useState<LocationSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTerm = useRef('');

  const onDistrictQueryChange = (text: string) => {
    setDistrictQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const term = text.trim();
    latestTerm.current = term;
    if (!term) {
      setDistrictResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const res = await browseCompanyLocations('district', term);
      if (latestTerm.current !== term) return; // a newer keystroke superseded this
      setDistrictResults(res.ok ? res.data : []);
      setSearching(false);
    }, 250);
  };
  const activeMinRating = searchParams.get('minRating') ?? '';
  const hasAny =
    !!searchParams.get('q') ||
    !!activeDistrict ||
    !!searchParams.get('specialization') ||
    erpVerified ||
    !!activeMinRating;

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      params.delete('page');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const selectDistrict = (d: string) =>
    push((p) => (activeDistrict === d ? p.delete('district') : p.set('district', d)));
  const toggleErp = (on: boolean) =>
    push((p) => (on ? p.set('erpVerified', '1') : p.delete('erpVerified')));
  const selectMinRating = (value: string) =>
    push((p) => (value ? p.set('minRating', value) : p.delete('minRating')));
  const clearAll = () =>
    push((p) => {
      p.delete('q');
      p.delete('district');
      p.delete('specialization');
      p.delete('erpVerified');
      p.delete('minRating');
    });

  // One district row (checkbox + name + count) - shared by the popular list and
  // the search results so both read identically.
  const renderDistrictOption = (value: string, count: number) => {
    const active = activeDistrict === value;
    return (
      <button
        type="button"
        aria-pressed={active}
        onClick={() => selectDistrict(value)}
        className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--cr-radius-sm)] border-0 px-2 py-1.5 text-start text-[12.5px] transition-colors"
        style={{
          background: active ? 'var(--cr-selected-bg)' : 'transparent',
          color: active ? 'var(--cr-selected-fg)' : 'var(--cr-text-2)',
          fontWeight: active ? 600 : 400,
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = 'var(--cr-hover-bg)';
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = 'transparent';
        }}
      >
        <span
          aria-hidden
          className="grid h-4 w-4 shrink-0 place-items-center rounded-[4px]"
          style={{
            border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border-strong)'}`,
            background: active ? 'var(--cr-primary)' : 'transparent',
            color: '#fff',
          }}
        >
          {active && <Check size={11} aria-hidden />}
        </span>
        <span className="min-w-0 flex-1 truncate">{value}</span>
        <span
          className="text-[11px]"
          style={{ color: 'var(--cr-text-5)', fontVariantNumeric: 'tabular-nums' }}
        >
          {count}
        </span>
      </button>
    );
  };

  const ratingOptions = [
    { value: '4.5', label: t('ratingPlus', { value: '4.5' }) },
    { value: '4', label: t('ratingPlus', { value: '4.0' }) },
    { value: '', label: t('ratingAny') },
  ];

  return (
    <aside
      aria-label={t('title')}
      className="sticky top-[72px] self-start overflow-hidden rounded-[var(--cr-radius-lg)]"
      style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-border)' }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--cr-divider)' }}
      >
        <span className="text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('title')}
        </span>
        {hasAny && (
          <button
            type="button"
            onClick={clearAll}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cr-text-link-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cr-text-link)')}
            className="cursor-pointer border-0 bg-transparent text-[11.5px] font-semibold transition-colors"
            style={{ color: 'var(--cr-text-link)' }}
          >
            {t('clearAll')}
          </button>
        )}
      </div>

      {districts.length > 0 && (
        <div className="px-3 py-3" style={{ borderBottom: '1px solid var(--cr-divider)' }}>
          <h4
            className="m-0 mb-3 px-1 pb-1 text-[11px] font-bold tracking-wide uppercase"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {t('district')}
          </h4>

          {/* Search the long tail of areas (beyond the popular list). */}
          <div className="relative mb-2">
            <Search
              size={13}
              aria-hidden
              className="pointer-events-none absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineStart: 8, color: 'var(--cr-text-4)' }}
            />
            <input
              type="text"
              value={districtQuery}
              onChange={(e) => onDistrictQueryChange(e.target.value)}
              placeholder={t('searchAreaPlaceholder')}
              aria-label={t('searchAreaPlaceholder')}
              className="w-full rounded-[var(--cr-radius-sm)] py-1.5 ps-7 pe-2 text-[12.5px]"
              style={{
                border: '1px solid var(--cr-border)',
                background: 'var(--cr-surface)',
                color: 'var(--cr-text)',
              }}
            />
          </div>

          {districtQuery.trim() ? (
            districtResults.length > 0 ? (
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {districtResults.map((d) => (
                  <li key={d.value}>{renderDistrictOption(d.value, d.count)}</li>
                ))}
              </ul>
            ) : (
              !searching && (
                <p className="m-0 px-1 py-1 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('noMatchingAreas')}
                </p>
              )
            )
          ) : (
            <>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {(expanded ? districts : districts.slice(0, POPULAR_DISTRICTS)).map((d) => (
                  <li key={d.value}>{renderDistrictOption(d.value, d.count)}</li>
                ))}
              </ul>
              {districts.length > POPULAR_DISTRICTS && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-1 cursor-pointer border-0 bg-transparent px-2 text-[12px] font-semibold transition-colors"
                  style={{ color: 'var(--cr-text-link)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--cr-text-link-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--cr-text-link)')}
                >
                  {expanded
                    ? t('showLess')
                    : t('showMore', { count: districts.length - POPULAR_DISTRICTS })}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <div className="px-4 py-3">
        <h4
          className="m-0 mb-3 text-[11px] font-bold tracking-wide uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('trust')}
        </h4>
        <label htmlFor="cd-rail-erp" className="flex cursor-pointer items-center gap-2.5">
          <Switch id="cd-rail-erp" size="small" checked={erpVerified} onChange={toggleErp} />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('erpVerified')}
            </span>
            <span className="block text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('erpVerifiedHint')}
            </span>
          </span>
        </label>
      </div>

      {/* Minimum owner rating - radio over the supported steps. Backed by the
          real seller-rating aggregate; unrated owners simply never match. */}
      <div className="px-4 py-3" style={{ borderTop: '1px solid var(--cr-divider)' }}>
        <h4
          className="m-0 mb-3 text-[11px] font-bold tracking-wide uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('minRating')}
        </h4>
        <div role="radiogroup" aria-label={t('minRating')} className="flex flex-col gap-0.5">
          {ratingOptions.map((opt) => {
            const active = activeMinRating === opt.value;
            return (
              <button
                key={opt.value || 'any'}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => selectMinRating(opt.value)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-[var(--cr-radius-sm)] border-0 px-2 py-1.5 text-start text-[12.5px] transition-colors"
                style={{
                  background: active ? 'var(--cr-selected-bg)' : 'transparent',
                  color: active ? 'var(--cr-selected-fg)' : 'var(--cr-text-2)',
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'var(--cr-hover-bg)';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span
                  aria-hidden
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full"
                  style={{
                    border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border-strong)'}`,
                  }}
                >
                  {active && (
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: 'var(--cr-primary)' }}
                    />
                  )}
                </span>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
