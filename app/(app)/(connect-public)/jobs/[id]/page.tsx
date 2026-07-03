import { cache } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { getPublicJob } from '@/features/connect/jobs/jobs.actions';
import { getCompanyPageRefs } from '@/features/connect/entities/company-page.actions';
import { getPublicPeople } from '@/features/connect/network.actions';
import JobDetailScreen from '@/features/connect/jobs/JobDetailScreen';
import type { JobEmployer } from '@/features/connect/jobs/jobs.types';
import { env } from '@/lib/env';
import { entitySeo, notFoundSeo } from '@/lib/connect/seo-meta';
import { JsonLd } from '@/components/marketing/JsonLd';
import { jobPostingJsonLd } from '@/components/connect/seo/connect-schema';
import ShareButton from '@/components/connect/ShareButton';

/**
 * `/jobs/[id]` -- the PUBLIC, SEO-indexable job detail + WhatsApp share landing.
 * Planned `(connect-public)` job route (see the group layout comment). SSR,
 * logged-out, JobPosting JSON-LD (feeds Google's jobs surface), OG tags, and a
 * Join-Connect CTA.
 *
 * Reads the `@Public` `GET /connect/jobs/public/:id`, which resolves a job ONLY
 * when its status is 'open' (closed/filled 404, so a dead job is invisible to
 * crawlers - the jobs analogue of suppressed-listing 404). The authed
 * `/connect/jobs/[id]` mirror owns the apply / hiring-funnel experience; an
 * authenticated member is mirror-redirected there by the proxy, so this page
 * serves crawlers + guests. The candidate view renders read-only-ish here
 * (canSave off, no application context).
 */

interface PageProps {
  params: Promise<{ id: string }>;
}

const loadJob = cache((id: string) => getPublicJob(id));

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations('connect.jobs');
  const res = await loadJob(id);
  if (!res.ok) return notFoundSeo(t('meta.title'));

  const job = res.data;
  const description = job.description.trim().slice(0, 160) || t('meta.description');
  return entitySeo({
    path: `/jobs/${id}`,
    title: job.title,
    description,
    image: job.videos?.[0]?.posterUrl,
    ogType: 'article',
  });
}

/**
 * Resolve the hiring identity using PUBLIC reads only (no authed actions, so a
 * logged-out view logs no 401 noise). A page-posted job resolves to its
 * CompanyPage (name + logo + public /company link); a person-posted job falls
 * back to the poster's public person ref. Returns the employer + the public
 * company href for the JobPosting `hiringOrganization.sameAs`.
 */
async function resolveEmployer(
  companyPageId: string | null,
  companyUserId: string,
): Promise<{ employer?: JobEmployer; orgUrl?: string }> {
  if (companyPageId) {
    const refRes = await getCompanyPageRefs([companyPageId]);
    const ref = refRes.ok ? refRes.data[0] : undefined;
    if (ref) {
      return {
        employer: { name: ref.name, avatar: ref.logo || null, href: `/company/${ref.slug}` },
        orgUrl: `/company/${ref.slug}`,
      };
    }
  }
  const pplRes = await getPublicPeople([companyUserId]);
  const person = pplRes.ok ? pplRes.data[0] : undefined;
  if (person) return { employer: { name: person.name, avatar: person.avatar } };
  return {};
}

export default async function PublicJobPage({ params }: PageProps) {
  const { id } = await params;
  const res = await loadJob(id);
  if (!res.ok) notFound();
  const job = res.data;

  const t = await getTranslations('connect.profile');
  const { employer, orgUrl } = await resolveEmployer(job.companyPageId, job.companyUserId);

  const jobUrl = `${env.appUrl}/jobs/${id}`;
  // JobPosting requires a hiring org name; emit only when we resolved one.
  const jobLd = employer?.name
    ? jobPostingJsonLd(job, { url: jobUrl, hiringOrgName: employer.name, hiringOrgUrl: orgUrl })
    : null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-6 sm:px-6 sm:py-8">
      {jobLd ? <JsonLd data={jobLd} /> : null}

      <div className="mb-3 flex justify-end">
        <ShareButton surface="job" url={jobUrl} name={job.title} size="small" />
      </div>

      <JobDetailScreen
        job={job}
        isCompany={false}
        applications={[]}
        myApplication={null}
        employer={employer}
        viewerSkills={[]}
        similarJobs={[]}
        isSaved={false}
        canSave={false}
      />

      {/* Logged-out conversion CTA (reuses the profile join copy). */}
      <div className="mx-auto mt-6 w-full max-w-[1100px]">
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
