'use client';

/**
 * ListingFacetPanel - the listings facet strip for `/connect/marketplace`
 * (M1.6.1) and, reused unchanged, the `/connect/search` listings tab (M1.6.6).
 *
 * Controls, all reducing to existing backend DTO params (no new param). Category
 * now lives in the top `CategoryStrip`; this rail owns keyword / district / price
 * / tags:
 *
 *   - keyword (debounced 300 ms) -> `?q=`. A listings-scoped keyword filter,
 *     distinct from the global `ConnectSearchBar` typeahead which jumps to the
 *     federated `/connect/search`.
 *   - district (debounced 300 ms) -> `?district=`.
 *   - price range slider -> `?priceMin=&priceMax=`. The pure mapping lives in
 *     `priceRangeToParams`; a bound at a slider extreme is dropped.
 *
 * Every change reads the live URL via `useSearchParams`, mutates only the
 * relevant key(s), and pushes with `router.push`. `usePathname` keeps the same
 * component correct on both `/connect/marketplace` and `/connect/search`.
 * Standard #17: the price control ships an `InfoTooltip` because the "no upper
 * limit" end is not self-evident to a workshop owner.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Input, InputNumber, Slider, Switch } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { InfoTooltip } from '@/components/ui';

// Shared rail styling: each facet group sits in a divider-separated SECTION with
// a small-caps header, mirroring the reference filter rail's structure. cr-
// tokens only; no new palette.
const SECTION_STYLE: CSSProperties = {
  borderTop: '1px solid var(--cr-border-light)',
  paddingTop: 13,
  paddingBottom: 13,
};
const SECTION_HEADER_STYLE: CSSProperties = {
  display: 'block',
  margin: '0 0 8px',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--cr-text-4)',
};
/** One pill style for both the tag and district single-select chips. */
function chipStyle(active: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    borderRadius: 'var(--cr-radius-full)',
    border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border-light)'}`,
    background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
    color: active ? 'var(--cr-surface)' : 'var(--cr-text-2)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  };
}

/** Maximum number of tag chips shown in the "Product types" strip. */
const MAX_TAG_CHIPS = 12;
/** Maximum number of district quick-pick chips shown in the "Location" group.
 *  Keeps the list bounded (top-N by listing count); the free-text input below
 *  covers anything outside the top-N, so this is never a long static list. */
const MAX_DISTRICT_CHIPS = 6;

/** Title-case a lowercased district key for display ("ring road" -> "Ring Road").
 *  The backend lowercases the `district` filter input, so the title-cased value
 *  still matches; this is display-only. Mirrors ListingGridCard's district cap. */
function titleCaseDistrict(value: string): string {
  return value.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}
import { PRICE_MAX, priceRangeToParams } from './url-params';
import { formatRupees } from './format';

const DEBOUNCE_MS = 300;
const PRICE_STEP = 500;

/** Coerce the AntD Slider value union into a `[min, max]` tuple. */
function toRange(value: number | number[]): [number, number] {
  if (Array.isArray(value)) return [value[0] ?? 0, value[1] ?? PRICE_MAX];
  return [value, value];
}

interface ListingFacetPanelProps {
  /**
   * Show the in-panel keyword field. True on /connect/marketplace (the panel
   * owns q). False on the /connect/search listings tab, where the header
   * ConnectSearchBar owns q, so the field would duplicate it and clear-all must
   * not wipe the active search.
   */
  showKeyword?: boolean;
  /**
   * Tag-slug to listing count from the backend listing search result
   * (`tagCounts` field). When provided and non-empty, a "Product types" chip
   * group is rendered below the category pills (top ~12 by count, desc).
   * Absent or empty: the group is hidden entirely.
   */
  tagCounts?: Record<string, number>;
  /**
   * Lowercased-district to listing count (backend facet distribution). When
   * provided and non-empty, the top-N districts render as single-select
   * quick-pick chips above the free-text district input (each sets the existing
   * `?district=` param). Absent or empty: only the free-text input shows. Keeps
   * the Location filter data-driven and bounded (never a long static list).
   */
  districtCounts?: Record<string, number>;
}

