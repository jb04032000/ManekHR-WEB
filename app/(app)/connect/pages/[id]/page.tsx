import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getMyCompanyPage,
  getMyCompanyPageStats,
  listMyCompanyPages,
  getCompanyPageStore,
  listCredentialRequests,
  getStudentInviteSummary,
} from '@/features/connect/entities/company-page.actions';
import { getCompanyPagePosts } from '@/features/connect/feed.actions';
import { getCompanyPageJobsForOwner } from '@/features/connect/jobs/jobs.actions';
import ManageCompanyPageScreen from '@/features/connect/entities/ManageCompanyPageScreen';
// First-party promoted-listing ad for the manage-console rail (placement
// `company_manage`). Hydrates via the PUBLIC listing getter (no owner leak);
// null on a no-fill. Adds the boost + Google slots to this previously bare rail.
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

export const metadata: Metadata = {
  title: 'Manage company page',
  robots: { index: false, follow: false },
};

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * `/connect/pages/[id]` -- manage one of the owner's Company Pages. The BE
 * 404s a page the caller does not own (no existence leak), which surfaces here
 * as notFound(). Loads the page + its posts + its FULL job history (all statuses,
 * owner-only via getCompanyPageJobsForOwner - the Jobs tab is the page-scoped
 * manager), plus the owner's per-page KPI stats (followers / 30-day posts / open
 * jobs) and the
 * full page list (the header switcher). Stats/list are best-effort: a failure
 * degrades to zero-state KPIs + a single-page header, never a broken screen.
 */
export default async function ManageCompanyPageRoute({ params }: Props) {
  const { id } = await params;
  const res = await getMyCompanyPage(id);
  if (!res.ok) notFound();
  // Store: the one storefront attached to this page (owner view, any visibility),
  // fed SSR so the Store tab has no fetch flash. Best-effort: a failure degrades
  // to "no store attached", never a broken screen.
  const [postsRes, jobsRes, statsRes, listRes, storeRes, promoted] = await Promise.all([
    getCompanyPagePosts(id, undefined, { manage: true }),
    getCompanyPageJobsForOwner(id),
    getMyCompanyPageStats(),
    listMyCompanyPages(),
    getCompanyPageStore(id),
    resolvePromotedRailListing('company_manage'), // rail boost (single slot)
  ]);
  const stat = statsRes.ok ? statsRes.data.pages.find((p) => p.pageId === id) : undefined;
  const pages = listRes.ok ? listRes.data.map((p) => ({ id: p._id, name: p.name })) : [];

  // Institute-only (Phase 2 Feature 3): SSR-seed the credential-review queue + the
  // first-touch invite roll-up for the two institute tabs, so they paint without a
  // client fetch. Best-effort: a failure degrades to an empty queue / zero counts,
  // never a broken screen. Skipped entirely for a business page (no extra calls).
  const isInstitute = res.data.kind === 'institute';
  const [credentialRes, summaryRes] = isInstitute
    ? await Promise.all([listCredentialRequests(id), getStudentInviteSummary(id)])
    : [null, null];

  return (
    <ManageCompanyPageScreen
      page={res.data}
      stat={stat}
      pages={pages}
      postsPage={postsRes.ok ? postsRes.data : undefined}
      jobs={jobsRes.ok ? jobsRes.data : []}
      store={storeRes.ok ? storeRes.data : null}
      credentialRequests={credentialRes?.ok ? credentialRes.data : []}
      inviteSummary={summaryRes?.ok ? summaryRes.data : { joinedCount: 0, pendingCount: 0 }}
      promoted={promoted}
    />
  );
}
