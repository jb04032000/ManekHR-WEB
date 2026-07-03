import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getPublicCompanyPage,
  getCompanyPageFollowState,
  getPublicCompanyPageStore,
  getInstituteAlumni,
  getInstitutePlacements,
} from '@/features/connect/entities/company-page.actions';
import { getCompanyPagePosts } from '@/features/connect/feed.actions';
import { getCompanyPageJobs } from '@/features/connect/jobs/jobs.actions';
import { getCompanyPageListings } from '@/features/connect/entities/storefront.actions';
import { getMyConnectProfile } from '@/features/connect/profile.actions';
import CompanyPageView from '@/features/connect/entities/CompanyPageView';
import ConnectPage from '@/components/connect/ConnectPage';
import EntityAdRail from '@/features/connect/ads/EntityAdRail';
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import { resolvePromotedRailListing } from '@/features/connect/ads/promoted-rail';

/**
 * `/connect/company/[slug]` -- the IN-APP (authenticated) view of a Company
 * Page.
 *
 * Mirrors `/connect/u/[slug]` for people: lives inside the Connect app shell
 * (sidebar + top bar), carries NO logged-out "Join Connect" conversion CTA, and
 * is `noindex` (the public `/company/[slug]` mirror is the SEO-canonical copy).
 * Every in-app company link targets this route so a signed-in member never
 * bounces into the logged-out marketing page when they tap a workshop -- the gap
 * the public-only route left. Read-only for everyone (incl. the owner) - the
 * owner edits from the Company Pages hub's "Manage", so a "View public" link
 * resolves here without bouncing into an edit form.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('connect.companyPage');
  const res = await getPublicCompanyPage(slug);
  if (!res.ok) {
    return { title: t('notFoundTitle'), robots: { index: false, follow: false } };
  }
  // The authed mirror is never indexed -- the public `/company/[slug]` owns SEO.
  return { title: res.data.page.name, robots: { index: false, follow: false } };
}

export default async function ConnectCompanyPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await getPublicCompanyPage(slug);
  if (!res.ok) notFound();

  const { page, erpLink, followerCount, rating } = res.data;

  // Products feed the redirect-first Store card (count + featured preview); the
  // attached public store gives the card its identity (name/logo/slug) + the
  // Visit-store target. Both are best-effort: no store -> no Store section.
  const [postsRes, jobsRes, productsRes, followRes, promoted, meRes, storeRes] = await Promise.all([
    getCompanyPagePosts(page._id),
    getCompanyPageJobs(page._id),
    getCompanyPageListings(page._id),
    getCompanyPageFollowState(page._id),
    resolvePromotedRailListing('company_page'),
    getMyConnectProfile(),
    getPublicCompanyPageStore(page._id),
  ]);

  // Owner-awareness for the jobs section: the in-app viewer manages their own
  // page's jobs (Post/close/stats); everyone else sees the candidate apply view.
  const isOwner = meRes.ok && meRes.data.userId === page.ownerUserId;
  // A resolved profile means the viewer is signed in: gates the institute-only
  // "Hire our trained candidates" lead button (Institutes Phase 2, Feature 4).
  const viewerSignedIn = meRes.ok;

  // Institute-only public reads (Institutes Phase 2, Feature 2): the Alumni /
  // Open-to-work tab + the "where our students work" Placement wall. Fetched only
  // for institute pages (the BE 404s these for a non-institute) and seeded SSR so
  // the tab content paints without a flash. Best-effort: a failure degrades to
  // an absent tab, never a broken page. The BE already DPDP-trims the rows.
  const isInstitute = page.kind === 'institute';
  const [alumniRes, placementsRes] = isInstitute
    ? await Promise.all([getInstituteAlumni(page._id), getInstitutePlacements(page._id)])
    : [null, null];

  const view = (
    <CompanyPageView
      page={page}
      erpLinked={erpLink.linked}
      followerCount={followerCount}
      initialFollowing={followRes.ok ? followRes.data.following : false}
      postsPage={postsRes.ok ? postsRes.data : undefined}
      jobs={jobsRes.ok ? jobsRes.data : []}
      products={productsRes.ok ? productsRes.data : []}
      store={storeRes.ok ? storeRes.data : null}
      rating={rating}
      isOwner={isOwner}
      viewerSignedIn={viewerSignedIn}
      alumniPage={alumniRes?.ok ? alumniRes.data : undefined}
      placements={placementsRes?.ok ? placementsRes.data : undefined}
    />
  );

  // The ad rail is always present (the page mirrors the marketplace's two-column
  // layout): it carries the Google AdSlots + a first-party promoted listing when
  // decided, and a house "advertise" panel as floor content so it never collapses
  // to a blank column. On < xl the rail is hidden and the page is single-column.
  return (
    <ConnectPage className="flex gap-5">
      <main className="min-w-0 flex-1">
        {view}
        {/* Mobile-only ad: the rail (with this same boost + Google slot) is hidden
            below xl, so phone users get the inventory inline here instead. */}
        <MobileAdInline promoted={promoted} />
      </main>
      <EntityAdRail promoted={promoted} />
    </ConnectPage>
  );
}
