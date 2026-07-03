import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import { getPeople } from '@/features/connect/network.actions';
import {
  getCompanyPageRefs,
  getPublicCompanyPage,
} from '@/features/connect/entities/company-page.actions';
import {
  getJob,
  listApplicationsForMyJob,
  listMyApplications,
  listJobBoard,
  listSavedJobs,
} from '@/features/connect/jobs/jobs.actions';
import JobDetailScreen from '@/features/connect/jobs/JobDetailScreen';
import type { Job, JobEmployer, BoardFilters } from '@/features/connect/jobs/jobs.types';
import { LISTING_CATEGORIES } from '@/features/connect/search.types';
// First-party promoted-listing ad for the job-detail rail (placement
// `jobs_detail`). Resolver hydrates via the PUBLIC listing getter so a
// paused/unpublished boost target safely yields no ad. Feeds JobDetailScreen ->
// its ConnectRightRail (which also owns the Google connect.right.* slots).
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

// Known board category slugs -- the board DTO rejects unknown (custom) ones, so
// we only pass `category` to the similar-jobs query when it is a known slug.
const KNOWN_CATEGORY = new Set<string>(LISTING_CATEGORIES);

export const metadata: Metadata = {
  title: 'Job',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

const SIMILAR_LIMIT = 6;

/**
 * `/connect/jobs/[id]` -- one job. The company (owner) sees the applicant-review
 * view; everyone else sees the apply composer. Viewer is resolved from their
 * Connect profile to pick the right face. Also hydrates: the candidate's skill
 * match (viewer skills vs job.skills), the rich employer trust block (public
 * company page), the viewer's saved-state, and "similar jobs near you".
 */
export default async function ConnectJobDetailRoute({ params }: Props) {
  const { id } = await params;
  // `promoted` is the rail boost; single-slot page so no shared pageRequestId is
  // needed (dedupe is a no-op). Resolves to null on a no-fill -> rail shows no ad.
  const [jobRes, meRes, promoted] = await Promise.all([
    getJob(id),
    getMyConnectProfile(),
    resolvePromotedRailListing('jobs_detail'),
  ]);
  if (!jobRes.ok) notFound();

  const job = jobRes.data;
  const viewerId = meRes.ok ? meRes.data.userId : '';
  const isCompany = !!viewerId && job.companyUserId === viewerId;
  // The viewer's own skills drive the candidate skill-match ring (mirrors the
  // board's "matches your skills" ribbon). Owner/logged-out => empty.
  const viewerSkills = !isCompany && meRes.ok ? (meRes.data.skills ?? []) : [];

  // Hiring identity (trust context). A page-posted job resolves to the CompanyPage
  // (logo + link + rich trust signals); a personal post falls back to the poster
  // person (avatar, no profile link - PersonRef has no slug).
  let employer: JobEmployer | undefined;
  if (job.companyPageId) {
    const refRes = await getCompanyPageRefs([job.companyPageId]);
    const ref = refRes.ok ? refRes.data[0] : undefined;
    if (ref) {
      employer = { name: ref.name, avatar: ref.logo || null, href: `/connect/company/${ref.slug}` };
      // Enrich with REAL trust signals from the public page (about / followers /
      // ERP-linked / seller rating / member since). Best-effort: the minimal
      // block still renders if this read fails.
      const pubRes = await getPublicCompanyPage(ref.slug);
      if (pubRes.ok) {
        const { page, followerCount, erpLink, rating } = pubRes.data;
        const loc = [page.location?.city, page.location?.state].filter(Boolean).join(', ');
        employer = {
          ...employer,
          about: page.about || undefined,
          location: loc || undefined,
          followerCount,
          erpLinked: erpLink.linked,
          ratingAvg: rating?.ratingAvg,
          ratingCount: rating?.ratingCount,
          memberSince: page.createdAt,
        };
      }
    }
  }
  if (!employer) {
    const pplRes = await getPeople([job.companyUserId]);
    const person = pplRes.ok ? pplRes.data[0] : undefined;
    if (person) employer = { name: person.name, avatar: person.avatar };
  }

  // Similar jobs near you (same trade + district, open only). Drop the current
  // job; cap to SIMILAR_LIMIT. Reuses the board query (no fabricated data). The
  // board DTO only accepts known category slugs, so a custom-category job omits
  // it and matches on district alone rather than 400ing the whole query.
  const similarFilters: BoardFilters = {
    district: job.location?.district || undefined,
    includeFilled: false,
    sort: 'recent',
    limit: SIMILAR_LIMIT + 1,
  };
  if (KNOWN_CATEGORY.has(job.category)) {
    similarFilters.category = job.category as BoardFilters['category'];
  }
  const similarRes = await listJobBoard(similarFilters);
  const similarJobs = (similarRes.ok ? similarRes.data : [])
    .filter((j) => j._id !== job._id)
    .slice(0, SIMILAR_LIMIT);

  if (isCompany) {
    const appsRes = await listApplicationsForMyJob(id);
    const applications = appsRes.ok ? appsRes.data : [];
    const ids = [...new Set(applications.map((a) => a.applicantUserId))];
    const peopleRes = await getPeople(ids);
    const names = peopleRes.ok
      ? Object.fromEntries(peopleRes.data.map((p) => [p.userId, p.name]))
      : {};
    return (
      <JobDetailScreen
        job={job}
        isCompany
        applications={applications}
        myApplication={null}
        names={names}
        employer={employer}
        similarJobs={similarJobs}
        promoted={promoted}
      />
    );
  }

  // Candidate view: own application + saved-state.
  const [myAppsRes, savedRes] = await Promise.all([
    listMyApplications(),
    viewerId ? listSavedJobs() : Promise.resolve({ ok: true as const, data: [] as Job[] }),
  ]);
  const myApplication = myAppsRes.ok ? (myAppsRes.data.find((a) => a.jobId === id) ?? null) : null;
  const isSaved = savedRes.ok ? savedRes.data.some((j) => j._id === id) : false;
  return (
    <JobDetailScreen
      job={job}
      isCompany={false}
      applications={[]}
      myApplication={myApplication}
      employer={employer}
      viewerSkills={viewerSkills}
      similarJobs={similarJobs}
      isSaved={isSaved}
      canSave={!!viewerId}
      promoted={promoted}
    />
  );
}
