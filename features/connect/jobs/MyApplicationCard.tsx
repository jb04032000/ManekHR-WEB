'use client';

/**
 * MyApplicationCard - one row in the seeker's "My applications" tab. Job-centric
 * (icon + job title + employer / location / applied-date) with the application's
 * status badge and a Withdraw control. Every value is REAL: the job snapshot +
 * employer name come from the enriched MyApplicationView (BE listMyApplications),
 * and "Viewed" is the genuine employer-saw-it signal (status 'applied' + viewedAt).
 *
 * Cross-module links:
 * - jobs.types.MyApplicationView (BE JobsService.MyApplicationView mirror).
 * - jobs.actions.withdrawApplication (BE POST /applications/:id/withdraw).
 * - Rendered by JobBoard's My applications tab; onWithdrawn bubbles the id so the
 *   board updates the row to "Withdrawn" live.
 *
 * Interaction & Cursor Contract: the whole card is a stretched <Link> to the job
 * detail; Withdraw is a real button layered above it (relative z-[2]) so it clicks
 * independently - no wrapper onClick, no stopPropagation.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App } from 'antd';
import {
  type LucideIcon,
  Brush,
  Briefcase,
  Cog,
  MapPin,
  PenTool,
  RotateCcw,
  Scissors,
  Users,
  X,
} from 'lucide-react';
import dayjs from 'dayjs';
import { parseApiError } from '@/lib/utils';
import { withdrawApplication } from './jobs.actions';
import type { MyApplicationView, ApplicationStatus, JobRole } from './jobs.types';

// role -> icon (keep in sync with JobCard ROLE_ICON / GOLD_ROLES). Hand-work roles
// get the gold tile; machine / oversight roles the indigo tile; unknown -> Briefcase.
const ROLE_ICON: Partial<Record<JobRole, LucideIcon>> = {
  karigar: Brush,
  helper: Scissors,
  operator: Cog,
  designer: PenTool,
  supervisor: Users,
};
const GOLD_ROLES = ['karigar', 'helper'];

// Statuses that can still be withdrawn (live applications). Terminal ones render a
// disabled Withdraw so the action zone stays consistent across rows.
const WITHDRAWABLE: ApplicationStatus[] = ['applied', 'shortlisted'];

type Tone = { bg: string; fg: string; border?: string };

export default function MyApplicationCard({
  application,
  onWithdrawn,
}: {
  application: MyApplicationView;
  /** Fired with the application id after a successful withdraw so the parent flips
   *  the row to "Withdrawn" without a reload. */
  onWithdrawn?: (id: string) => void;
}) {
  const t = useTranslations('connect.jobs');
  const { message, modal } = App.useApp();
  const [withdrawing, setWithdrawing] = useState(false);

  const job = application.job;
  const role = job?.role ?? null;
  const Icon: LucideIcon = (role && ROLE_ICON[role as JobRole]) || Briefcase;
  const gold = role ? GOLD_ROLES.includes(role) : false;

  // "Viewed" is display-only: the stored status is still 'applied', but the employer
  // has opened it (viewedAt). It never overrides shortlisted / accepted / declined.
  const isViewed = application.status === 'applied' && !!application.viewedAt;
  const statusKey = isViewed ? 'viewed' : application.status;
  const tone: Tone = {
    // "Applied" reads as a solid pending chip (darker text) so it never looks like
    // the OUTLINED, muted "Withdrawn" chip below.
    applied: { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-3)' },
    viewed: { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)' },
    shortlisted: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
    accepted: { bg: 'var(--cr-success)', fg: '#fff' },
    declined: { bg: 'var(--cr-error-bg)', fg: 'var(--cr-error)' },
    withdrawn: { bg: 'transparent', fg: 'var(--cr-text-5)', border: 'var(--cr-border)' },
  }[statusKey];

  const location = [job?.location?.district, job?.location?.state].filter(Boolean).join(', ');
  const appliedOn = application.createdAt
    ? t('myApps.appliedOn', { date: dayjs(application.createdAt).format('D MMM YYYY') })
    : '';
  const canWithdraw = WITHDRAWABLE.includes(application.status);

  const doWithdraw = async () => {
    setWithdrawing(true);
    try {
      const res = await withdrawApplication(application._id);
      if (!res.ok) {
        message.error(res.error);
        return;
      }
      void message.success(t('myApps.withdrawnToast'));
      onWithdrawn?.(application._id);
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setWithdrawing(false);
    }
  };
  // Confirm first - withdrawing is destructive (the employer loses your application).
  // modal.confirm awaits onOk's promise, so the OK button shows a spinner.
  const withdraw = () => {
    if (withdrawing || !canWithdraw) return;
    modal.confirm({
      title: t('myApps.withdrawConfirmTitle'),
      content: t('myApps.withdrawConfirmBody'),
      okText: t('withdrawApplication'),
      cancelText: t('cancel'),
      okButtonProps: { danger: true },
      onOk: doWithdraw,
    });
  };

  return (
    <div
      className="relative transition-shadow hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)]"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
        padding: 14,
      }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center"
          style={{
            borderRadius: 'var(--cr-radius-md)',
            background: gold ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
            color: gold ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
          }}
        >
          <Icon size={22} aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          {/* Title = the only full-card link (stretched ::after covers the card);
              Withdraw sits above it via z-[2]. Falls back to plain text if the job
              was deleted (job === null). */}
          {job ? (
            <Link
              href={`/connect/jobs/${job.id}`}
              className="text-[15px] leading-snug font-semibold no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
              style={{ color: 'var(--cr-text)' }}
            >
              {job.title}
            </Link>
          ) : (
            <span
              className="text-[15px] leading-snug font-semibold"
              style={{ color: 'var(--cr-text-4)' }}
            >
              {t('myApps.jobRemoved')}
            </span>
          )}

          {/* Employer . location . applied date - one muted meta line. */}
          <div
            className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]"
            style={{ color: 'var(--cr-text-4)' }}
          >
            {application.employer.name && (
              <span className="font-medium" style={{ color: 'var(--cr-text-3)' }}>
                {application.employer.name}
              </span>
            )}
            {location && (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} aria-hidden /> {location}
                </span>
              </>
            )}
            {appliedOn && (
              <>
                <span aria-hidden>·</span>
                <span>{appliedOn}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: status badge (top) + Withdraw (below), right-aligned. */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
            style={{
              background: tone.bg,
              color: tone.fg,
              border: tone.border ? `1px solid ${tone.border}` : undefined,
            }}
          >
            {t(`applicationStatus.${statusKey}`)}
          </span>
          {/* Action: Withdraw (live apps, confirmed) -> Re-apply (you withdrew, so
              let you back in via the detail's re-apply composer) -> nothing for
              terminal accepted/declined (the employer's call, no action to take). */}
          {canWithdraw ? (
            <button
              type="button"
              onClick={withdraw}
              disabled={withdrawing}
              aria-disabled={withdrawing}
              className={`relative z-[2] inline-flex h-9 items-center justify-center gap-1.5 rounded-full border px-3.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
                withdrawing ? 'cursor-not-allowed' : 'cursor-pointer'
              }`}
              style={{
                borderColor: 'var(--cr-border)',
                background: 'var(--cr-surface)',
                color: 'var(--cr-text-3)',
                outlineColor: 'var(--cr-primary)',
              }}
            >
              <X size={14} aria-hidden /> {t('withdrawApplication')}
            </button>
          ) : application.status === 'withdrawn' && job ? (
            <Link
              href={`/connect/jobs/${job.id}`}
              className="relative z-[2] inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1"
              style={{
                background: 'var(--cr-primary)',
                color: '#fff',
                outlineColor: 'var(--cr-primary)',
              }}
            >
              <RotateCcw size={14} aria-hidden /> {t('myApps.reapply')}
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
