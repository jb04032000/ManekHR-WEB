import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import {
  getPublicCompanyPage,
  getCompanyPageFollowState,
  getInstituteAlumni,
  getInstitutePlacements,
} from '@/features/connect/entities/company-page.actions';
import { getCompanyPagePosts } from '@/features/connect/feed.actions';
import { getCompanyPageJobs } from '@/features/connect/jobs/jobs.actions';
import { getCompanyPageListings } from '@/features/connect/entities/storefront.actions';
import CompanyPageView from '@/features/connect/entities/CompanyPageView';
import { env } from '@/lib/env';
import { entitySeo, notFoundSeo } from '@/lib/connect/seo-meta';
import { JsonLd } from '@/components/marketing/JsonLd';
import { organizationJsonLd } from '@/components/connect/seo/connect-schema';
import ShareButton from '@/components/connect/ShareButton';

/**
 * `/company/[slug]` -- the public, SEO-indexable Company Page.
 *
 * SSR; only resolvable, non-hidden pages render (the backend 404s the rest).
 * Works logged-out with a "Join Connect" conversion CTA. The ERP-linked badge
 * is derived live + trimmed to `{ linked, since }` (privacy wall). Mirrors the
 * `/u/[slug]` profile template.
 */

interface PageProps {
  params: Promise<{ slug: string }>;
}

const loadPage = cache((slug: string) => getPublicCompanyPage(slug));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getTranslations('connect.companyPage');
  const res = await loadPage(slug);

  if (!res.ok) return notFoundSeo(t('notFoundTitle'));

  const { page } = res.data;
  const description = page.about.trim().slice(0, 160) || t('metaFallback', { name: page.name });

  return entitySeo({
    path: `/company/${page.slug}`,
    title: page.name,
    description,
    image: page.banner,
    ogType: 'website',
  });
}

export default async function PublicCompanyPage({ params }: PageProps) {
  const { slug } = await params;
  const res = await loadPage(slug);
  if (!res.ok) notFound();

  const t = await getTranslations('connect.profile');
  const { page, erpLink, followerCount, rating } = res.data;

  // The Posts + Jobs + Products sections + the viewer's follow state (false out).
  const [postsRes, jobsRes, productsRes, followRes] = await Promise.all([
    getCompanyPagePosts(page._id),
    getCompanyPageJobs(page._id),
    getCompanyPageListings(page._id),
    getCompanyPageFollowState(page._id),
  ]);

  // Institute-only public reads (Institutes Phase 2, Feature 2): the Alumni /
  // Open-to-work tab + the "where our students work" Placement wall. Fetched only
  // for institute pages (the BE 404s these otherwise) and seeded SSR so the tab
  // content is SEO-visible + paints without a flash. The logged-out visitor sees
  // these tabs only when non-empty (isOwner is always false here). The BE
  // already DPDP-trims the rows.
  const isInstitute = page.kind === 'institute';
  const [alumniRes, placementsRes] = isInstitute
    ? await Promise.all([getInstituteAlumni(page._id), getInstitutePlacements(page._id)])
    : [null, null];

  // Organization structured data for the company (name + cover + about only).
  // An institute page (kind === 'institute') is an EducationalOrganization so the
  // courses it lists resolve to a real educational provider in the graph; a
  // business page stays a plain Organization.
  const companyUrl = `${env.appUrl}/company/${page.slug}`;

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 py-6 sm:px-6 sm:py-8">
      <JsonLd
        data={organizationJsonLd({
          type: isInstitute ? 'EducationalOrganization' : 'Organization',
          name: page.name,
          url: `/company/${page.slug}`,
          logo: page.banner,
          description: page.about,
        })}
      />
      <div className="mb-3 flex justify-end">
        <ShareButton surface="company" url={companyUrl} name={page.name} size="small" />
      </div>
      <CompanyPageView
        page={page}
        erpLinked={erpLink.linked}
        followerCount={followerCount}
        initialFollowing={followRes.ok ? followRes.data.following : false}
        postsPage={postsRes.ok ? postsRes.data : undefined}
        jobs={jobsRes.ok ? jobsRes.data : []}
        products={productsRes.ok ? productsRes.data : []}
        rating={rating}
        isOwner={false}
        alumniPage={alumniRes?.ok ? alumniRes.data : undefined}
        placements={placementsRes?.ok ? placementsRes.data : undefined}
      />

      {/* Logged-out conversion CTA (reuses the profile join copy). */}
      <div className="mx-auto mt-6 w-full max-w-[960px]">
        <div
          className="flex flex-col items-start gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"
          style={{
            background: 'var(--cr-wash-indigo)',
            border: '1px solid var(--cr-primary-border)',
            borderRadius: 'var(--cr-radius-lg)',
          }}
        >
          <div>
            <div className="text-[15px] font-semibold" style={{ color: 'var(--cr-text)' }}>
              {t('joinCtaTitle')}
            </div>
            <p className="m-0 mt-1 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
              {t('joinCtaBody')}
            </p>
          </div>
          <Link
            href="/connect"
            className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold no-underline"
            style={{ background: 'var(--cr-primary)', color: '#ffffff', flexShrink: 0 }}
          >
            {t('joinCtaButton')}
            <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
      </div>
    </div>
  );
}
