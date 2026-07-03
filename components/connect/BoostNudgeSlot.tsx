'use client';

/**
 * Owner-surface mount point for the traction boost nudge. Fetches the owner's
 * candidates (shared one-fetch hook), picks ONE to show -- the top-ranked, or
 * the top of a given `kind` on a kind-specific surface -- marks it shown (the
 * 7-day cool-down trigger) exactly once per session, and wires Boost / Dismiss.
 *
 * Placement: at most one slot per surface (listings hub, jobs board, profile),
 * and at most one nudge visible. The backend's global cool-down means only one
 * nudge shows per owner per week across all surfaces.
 *
 * Cross-module links: useBoostNudges (data), boost-nudges.actions (shown /
 * dismiss writes), BoostNudgeCard (presentation), lib/analytics-events (funnel),
 * /connect/boost/<kind>/<id> (the existing boost composer routes).
 *
 * Watch: shown-marking is deduped at module scope so two remounts (or a second
 * surface later in the session) never double-fire it; tests reset via
 * __resetBoostNudgeShownGuard().
 */

import { useEffect, useRef, useState } from 'react';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { useBoostNudges } from '@/features/connect/useBoostNudges';
import { dismissBoostNudge, markBoostNudgeShown } from '@/features/connect/boost-nudges.actions';
import type { BoostNudgeKind } from '@/features/connect/boost-nudges.types';
import { BoostNudgeCard } from './BoostNudgeCard';

// Once-per-session guard: the first rendered nudge marks shown; later remounts
// or a second surface in the same session must not re-fire it (the BE upsert is
// idempotent, but we also avoid a redundant request + duplicate analytics).
let markedShown = false;
/** Test-only: reset the session shown guard. */
export function __resetBoostNudgeShownGuard(): void {
  markedShown = false;
}

export function BoostNudgeSlot({
  kind,
  className,
}: {
  /** Restrict to one entity kind (kind-specific surface). Omit on the profile. */
  kind?: BoostNudgeKind;
  className?: string;
}) {
  const { candidates, removeLocal } = useBoostNudges();
  const [dismissedId, setDismissedId] = useState<string | null>(null);
  const shownFiredRef = useRef(false);

  // Candidates arrive ranked by views desc; the first matching one is the top.
  const candidate =
    candidates?.find((c) => (kind ? c.kind === kind : true) && c.entityId !== dismissedId) ?? null;

  // Mark shown the first time a card is actually rendered (once per session).
  useEffect(() => {
    if (!candidate || shownFiredRef.current || markedShown) return;
    shownFiredRef.current = true;
    markedShown = true;
    trackEvent(ConnectEvents.boostNudgeShown, { kind: candidate.kind });
    void markBoostNudgeShown();
  }, [candidate]);

  if (!candidate) return null;

  const boostHref = `/connect/boost/${candidate.kind}/${candidate.entityId}`;

  return (
    <BoostNudgeCard
      candidate={candidate}
      boostHref={boostHref}
      className={className}
      onBoost={() => trackEvent(ConnectEvents.boostNudgeClicked, { kind: candidate.kind })}
      onDismiss={() => {
        trackEvent(ConnectEvents.boostNudgeDismissed, { kind: candidate.kind });
        setDismissedId(candidate.entityId);
        removeLocal(candidate.entityId);
        void dismissBoostNudge(candidate.entityId, candidate.kind);
      }}
    />
  );
}
