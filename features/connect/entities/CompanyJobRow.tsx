'use client';

/**
 * CompanyJobRow - one open-position row in a company page's jobs section
 * (CompanyJobsSection). Lighter than the board's JobCard but never empty: it
 * always carries the role/category label + posted-time, so even a job with no
 * pay/worktype reads as intentional. The right side is role-aware: a candidate
 * gets a "View & apply" link to the job detail (where the apply flow lives); the
 * owner gets live applicants/views stats (separated) + a Close action (confirm).
 * Keep ROLE_ICON/GOLD_ROLES + the role->icon mapping in sync with jobs/JobCard.tsx;
 * closeJob is driven by the parent section (onClose).
 */

import { useCallback, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Dropdown, type MenuProps } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  type LucideIcon,
  Brush,
  Briefcase,
  CalendarClock,
  ChevronDown,
  Clock,
  Cog,
  Eye,
  MapPin,
  PenTool,
  Scissors,
  Send,
  Users,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { categoryLabel } from '../search.types';
import { roleLabel, type Job, type JobRole } from '../jobs/jobs.types';
// Additive boost-CTA funnel telemetry. Keyless-safe (no-op without analytics keys).
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';

dayjs.extend(relativeTime);

const ROLE_ICON: Record<JobRole, LucideIcon> = {
  karigar: Brush,
  helper: Scissors,
  operator: Cog,
  designer: PenTool,
  supervisor: Users,
};
const GOLD_ROLES: JobRole[] = ['karigar', 'helper'];
const CLOSING_SOON_DAYS = 3;
// Skill chips cap - matches the board JobCard so a job reads consistently in
// both surfaces (overflow folds into a "+N" chip).
const MAX_SKILLS = 4;

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function CompanyJobRow({
  job,
  isOwner,
  onClose,
  onUseAsTemplate,
  showOpenChip = false,
  closing,
}: {
  job: Job;
  isOwner: boolean;
  /** Close the job, capturing the hire outcome (filled = hired). */
  onClose?: (jobId: string, filled: boolean) => void;
  /** Open the composer prefilled from this job to post a similar one. When
   *  omitted (e.g. the public section) the "Use as template" item is hidden. */
  onUseAsTemplate?: (job: Job) => void;
  /** Show an "Open" status chip on open jobs. ON in the manage console (mixed
   *  open/filled/closed list, so open needs a chip too); OFF in the public
   *  section where every job is open and the chip would be noise. */
  showOpenChip?: boolean;
  closing?: boolean;
}) {
  const t = useTranslations('connect.jobs');
  const tPage = useTranslations('connect.companyPage');
  const tCat = useTranslations('connect.search.listing.category');

  // Description preview: clamp to 2 lines with an inline Read more / Read less
  // toggle. `canExpand` is set once post-layout (ref callback, not an effect, so
  // it never trips the no-setState-in-effect rule) and only when the text
  // actually overflows the clamp - so a short description shows no toggle.
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const measureDesc = useCallback((el: HTMLParagraphElement | null) => {
    if (el) setCanExpand(el.scrollHeight - el.clientHeight > 1);
  }, []);
  const description = job.description?.trim();
  // Skills + machine type as chips (real role requirements, mirrors JobCard).
  const skills = (job.skills ?? []).slice(0, MAX_SKILLS);
  const extraSkills = Math.max(0, (job.skills?.length ?? 0) - MAX_SKILLS);

  // Owner "Manage" menu, shown for every owned job (open + terminal). Review +
  // Use-as-template apply to any status; Edit / Boost / Close are open-only.
  // Review/Edit/Boost are links to the detail (Edit deep-links `?edit=1` to open
  // the editor); Mark hired / Close capture the hire outcome (see
  // jobs.actions.closeJob). Boost is hidden once the job has a campaign.
  const isOpen = job.status === 'open';
  const linkStyle = { color: 'inherit' } as const;
  const ownerMenuItems: MenuProps['items'] = [
    {
      key: 'review',
      label: (
        <Link href={`/connect/jobs/${job._id}`} className="no-underline" style={linkStyle}>
          {tPage('jobsReview')}
        </Link>
      ),
    },
    ...(onUseAsTemplate
      ? [{ key: 'template', label: tPage('jobsUseTemplate'), onClick: () => onUseAsTemplate(job) }]
      : []),
    ...(isOpen
      ? [
          {
            key: 'edit',
            label: (
              <Link
                href={`/connect/jobs/${job._id}?edit=1`}
                className="no-underline"
                style={linkStyle}
              >
                {t('editJob')}
              </Link>
            ),
          },
          ...(job.boostCampaignId
            ? []
            : [
                {
                  key: 'boost',
                  label: (
                    <Link
                      href={`/connect/boost/job/${job._id}`}
                      className="no-underline"
                      style={linkStyle}
                      // Additive funnel telemetry: boost CTA clicked (job). The
                      // Link still navigates; onClick only fires the event.
                      // Keyless-safe (no-op without analytics keys).
                      onClick={() => trackEvent(ConnectEvents.boostCtaClicked, { subject: 'job' })}
                    >
                      {t('boostCta')}
                    </Link>
                  ),
                },
              ]),
          { type: 'divider' as const, key: 'sep' },
          { key: 'filled', label: t('closeFilled'), onClick: () => onClose?.(job._id, true) },
          { key: 'closed', label: t('closeNotHired'), onClick: () => onClose?.(job._id, false) },
        ]
      : []),
  ];

  // role is an open string now: a custom role has no preset icon, so it falls
  // back to the neutral Briefcase tile (cast guards the preset-keyed lookup).
  const Icon: LucideIcon = (job.role && ROLE_ICON[job.role as JobRole]) || Briefcase;
  const goldTile = job.role ? GOLD_ROLES.includes(job.role as JobRole) : false;

  const wage =
    job.wageMin != null && job.wageMax != null
      ? `${rupees(job.wageMin)} - ${rupees(job.wageMax)}`
      : job.wageMin != null
        ? rupees(job.wageMin)
        : null;
  const location = [job.location?.district, job.location?.state].filter(Boolean).join(', ');
  // Always-present trade label: the specific role if set, else the category, so a
  // pay-less / worktype-less job still reads as a real position.
  const tradeLabel = job.role ? roleLabel(job.role, t) : categoryLabel(job.category, tCat);

  // Closing-soon / filled status chip (only when noteworthy - every row here is
  // an open position, so a plain "Open" chip would be noise).
  const daysLeft =
    job.status === 'open' && job.closesAt
      ? dayjs(job.closesAt).startOf('day').diff(dayjs().startOf('day'), 'day')
      : null;
  const closingSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= CLOSING_SOON_DAYS;
  // filled / closed are terminal states; closing-soon is a live nudge on an open
  // job; with `showOpenChip` (manage console's mixed list) a plain open job gets
  // a green "Open" chip so it reads consistently next to filled/closed rows.
  const statusChip =
    job.status === 'filled'
      ? { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)', label: t('status.filled') }
      : job.status === 'closed'
        ? { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)', label: t('status.closed') }
        : closingSoon
          ? { bg: 'var(--cr-warning-bg)', fg: 'var(--cr-warning)', label: t('closingSoon') }
          : showOpenChip
            ? { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)', label: t('status.open') }
            : null;

  // The quiet meta line, built so the always-present items (trade + posted) keep
  // it full. Each entry renders with a dot separator.
  const meta: { key: string; node: ReactNode }[] = [];
  if (wage)
    meta.push({
      key: 'wage',
      node: (
        <span className="font-semibold" style={{ color: 'var(--cr-text-2)' }}>
          {/* wageType label already carries the slash (e.g. "/ day"), so append
              it directly - prepending another "/" produced "₹100 - ₹500 / / day". */}
          {wage}
          {job.wageType ? ` ${t(`wageType.${job.wageType}`)}` : ''}
        </span>
      ),
    });
  meta.push({ key: 'trade', node: <span>{tradeLabel}</span> });
  if (location)
    meta.push({
      key: 'loc',
      node: (
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} aria-hidden /> {location}
        </span>
      ),
    });
  if (job.openings > 1)
    meta.push({ key: 'open', node: <span>{t('openingsCount', { count: job.openings })}</span> });
  if (job.createdAt)
    meta.push({
      key: 'posted',
      node: (
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {t('postedAgo', { when: dayjs(job.createdAt).fromNow() })}
        </span>
      ),
    });

  return (
    <div
      // items-start: the row can run several lines tall (meta + description +
      // skills + owner stats), so the icon tile and the right-side action pin to
      // the TOP next to the title - not floating in the vertical middle.
      // relative anchors the title's stretched-link overlay so the WHOLE row is
      // clickable to the job detail; the interactive controls (Manage menu, Read
      // more, applicant link) sit above it via `relative z-10` so they still work.
      className="relative flex items-start gap-3 p-3 transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)] sm:gap-4 sm:p-4"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <span
        aria-hidden
        className="grid h-11 w-11 shrink-0 place-items-center"
        style={{
          borderRadius: 'var(--cr-radius-md)',
          background: goldTile ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
          color: goldTile ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
        }}
      >
        <Icon size={20} aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link
            href={`/connect/jobs/${job._id}`}
            // Stretched link: the ::after overlay spans the whole card so a click
            // anywhere opens the detail, while staying ONE real (keyboard- and
            // screen-reader-accessible) link. hover:underline only the title text.
            className="text-[15px] leading-snug font-semibold no-underline after:absolute after:inset-0 after:content-[''] hover:underline"
            style={{ color: 'var(--cr-text)' }}
          >
            {job.title}
          </Link>
          {job.wageType && (
            <span
              className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={{ background: 'var(--cr-accent-light)', color: 'var(--cr-gold-700)' }}
            >
              {t(`workType.${job.wageType}`)}
            </span>
          )}
          {statusChip && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ background: statusChip.bg, color: statusChip.fg }}
            >
              {closingSoon && <CalendarClock size={11} aria-hidden />}
              {statusChip.label}
            </span>
          )}
        </div>

        <div
          className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12.5px]"
          style={{ color: 'var(--cr-text-4)' }}
        >
          {meta.map((m, i) => (
            <span key={m.key} className="inline-flex items-center gap-x-1.5">
              {i > 0 && <span aria-hidden>·</span>}
              {m.node}
            </span>
          ))}
        </div>

        {/* Description preview: 2-line clamp + inline Read more / Read less. The
            title still links to the full job detail; this keeps a quick read in
            context without leaving the console. */}
        {description && (
          <div className="mt-1.5">
            <p
              ref={measureDesc}
              className={`m-0 text-[12.5px] leading-relaxed whitespace-pre-line ${
                expanded ? '' : 'line-clamp-2'
              }`}
              style={{ color: 'var(--cr-text-3)' }}
            >
              {description}
            </p>
            {(canExpand || expanded) && (
              <button
                type="button"
                onClick={() => setExpanded((e) => !e)}
                aria-expanded={expanded}
                className="relative z-10 mt-0.5 cursor-pointer border-0 bg-transparent p-0 text-[12px] font-semibold"
                style={{ color: 'var(--cr-primary)' }}
              >
                {expanded ? t('readLess') : t('readMore')}
              </button>
            )}
          </div>
        )}

        {/* Role requirements as chips (skills + machine type) - mirrors the board
            JobCard so a job reads the same in both surfaces. */}
        {(skills.length > 0 || job.machineType) && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {skills.map((s) => (
              <span
                key={s}
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-3)' }}
              >
                {s}
              </span>
            ))}
            {extraSkills > 0 && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-4)' }}
              >
                {t('skillsMoreCount', { count: extraSkills })}
              </span>
            )}
            {job.machineType && (
              <span
                className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
              >
                {job.machineType}
              </span>
            )}
          </div>
        )}

        {isOwner && (
          <div
            className="mt-2 flex flex-wrap items-center gap-x-3 border-t pt-2 text-[11.5px]"
            style={{ color: 'var(--cr-text-4)', borderColor: 'var(--cr-divider)' }}
          >
            {/* Applicant count is the owner's #1 task - make it a direct link to
                the detail's review list (not just a static stat). */}
            <Link
              href={`/connect/jobs/${job._id}`}
              aria-label={tPage('jobsReview')}
              className="relative z-10 inline-flex items-center gap-1 no-underline hover:underline"
              style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
            >
              <Send size={12} aria-hidden />{' '}
              {tPage('jobsStatApplicants', { count: job.applicationsCount })}
            </Link>
            <span className="inline-flex items-center gap-1">
              <Eye size={12} aria-hidden /> {tPage('jobsStatViews', { count: job.views })}
            </span>
          </div>
        )}
      </div>

      {/* Right side by audience: visitor -> apply; owner -> one Manage menu for
          every status (open gets edit/boost/close; terminal gets review +
          use-as-template). The status chip + title link still carry the record. */}
      <div className="relative z-10 shrink-0">
        {!isOwner ? (
          <DsButton dsVariant="primary" dsSize="sm" href={`/connect/jobs/${job._id}`}>
            {tPage('jobsViewAndApply')}
          </DsButton>
        ) : (
          <Dropdown trigger={['click']} menu={{ items: ownerMenuItems }}>
            <DsButton dsVariant="ghost" dsSize="sm" loading={closing}>
              {tPage('jobsManage')} <ChevronDown size={13} aria-hidden />
            </DsButton>
          </Dropdown>
        )}
      </div>
    </div>
  );
}
