'use client';

/**
 * JobFilterRail - the filter rail on the Jobs "Find work" (Open) tab. Rebuilt to
 * the owner reference + the marketplace ListingFacetPanel visual family: a white
 * panel with divider-separated SECTIONS, small-caps 11px headers, a header row
 * (title left + Clear-all top-right shown only when a filter is active). EVERY
 * section is always visible (no collapsed "More filters").
 *
 * Cross-module links:
 * - features/connect/jobs/FacetGroup.tsx renders each counted multi-check facet
 *   (Location / Role / Employment type / Skills / Machine type). FacetGroup keeps
 *   a selected value visible even when its count drops to 0 (selected-always-on).
 * - features/connect/jobs/useBoardFilters.ts owns the real filter state; on
 *   desktop JobBoard passes its setFilter straight through (apply-on-change). On
 *   mobile JobBoard passes a STAGING setter + the staged snapshot so taps do not
 *   hit the server until "Show N jobs" (see JobBoard mobile drawer). Everything
 *   here flows through the single setFilter(patch) prop - NO direct URL writes.
 * - features/connect/jobs/jobs.types.ts BoardFilters / BoardFacets / FacetEntry.
 * - The marketplace twin is features/connect/marketplace/ListingFacetPanel.tsx;
 *   SECTION_STYLE / SECTION_HEADER_STYLE are copied from it so the two rails read
 *   as one design system. Keep them in sync if either is restyled.
 *
 * Layout, top to bottom (all always visible):
 *   Header (Filters + Clear all) -> Open positions only (Switch + subtitle) ->
 *   Location (multi-check + search-within/add-your-own when >8) -> Role (multi-check)
 *   -> Employment type (multi-check) -> Pay type (single-select wageType chips with
 *   counts) -> Skills (multi-check, csv) -> Machine type (multi-check) -> Posted
 *   (radios).
 *
 * Gotcha: Pay type REPLACED a flat salary-range slider, which was misleading - a
 * single rupee band cannot mean the same across per-day / per-hour / per-piece /
 * per-month pay (BE matches payMin/payMax on wageMin/wageMax regardless of period).
 * Filtering by HOW you are paid (wageType) is the period-safe control. Role lives
 * INTO the rail (plural roles); the board role strip was rewired to filters.roles
 * to avoid a dual-control desync (BE plural-supersedes-singular) - see JobBoard.tsx.
 */

