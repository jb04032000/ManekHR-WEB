'use client';

/**
 * Self-contained usage meter for one kind on an owner surface. Reads the
 * person's Connect usage roll-up via the SHARED hook (one fetch per page, even
 * when an OverLimitBanner sits next to it), picks the row for `kind`, and renders
 * the presentational UsageMeter. Owns its own loading skeleton, so no
 * route-level loading.tsx is needed. Stays invisible if the fetch fails or the
 * kind is absent, so it can never block the page.
 *
 * Also emits the connect.limit.near_limit demand signal once per surface per
 * session the first time this meter is seen at/above the near threshold (>=80%).
 * `surface` names where the meter lives (stores / pages / jobs / products /
 * limits / storage) so the same kind on two surfaces is counted separately.
 *
 * Links: features/connect/useConnectUsage.ts (shared fetch),
 * components/connect/UsageMeter.tsx (presentation),
 * lib/analytics-events.ts (bucketUsageRatio + nearLimit event).
 */

import { useEffect } from 'react';
import { useConnectUsageRow } from '@/features/connect/useConnectUsage';
import type { ConnectUsageKind } from '@/features/connect/usage.types';
import { ConnectEvents, bucketUsageRatio, trackEvent } from '@/lib/analytics-events';
import { UsageMeter } from './UsageMeter';

/** sessionStorage guard so near_limit fires at most once per surface+kind. */
function nearKey(surface: string, kind: ConnectUsageKind): string {
  return `cn.nearlimit.${surface}.${kind}`;
}

export function ConnectUsageMeter({
  kind,
  surface,
  className,
  showHint = true,
}: {
  kind: ConnectUsageKind;
  /** Where this meter lives; scopes the once-per-session near_limit signal. */
  surface: string;
  className?: string;
  showHint?: boolean;
}) {
  const { row, loading } = useConnectUsageRow(kind);

  // Fire the near-limit demand signal once per surface per session. Bucketed
  // ratio only (0.8/0.9/1.0) - never the raw used/limit. storage rides along as
  // a valid kind (the event types it alongside the four count kinds).
  useEffect(() => {
    if (!row) return;
    const ratio = bucketUsageRatio(row.used, row.limit);
    if (ratio === null) return;
    if (typeof window === 'undefined') return;
    const key = nearKey(surface, row.kind);
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, '1');
    trackEvent(ConnectEvents.nearLimit, { kind: row.kind, ratio });
  }, [row, surface]);

  if (loading) {
    // Slim skeleton mirroring the meter (label line + bar) using the shared
    // `.skeleton` shimmer. aria-hidden: decorative while data loads.
    return (
      <div className={className} aria-hidden>
        <div className="skeleton mb-1 h-3 w-24 rounded" />
        <div className="skeleton h-1.5 w-full rounded-full" />
      </div>
    );
  }
  // Fetch failed or this kind is absent: render nothing rather than an error.
  if (!row) return null;
  return (
    <UsageMeter
      kind={row.kind}
      used={row.used}
      limit={row.limit}
      className={className}
      showHint={showHint}
    />
  );
}
