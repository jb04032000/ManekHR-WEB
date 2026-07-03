'use client';

/**
 * SearchResultSection - the framed group that wraps ONE vertical's results on
 * `/connect/search` (people / posts / listings / jobs / storefronts / pages).
 *
 * Two visual variants so the section chrome never fights the row chrome:
 *   - `panel` (default): a white `.cr-surface` card for ROW-style verticals
 *     (people, posts, storefronts, pages) whose rows are bare dividers. The card
 *     supplies the elevation; rows render full-bleed inside it.
 *   - `bare`: header only, no card, for CARD-style verticals (listings, jobs)
 *     whose ListingCard / JobCard already bring their own border + shadow, so a
 *     wrapping card would double-frame them.
 *
 * The header carries the section title, an optional result-count chip (the
 * leak-free per-vertical total), and an optional "Show all ->" jump used only in
 * the blended `all` view (Phase 1b of the progressive-loading ADR). Omitting
 * `title` renders no header (focused single-vertical tabs, where the page header
 * + ModuleTabs already label the list).
 *
 * Presentational + search-specific (NOT a shared DS component). Rendered by
 * SearchResultsScreen for both the blended sections and the focused tabs.
 */

import type { ReactNode } from 'react';
import Link from 'next/link';

interface SearchResultSectionProps {
  /** Stable id for the <h2> so the <section> can `aria-labelledby` it. */
  headingId: string;
  /** Section title. Omit to render the framed card with no header. */
  title?: string;
  /** Leak-free vertical total, shown as a muted chip by the title. Hidden when 0/undefined. */
  count?: number | null;
  /** White card vs header-only. Use `bare` for listings/jobs (self-framed cards). */
  variant?: 'panel' | 'bare';
  /** When set, renders a right-aligned "Show all" jump to the focused tab. */
  showAllHref?: string;
  showAllLabel?: string;
  showAllAriaLabel?: string;
  children: ReactNode;
}

export default function SearchResultSection({
  headingId,
  title,
  count,
  variant = 'panel',
  showAllHref,
  showAllLabel,
  showAllAriaLabel,
  children,
}: SearchResultSectionProps) {
  const isPanel = variant === 'panel';
  const hasHeader = Boolean(title);

  const header = hasHeader ? (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--cr-space-sm)',
        // Panel header sits inside the card padding with a divider under it; the
        // bare header sits on the page with no border (cards follow below).
        padding: isPanel
          ? 'var(--cr-space-md) var(--cr-space-md) var(--cr-space-sm)'
          : '0 0 var(--cr-space-sm)',
        borderBottom: isPanel ? '1px solid var(--cr-border-light)' : 'none',
      }}
    >
      <h2
        id={headingId}
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 'var(--cr-space-sm)',
          minWidth: 0,
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--cr-text)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {title}
        </span>
        {typeof count === 'number' && count > 0 && (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--cr-text-4)',
              background: 'var(--cr-surface-2)',
              borderRadius: 'var(--cr-radius-full)',
              padding: '1px 8px',
            }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </h2>
      {showAllHref && showAllLabel && (
        <Link
          href={showAllHref}
          aria-label={showAllAriaLabel}
          className="inline-flex shrink-0 items-center gap-1 rounded-[var(--cr-radius-sm)] no-underline transition-[filter,background] hover:brightness-95"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-primary)' }}
        >
          {showAllLabel} <span aria-hidden>&rarr;</span>
        </Link>
      )}
    </div>
  ) : null;

  if (!isPanel) {
    // Header-only: the self-framed ListingCard/JobCard list follows below.
    return (
      <section aria-labelledby={hasHeader ? headingId : undefined}>
        {header}
        {children}
      </section>
    );
  }

  return (
    <section
      aria-labelledby={hasHeader ? headingId : undefined}
      className="cr-surface"
      style={{ boxShadow: 'var(--cr-shadow-card)', overflow: 'hidden' }}
    >
      {header}
      {children}
    </section>
  );
}