import { useMemo, type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { Switch } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { track } from '@/lib/analytics';
import FacetGroup from './FacetGroup';
import {
  JOB_EMPLOYMENT_TYPES,
  JOB_ROLE_PRESETS,
  type BoardFacets,
  type BoardFilters,
  type JobWageType,
} from './jobs.types';

// Shared rail styling, copied verbatim from the marketplace ListingFacetPanel so
// the Jobs rail is the SAME visual family (divider-separated sections, small-caps
// 11px headers). cr- tokens only; no new palette. Keep in sync with that file.
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

const POSTED_WINDOWS: Array<{ key: string; days: number | null }> = [
  { key: 'postedAny', days: null },
  { key: 'posted24h', days: 1 },
  { key: 'postedWeek', days: 7 },
  { key: 'postedMonth', days: 30 },
];

// Pay type (how the wage is expressed). Single-select -> filters.wageType. This
// REPLACED a flat "salary range" slider, which was misleading: a single rupee
// band cannot mean the same thing across per-day / per-hour / per-piece / per-
// month pay (the BE matches payMin/payMax on wageMin/wageMax regardless of
// period, so 500/day and 500/month collided). Filtering by HOW you are paid is
// the meaningful, period-safe control for this audience. Order mirrors the
// composer WAGE_TYPES + BE JOB_WAGE_TYPES; labels via workType.<slug>.
const WAGE_TYPES: JobWageType[] = ['hourly', 'daily', 'piece', 'monthly'];

// Humanize a free-text facet value (dashes/underscores to spaces, capitalize).
function humanize(value: string): string {
  return value.replace(/[-_]/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

interface Props {
  /** Current filter snapshot (live filters on desktop, staged filters in the drawer). */
  filters: BoardFilters;
  /** Facet counts for the active filter set (null while a fetch is in flight). */
  facets: BoardFacets | null;
  /** Merge a partial change. Desktop = hook.setFilter (live); mobile = staging setter. */
  setFilter: (patch: Partial<BoardFilters>) => void;
  /** Reset every filter (keeps view/sort). Shown only when something is active. */
  onClearAll: () => void;
}

/** Toggle one value inside a string[] facet (add if absent, remove if present). */
function toggleIn(arr: string[] | undefined, value: string): string[] | undefined {
  const cur = arr ?? [];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return next.length ? next : undefined;
}

export default function JobFilterRail({ filters, facets, setFilter, onClearAll }: Props) {
  const t = useTranslations('connect.jobs');

  // Analytics: a single facet checkbox toggle. { facet, value } - one event per tap
  // (vs the debounced connect.jobs.filter_applied that fires once per committed set
  // in useBoardFilters). Wired into every multi-select FacetGroup below. Works the
  // same in the desktop rail (live) and the mobile staged drawer.
  const trackToggle = (facet: string) => (value: string) =>
    track('connect.jobs.facet_toggled', { facet, value });

  const districts = filters.districts ?? [];
  const roles = filters.roles ?? [];
  const employmentTypes = filters.employmentTypes ?? [];
  const machineTypes = filters.machineTypes ?? [];
  const skills = filters.skills ? filters.skills.split(',').filter(Boolean) : [];

  // `hasAny` drives the Clear-all visibility. includeFilled === true means the
  // open-only toggle was turned OFF (filled jobs shown), an active non-default.
  const hasAny =
    districts.length > 0 ||
    roles.length > 0 ||
    employmentTypes.length > 0 ||
    machineTypes.length > 0 ||
    skills.length > 0 ||
    Boolean(filters.wageType) ||
    filters.postedWithinDays != null ||
    filters.includeFilled != null ||
    Boolean(filters.q);

  // Role label: a known preset -> roleName.<slug>; an unexpected/custom value ->
  // humanize. Mirrors roleLabel in jobs.types (kept inline so FacetGroup gets a
  // simple value->string fn).
  const roleLabelFor = useMemo(
    () => (v: string) =>
      (JOB_ROLE_PRESETS as readonly string[]).includes(v) ? t(`roleName.${v}`) : humanize(v),
    [t],
  );

  // Employment-type label uses the existing employmentTypeOpt.<slug> i18n when the
  // value is a known enum, otherwise humanize (defensive for unexpected data).
  const employmentLabel = useMemo(
    () => (v: string) =>
      (JOB_EMPLOYMENT_TYPES as readonly string[]).includes(v)
        ? t(`employmentTypeOpt.${v}`)
        : humanize(v),
    [t],
  );

  // Pay-type counts from the wageType facet (value -> count) for the chip badges.
  const wageTypeCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const f of facets?.wageType ?? []) m[f.value] = f.count;
    return m;
  }, [facets]);

  return (
    <section
      aria-label={t('filters.title')}
      // White panel, border + whisper shadow + radius-lg - the SAME container the
      // marketplace ListingFacetPanel uses so the two rails read as one family.
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 16px 14px',
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border-light)',
        borderRadius: 'var(--cr-radius-lg)',
        boxShadow: '0 1px 3px rgba(16,24,40,0.06)',
      }}
    >
      {/* Header: panel title + Clear-all in the standard top-right slot (only when
          a filter is active). */}
      <div
        className="flex items-center justify-between"
        style={{ minHeight: 24, paddingBottom: 13 }}
      >
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--cr-text)' }}>
          {t('filters.title')}
        </p>
        {hasAny && (
          <DsButton dsVariant="ghost" dsSize="sm" onClick={onClearAll}>
            {t('filters.clear')}
          </DsButton>
        )}
      </div>

      {/* OPEN POSITIONS ONLY - a Switch + a subtitle line. Maps to includeFilled
          inverse: checked = hide filled (includeFilled undefined); unchecked =
          show filled (includeFilled true). Default checked since includeFilled is
          normally undefined. */}
      <div style={SECTION_STYLE}>
        <div className="flex items-start justify-between gap-3">
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: 'block',
                fontSize: 12.5,
                fontWeight: 600,
                color: 'var(--cr-text-2)',
              }}
            >
              {t('filters.openOnly')}
            </span>
            <span style={{ fontSize: 11, color: 'var(--cr-text-4)' }}>
              {t('filters.openOnlySubtitle')}
            </span>
          </div>
          <Switch
            size="small"
            className="cursor-pointer"
            checked={filters.includeFilled !== true}
            onChange={(checked) => setFilter({ includeFilled: checked ? undefined : true })}
            aria-label={t('filters.openOnly')}
          />
        </div>
      </div>

      {/* LOCATION - counted multi-check over location.district. searchable (a
          search-within once >8 options) + allowCustom (district is free-text, so a
          preferred area outside the top list can be typed + added). FacetGroup owns
          both now (one consistent mechanism). */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.location')}</p>
        <FacetGroup
          title=""
          options={facets?.district ?? []}
          selected={districts}
          onToggle={(v) => {
            trackToggle('district')(v);
            setFilter({ districts: toggleIn(districts, v) });
          }}
          labelFor={humanize}
          searchable
          allowCustom
        />
      </div>

      {/* ROLE - counted multi-check over facets.role -> filters.roles (plural).
          The board role strip drives the SAME filters.roles array (unified to
          avoid a dual-control desync). */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.role')}</p>
        <FacetGroup
          title=""
          options={facets?.role ?? []}
          selected={roles}
          onToggle={(v) => {
            trackToggle('role')(v);
            setFilter({ roles: toggleIn(roles, v) });
          }}
          labelFor={roleLabelFor}
        />
      </div>

      {/* EMPLOYMENT TYPE - counted multi-check. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.employmentType')}</p>
        <FacetGroup
          title=""
          options={facets?.employmentType ?? []}
          selected={employmentTypes}
          onToggle={(v) => {
            trackToggle('employmentType')(v);
            setFilter({ employmentTypes: toggleIn(employmentTypes, v) });
          }}
          labelFor={employmentLabel}
        />
      </div>

      {/* PAY TYPE - single-select chips over the wageType facet (with counts).
          Replaces the period-mixing salary slider: a worker filters by HOW they are
          paid (per day / hour / piece / month), which is meaningful + period-safe.
          Re-click clears. A 0-count type is disabled unless it is the active one. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.payType')}</p>
        <div role="group" aria-label={t('filters.payType')} className="flex flex-wrap gap-1.5">
          {WAGE_TYPES.map((w) => {
            const count = wageTypeCounts[w] ?? 0;
            const active = filters.wageType === w;
            const disabled = count === 0 && !active;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                onClick={() => {
                  track('connect.jobs.facet_toggled', { facet: 'wageType', value: w });
                  setFilter({ wageType: active ? undefined : w });
                }}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border-light)'}`,
                  background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
                  color: active ? 'var(--cr-surface)' : 'var(--cr-text-2)',
                  opacity: disabled ? 0.5 : 1,
                  outlineColor: 'var(--cr-primary)',
                }}
              >
                {t(`workType.${w}`)}
                <span
                  className="text-[11px] tabular-nums"
                  style={{ color: active ? 'var(--cr-surface)' : 'var(--cr-text-4)' }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SKILLS - counted multi-check over the skills[] facet. filters.skills is a
          CSV string on the wire; toggle in/out and re-join with ','. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.skills')}</p>
        <FacetGroup
          title=""
          options={facets?.skill ?? []}
          selected={skills}
          onToggle={(v) => {
            trackToggle('skill')(v);
            const next = toggleIn(skills, v);
            setFilter({ skills: next ? next.join(',') : undefined });
          }}
          labelFor={humanize}
          searchable
          allowCustom
        />
      </div>

      {/* MACHINE TYPE - counted multi-check (free-text, humanized labels). */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.machineType')}</p>
        <FacetGroup
          title=""
          options={facets?.machineType ?? []}
          selected={machineTypes}
          onToggle={(v) => {
            trackToggle('machineType')(v);
            setFilter({ machineTypes: toggleIn(machineTypes, v) });
          }}
          labelFor={humanize}
          searchable
          allowCustom
        />
      </div>

      {/* POSTED DATE - single-select radios -> postedWithinDays (null/1/7/30).
          Re-selecting "Any time" (days null) clears postedWithinDays. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.posted')}</p>
        <div role="radiogroup" aria-label={t('filters.posted')} className="flex flex-col">
          {POSTED_WINDOWS.map(({ key, days }) => (
            <label
              key={key}
              // No focus-within box (fired on click, lingered). The native radio's
              // own :focus-visible ring is the clean keyboard indicator.
              className="flex cursor-pointer items-center gap-2 rounded py-1 text-[12.5px] leading-tight transition-colors hover:bg-[var(--cr-surface-2)]"
              style={{ color: 'var(--cr-text-2)' }}
            >
              <input
                type="radio"
                name="job-facet-posted"
                checked={(filters.postedWithinDays ?? null) === days}
                onChange={() => setFilter({ postedWithinDays: days ?? undefined })}
                style={{ accentColor: 'var(--cr-primary)', width: 16, height: 16 }}
              />
              {t(`filters.${key}`)}
            </label>
          ))}
        </div>
      </div>
    </section>
  );
}
