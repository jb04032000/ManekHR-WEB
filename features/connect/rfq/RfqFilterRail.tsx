'use client';

/**
 * RfqFilterRail - the filter rail on the RFQ "Open board" tab, rebuilt
 * 2026-06-10 to the Jobs/marketplace rail visual family: a white panel with
 * divider-separated sections, small-caps 11px headers, a header row (title +
 * Clear-all top-right when a filter is active). Server-driven: every control
 * maps onto BoardFilters and the counts come from GET board/facets.
 *
 * Cross-module links:
 * - features/connect/jobs/FacetGroup.tsx is REUSED for the district checklist
 *   (counted multi-check + search-within + add-your-own). Its internal strings
 *   translate from connect.jobs.filters.* - intentional shared vocabulary.
 * - features/connect/rfq/useRfqBoardFilters.ts owns the filter state; all
 *   changes flow through the single setFilter(patch) prop (no URL writes here).
 * - SECTION_STYLE / SECTION_HEADER_STYLE mirror JobFilterRail /
 *   ListingFacetPanel - keep the three rails in sync if any is restyled.
 *
 * Layout, top to bottom: Header -> Status (counted checklist of derived
 * buckets) -> District / Area (FacetGroup) -> Budget (min/max + include-
 * negotiable) -> Show me (Matched to my work switch - hidden when the viewer
 * supplies nothing - + No quote from me yet) -> Posted (radios).
 */

import { type CSSProperties } from 'react';
import { useTranslations } from 'next-intl';
import { InputNumber, Switch } from 'antd';
import DsButton from '@/components/ui/DsButton';
import { track } from '@/lib/analytics';
import FacetGroup from '../jobs/FacetGroup';
import type { BoardFacets, BoardFilters, RfqStatusBucket } from './rfq.types';

// Shared rail styling, copied from JobFilterRail so the rails read as one
// design family. cr- tokens only.
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

const STATUS_BUCKETS: RfqStatusBucket[] = ['open', 'closing-soon', 'awarded'];

interface Props {
  filters: BoardFilters;
  /** Facet counts for the active filter set (null while a fetch is in flight). */
  facets: BoardFacets | null;
  setFilter: (patch: Partial<BoardFilters>) => void;
  onClearAll: () => void;
  /** The viewer supplies at least one category (BoardStats.supplyCategories);
   *  false hides the Matched-to-my-work toggle (nothing to match against). */
  hasSupply: boolean;
}

/** Toggle one value inside a string[] facet (add if absent, remove if present). */
function toggleIn<T extends string>(arr: T[] | undefined, value: T): T[] | undefined {
  const cur = arr ?? [];
  const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
  return next.length ? next : undefined;
}

