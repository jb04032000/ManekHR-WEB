'use client';

/**
 * AudienceGeoTradeFields - the boost Step 3 ("Who should see it?") location +
 * trade pickers. Replaces the old hardcoded Gujarat-only district chips and the
 * fixed trade chips with:
 *   - a State -> District picker over the shared india-geo dataset (all-India,
 *     multi-state); Gujarat (the live market) is the default for the fast path.
 *   - a trade picker that keeps popular quick-picks AND allows custom + multiple
 *     trades via the ConnectTag `searchTags` typeahead (the same vocabulary the
 *     marketplace listing form uses).
 *
 * VALUES: `districts` holds district NAMES (e.g. "Surat", "Devbhumi Dwarka") and
 * `sectors` holds trade slugs/terms. Both are matched case-insensitively AND
 * separator-agnostically by the backend (ads/lib/targeting-normalize), so they
 * match today's free-text profile data without a migration.
 *
 * Links: india-geo dataset (features/connect/geo); searchTags (marketplace
 * tag.actions); consumed by BoostComposer; sent verbatim in targeting.{districts,
 * sectors}.
 */

import { useCallback, useId, useMemo, useRef, useState } from 'react';
import { Select } from 'antd';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { INDIA_GEO } from '@/features/connect/geo/india-geo';
import { BOOST_SECTORS } from './boost-targeting';
import { searchTags } from '../marketplace/tag.actions';

interface Props {
  /** Selected district NAMES (across any states). */
  districts: string[];
  /** Selected trade slugs/terms. */
  sectors: string[];
  onDistrictsChange: (next: string[]) => void;
  onSectorsChange: (next: string[]) => void;
}

type TradeOption = { value: string; label: string };

/** Default browse state = the live market, so the common path is one tap. */
const DEFAULT_STATE_SLUG = 'gujarat';

export default function AudienceGeoTradeFields({
  districts,
  sectors,
  onDistrictsChange,
  onSectorsChange,
}: Props) {
  const t = useTranslations('connect.boosts.cfg.audience');
  const stateLabelId = useId();
  const tradeLabelId = useId();

  // Which state's districts are currently shown. Selected districts persist
  // across state switches (selection is by name, not by the browsed state).
  const [browseState, setBrowseState] = useState<string>(DEFAULT_STATE_SLUG);

  const stateOptions = useMemo(
    () => INDIA_GEO.map((s) => ({ value: s.slug, label: s.isUT ? `${s.name} (UT)` : s.name })),
    [],
  );
  const currentDistricts = useMemo(
    () => INDIA_GEO.find((s) => s.slug === browseState)?.districts ?? [],
    [browseState],
  );
  const selectedSet = useMemo(() => new Set(districts), [districts]);

  const toggleDistrict = useCallback(
    (name: string) => {
      onDistrictsChange(
        selectedSet.has(name) ? districts.filter((d) => d !== name) : [...districts, name],
      );
    },
    [districts, selectedSet, onDistrictsChange],
  );

  // ── Trade typeahead (popular options + live ConnectTag suggestions) ──────────
  const popularOptions = useMemo<TradeOption[]>(
    () => BOOST_SECTORS.map((s) => ({ value: s, label: s })),
    [],
  );
  const [tradeOptions, setTradeOptions] = useState<TradeOption[]>(popularOptions);
  const searchSeq = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onTradeSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const term = q.trim();
      if (!term) {
        setTradeOptions(popularOptions);
        return;
      }
      const seq = ++searchSeq.current;
      debounceRef.current = setTimeout(() => {
        void searchTags(term).then((res) => {
          if (searchSeq.current !== seq) return; // stale
          const live = res.ok ? res.data.map((s) => ({ value: s.slug, label: s.label })) : [];
          // Popular first, then live suggestions not already in popular.
          const have = new Set(popularOptions.map((o) => o.value));
          setTradeOptions([...popularOptions, ...live.filter((o) => !have.has(o.value))]);
        });
      }, 300);
    },
    [popularOptions],
  );

  return (
    <>
      {/* ── Location: State -> District ── */}
      <fieldset className="m-0 mb-4 border-0 p-0">
        <legend
          id={stateLabelId}
          className="m-0 mb-2.5 text-[11px] font-bold tracking-[0.06em] uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('districtsTitle')}
        </legend>

        <Select
          aria-labelledby={stateLabelId}
          showSearch
          value={browseState}
          options={stateOptions}
          onChange={setBrowseState}
          optionFilterProp="label"
          style={{ width: '100%', maxWidth: 320 }}
          placeholder={t('statePlaceholder')}
        />

        {/* Districts of the browsed state - toggle chips. */}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {currentDistricts.map((d) => {
            const on = selectedSet.has(d.name);
            return (
              <button
                key={d.slug}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDistrict(d.name)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold transition-colors"
                style={{
                  border: on ? '1px solid var(--cr-primary-light)' : '1px solid var(--cr-border)',
                  background: on ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
                  color: on ? 'var(--cr-primary-hover)' : 'var(--cr-text-2)',
                  cursor: 'pointer',
                }}
              >
                {on && <span aria-hidden>✓</span>}
                {d.name}
              </button>
            );
          })}
        </div>

        {/* Selected districts across all states (so multi-state stays visible). */}
        {districts.length > 0 ? (
          <div className="mt-3">
            <div
              className="mb-1.5 text-[10.5px] font-bold tracking-[0.05em] uppercase"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {t('selectedAreas', { count: districts.length })}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {districts.map((name) => (
                <span
                  key={name}
                  className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] font-semibold"
                  style={{
                    background: 'var(--cr-primary-light)',
                    color: 'var(--cr-primary-hover)',
                  }}
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => toggleDistrict(name)}
                    aria-label={t('removeArea', { name })}
                    style={{ display: 'inline-flex', cursor: 'pointer' }}
                  >
                    <X size={12} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="m-0 mt-2 text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('allAreasHint')}
          </p>
        )}
      </fieldset>

      {/* ── Trade / category: popular + custom + multiple ── */}
      <fieldset className="m-0 mb-4 border-0 p-0">
        <legend
          id={tradeLabelId}
          className="m-0 mb-2.5 text-[11px] font-bold tracking-[0.06em] uppercase"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {t('sectorsTitle')}
        </legend>
        <Select
          aria-labelledby={tradeLabelId}
          mode="tags"
          value={sectors}
          options={tradeOptions}
          onChange={(next: string[]) => onSectorsChange(next)}
          onSearch={onTradeSearch}
          filterOption={false}
          tokenSeparators={[',']}
          style={{ width: '100%' }}
          placeholder={t('tradesPlaceholder')}
          notFoundContent={null}
        />
        <p className="m-0 mt-1.5 text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('tradesHint')}
        </p>
      </fieldset>
    </>
  );
}
