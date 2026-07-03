'use client';

/**
 * StateDistrictPicker - a single-location State -> District chooser over the
 * shared india-geo dataset (features/connect/geo/india-geo). Two linked AntD
 * Selects (state, then its districts). Picking a district emits the CANONICAL
 * location triple the rest of Connect expects:
 *   - `district`        the district NAME exactly as in india-geo (e.g. "Surat").
 *                       This is the matched value: the boost matcher compares a
 *                       targeted district NAME against ConnectProfile.district
 *                       (ads/lib/targeting-normalize, case-insensitive), so the
 *                       profile MUST store the name, not a slug.
 *   - `geoStateSlug`    the state slug from india-geo (additive structured loc).
 *   - `geoDistrictSlug` the district slug from india-geo (additive structured loc).
 *
 * Single-select on purpose (a person has ONE home location), unlike the boost
 * composer's AudienceGeoTradeFields which multi-selects targeted districts; both
 * read the SAME dataset + the SAME canonical-name contract so a profile saved
 * here matches a region-targeted boost set there.
 *
 * Used by: profile edit (EditSectionModal header) + onboarding (OnboardingClient).
 * Writes flow through the connect profile PATCH (geoStateSlug/geoDistrictSlug are
 * accepted by UpdateConnectProfileDto + the ConnectProfile schema).
 */

import { useId, useMemo } from 'react';
import { Select } from 'antd';
import { INDIA_GEO } from './india-geo';

/** The canonical location triple this picker reads + writes. */
export interface StateDistrictValue {
  /** District NAME exactly as in india-geo (the boost-matched value). Empty when cleared. */
  district: string;
  /** State slug from india-geo. Empty when cleared. */
  geoStateSlug: string;
  /** District slug from india-geo. Empty when cleared. */
  geoDistrictSlug: string;
}

/** An empty (no-location) value. */
export const EMPTY_STATE_DISTRICT: StateDistrictValue = {
  district: '',
  geoStateSlug: '',
  geoDistrictSlug: '',
};

/**
 * Pure resolver: given a state slug + a chosen district slug, build the canonical
 * triple (NAME + both slugs). Returns the empty triple when either side is unset
 * or not found in the dataset. Exported so the mapping is unit-testable without
 * rendering the component (the picker delegates here so the save shape is proven).
 */
export function resolveStateDistrict(
  stateSlug: string | undefined,
  districtSlug: string | undefined,
): StateDistrictValue {
  if (!stateSlug || !districtSlug) return { ...EMPTY_STATE_DISTRICT };
  const state = INDIA_GEO.find((s) => s.slug === stateSlug);
  const district = state?.districts.find((d) => d.slug === districtSlug);
  if (!state || !district) return { ...EMPTY_STATE_DISTRICT };
  return {
    district: district.name,
    geoStateSlug: state.slug,
    geoDistrictSlug: district.slug,
  };
}

/**
 * Pure seeder: derive the picker's two dropdown slugs from a stored value. We
 * trust the stored slugs when present; otherwise we recover the state slug by
 * locating the stored district NAME in the dataset (so a legacy free-text
 * district like "Surat" still pre-selects the right pair). Exported for the test.
 */
export function seedStateDistrict(value: Partial<StateDistrictValue> | undefined): {
  stateSlug: string | undefined;
  districtSlug: string | undefined;
} {
  if (!value) return { stateSlug: undefined, districtSlug: undefined };
  if (value.geoStateSlug && value.geoDistrictSlug) {
    return { stateSlug: value.geoStateSlug, districtSlug: value.geoDistrictSlug };
  }
  // Recover from the free-text NAME (legacy rows have no slugs): find the first
  // state whose district name matches (case-insensitive) so the dropdowns open
  // on the stored location instead of blank.
  const name = (value.district ?? '').trim().toLowerCase();
  if (!name) return { stateSlug: undefined, districtSlug: undefined };
  for (const s of INDIA_GEO) {
    const d = s.districts.find((dd) => dd.name.toLowerCase() === name);
    if (d) return { stateSlug: s.slug, districtSlug: d.slug };
  }
  return { stateSlug: undefined, districtSlug: undefined };
}

interface Props {
  /**
   * Current stored value (canonical triple). Optional because when this picker
   * is wrapped by an AntD `Form.Item`, the Form injects `value`/`onChange` and
   * passes `undefined` for an empty field; `seedStateDistrict` tolerates that.
   */
  value?: StateDistrictValue;
  /** Emits the next canonical triple on any change (incl. clear). */
  onChange: (next: StateDistrictValue) => void;
  /** Accessible label for the State select (the District select is labelled too). */
  stateLabel: string;
  districtLabel: string;
  statePlaceholder: string;
  districtPlaceholder: string;
  /** Disable both selects (e.g. while a parent form is saving). */
  disabled?: boolean;
}

export default function StateDistrictPicker({
  value,
  onChange,
  stateLabel,
  districtLabel,
  statePlaceholder,
  districtPlaceholder,
  disabled,
}: Props) {
  const stateLabelId = useId();
  const districtLabelId = useId();

  // Derive the two dropdown selections from the stored value (slugs preferred,
  // else recovered from a legacy free-text name) so the picker opens populated.
  const { stateSlug, districtSlug } = useMemo(() => seedStateDistrict(value), [value]);

  const stateOptions = useMemo(
    () => INDIA_GEO.map((s) => ({ value: s.slug, label: s.isUT ? `${s.name} (UT)` : s.name })),
    [],
  );
  const districtOptions = useMemo(
    () =>
      (INDIA_GEO.find((s) => s.slug === stateSlug)?.districts ?? []).map((d) => ({
        value: d.slug,
        label: d.name,
      })),
    [stateSlug],
  );

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <span id={stateLabelId} className="sr-only">
          {stateLabel}
        </span>
        <Select
          aria-labelledby={stateLabelId}
          showSearch
          allowClear
          disabled={disabled}
          value={stateSlug ?? undefined}
          options={stateOptions}
          optionFilterProp="label"
          placeholder={statePlaceholder}
          style={{ width: '100%' }}
          // Switching state clears the district (its district list changed); a
          // half-set pair would emit an empty triple anyway, so reset cleanly.
          onChange={(nextState?: string) => onChange(resolveStateDistrict(nextState, undefined))}
        />
      </div>
      <div className="flex-1">
        <span id={districtLabelId} className="sr-only">
          {districtLabel}
        </span>
        <Select
          aria-labelledby={districtLabelId}
          showSearch
          allowClear
          disabled={disabled || !stateSlug}
          value={districtSlug ?? undefined}
          options={districtOptions}
          optionFilterProp="label"
          placeholder={districtPlaceholder}
          style={{ width: '100%' }}
          onChange={(nextDistrict?: string) =>
            onChange(resolveStateDistrict(stateSlug, nextDistrict))
          }
        />
      </div>
    </div>
  );
}
