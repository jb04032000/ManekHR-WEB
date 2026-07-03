'use client';

/**
 * CompanyJobsManager - the OWNER's page-scoped job history + management surface,
 * rendered in the manage console Jobs tab (ManageCompanyPageScreen). Unlike the
 * public CompanyJobsSection (open-only), this lists ALL of the page's jobs (open /
 * filled / closed) from getCompanyPageJobsForOwner, with a status filter + counts,
 * Post a job, and a quick Close on open rows. Each row links to the job detail
 * (/connect/jobs/[id]) where edit / applicant review live (screen 2). Posting +
 * closing router.refresh so the SSR list re-reads. Cross-module: jobs publish to
 * the Connect board attributed to this page.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { message } from 'antd';
import { Briefcase } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import ConnectEmptyState from '@/components/connect/ConnectEmptyState';
import { useLimitReachedDialog } from '@/components/connect/useLimitReachedDialog';
import { parseApiError } from '@/lib/utils';
import JobComposer from '../jobs/JobComposer';
import CompanyJobRow from './CompanyJobRow';
import { createJob, closeJob } from '../jobs/jobs.actions';
import type { Job, JobStatus, CreateJobPayload } from '../jobs/jobs.types';

type Filter = 'all' | JobStatus;

export default function CompanyJobsManager({
  pageId,
  pageName,
  jobs,
}: {
  pageId: string;
  pageName: string;
  jobs: Job[];
}) {
  const t = useTranslations('connect.companyPage');
  const tJobs = useTranslations('connect.jobs');
  const router = useRouter();
  const [msgApi, ctx] = message.useMessage();
  const [composerOpen, setComposerOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  // Plan-limit upgrade prompt for a blocked job post.
  const { dialog: limitDialog, handleLimited } = useLimitReachedDialog();
  const [closingId, setClosingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  // "Use as template": when set, the composer opens prefilled from this job and
  // posts a NEW job (createJob) - lets an owner re-run a similar role without
  // retyping. Cleared on close/post. null = a blank "Post a job".
  const [templateJob, setTemplateJob] = useState<Job | null>(null);

  const openComposer = (template: Job | null) => {
    setTemplateJob(template);
    setComposerOpen(true);
  };
  const closeComposer = () => {
    setComposerOpen(false);
    setTemplateJob(null);
  };

  const counts = useMemo(() => {
    const c = { all: jobs.length, open: 0, filled: 0, closed: 0 };
    for (const j of jobs) c[j.status] += 1;
    return c;
  }, [jobs]);

  const filtered = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter((j) => j.status === filter)),
    [jobs, filter],
  );

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
      closeComposer();
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

  // The status filter chips (each with a live count). All / Open / Filled / Closed.
  const filters: { key: Filter; label: string }[] = [
    { key: 'all', label: t('jobsFilterAll') },
    { key: 'open', label: tJobs('status.open') },
    { key: 'filled', label: tJobs('status.filled') },
    { key: 'closed', label: tJobs('status.closed') },
  ];

  return (
    <section>
      {ctx}
      {limitDialog}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('jobsOpenPositions')}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(f.key)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--cr-primary)] focus-visible:ring-offset-1 focus-visible:outline-none"
                style={{
                  border: `1px solid ${active ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                  background: active ? 'var(--cr-primary)' : 'var(--cr-surface)',
                  color: active ? '#fff' : 'var(--cr-text-2)',
                }}
              >
                {f.label}
                <span
                  className="text-[11px]"
                  style={{ color: active ? 'rgba(255,255,255,0.75)' : 'var(--cr-text-4)' }}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>
        {jobs.length > 0 && (
          <DsButton
            dsVariant="primary"
            dsSize="sm"
            icon={<Briefcase size={15} aria-hidden />}
            onClick={() => openComposer(null)}
          >
            {t('jobsPostCta')}
          </DsButton>
        )}
      </div>

      {jobs.length === 0 ? (
        <ConnectEmptyState
          variant="inline"
          icon={<Briefcase size={24} aria-hidden />}
          title={t('jobsEmptyOwnerTitle')}
          description={t('jobsEmptyOwnerBody')}
          primaryAction={{ label: t('jobsPostCta'), onClick: () => openComposer(null) }}
        />
      ) : filtered.length === 0 ? (
        <p className="m-0 py-6 text-center text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
          {t('jobsNoneInStatus')}
        </p>
      ) : (
        <ul
          className="m-0 grid list-none gap-3 p-0"
          aria-label={t('jobsListAriaOwner', { name: pageName })}
        >
          {filtered.map((job) => (
            <li key={job._id}>
              <CompanyJobRow
                job={job}
                isOwner
                onClose={handleClose}
                onUseAsTemplate={(j) => openComposer(j)}
                showOpenChip
                closing={closingId === job._id}
              />
            </li>
          ))}
        </ul>
      )}

      <JobComposer
        open={composerOpen}
        submitting={posting}
        companyPageId={pageId}
        // templateJob prefills the form (row "Use as template"); null = blank new
        // post. mode stays 'create' either way, so this always calls createJob.
        initial={templateJob ?? undefined}
        // The page's jobs also seed the in-modal "Start from a past job" picker, so
        // a template can be chosen (or switched) from inside the composer too.
        templates={jobs}
        onClose={closeComposer}
        onSubmit={handlePost}
      />
    </section>
  );
}
