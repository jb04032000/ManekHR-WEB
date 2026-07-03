'use client';

/**
 * ModuleTabs - a URL-synced tab bar for Connect module screens.
 *
 * Each tab is a `next/link` to `?tab=<key>` on the current path; the active
 * tab is read from the live `tab` search param (ENGINEERING-STANDARDS #8 - the
 * shell never remounts when the tab changes, only the panel below it does).
 * A tab may carry an optional count badge and/or a tooltip explaining what
 * it contains (used when label alone is ambiguous, e.g. `Following` vs
 * `Connections` on the Network screen). Mobile-first: the row scrolls
 * horizontally on narrow screens so every tab stays reachable at 380px.
 *
 * JIT shared component (Phase 2). Rendered in isolation on `/design-system`.
 */

import { useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Tooltip } from 'antd';

export interface ModuleTab {
  /** Stable key - written to / read from the `?tab=` search param. */
  key: string;
  /** Visible, already-i18n'd label. */
  label: string;
  /**
   * Optional count badge. `0`, `null` and `undefined` render no badge; a
   * positive number renders the count, capped at `99+`.
   */
  count?: number | null;
  /**
   * Optional hover tooltip - clarifies labels that aren't self-explanatory
   * (e.g. `Following = one-way; Connections = mutual`). Shown on hover only;
   * the label itself stays unadorned so the bar reads tight at a glance.
   */
  tooltip?: string;
}

interface ModuleTabsProps {
  tabs: ModuleTab[];
  /**
   * Tab selected when the `?tab=` param is absent or unknown. Defaults to the
   * first tab so the bar is never in a no-selection state.
   */
  defaultTab?: string;
  /** Search-param name to sync against. Defaults to `tab`. */
  paramName?: string;
  /** Accessible label for the tablist landmark. */
  ariaLabel?: string;
  className?: string;
}

/** Format a count badge - caps at `99+` so the pill never overflows. */
function formatCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export default function ModuleTabs({
  tabs,
  defaultTab,
  paramName = 'tab',
  ariaLabel,
  className,
}: ModuleTabsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fallbackKey = defaultTab ?? tabs[0]?.key ?? '';
  const requested = searchParams.get(paramName);
  const activeKey = useMemo(() => {
    if (requested && tabs.some((tab) => tab.key === requested)) return requested;
    return fallbackKey;
  }, [requested, tabs, fallbackKey]);

  /** Build the href for a tab - preserves every other search param. */
  const hrefFor = (key: string): string => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramName, key);
    return `${pathname}?${params.toString()}`;
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={className}
      style={{
        display: 'flex',
        gap: 2,
        overflowX: 'auto',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
        borderBottom: '1px solid var(--cr-border)',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.key === activeKey;
        const hasBadge = typeof tab.count === 'number' && tab.count > 0;
        const linkNode = (
          <Link
            key={tab.key}
            href={hrefFor(tab.key)}
            role="tab"
            aria-selected={active}
            aria-current={active ? 'page' : undefined}
            scroll={false}
            className="no-underline"
            style={{
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              padding: '13px 16px',
              fontSize: 13.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              color: active ? 'var(--cr-primary)' : 'var(--cr-text-4)',
              borderBottom: `2px solid ${active ? 'var(--cr-primary)' : 'transparent'}`,
              marginBottom: -1,
              transition: 'color 0.15s ease',
            }}
          >
            <span>{tab.label}</span>
            {hasBadge && (
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minWidth: 18,
                  height: 18,
                  padding: '0 5px',
                  borderRadius: 'var(--cr-radius-full)',
                  fontSize: 11,
                  fontWeight: 700,
                  lineHeight: 1,
                  background: active ? 'var(--cr-primary)' : 'var(--cr-surface-2)',
                  color: active ? 'var(--cr-surface)' : 'var(--cr-text-4)',
                }}
              >
                {formatCount(tab.count as number)}
              </span>
            )}
          </Link>
        );
        return tab.tooltip ? (
          <Tooltip key={tab.key} title={tab.tooltip} placement="bottom">
            {linkNode}
          </Tooltip>
        ) : (
          linkNode
        );
      })}
    </div>
  );
}
