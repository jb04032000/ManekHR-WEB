'use client';

/**
 * CompanyJobsSection - the role-aware Jobs section on a company page. The owner
 * sees Post a job + "Manage in Jobs ->" + per-row stats/close; everyone else sees
 * a compact "View & apply" list. Mounted in CompanyPageView (in-app, isOwner
 * derived from the viewer profile), the public SEO mirror (isOwner=false), and
 * ManageCompanyPageScreen (isOwner). Posting reuses JobComposer with
 * companyPageId; closing reuses closeJob (jobs.actions). After a mutation we
 * router.refresh() so the SSR job list + KPI stats re-read. Cross-module: jobs
 * posted here publish to the Connect jobs board attributed to this page.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import { ArrowRight, Briefcase } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import { parseApiError } from '@/lib/utils';
import JobComposer from '../jobs/JobComposer';
import CompanyJobRow from './CompanyJobRow';
import { showOwnerEmpty } from './companyJobs.logic';
import { createJob, closeJob } from '../jobs/jobs.actions';
import type { Job, CreateJobPayload } from '../jobs/jobs.types';

export default function CompanyJobsSection({
  pageId,
  pageName,
  jobs,
  isOwner,
}: {
  pageId: string;
  pageName: string;
  jobs: Job[];
  isOwner: boolean;
}) {
  const t = useTranslations('connect.companyPage');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  // Plan-limit upgrade prompt for a blocked job post.
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();
  const [closingId, setClosingId] = useState<string | null>(null);

  const handlePost = async (payload: CreateJobPayload) => {
    setPosting(true);
    try {
      const res = await createJob(payload);
      if (!res.ok) {
        // Plan-limit block shows the shared upgrade dialog, not a toast.
        if (handleLimited(res)) return;
        msgApi.error(res.error);
        return;
      }
      void msgApi.success(t('jobsPostSuccess'));
      setComposerOpen(false);
      router.refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setPosting(false);
    }
  };

  const handleClose = async (jobId: string, filled: boolean) => {
    setClosingId(jobId);
    try {
      const res = await closeJob(jobId, filled);
      if (!res.ok) {
        msgApi.error(res.error);
        return;
      }
      void msgApi.success(filled ? t('jobsFilledSuccess') : t('jobsCloseSuccess'));
      router.refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setClosingId(null);
    }
  };

  // A visitor with no open jobs renders nothing (the parent also hides the tab).
  if (!isOwner && jobs.length === 0) return null;

  return (
    <section>
      {ctx}
      {limitDialog}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[16px] font-bold" style={{ color: 'var(--cr-text)' }}>
          {t('jobsOpenPositions')}
        </h2>
        {isOwner && (
          <div className="flex items-center gap-3">
            {/* Page-scoped management: the manage console Jobs tab (full history /
                all statuses), NOT the global board. ?tab=jobs deep-links the tab. */}
            <Link
              href={`/connect/pages/${pageId}?tab=jobs`}
              className="inline-flex items-center gap-1 text-[13px] font-semibold no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              {t('jobsManageInJobs')} <ArrowRight size={14} aria-hidden />
            </Link>
            {jobs.length > 0 && (
              <DsButton
                dsVariant="primary"
                dsSize="sm"
                icon={<Briefcase size={15} aria-hidden />}
                onClick={() => setComposerOpen(true)}
              >
                {t('jobsPostCta')}
              </DsButton>
            )}
          </div>
        )}
      </div>

      {showOwnerEmpty(jobs.length, isOwner) ? (
        <ConnectEmptyState
          variant="inline"
          icon={<Briefcase size={24} aria-hidden />}
          title={t('jobsEmptyOwnerTitle')}
          description={t('jobsEmptyOwnerBody')}
          primaryAction={{ label: t('jobsPostCta'), onClick: () => setComposerOpen(true) }}
        />
      ) : (
        <ul
          className="m-0 grid list-none gap-3 p-0"
          aria-label={t(isOwner ? 'jobsListAriaOwner' : 'jobsListAriaViewer', { name: pageName })}
        >
          {jobs.map((job) => (
            <li key={job._id}>
              <CompanyJobRow
                job={job}
                isOwner={isOwner}
                onClose={handleClose}
                closing={closingId === job._id}
              />
            </li>
          ))}
        </ul>
      )}

      {isOwner && (
        <JobComposer
          open={composerOpen}
          submitting={posting}
          companyPageId={pageId}
          // The page's jobs seed the in-modal "Start from a past job" picker so a
          // new post can copy an earlier one's details (same prefill as the manage
          // console's row "Use as template").
          templates={jobs}
          onClose={() => setComposerOpen(false)}
          onSubmit={handlePost}
        />
      )}
    </section>
  );
}