export default function ListingFacetPanel({
  showKeyword = true,
  tagCounts,
  districtCounts,
}: ListingFacetPanelProps) {
  const t = useTranslations('connect.marketplace.facets');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Live URL state, recomputed every render so external navigation (back
  // button, category pill, manual URL edit) is reflected without a re-mount.
  const urlQ = searchParams.get('q') ?? '';
  const urlCategory = searchParams.get('category');
  const urlTag = searchParams.get('tag');
  const urlVerified = searchParams.get('verified') === '1';
  const urlDistrict = searchParams.get('district') ?? '';
  const rawMin = Number(searchParams.get('priceMin'));
  const rawMax = Number(searchParams.get('priceMax'));
  const urlPriceMin = Number.isFinite(rawMin) && rawMin > 0 ? rawMin : 0;
  const urlPriceMax =
    Number.isFinite(rawMax) && rawMax > 0 && rawMax < PRICE_MAX ? rawMax : PRICE_MAX;

  const hasAnyFacet =
    (showKeyword && urlQ.length > 0) ||
    Boolean(urlCategory) ||
    Boolean(urlTag) ||
    urlVerified ||
    urlDistrict.length > 0 ||
    searchParams.has('priceMin') ||
    searchParams.has('priceMax');

  // Local drafts for the typing / dragging paths. Synced from the URL on
  // external navigation via the previous-value render pattern (no effect).
  const [keywordDraft, setKeywordDraft] = useState(urlQ);
  const [districtDraft, setDistrictDraft] = useState(urlDistrict);
  const [priceDraft, setPriceDraft] = useState<[number, number]>([urlPriceMin, urlPriceMax]);

  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) {
    setPrevUrlQ(urlQ);
    setKeywordDraft(urlQ);
  }
  const [prevUrlDistrict, setPrevUrlDistrict] = useState(urlDistrict);
  if (urlDistrict !== prevUrlDistrict) {
    setPrevUrlDistrict(urlDistrict);
    setDistrictDraft(urlDistrict);
  }
  const priceKey = `${urlPriceMin}:${urlPriceMax}`;
  const [prevPriceKey, setPrevPriceKey] = useState(priceKey);
  if (priceKey !== prevPriceKey) {
    setPrevPriceKey(priceKey);
    setPriceDraft([urlPriceMin, urlPriceMax]);
  }

  /** Push a new URL with a caller-defined param mutation applied. */
  const pushWith = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  // Keyword debounced sync. Fires only when the draft has diverged from the URL.
  useEffect(() => {
    if (keywordDraft === urlQ) return;
    const timer = setTimeout(() => {
      pushWith((params) => {
        const trimmed = keywordDraft.trim();
        if (trimmed) params.set('q', trimmed);
        else params.delete('q');
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [keywordDraft, urlQ, pushWith]);

  // District debounced sync.
  useEffect(() => {
    if (districtDraft === urlDistrict) return;
    const timer = setTimeout(() => {
      pushWith((params) => {
        const trimmed = districtDraft.trim();
        if (trimmed) params.set('district', trimmed);
        else params.delete('district');
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [districtDraft, urlDistrict, pushWith]);

  const handleTagClick = useCallback(
    (slug: string) => {
      pushWith((params) => {
        if (urlTag === slug) params.delete('tag');
        else params.set('tag', slug);
      });
    },
    [pushWith, urlTag],
  );

  /** Top MAX_TAG_CHIPS tags sorted by count desc. Stable across renders when
   *  tagCounts reference is stable (Server Component passes a new object per
   *  navigation, which is correct). */
  const sortedTags = useMemo(() => {
    if (!tagCounts) return [];
    return Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_TAG_CHIPS)
      .map(([slug]) => slug);
  }, [tagCounts]);

  /** Top-N districts by listing count (desc), empties dropped. Bounded by
   *  MAX_DISTRICT_CHIPS; the free-text input covers the rest. */
  const topDistricts = useMemo(() => {
    if (!districtCounts) return [];
    return Object.entries(districtCounts)
      .filter(([key]) => key.trim().length > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, MAX_DISTRICT_CHIPS)
      .map(([key, count]) => ({ key, label: titleCaseDistrict(key), count }));
  }, [districtCounts]);

  // Single-select district chip -> the existing `?district=` param. The display-
  // cased label is written (the BE lowercases when matching); re-click clears.
  // The free-text input below re-syncs from the URL via the prev-value render
  // pattern, so it reflects the chip choice without a manual draft set here.
  const handleDistrictChip = useCallback(
    (label: string, isActive: boolean) => {
      pushWith((params) => {
        if (isActive) params.delete('district');
        else params.set('district', label);
      });
    },
    [pushWith],
  );

  const handlePriceComplete = useCallback(
    (value: number | number[]) => {
      pushWith((params) => {
        const { priceMin, priceMax } = priceRangeToParams(toRange(value));
        if (priceMin !== undefined) params.set('priceMin', String(priceMin));
        else params.delete('priceMin');
        if (priceMax !== undefined) params.set('priceMax', String(priceMax));
        else params.delete('priceMax');
      });
    },
    [pushWith],
  );

  const handleVerifiedChange = useCallback(
    (checked: boolean) => {
      pushWith((params) => {
        if (checked) params.set('verified', '1');
        else params.delete('verified');
      });
    },
    [pushWith],
  );

  const handleClearAll = useCallback(() => {
    pushWith((params) => {
      if (showKeyword) params.delete('q');
      params.delete('category');
      params.delete('tag');
      params.delete('verified');
      params.delete('district');
      params.delete('priceMin');
      params.delete('priceMax');
    });
  }, [pushWith, showKeyword]);

  return (
    <section
      aria-label={t('title')}
      // Vertical filter rail: a labelled, divider-separated stack of facet
      // SECTIONS (Product types / District / Price / Trust) mirroring the
      // reference rail's structure. Category lives in the top strip.
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px 14px',
        marginBottom: 'var(--cr-space-md)',
        // A defined white panel (was a near-cream surface-2 that blended into the
        // page); border + a whisper shadow read it as a real filter card.
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border-light)',
        borderRadius: 'var(--cr-radius-lg)',
        boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
      }}
    >
      {/* Header: panel title + clear-all in the standard top-right slot. */}
      <div
        className="flex items-center justify-between"
        style={{ minHeight: 24, paddingBottom: 13 }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('title')}
        </p>
        {hasAnyFacet && (
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            aria-label={t('clearAllAria')}
            onClick={handleClearAll}
          >
            {t('clearAll')}
          </DsButton>
        )}
      </div>

      {/* PRODUCT TYPES (tag facet) */}
      {sortedTags.length > 0 && (
        <div style={SECTION_STYLE}>
          <p style={SECTION_HEADER_STYLE}>{t('tagsTitle')}</p>
          <div
            role="group"
            aria-label={t('tagsTitle')}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}
          >
            {sortedTags.map((slug) => {
              const active = urlTag === slug;
              return (
                <button
                  key={slug}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleTagClick(slug)}
                  style={chipStyle(active)}
                >
                  {slug}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* SEARCH LISTINGS (keyword) */}
      {showKeyword && (
        <div style={SECTION_STYLE}>
          <label htmlFor="mp-facet-keyword" style={SECTION_HEADER_STYLE}>
            {t('keywordLabel')}
          </label>
          <Input
            id="mp-facet-keyword"
            size="small"
            placeholder={t('keywordPlaceholder')}
            value={keywordDraft}
            onChange={(e) => setKeywordDraft(e.target.value)}
            allowClear
          />
        </div>
      )}

      {/* DISTRICT (location chips + free-text). The chips are real top-N facet
          counts; the input covers anything outside the top-N. */}
      <div style={SECTION_STYLE}>
        <label htmlFor="mp-facet-district" style={SECTION_HEADER_STYLE}>
          {t('districtLabel')}
        </label>
        {topDistricts.length > 0 && (
          <div
            role="group"
            aria-label={t('districtLabel')}
            style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}
          >
            {topDistricts.map(({ key, label, count }) => {
              const isActive = urlDistrict.trim().toLowerCase() === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => handleDistrictChip(label, isActive)}
                  style={chipStyle(isActive)}
                >
                  {label}
                  <span
                    className="tabular-nums"
                    style={{
                      marginLeft: 5,
                      fontSize: 11,
                      fontWeight: 700,
                      color: isActive ? 'var(--cr-surface)' : 'var(--cr-text-4)',
                      opacity: isActive ? 0.85 : 1,
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <Input
          id="mp-facet-district"
          size="small"
          placeholder={t('districtPlaceholder')}
          value={districtDraft}
          onChange={(e) => setDistrictDraft(e.target.value)}
          allowClear
        />
      </div>

      {/* PRICE RANGE: min/max number inputs (typed precision) + the slider, both
          driving the same priceDraft -> ?priceMin=&priceMax=. Inputs push on blur
          (handlePriceComplete drops a bound that sits at a slider extreme). */}
      <div style={SECTION_STYLE}>
        <span
          style={{ ...SECTION_HEADER_STYLE, display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          {t('priceLabel')}
          <InfoTooltip
            text={t('priceLabel')}
            body={<p style={{ margin: 0 }}>{t('priceHelp')}</p>}
            ariaLabel={t('priceLabel')}
          />
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <InputNumber
            size="small"
            min={0}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={priceDraft[0]}
            onChange={(v) => setPriceDraft([typeof v === 'number' ? v : 0, priceDraft[1]])}
            onBlur={() => handlePriceComplete(priceDraft)}
            prefix="₹"
            aria-label={t('minLabel')}
            placeholder={t('minLabel')}
            style={{ width: '100%' }}
          />
          <span aria-hidden style={{ fontSize: 12, color: 'var(--cr-text-4)' }}>
            -
          </span>
          <InputNumber
            size="small"
            min={0}
            max={PRICE_MAX}
            step={PRICE_STEP}
            value={priceDraft[1] >= PRICE_MAX ? null : priceDraft[1]}
            onChange={(v) => setPriceDraft([priceDraft[0], typeof v === 'number' ? v : PRICE_MAX])}
            onBlur={() => handlePriceComplete(priceDraft)}
            prefix="₹"
            aria-label={t('maxLabel')}
            placeholder={t('maxLabel')}
            style={{ width: '100%' }}
          />
        </div>
        <Slider
          range
          min={0}
          max={PRICE_MAX}
          step={PRICE_STEP}
          value={priceDraft}
          onChange={(value) => setPriceDraft(toRange(value))}
          onChangeComplete={handlePriceComplete}
          tooltip={{ formatter: (value) => formatRupees(typeof value === 'number' ? value : 0) }}
          aria-label={t('priceAria')}
        />
      </div>

      {/* TRUST (verified sellers). ERP-active-only / rating / response-time
          filters from the reference are intentionally absent: no backing data. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('trustTitle')}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--cr-text-2)',
              }}
            >
              {t('verifiedLabel')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--cr-text-4)' }}>{t('verifiedHelp')}</span>
          </div>
          <Switch
            size="small"
            checked={urlVerified}
            onChange={handleVerifiedChange}
            aria-label={t('verifiedLabel')}
          />
        </div>
      </div>
    </section>
  );
}
