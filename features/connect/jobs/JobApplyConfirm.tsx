'use client';

/**
 * JobApplyConfirm - the quick-apply modal opened from a board JobCard's Apply
 * button. It hosts the SHARED ApplicationComposer (the exact same apply form used
 * on the job detail page), so the apply feature is single-source: any change to
 * ApplicationComposer (fields, validation, copy) reflects on BOTH the board
 * quick-apply modal and the detail page. Above the form it restates the job title
 * and what actually happens -- the candidate's Connect profile (experience +
 * skills) is what gets shared. Every composer field is optional, so this stays a
 * genuine quick apply (a karigar can just hit Apply).
 *
 * Cross-module links:
 * - features/connect/jobs/ApplicationComposer.tsx (THE shared apply form; also
 *   rendered on JobDetailScreen). Keep them rendering the same component.
 * - jobs.actions.applyToJob (BE connect/jobs/:id/apply; returns the created
 *   JobApplication; hiring funnel notifies the employer).
 * - Opened by JobCard; onApplied(application) bubbles the created application up so
 *   JobCard flips to "Applied" AND JobBoard adds it to the My applications tab.
 *
 * AntD v6: `open` + `destroyOnHidden` + `footer={null}` (the composer owns its
 * submit button).
 */

import { useState } from 'react';
import { App, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { parseApiError } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { applyToJob } from './jobs.actions';
import ApplicationComposer from './ApplicationComposer';
import type { Job, JobApplication, CreateApplicationPayload } from './jobs.types';

export default function JobApplyConfirm({
  job,
  open,
  onClose,
  onApplied,
}: {
  job: Job;
  open: boolean;
  onClose: () => void;
  /** Fired with the created application after a successful apply, so the parent
   *  card flips to "Applied" and the board reflects it in My applications. */
  onApplied: (application: JobApplication) => void;
}) {
  const t = useTranslations('connect.jobs');
  const { message } = App.useApp();
  const [submitting, setSubmitting] = useState(false);

  // Shared submit path: the composer hands us the payload (message / voice / resume,
  // all optional), we POST it and bubble the created application up. Same action the
  // detail page calls -> identical behaviour on both surfaces.
  const submit = async (payload: CreateApplicationPayload) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await applyToJob(job._id, payload);
      if (!res.ok) {
        message.error(res.error);
        return;
      }
      // Analytics: a quick apply confirmed from the board. { jobId }. Fired only on
      // a successful apply, so it counts real applications, not modal opens.
      track('connect.jobs.apply_confirmed', { jobId: job._id });
      void message.success(t('applyConfirm.success'));
      onApplied(res.data);
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('applyConfirm.title')}
      destroyOnHidden
      centered
      width={480}
      footer={null}
      // Scroll ONLY the body (title stays pinned), not the whole modal: cap the body
      // and let it scroll internally so a tall composer (voice + resume) never makes
      // the entire dialog overflow the viewport.
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
    >
      <p className="m-0 text-[14px] font-semibold" style={{ color: 'var(--cr-text)' }}>
        {job.title}
      </p>
      <p className="m-0 mt-2 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-3)' }}>
        {t('applyConfirm.body')}
      </p>

      {/* THE shared apply form (same component as the job detail). All fields
          optional -> still a quick apply; its own button submits. The old
          "number stays private until shortlist" reassurance was removed - there is
          no such phone-privacy gating, so it was a false claim. */}
      <div className="mt-4">
        <ApplicationComposer submitting={submitting} onSubmit={submit} />
      </div>
    </Modal>
  );
}
