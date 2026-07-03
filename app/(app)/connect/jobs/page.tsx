import type { Metadata } from 'next';
import { Suspense } from 'react';
import JobsHubSkeleton from '@/features/connect/jobs/JobsHubSkeleton';
import {
  listJobBoard,
  listMyJobs,
  listMyApplications,
  getJobBoardStats,
  getJobBoardFacets,
  listPromotedJobs,
  listSavedJobs,
} from '@/features/connect/jobs/jobs.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import JobBoard from '@/features/connect/jobs/JobBoard';
import type { BoardFilters, JobWageType } from '@/features/connect/jobs/jobs.types';
import type { ListingCategory } from '@/features/connect/search.types';

export const metadata: Metadata = {
  title: 'Jobs',
  robots: { index: false, follow: false },
};

const BOARD_PAGE_SIZE = 20;

/** Pull the first value for a key out of the (sync or array) searchParams bag. */
function one(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
/** Split a csv param into a trimmed, non-empty string[]. */
function csv(v: string | string[] | undefined): string[] | undefined {
  const s = one(v);
  if (!s) return undefined;
  const out = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return out.length ? out : undefined;
}
function num(v: string | string[] | undefined): number | undefined {
  const s = one(v);
  if (s == null || s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * URL -> BoardFilters. The address bar is the source of truth for the Open tab
 * (see useBoardFilters). Keep the key names in sync with filtersToSearch in the
 * hook so a deep link or a back/forward navigation seeds the exact same state.
 */
function parseBoardFilters(sp: Record<string, string | string[] | undefined>): BoardFilters {
  const sort = one(sp.sort);
  const view = one(sp.view);
  // Normalize a singular `?role=` deep link (e.g. the job-detail "Similar jobs"
  // link, or an old shared URL) into the plural `roles` the rail/strip read, so a
  // deep-linked role actually shows as selected (not just BE-filtered). Plural
  // wins; a singular role is folded in when no `roles` were supplied.
  const singleRole = one(sp.role);
  const roles = csv(sp.roles) ?? (singleRole ? [singleRole] : undefined);
  return {
    q: one(sp.q) || undefined,
    category: (one(sp.category) as ListingCategory) || undefined,
    wageType: (one(sp.wageType) as JobWageType) || undefined,
    district: one(sp.district) || undefined,
    districts: csv(sp.districts),
    roles,
    employmentTypes: csv(sp.employmentTypes),
    machineTypes: csv(sp.machineTypes),
    skills: one(sp.skills) || undefined,
    payMin: num(sp.payMin),
    payMax: num(sp.payMax),
    postedWithinDays: num(sp.posted),
    sort: sort === 'openings' || sort === 'closing' ? sort : 'recent',
    view: view === 'grid' ? 'grid' : 'list',
  };
}

/**
 * `/connect/jobs` -- the jobs hub. The Open tab is server-driven: SSR seeds page 1
 * of results + the facet counts from the URL filters (limit 20), then
 * useBoardFilters takes over on the client (URL via history.replaceState, no SSR
 * re-run per tap). The other tabs (My applications / Saved / My jobs) are seeded
 * from their own arrays and stay client-rendered.
 */
/** The active tab, read from `?tab=` so it survives leaving + returning (and
 *  back/forward). Defaults to the board ('Open jobs'). Kept in sync with JobBoard's
 *  Tab union + its URL write on tab change. Unknown -> default. */
function parseTab(v: string | string[] | undefined): 'board' | 'mine' | 'myApplications' | 'saved' {
  const t = one(v);
  return t === 'mine' || t === 'myApplications' || t === 'saved' ? t : 'board';
}

export default async function ConnectJobsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const filters = parseBoardFilters(sp);
  const initialTab = parseTab(sp.tab);
  // Wrap the data fetch in <Suspense> so a hard load / refresh / shared link that
  // lands on a non-board `?tab=` shows the MATCHING skeleton (a route loading.tsx
  // cannot read searchParams; this fallback can). loading.tsx covers the instant
  // before the searchParams resolve with the board default.
  return (
    <Suspense fallback={<JobsHubSkeleton tab={initialTab} />}>
      <JobsHubContent filters={filters} initialTab={initialTab} />
    </Suspense>
  );
}

async function JobsHubContent({
  filters,
  initialTab,
}: {
  filters: BoardFilters;
  initialTab: 'board' | 'mine' | 'myApplications' | 'saved';
}) {
  const [boardRes, facetsRes, promotedRes, mineRes, appsRes, statsRes, meRes, savedRes] =
    await Promise.all([
      listJobBoard({ ...filters, limit: BOARD_PAGE_SIZE, skip: 0 }),
      getJobBoardFacets(filters),
      // Promoted (boosted) jobs for the labelled block above the organic list.
      // BE caps at K (default 3); JobBoard only shows it on the Open tab with no
      // active text search, and de-dupes these ids out of the organic results.
      listPromotedJobs(filters),
      listMyJobs(),
      listMyApplications(),
      getJobBoardStats(),
      getMyConnectProfile(),
      listSavedJobs(),
    ]);
  // The viewer's own skills drive the "matches your skills" ribbon on Find work.
  const viewerSkills = meRes.ok ? meRes.data.skills : [];
  // The viewer's own user id - JobCard uses it to hide Save/Apply on the viewer's
  // OWN jobs (owner-on-own-job; mirrors the post-menu fix). Empty string = unknown.
  const viewerId = meRes.ok ? meRes.data.userId : '';
  // The viewer's already-applied job ids - the card renders Apply as a disabled
  // "Applied" state for these (no second tap). Derived from listMyApplications so
  // the board does not need a per-card lookup. Keep in sync with applyToJob.
  const appliedJobIds = appsRes.ok ? appsRes.data.map((a) => a.jobId) : [];
  // The viewer's saved (bookmarked) job ids - seeds the card's filled-bookmark
  // state without a per-card fetch. Derived from listSavedJobs.
  const savedJobIds = savedRes.ok ? savedRes.data.map((j) => j._id) : [];
  return (
    <JobBoard
      filters={filters}
      initialTab={initialTab}
      initialResults={boardRes.ok ? boardRes.data : []}
      initialFacets={facetsRes.ok ? facetsRes.data : null}
      initialPromoted={promotedRes.ok ? promotedRes.data : []}
      mine={mineRes.ok ? mineRes.data : []}
      myApplications={appsRes.ok ? appsRes.data : []}
      stats={statsRes.ok ? statsRes.data : { openTotal: 0, newToday: 0 }}
      viewerSkills={viewerSkills}
      viewerId={viewerId}
      appliedJobIds={appliedJobIds}
      savedJobIds={savedJobIds}
      saved={savedRes.ok ? savedRes.data : []}
    />
  );
}
