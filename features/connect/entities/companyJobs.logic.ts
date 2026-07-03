/**
 * Pure visibility rules for the company page jobs section, factored out so they
 * are unit-testable without rendering. Consumed by CompanyPageView (tab
 * visibility) and CompanyJobsSection (owner empty state). Keep both call sites in
 * sync with these helpers.
 */

/** The Jobs tab shows for the owner always (so they can post into an empty page),
 *  and for a visitor only when there is at least one open job. */
export const showJobsTab = (jobCount: number, isOwner: boolean): boolean => isOwner || jobCount > 0;

/** Only the owner sees the "No open positions -> Post a job" empty state; a
 *  visitor with no jobs sees nothing (the tab itself is hidden). */
export const showOwnerEmpty = (jobCount: number, isOwner: boolean): boolean =>
  isOwner && jobCount === 0;

/**
 * Institute Placements / Alumni tab visibility (Institutes Phase 2, Feature 2).
 *
 * What this does: decide whether the institute-only "Placements" / "Alumni"
 * public tabs appear on the company page. The owner ALWAYS sees them (even
 * empty) so they reach the "Invite your students" acquisition CTA; a public
 * visitor sees a tab only when it carries real content. Both are additionally
 * gated on the page being an institute at the call site (CompanyPageView).
 *
 * Cross-module links: consumed by CompanyPageView (tab-bar builder + section
 * gating). The content counts come from the BE public reads
 * `getInstitutePlacements` / `getInstituteAlumni` (company-page.actions). Keep
 * the owner-always / public-when-non-empty rule in sync with the section blocks
 * and the empty-state CTA in CompanyPageView. Mirrors `showJobsTab` above.
 *
 * Watch: `hasContent` is the already-counted "is there anything to show" flag
 * (alumni: items.length > 0; placements: employers.length > 0 OR
 * otherEmployerCount > 0). These helpers do not look at `isInstitute` - the
 * caller AND-gates that so the helper stays a pure owner/content rule.
 */
export const showPlacementsTab = (hasContent: boolean, isOwner: boolean): boolean =>
  isOwner || hasContent;

export const showAlumniTab = (hasContent: boolean, isOwner: boolean): boolean =>
  isOwner || hasContent;
