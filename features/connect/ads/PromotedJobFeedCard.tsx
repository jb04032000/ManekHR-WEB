'use client';

/**
 * PromotedJobFeedCard - a boosted job as a full-width feed card (Phase 1). Gives
 * job boosts a billed in-feed surface (the jobs-board "Promoted" block is a
 * separate non-billed showcase).
 *
 * REDESIGN (2026-06-20): renders the REAL jobs board card (JobCard) in its
 * `promoted` variant instead of a basic icon+title stub, so an in-feed job boost
 * shows the same rich signals as the board (wage, role/category, openings,
 * status, location, employer) and never drifts from the canonical card. Mirrors
 * the marketplace-grid wrapper pattern (PromotedGridListingCard): a beacon
 * cardRef wrapper measures viewability; the tap-through fires the click beacon
 * via JobCard's `onOpen` (the title link), so Save/Apply taps are NOT billed as
 * ad clicks. JobCard's own `promoted` pill carries the "Promoted" disclosure.
 *
 * Cross-module: Job (jobs.types); JobCard (jobs/JobCard.tsx); useAdBeacons ->
 * /connect/ads/events/*. The feed hydrates only the Job (no JobEmployerRef), so
 * the employer row is absent here by design - JobCard degrades gracefully. Gotcha:
 * keep the JobCard `promoted` look + onOpen seam in sync if JobCard changes.
 */

import JobCard from '../jobs/JobCard';
import { useAdBeacons } from './use-ad-beacons';
import type { Job } from '../jobs/jobs.types';

export interface PromotedJobFeedCardProps {
  job: Job;
  impressionToken: string;
  campaignId: string;
}

export default function PromotedJobFeedCard({
  job,
  impressionToken,
  campaignId,
}: PromotedJobFeedCardProps) {
  // MRC viewability + click beacons (billing). cardRef on the wrapper measures
  // viewability; onClick fires on the job OPEN (JobCard.onOpen = title link tap)
  // so the candidate Save/Apply controls never count as ad clicks.
  // Links: lib/analytics-events.ts; placement feed, kind 'boost'.
  const { cardRef, onClick } = useAdBeacons(impressionToken, {
    placement: 'feed',
    kind: 'boost',
    campaignId,
  });

  return (
    <div ref={cardRef}>
      <JobCard job={job} variant="list" promoted onOpen={() => onClick()} />
    </div>
  );
}
