'use client';

import { useTranslations } from 'next-intl';
import { Tag } from 'antd';
import { FileText } from 'lucide-react';
// Per-item "Sample" disclosure pill on a seeded demo applicant (application.isDemo).
import SampleBadge from '@/components/connect/SampleBadge';
import type { JobApplication } from './jobs.types';

const STATUS_COLOR: Record<JobApplication['status'], string> = {
  applied: 'blue',
  shortlisted: 'gold',
  accepted: 'green',
  declined: 'red',
  withdrawn: 'default',
};

/** The positive hiring path; declined / withdrawn are terminal off-pipeline. */
const PIPELINE: Array<'applied' | 'shortlisted' | 'accepted'> = [
  'applied',
  'shortlisted',
  'accepted',
];

/**
 * A single application, shown both in the company's review list (with an action
 * slot) and the applicant's "My applications" view. `applicantName`/`actions`
 * are filled by the parent; the applicant identity comes from the people batch.
 * `pipeline` renders the application-tracking stepper (the seeker's view) -
 * driven entirely by the real status, no fabricated stages.
 */
export default function ApplicationCard({
  application,
  applicantName,
  actions,
  pipeline = false,
}: {
  application: JobApplication;
  applicantName?: string;
  actions?: React.ReactNode;
  pipeline?: boolean;
}) {
  const t = useTranslations('connect.jobs');
  const isOffPipeline = application.status === 'declined' || application.status === 'withdrawn';
  const reachedIndex = PIPELINE.indexOf(
    application.status as 'applied' | 'shortlisted' | 'accepted',
  );

  return (
    <div
      role="group"
      aria-label={applicantName || t('applicantFallback')}
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 16,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
          {applicantName || t('applicantFallback')}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {application.isDemo && <SampleBadge size="sm" />}
          <Tag color={STATUS_COLOR[application.status]}>
            {t(`applicationStatus.${application.status}`)}
          </Tag>
        </span>
      </div>

      {/* Application-tracking stepper (seeker view). On the positive path, the
          three stages light up to the current status; declined / withdrawn show
          as a single terminal pill instead. */}
      {pipeline &&
        (isOffPipeline ? (
          <div
            className="mt-3 rounded-md px-3 py-2 text-[12.5px] font-semibold"
            style={{
              background:
                application.status === 'declined' ? 'var(--cr-error-bg)' : 'var(--cr-surface-2)',
              color: application.status === 'declined' ? 'var(--cr-error)' : 'var(--cr-text-4)',
            }}
          >
            {t(`applicationStatus.${application.status}`)}
          </div>
        ) : (
          <ol
            className="mt-3 flex items-center"
            aria-label={t('applicationProgressAria')}
            style={{ listStyle: 'none', margin: 0, padding: 0 }}
          >
            {PIPELINE.map((step, i) => {
              const reached = i <= reachedIndex;
              return (
                <li key={step} className="flex flex-1 items-center last:flex-none">
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold"
                      style={{
                        background: reached ? 'var(--cr-primary)' : 'var(--cr-surface-2)',
                        color: reached ? '#fff' : 'var(--cr-text-4)',
                        border: `1px solid ${reached ? 'var(--cr-primary)' : 'var(--cr-border)'}`,
                      }}
                    >
                      {i + 1}
                    </span>
                    <span
                      className="text-[11.5px] font-semibold whitespace-nowrap"
                      style={{ color: reached ? 'var(--cr-text-2)' : 'var(--cr-text-4)' }}
                    >
                      {t(`applicationStatus.${step}`)}
                    </span>
                  </span>
                  {i < PIPELINE.length - 1 && (
                    <span
                      aria-hidden
                      className="mx-2 h-px flex-1"
                      style={{
                        background: i < reachedIndex ? 'var(--cr-primary)' : 'var(--cr-border)',
                      }}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        ))}

      {application.message && (
        <p className="mt-2 mb-0 text-[13px]" style={{ color: 'var(--cr-text-2)' }}>
          {application.message}
        </p>
      )}
      {application.voiceNoteUrl && (
        <audio
          controls
          src={application.voiceNoteUrl}
          aria-label={t('voiceNoteFor', { name: applicantName || t('applicantFallback') })}
          className="mt-2 w-full"
        />
      )}
      {application.resumeUrl && (
        <a
          href={application.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-semibold no-underline"
          style={{
            border: '1px solid var(--cr-border)',
            background: 'var(--cr-surface-2)',
            color: 'var(--cr-primary)',
          }}
        >
          <FileText size={14} aria-hidden /> {application.resumeName || t('resumeView')}
        </a>
      )}
      {actions && <div className="mt-3 flex justify-end gap-2">{actions}</div>}
    </div>
  );
}
