'use client';

/**
 * The board's "Promoted" block: a visually separated, clearly labelled strip of
 * boosted jobs rendered ABOVE the organic Open-tab list (NOT interleaved). Each
 * job is a normal JobCard (same Save/Apply/skill-match anatomy) so promoted reads
 * as a real listing, just flagged. First-party only - this surface does NO
 * per-render impression billing; it just shows what the BE resolver returned
 * (GET /connect/jobs/board/promoted, capped at K).
 *
 * Cross-module links:
 * - features/connect/jobs/jobs.actions.listPromotedJobs feeds `jobs` (SSR-seeded
 *   in app/connect/jobs/page.tsx, kept in sync with filters by JobBoard).
 * - features/connect/jobs/JobCard renders each card (variant = the board view).
 * - features/connect/jobs/JobBoard owns de-dupe (it strips promoted ids from the
 *   organic results) AND the visibility gate (Open tab + no active text search);
 *   this component only renders what it is handed, and renders NOTHING when empty.
 *
 * Gotcha: the "Promoted" header is a LABEL, not a button (no cursor-pointer, no
 * onClick) - per the Interaction & Cursor Contract. De-dupe lives in JobBoard so
 * a promoted job never also shows in the organic list below. Hidden-when-search
 * is also enforced by the caller (a text query should rank by relevance, not ads).
 */

import { useTranslations } from 'next-intl';
import JobCard from './JobCard';
import type { Job, MyApplicationView, JobEmployerRef } from './jobs.types';

interface Props {
  /** The promoted jobs to show (BE caps at K). Empty -> render nothing. */
  jobs: Job[];
  /** Card layout, mirrors the organic list's view. */
  view: 'list' | 'grid';
  /** The viewer's own skills - drives the "matches your skills" ribbon. */
  viewerSkills?: string[];
  /** The viewer's own user id - JobCard hides Save/Apply on own jobs. */
  viewerId?: string;
  /** The viewer's saved job ids (seeds the filled-bookmark state). */
  savedSet: Set<string>;
  /** The viewer's already-applied job ids (renders disabled "Applied"). */
  appliedSet: Set<string>;
  /** Resolved employer identity per jobId (useBoardEmployers map). */
  employers: Record<string, JobEmployerRef>;
  /** Fired with the jobId when a promoted card is opened (-> the JobBoard emits
   *  connect.jobs.promoted_click). Only the promoted block passes JobCard.onOpen,
   *  so an organic open is never miscounted as an ad click. */
  onJobOpen?: (jobId: string) => void;
  /** Bubbled from a card's quick-apply so JobBoard reflects it in My applications.
   *  Same handler the organic list gets - applying from a promoted card counts too. */
  onApplied?: (application: MyApplicationView) => void;
}

export default function PromotedJobs({
  jobs,
  view,
  viewerSkills = [],
  viewerId = '',
  savedSet,
  appliedSet,
  employers,
  onJobOpen,
  onApplied,
}: Props) {
  const t = useTranslations('connect.jobs');

  // Empty -> render nothing (no stray header, no layout shift).
  if (jobs.length === 0) return null;

  return (
    <section aria-label={t('promoted.ariaSection')} className="mb-6">
      {/* No section header: each promoted job is flagged on the card ITSELF (the
          gold-edged JobCard `promoted` variant with its own "Promoted" pill), so paid
          jobs read as premium featured cards (LinkedIn/Indeed style) rather than a
          boxed-off block. The section keeps an aria-label for AT and extra bottom
          whitespace (mb-6) to separate it from the organic list below. */}

      {/* Same card anatomy + grid/list rules as the organic list. Grid view uses
          container-aware columns (auto-fill minmax), NOT viewport grid-cols, so the
          narrow results column never squeezes cards too small (see JobBoard). The
          min(100%, ...) floor keeps a single full-width column on a narrow screen. */}
      <ul
        className="m-0 grid list-none gap-3 p-0"
        style={
          view === 'grid'
            ? { gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }
            : undefined
        }
        aria-label={t('promoted.ariaSection')}
      >
        {jobs.map((j) => (
          <li key={j._id}>
            <JobCard
              job={j}
              promoted
              variant={view}
              matchedSkills={viewerSkills}
              employer={employers[j._id]}
              viewerId={viewerId}
              initialSaved={savedSet.has(j._id)}
              alreadyApplied={appliedSet.has(j._id)}
              onOpen={onJobOpen}
              onApplied={onApplied}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
