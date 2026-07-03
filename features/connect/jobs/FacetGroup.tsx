'use client';

/**
 * FacetGroup - a reusable counted multi-check group for the Jobs filter rail.
 * Renders one facet (Location / Role / Employment type / Machine type / Skills)
 * as a tight vertical checklist where each row shows a checkbox + a humanized
 * label + the live count of jobs that value would yield given the OTHER active
 * filters.
 *
 * Cross-module links:
 * - features/connect/jobs/JobFilterRail.tsx composes several FacetGroups over the
 *   BoardFacets buckets (jobs.types.ts FacetEntry[]) and wires onToggle back into
 *   useBoardFilters.setFilter (multi-select arrays).
 *
 * Long-facet handling (Location can have 50s of districts):
 * - The server caps each facet at its top ~50 by count; we never dump hundreds.
 * - `searchable` shows a search-within box once a facet exceeds `max`, filtering
 *   the RENDERED rows locally (label OR raw value).
 * - `allowCustom` (free-text facets only - district/skills/machine) lets the user
 *   ADD a value not in the list (Enter or the "Add ..." button) so a preferred
 *   location outside the top-N is still reachable; it calls onToggle(value) and
 *   surfaces via the "selected always visible" rule (shown at count 0).
 * - Enum facets (role/employment) pass neither - typing a non-enum value would
 *   match nothing on the backend.
 *
 * Binding rules baked in (Interaction & Cursor Contract):
 * - Each row is a <label> (cursor-pointer, focus-within ring) with a native
 *   checkbox (correct aria-checked, keyboard-operable). Rows are tight (no forced
 *   44px min-height) for a dense, scannable rail; the whole row stays clickable.
 * - Labels WRAP and are never truncated (long gu/hi labels stay readable).
 * - "Selected always visible": a picked value is ALWAYS shown + enabled even at
 *   count 0, so it can be unselected and never disappears mid-interaction. Only
 *   NON-selected 0-count rows are disabled.
 * - "Show more" reveals values past `max` (default 8).
 */

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from 'antd';
import { Search, Plus } from 'lucide-react';
import type { FacetEntry } from './jobs.types';

interface Props {
  title: string;
  options: FacetEntry[];
  selected: string[];
  onToggle: (value: string) => void;
  /** Humanize a stored facet value into a display label (locale-aware). */
  labelFor: (value: string) => string;
  /** Rows shown before the "Show more" cut. */
  max?: number;
  /** Show a search-within box once the facet exceeds `max` (long facets). */
  searchable?: boolean;
  /** Free-text facets only: allow adding a value not in the list (Enter / button). */
  allowCustom?: boolean;
}

export default function FacetGroup({
  title,
  options,
  selected,
  onToggle,
  labelFor,
  max = 8,
  searchable = false,
  allowCustom = false,
}: Props) {
  const t = useTranslations('connect.jobs');
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');

  // Ensure every selected value is present even if it fell outside the facet's
  // top-N buckets (count 0) - the "selected always visible" rule. Selected-but-
  // missing values float to the top so they stay above the fold.
  const merged = useMemo(() => {
    const present = new Set(options.map((o) => o.value));
    const extras: FacetEntry[] = selected
      .filter((v) => !present.has(v))
      .map((v) => ({ value: v, count: 0 }));
    return [...extras, ...options];
  }, [options, selected]);

  // Search is only worth showing once the list is long enough to scroll.
  const showSearch = searchable && merged.length > max;
  const q = query.trim().toLowerCase();

  // Filter the rendered rows locally on the label OR the raw value.
  const filtered = useMemo(() => {
    if (!q) return merged;
    return merged.filter(
      (o) => o.value.toLowerCase().includes(q) || labelFor(o.value).toLowerCase().includes(q),
    );
  }, [merged, q, labelFor]);

  // Offer "Add '<typed>'" only for free-text facets, when the trimmed query does
  // not already exist as a value or label (case-insensitive) in the full list.
  const trimmed = query.trim();
  const canAddCustom =
    allowCustom &&
    trimmed.length > 0 &&
    !merged.some((o) => o.value.toLowerCase() === q || labelFor(o.value).toLowerCase() === q);

  const addCustom = () => {
    if (!canAddCustom) return;
    onToggle(trimmed);
    setQuery('');
  };

  if (merged.length === 0) {
    return (
      <div>
        {title && (
          <p
            className="m-0 mb-1.5 text-[12.5px] font-semibold"
            style={{ color: 'var(--cr-text-2)' }}
          >
            {title}
          </p>
        )}
        <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('filters.noFacetOptions')}
        </p>
      </div>
    );
  }

  const visible = expanded ? filtered : filtered.slice(0, max);
  const hasMore = filtered.length > max;

  return (
    <div>
      {title && (
        <p className="m-0 mb-1.5 text-[12.5px] font-semibold" style={{ color: 'var(--cr-text-2)' }}>
          {title}
        </p>
      )}

      {showSearch && (
        <Input
          size="small"
          className="mb-1.5"
          prefix={<Search size={14} aria-hidden style={{ color: 'var(--cr-text-4)' }} />}
          placeholder={t('filters.facetSearch')}
          aria-label={title || t('filters.facetSearch')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onPressEnter={addCustom}
          allowClear
        />
      )}

      {/* Tight checklist: no forced row min-height (was 44px and left big gaps);
          py-1 keeps a comfortable but dense row. The whole label is clickable. */}
      <div role="group" aria-label={title || undefined} className="flex flex-col">
        {visible.map((o) => {
          const isSelected = selected.includes(o.value);
          const disabled = o.count === 0 && !isSelected;
          return (
            <label
              key={o.value}
              // No row-level focus box: focus-within fired on mouse click too and
              // left a heavy outline until you clicked away. The native checkbox
              // shows its own clean keyboard-only :focus-visible ring, which is the
              // correct, unobtrusive indicator.
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
                onChange={() => onToggle(o.value)}
                aria-checked={isSelected}
                style={{ accentColor: 'var(--cr-primary)', width: 16, height: 16 }}
              />
              <span className="min-w-0 flex-1 break-words">{labelFor(o.value)}</span>
              <span className="shrink-0 tabular-nums" style={{ color: 'var(--cr-text-4)' }}>
                {o.count}
              </span>
            </label>
          );
        })}

        {/* No match for the typed term, but it can be added (free-text facet). */}
        {showSearch && filtered.length === 0 && !canAddCustom && (
          <p className="m-0 py-1 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            {t('filters.noFacetOptions')}
          </p>
        )}
      </div>

      {canAddCustom && (
        <button
          type="button"
          onClick={addCustom}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 rounded text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{ color: 'var(--cr-primary)', outlineColor: 'var(--cr-primary)' }}
        >
          <Plus size={13} aria-hidden /> {t('filters.addValue', { value: trimmed })}
        </button>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 block cursor-pointer rounded text-[12px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
          style={{ color: 'var(--cr-primary)', outlineColor: 'var(--cr-primary)' }}
        >
          {expanded ? t('filters.showLess') : t('filters.showMore')}
        </button>
      )}
    </div>
  );
}