export default function RfqFilterRail({
  filters,
  facets,
  setFilter,
  onClearAll,
  hasSupply,
}: Props) {
  const t = useTranslations('connect.rfq');

  const districts = filters.districts ?? [];
  const statuses = filters.statuses ?? [];

  const hasAny =
    districts.length > 0 ||
    statuses.length > 0 ||
    Boolean(filters.category) ||
    filters.budgetMin != null ||
    filters.budgetMax != null ||
    Boolean(filters.includeNegotiable) ||
    Boolean(filters.matchedToMyWork) ||
    Boolean(filters.notQuotedByMe) ||
    filters.postedWithinDays != null ||
    Boolean(filters.q);

  // One analytics tap per checkbox; the committed set fires filter_applied in
  // useRfqBoardFilters (same two-event model as the jobs rail).
  const trackToggle = (facet: string, value: string) =>
    track('connect.rfq.facet_toggled', { facet, value });

  const statusCount: Record<RfqStatusBucket, number> = {
    open: facets?.status.open ?? 0,
    'closing-soon': facets?.status.closingSoon ?? 0,
    awarded: facets?.status.awarded ?? 0,
  };
  const statusLabel: Record<RfqStatusBucket, string> = {
    open: t('status.open'),
    'closing-soon': t('closingSoon'),
    awarded: t('status.awarded'),
  };

  const budgetActive = filters.budgetMin != null || filters.budgetMax != null;

  return (
    <section
      aria-label={t('filters.title')}
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

      {/* STATUS - counted checklist of the derived buckets (open / closing soon /
          awarded). The counts share the BE statusBucketClause definition, so a
          checked bucket always equals the rows it yields. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.status')}</p>
        <div role="group" aria-label={t('filters.status')} className="flex flex-col">
          {STATUS_BUCKETS.map((b) => {
            const isSelected = statuses.includes(b);
            const disabled = statusCount[b] === 0 && !isSelected;
            return (
              <label
                key={b}
                className={`flex items-center gap-2 rounded py-1 text-[12.5px] leading-tight transition-colors ${
                  disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-[var(--cr-surface-2)]'
                }`}
                style={{ color: disabled ? 'var(--cr-text-5)' : 'var(--cr-text-2)' }}
              >
                <input
                  type="checkbox"
                  className="shrink-0"
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => {
                    trackToggle('status', b);
                    setFilter({ statuses: toggleIn(statuses, b) });
                  }}
                  aria-checked={isSelected}
                  style={{ accentColor: 'var(--cr-primary)', width: 16, height: 16 }}
                />
                <span className="min-w-0 flex-1 break-words">{statusLabel[b]}</span>
                <span className="shrink-0 tabular-nums" style={{ color: 'var(--cr-text-4)' }}>
                  {statusCount[b]}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* DISTRICT / AREA - counted multi-check over location.district (jobs
          FacetGroup: search-within + add-your-own once the list grows). */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.district')}</p>
        <FacetGroup
          title=""
          options={facets?.district ?? []}
          selected={districts}
          onToggle={(v) => {
            trackToggle('district', v);
            setFilter({ districts: toggleIn(districts, v) });
          }}
          labelFor={(v) => v}
          searchable
          allowCustom
        />
      </div>

      {/* BUDGET - range overlap on the request's budget band; the checkbox ORs
          the "Negotiable" (no-budget) requests back in once a bound is set. */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.budget')}</p>
        <div className="flex items-center gap-2">
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            prefix="₹"
            placeholder={t('filters.budgetMinPlaceholder')}
            aria-label={t('filters.budgetMinPlaceholder')}
            value={filters.budgetMin ?? undefined}
            onChange={(v) => setFilter({ budgetMin: typeof v === 'number' ? v : undefined })}
          />
          <InputNumber
            min={0}
            style={{ width: '100%' }}
            prefix="₹"
            placeholder={t('filters.budgetMaxPlaceholder')}
            aria-label={t('filters.budgetMaxPlaceholder')}
            value={filters.budgetMax ?? undefined}
            onChange={(v) => setFilter({ budgetMax: typeof v === 'number' ? v : undefined })}
          />
        </div>
        <label
          className={`mt-2 flex items-center gap-2 rounded py-1 text-[12.5px] leading-tight ${
            budgetActive ? 'cursor-pointer hover:bg-[var(--cr-surface-2)]' : 'cursor-not-allowed'
          }`}
          style={{ color: budgetActive ? 'var(--cr-text-2)' : 'var(--cr-text-5)' }}
        >
          <input
            type="checkbox"
            className="shrink-0"
            checked={Boolean(filters.includeNegotiable)}
            disabled={!budgetActive}
            onChange={(e) => setFilter({ includeNegotiable: e.target.checked || undefined })}
            style={{ accentColor: 'var(--cr-primary)', width: 16, height: 16 }}
          />
          <span className="min-w-0 flex-1 break-words">{t('filters.includeNegotiable')}</span>
        </label>
      </div>

      {/* SHOW ME - viewer-scoped toggles. Matched-to-my-work only renders when
          the viewer actually supplies something (active listings). */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.showMe')}</p>
        {hasSupply && (
          <div className="flex items-start justify-between gap-3 py-1">
            <div style={{ flex: 1 }}>
              <span
                style={{
                  display: 'block',
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: 'var(--cr-text-2)',
                }}
              >
                {t('filters.matchedToMyWork')}
              </span>
              <span style={{ fontSize: 11, color: 'var(--cr-text-4)' }}>
                {t('filters.matchedSubtitle')}
              </span>
            </div>
            <Switch
              size="small"
              className="cursor-pointer"
              checked={Boolean(filters.matchedToMyWork)}
              onChange={(checked) => {
                trackToggle('matchedToMyWork', String(checked));
                setFilter({ matchedToMyWork: checked || undefined });
              }}
              aria-label={t('filters.matchedToMyWork')}
            />
          </div>
        )}
        <label
          className="flex cursor-pointer items-center gap-2 rounded py-1 text-[12.5px] leading-tight transition-colors hover:bg-[var(--cr-surface-2)]"
          style={{ color: 'var(--cr-text-2)' }}
        >
          <input
            type="checkbox"
            className="shrink-0"
            checked={Boolean(filters.notQuotedByMe)}
            onChange={(e) => {
              trackToggle('notQuotedByMe', String(e.target.checked));
              setFilter({ notQuotedByMe: e.target.checked || undefined });
            }}
            style={{ accentColor: 'var(--cr-primary)', width: 16, height: 16 }}
          />
          <span className="min-w-0 flex-1 break-words">{t('filters.notQuotedByMe')}</span>
          <span className="shrink-0 tabular-nums" style={{ color: 'var(--cr-text-4)' }}>
            {facets?.notQuotedByMe ?? 0}
          </span>
        </label>
      </div>

      {/* POSTED - single-select radios -> postedWithinDays (null/1/7/30). */}
      <div style={SECTION_STYLE}>
        <p style={SECTION_HEADER_STYLE}>{t('filters.posted')}</p>
        <div role="radiogroup" aria-label={t('filters.posted')} className="flex flex-col">
          {POSTED_WINDOWS.map(({ key, days }) => (
            <label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded py-1 text-[12.5px] leading-tight transition-colors hover:bg-[var(--cr-surface-2)]"
              style={{ color: 'var(--cr-text-2)' }}
            >
              <input
                type="radio"
                name="rfq-facet-posted"
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
