'use client';

/**
 * Job detail. Two faces from one screen:
 *  - Company (owns the job): the job hero + a hiring funnel summary + the
 *    applicant list (shortlist / accept (fills) / decline), with Edit / Boost /
 *    Close controls. Edit reuses JobComposer (updateJob -> PATCH /connect/jobs/:id).
 *  - Karigar (anyone else): the job hero + sectioned detail + an apply composer
 *    (submit/update their one application) and its current status.
 * Mediator model: the platform brokers no deal. A "Message" handoff (inbox) lets
 * the two parties talk once an application exists; hiring settles off-platform.
 *
 * Layout follows the connect job-view reference: a hero card (gradient band +
 * icon + title + status + employer + a 4-tile spec strip) then sectioned cards
 * (About / Requirements & details / Pay & benefits / About company), with the
 * owner's review (or the karigar's apply) below.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Dropdown, message } from 'antd';
import {
  type LucideIcon,
  Brush,
  Briefcase,
  Building2,
  Bus,
  BadgeCheck,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Clock,
  Cog,
  Coffee,
  Eye,
  FileText,
  Gift,
  GraduationCap,
  HeartHandshake,
  Home,
  IndianRupee,
  Languages,
  ListChecks,
  MapPin,
  PenSquare,
  PenTool,
  Play,
  Scissors,
  Send,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  Video,
} from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { ConnectPage, ConnectRightRail, RailPanel } from '@/components/connect';
import { parseApiError } from '@/lib/utils';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import ApplicationCard from './ApplicationCard';
import ApplicationComposer from './ApplicationComposer';
import JobComposer from './JobComposer';
// First-party promoted-listing boost card for the rail (placement `jobs_detail`).
// Resolved server-side in app/connect/jobs/[id]/page.tsx; sits at the top of
// ConnectRightRail (which already owns the Google connect.right.* slots).
import PromotedListingAdCard, {
  type PromotedListingResolved,
} from '@/features/connect/marketplace/PromotedListingAdCard';
// Mobile inline ad: the ConnectRightRail (boost + Google slot) is hidden below
// xl, so render the same inventory in the content column for phone/tablet.
import MobileAdInline from '@/features/connect/ads/MobileAdInline';
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';
import {
  acceptApplication,
  applyToJob,
  closeJob,
  saveJob,
  setApplicationStatus,
  unsaveJob,
  updateJob,
  withdrawApplication,
} from './jobs.actions';
import { categoryLabel } from '../search.types';
import { roleLabel, benefitLabel, JOB_BENEFIT_PRESETS } from './jobs.types';
// Additive boost-CTA funnel telemetry. Keyless-safe (no-op without analytics keys).
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';
import { noDownloadVideoProps } from '@/lib/connect/media-guard';
import type {
  Job,
  JobApplication,
  JobEmployer,
  CreateApplicationPayload,
  CreateJobPayload,
} from './jobs.types';

dayjs.extend(relativeTime);

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

const ROLE_ICON: Record<string, LucideIcon> = {
  karigar: Brush,
  helper: Scissors,
  operator: Cog,
  designer: PenTool,
  supervisor: Users,
};
const GOLD_ROLES = ['karigar', 'helper'];
const CLOSING_SOON_DAYS = 3;

// Per-benefit icon for the Pay & benefits tiles (preset slugs -> a fitting
// glyph; custom benefits fall back to Sparkles). Keep slugs in sync with
// JOB_BENEFIT_PRESETS (jobs.types.ts).
const BENEFIT_ICON: Record<string, LucideIcon> = {
  pf_esi: ShieldCheck,
  meals: Coffee,
  accommodation: Home,
  transport: Bus,
  overtime_pay: IndianRupee,
  weekly_off: CalendarClock,
  bonus: Gift,
  health_insurance: HeartHandshake,
};

const STATUS_TONE: Record<Job['status'], { bg: string; fg: string }> = {
  open: { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)' },
  filled: { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)' },
  closed: { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)' },
};

const CARD: CSSProperties = {
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border)',
  borderRadius: 'var(--cr-radius-lg)',
  padding: 20,
};

/** A sectioned content card (About / Requirements / ...). */
function DetailCard({
  children,
  className,
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={className} style={CARD}>
      {children}
    </section>
  );
}

/** Section heading with a tinted icon chip. */
function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h2
      // marginBottom inline (not `mb-3`): the global `h2 { margin: 0 }` reset +
      // Tailwind's `m-0` were cancelling the gap, so set it explicitly here.
      className="flex items-center gap-2 text-[15px] font-bold"
      style={{ color: 'var(--cr-text)', margin: '0 0 14px' }}
    >
      <span
        aria-hidden
        className="grid h-7 w-7 place-items-center"
        style={{
          borderRadius: 'var(--cr-radius-md)',
          background: 'var(--cr-primary-light)',
          color: 'var(--cr-primary)',
        }}
      >
        <Icon size={15} aria-hidden />
      </span>
      {children}
    </h2>
  );
}

/** One tile in the hero spec strip (Pay / Type / Experience / Openings). */
function SpecTile({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="px-4 py-3" style={{ borderInlineStart: '1px solid var(--cr-divider)' }}>
      <div
        className="flex items-center gap-1.5 text-[10.5px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        <Icon size={13} aria-hidden style={{ color: 'var(--cr-primary)' }} /> {label}
      </div>
      <div className="mt-1 text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
        {value}
        {sub ? (
          <small className="ml-1 text-[11.5px] font-medium" style={{ color: 'var(--cr-text-4)' }}>
            {sub}
          </small>
        ) : null}
      </div>
    </div>
  );
}

/** One labelled cell in the requirements grid - self-bordered, so a partial row
 *  never leaves a grey divider gap (the grid renders only the cells that exist). */
function ReqCell({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-md)',
        background: 'var(--cr-surface-2)',
        padding: '12px 14px',
      }}
    >
      <div
        className="text-[10.5px] font-bold tracking-wide uppercase"
        style={{ color: 'var(--cr-text-4)' }}
      >
        {label}
      </div>
      <div
        className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-semibold"
        style={{ color: 'var(--cr-text)' }}
      >
        <Icon size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
        {children}
      </div>
    </div>
  );
}

interface Props {
  job: Job;
  isCompany: boolean;
  /** Company view: all applications. Empty for a karigar. */
  applications: JobApplication[];
  /** Karigar view: the caller's own application, if any. */
  myApplication: JobApplication | null;
  /** applicantUserId -> display name, for the company's review list. */
  names?: Record<string, string>;
  /** The hiring identity (company page or poster), shown as trust context. */
  employer?: JobEmployer;
  /** Candidate view: the viewer's own skills -> the skill-match ring/chips. */
  viewerSkills?: string[];
  /** Open jobs in the same trade/area (the "Similar jobs near you" rail). */
  similarJobs?: Job[];
  /** Candidate view: whether the viewer has bookmarked this job. */
  isSaved?: boolean;
  /** Whether the viewer can save (logged-in non-owner). */
  canSave?: boolean;
  /** First-party promoted-listing boost for the rail, or null on a no-fill. */
  promoted?: PromotedListingResolved | null;
}

export default function JobDetailScreen({
  job: jobProp,
  isCompany,
  applications,
  myApplication,
  names = {},
  employer,
  viewerSkills = [],
  similarJobs = [],
  isSaved = false,
  canSave = false,
  promoted = null,
}: Props) {
  const t = useTranslations('connect.jobs');
  const tInbox = useTranslations('connect.inbox');
  const tCat = useTranslations('connect.search.listing.category');
  const [msgApi, ctx] = message.useMessage();

  // Single source of truth: edits + status changes both flow through `job`, so
  // the hero reflects them without a full reload.
  const [job, setJob] = useState(jobProp);
  const [appList, setAppList] = useState(applications);
  const [mine, setMine] = useState<JobApplication | null>(myApplication);
  const [busy, setBusy] = useState(false);
  // Deep-link: the company-page console's job row "Edit" links here with
  // `?edit=1` to open the editor straight away (owner only).
  const searchParams = useSearchParams();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(isCompany && searchParams.get('edit') === '1');

  // Back goes to the actual previous page (the company-page console Jobs tab, the
  // board, wherever). Falls back to the jobs board - never leaves the platform -
  // when there is no in-app history (direct/refresh) OR the previous page was an
  // external site (a shared link opened from WhatsApp/Google), since router.back()
  // would otherwise navigate out of the app.
  const goBack = () => {
    let cameFromExternal = false;
    try {
      const ref = document.referrer;
      cameFromExternal = ref !== '' && new URL(ref).origin !== window.location.origin;
    } catch {
      cameFromExternal = false;
    }
    if (window.history.length > 1 && !cameFromExternal) router.back();
    else router.push('/connect/jobs');
  };
  const [saving, setSaving] = useState(false);
  // Screen-reader announcement mirror for every successful mutation (AntD toasts
  // are not reliably announced; low-literacy + SR audience).
  const [announcement, setAnnouncement] = useState('');

  const notifySuccess = (text: string) => {
    void msgApi.success(text);
    setAnnouncement(text);
  };

  // Poster-first job video: hide the decorative play badge once playback starts.
  const [videoStarted, setVideoStarted] = useState(false);

  // Bookmark (candidate). Optimistic: flip immediately, roll back on failure.
  const [saved, setSaved] = useState(isSaved);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    setSavingBookmark(true);
    try {
      const res = next ? await saveJob(job._id) : await unsaveJob(job._id);
      if (!res.ok) {
        setSaved(!next);
        msgApi.error(res.error);
        return;
      }
      setAnnouncement(next ? t('savedToast') : t('unsavedToast'));
    } catch (e) {
      setSaved(!next);
      msgApi.error(parseApiError(e));
    } finally {
      setSavingBookmark(false);
    }
  };

  // Share: native share sheet where available (mobile-first market), else copy
  // the link. Best-effort; a user-cancelled share is not an error.
  const handleShare = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const shareData = { title: job.title, url };
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share(shareData);
        return;
      }
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        notifySuccess(t('linkCopied'));
      }
    } catch {
      // Share cancelled / clipboard blocked -- not an error worth surfacing.
    }
  };

  const status = job.status;
  const isOpen = status === 'open';

  // Skill match (candidate): split the job's skills into matched (in the viewer's
  // profile) and unmatched. Drives the match ring + chips + the "add X" hint.
  // Mirrors the board's "matches your skills" logic; hidden for owner / no skills.
  const skillMatch = useMemo(() => {
    const jobSkills = job.skills ?? [];
    if (isCompany || jobSkills.length === 0 || viewerSkills.length === 0) {
      return null;
    }
    const mine = new Set(viewerSkills.map((s) => s.toLowerCase()));
    const matched = jobSkills.filter((s) => mine.has(s.toLowerCase()));
    const missing = jobSkills.filter((s) => !mine.has(s.toLowerCase()));
    return { matched, missing, total: jobSkills.length };
  }, [job.skills, viewerSkills, isCompany]);

  const wage =
    job.wageMin != null && job.wageMax != null
      ? `${rupees(job.wageMin)} - ${rupees(job.wageMax)}`
      : job.wageMin != null
        ? rupees(job.wageMin)
        : null;
  const location = [job.location?.district, job.location?.city, job.location?.state]
    .filter(Boolean)
    .join(', ');
  const Icon: LucideIcon = (job.role && ROLE_ICON[job.role]) || Briefcase;
  const goldTile = job.role ? GOLD_ROLES.includes(job.role) : false;

  const daysLeft =
    isOpen && job.closesAt
      ? dayjs(job.closesAt).startOf('day').diff(dayjs().startOf('day'), 'day')
      : null;
  const closingSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= CLOSING_SOON_DAYS;

  // Short experience label for the spec tile + the requirements grid.
  const experienceText =
    job.experienceMin == null
      ? null
      : job.experienceMin > 0
        ? `${job.experienceMin}+ ${t('experienceSuffix')}`
        : t('experienceFreshers');

  // Build the requirement cells from only the fields that exist, so the grid
  // never renders an empty (grey) slot. Column count is derived from the count.
  const reqCells = [
    experienceText && (
      <ReqCell key="exp" label={t('experienceLabel')} icon={GraduationCap}>
        {experienceText}
      </ReqCell>
    ),
    job.machineType && (
      <ReqCell key="machine" label={t('machineTypeLabel')} icon={Cog}>
        {job.machineType}
      </ReqCell>
    ),
    job.shift && (
      <ReqCell key="shift" label={t('shiftLabel')} icon={Clock}>
        {t(`shiftOpt.${job.shift}`)}
      </ReqCell>
    ),
    job.workingDays && (
      <ReqCell key="days" label={t('workingDaysLabel')} icon={CalendarClock}>
        {job.workingDays}
      </ReqCell>
    ),
    (job.languages?.length ?? 0) > 0 && (
      <ReqCell key="lang" label={t('languagesLabel')} icon={Languages}>
        {job.languages.join(', ')}
      </ReqCell>
    ),
  ].filter(Boolean);

  const hasSkills = (job.skills?.length ?? 0) > 0;
  const hasRequirements = hasSkills || reqCells.length > 0;

  // Hiring funnel (owner): real counts off the loaded application list.
  const funnel = useMemo(() => {
    const c = { applied: 0, shortlisted: 0, accepted: 0 };
    for (const a of appList) {
      if (a.status === 'applied') c.applied += 1;
      else if (a.status === 'shortlisted') c.shortlisted += 1;
      else if (a.status === 'accepted') c.accepted += 1;
    }
    return c;
  }, [appList]);

  const handleClose = async (filled: boolean) => {
    setBusy(true);
    try {
      const res = await closeJob(job._id, filled);
      if (!res.ok) return msgApi.error(res.error);
      setJob((j) => ({ ...j, status: filled ? 'filled' : 'closed' }));
      notifySuccess(filled ? t('filledSuccess') : t('closedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (payload: CreateJobPayload) => {
    setSaving(true);
    try {
      // companyPageId is create-only; JobComposer omits it in edit mode.
      const res = await updateJob(job._id, payload);
      if (!res.ok) return msgApi.error(res.error);
      setJob(res.data);
      setEditOpen(false);
      notifySuccess(t('updatedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleAccept = async (applicationId: string) => {
    setBusy(true);
    try {
      const res = await acceptApplication(applicationId);
      if (!res.ok) return msgApi.error(res.error);
      setJob((j) => ({ ...j, status: 'filled' }));
      setAppList((list) =>
        list.map((a) =>
          a._id === applicationId ? { ...a, status: 'accepted' } : { ...a, status: 'declined' },
        ),
      );
      notifySuccess(t('acceptedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSetStatus = async (applicationId: string, next: 'shortlisted' | 'declined') => {
    setBusy(true);
    try {
      const res = await setApplicationStatus(applicationId, next);
      if (!res.ok) return msgApi.error(res.error);
      setAppList((list) => list.map((a) => (a._id === applicationId ? { ...a, status: next } : a)));
      notifySuccess(t(next === 'shortlisted' ? 'shortlistedSuccess' : 'declinedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleApply = async (payload: CreateApplicationPayload) => {
    setBusy(true);
    try {
      const res = await applyToJob(job._id, payload);
      if (!res.ok) return msgApi.error(res.error);
      setMine(res.data);
      notifySuccess(t('appliedSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleWithdraw = async () => {
    if (!mine) return;
    setBusy(true);
    try {
      const res = await withdrawApplication(mine._id);
      if (!res.ok) return msgApi.error(res.error);
      setMine(res.data);
      notifySuccess(t('withdrawnSuccess'));
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ConnectPage className="flex gap-5">
      <main className="flex min-w-0 flex-1 flex-col gap-5">
        {ctx}
        <div aria-live="polite" className="sr-only" role="status">
          {announcement}
        </div>
        <button
          type="button"
          onClick={goBack}
          className="-mb-1 inline-flex w-fit cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px]"
          style={{ color: 'var(--cr-primary)' }}
        >
          <ChevronLeft size={15} aria-hidden /> {t('back')}
        </button>

        {/* ── Hero: band + identity + spec strip ── */}
        <section className="overflow-hidden" style={{ ...CARD, padding: 0 }}>
          <div aria-hidden style={{ height: 6, background: 'var(--cr-grad-hero)' }} />
          <div style={{ padding: '18px 20px 16px' }}>
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="grid h-14 w-14 shrink-0 place-items-center"
                style={{
                  borderRadius: 'var(--cr-radius-lg)',
                  background: goldTile ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
                  color: goldTile ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
                }}
              >
                <Icon size={28} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h1
                    className="m-0 text-[22px] leading-tight font-bold tracking-tight"
                    style={{ color: 'var(--cr-text)' }}
                  >
                    {job.title}
                  </h1>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                      style={{
                        background: isOpen ? 'var(--cr-success-bg)' : STATUS_TONE[status].bg,
                        color: isOpen ? 'var(--cr-success)' : STATUS_TONE[status].fg,
                      }}
                    >
                      {/* "Actively hiring" reads warmer than a bare "Open". */}
                      {isOpen ? t('activelyHiring') : t(`status.${status}`)}
                    </span>
                    {/* Bookmark: candidate-only, logged-in. Optimistic toggle. */}
                    {canSave && (
                      <button
                        type="button"
                        onClick={toggleSave}
                        disabled={savingBookmark}
                        aria-pressed={saved}
                        aria-label={saved ? t('savedAria') : t('saveAria')}
                        className="grid h-8 w-8 cursor-pointer place-items-center rounded-full border bg-transparent transition-colors"
                        style={{
                          borderColor: saved ? 'var(--cr-primary)' : 'var(--cr-border)',
                          color: saved ? 'var(--cr-primary)' : 'var(--cr-text-4)',
                          background: saved ? 'var(--cr-primary-light)' : 'transparent',
                        }}
                      >
                        <Bookmark size={15} aria-hidden fill={saved ? 'currentColor' : 'none'} />
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  <span>{categoryLabel(job.category, tCat)}</span>
                  {job.role && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{roleLabel(job.role, t)}</span>
                    </>
                  )}
                  {location && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={13} aria-hidden /> {location}
                      </span>
                    </>
                  )}
                  {job.createdAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span>{t('postedAgo', { when: dayjs(job.createdAt).fromNow() })}</span>
                    </>
                  )}
                  {job.closesAt && (
                    <>
                      <span aria-hidden>·</span>
                      <span
                        className="inline-flex items-center gap-1"
                        style={
                          closingSoon ? { color: 'var(--cr-warning)', fontWeight: 600 } : undefined
                        }
                      >
                        <CalendarClock size={13} aria-hidden />{' '}
                        {dayjs(job.closesAt).format('D MMM YYYY')}
                      </span>
                    </>
                  )}
                  {isCompany && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        <Eye size={13} aria-hidden /> {t('viewsCount', { count: job.views })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Employer (hiring identity) */}
            {employer && (
              <div
                className="mt-3 flex items-center gap-2.5 rounded-[var(--cr-radius-md)] px-3 py-2"
                style={{ background: 'var(--cr-surface-2)' }}
              >
                <span
                  aria-hidden
                  className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full"
                  style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-4)' }}
                >
                  {employer.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small user/company creative
                    <img
                      src={employer.avatar}
                      alt=""
                      aria-hidden
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    employer.name.slice(0, 1).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[10.5px] font-bold tracking-wide uppercase"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {t('postedByLabel')}
                  </div>
                  {employer.href ? (
                    <Link
                      href={employer.href}
                      className="text-[13px] font-semibold no-underline"
                      style={{ color: 'var(--cr-text)' }}
                    >
                      {employer.name}
                    </Link>
                  ) : (
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--cr-text)' }}>
                      {employer.name}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Spec strip */}
          <div
            className="grid grid-cols-2 sm:grid-cols-4"
            style={{ borderTop: '1px solid var(--cr-divider)' }}
          >
            <SpecTile
              icon={IndianRupee}
              label={t('specPay')}
              value={wage ? wage : '-'}
              sub={wage && job.wageType ? t(`wageType.${job.wageType}`) : undefined}
            />
            <SpecTile
              icon={Briefcase}
              label={t('specType')}
              value={job.employmentType ? t(`employmentTypeOpt.${job.employmentType}`) : '-'}
            />
            <SpecTile
              icon={GraduationCap}
              label={t('specExperience')}
              value={experienceText ?? '-'}
            />
            <SpecTile
              icon={Users}
              label={t('specOpenings')}
              value={t('openingsCount', { count: job.openings })}
            />
          </div>
        </section>

        {/* Owner controls (open job only) */}
        {isCompany && isOpen && (
          <div className="-mt-1 flex flex-wrap justify-end gap-2">
            <DsButton
              dsVariant="ghost"
              icon={<PenSquare size={15} aria-hidden />}
              onClick={() => setEditOpen(true)}
              disabled={busy}
            >
              {t('editJob')}
            </DsButton>
            {!job.boostCampaignId && (
              <DsButton
                dsVariant="ghost"
                href={`/connect/boost/job/${job._id}`}
                // Additive funnel telemetry: boost CTA clicked (job). The href
                // still drives navigation; onClick only fires the event.
                // Keyless-safe (no-op without analytics keys).
                onClick={() => trackEvent(ConnectEvents.boostCtaClicked, { subject: 'job' })}
              >
                {t('boostCta')}
              </DsButton>
            )}
            {/* Closing captures the hire outcome (filled vs just closed). */}
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'filled', label: t('closeFilled'), onClick: () => handleClose(true) },
                  { key: 'closed', label: t('closeNotHired'), onClick: () => handleClose(false) },
                ],
              }}
            >
              <DsButton dsVariant="ghost" loading={busy}>
                {t('closeJob')} <ChevronDown size={14} aria-hidden />
              </DsButton>
            </Dropdown>
          </div>
        )}

        {/* About this role */}
        {job.description && (
          <DetailCard>
            <SectionHeader icon={FileText}>{t('aboutHeading')}</SectionHeader>
            <p
              className="m-0 text-[14px] leading-relaxed whitespace-pre-wrap"
              style={{ color: 'var(--cr-text-2)' }}
            >
              {job.description}
            </p>
          </DetailCard>
        )}

        {/* Job video (poster-first). At most one clip (composer + BE cap it).
            Painted poster-first with preload="metadata" + a non-interactive play
            badge that hides once playback starts - the SAME pattern as the
            marketplace ListingDetailScreen + profile ProfileView. Native
            <video controls> is keyboard accessible; the badge is aria-hidden
            (decorative cue only). Rendered only when the job has a video. Sits
            right under About so a candidate reads the role then sees it. */}
        {job.videos?.[0] && (
          <DetailCard>
            <SectionHeader icon={Video}>{t('video.displayTitle')}</SectionHeader>
            <div
              style={{
                position: 'relative',
                borderRadius: 'var(--cr-radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--cr-border)',
                background: '#000',
              }}
            >
              <video
                controls
                // Strip the easy download affordances (native download button,
                // PiP, right-click save). Shared with every Connect media player.
                {...noDownloadVideoProps}
                preload="metadata"
                poster={job.videos[0].posterUrl || undefined}
                src={job.videos[0].url}
                aria-label={t('video.play')}
                onPlay={() => {
                  setVideoStarted(true);
                  // Additive funnel telemetry: video play on the job surface.
                  trackEvent(ConnectEvents.videoPlay, { surface: 'job' });
                }}
                style={{ width: '100%', maxHeight: 520, background: '#000', display: 'block' }}
              />
              {!videoStarted && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  <span
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'rgba(14,24,68,0.55)',
                      color: '#fff',
                    }}
                  >
                    <Play size={26} aria-hidden style={{ marginInlineStart: 3 }} />
                  </span>
                </div>
              )}
            </div>
          </DetailCard>
        )}

        {/* What you'll do (structured responsibilities checklist) */}
        {(job.responsibilities?.length ?? 0) > 0 && (
          <DetailCard>
            <SectionHeader icon={ListChecks}>{t('responsibilitiesHeading')}</SectionHeader>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {job.responsibilities.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <CheckCircle2
                    size={16}
                    aria-hidden
                    className="mt-0.5 shrink-0"
                    style={{ color: 'var(--cr-success)' }}
                  />
                  <span
                    className="text-[13.5px] leading-relaxed"
                    style={{ color: 'var(--cr-text-2)' }}
                  >
                    {r}
                  </span>
                </li>
              ))}
            </ul>
          </DetailCard>
        )}

        {/* Requirements & details */}
        {hasRequirements && (
          <DetailCard>
            <SectionHeader icon={ShieldCheck}>{t('requirementsLegend')}</SectionHeader>
            {/* Candidate with a profile: the skill-match ring + the "add X" hint,
                then matched (green check) vs unmatched (dashed) chips. */}
            {skillMatch ? (
              <div className={reqCells.length > 0 ? 'mb-3' : ''}>
                <div
                  className="mb-3 flex items-center gap-3 rounded-[var(--cr-radius-md)] p-3"
                  style={{ background: 'var(--cr-primary-light)' }}
                >
                  <span
                    aria-hidden
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[12px] font-extrabold"
                    style={{
                      background: 'var(--cr-surface)',
                      color: 'var(--cr-primary)',
                      border: '2px solid var(--cr-primary)',
                    }}
                  >
                    {skillMatch.matched.length}/{skillMatch.total}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold" style={{ color: 'var(--cr-text)' }}>
                      {t('skillMatchTitle', {
                        matched: skillMatch.matched.length,
                        total: skillMatch.total,
                      })}
                    </div>
                    {skillMatch.missing.length > 0 && (
                      <div className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                        {t('skillMatchHint', { skills: skillMatch.missing.join(', ') })}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {skillMatch.matched.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                      style={{ background: 'var(--cr-success-bg)', color: 'var(--cr-success)' }}
                    >
                      <CheckCircle2 size={12} aria-hidden /> {s}
                    </span>
                  ))}
                  {skillMatch.missing.map((s) => (
                    <span
                      key={s}
                      className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                      style={{
                        border: '1px dashed var(--cr-border)',
                        color: 'var(--cr-text-4)',
                      }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              hasSkills && (
                <div className={`flex flex-wrap gap-1.5 ${reqCells.length > 0 ? 'mb-3' : ''}`}>
                  {job.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
                      style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-3)' }}
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )
            )}
            {reqCells.length > 0 && (
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: reqCells.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))',
                }}
              >
                {reqCells}
              </div>
            )}
          </DetailCard>
        )}

        {/* Pay & benefits */}
        {(wage || (job.benefits?.length ?? 0) > 0) && (
          <DetailCard>
            <SectionHeader icon={Gift}>{t('benefitsHeading')}</SectionHeader>
            {wage && (
              <p className="m-0 mb-3 text-[14px]" style={{ color: 'var(--cr-text-2)' }}>
                <b style={{ color: 'var(--cr-text)', fontWeight: 700 }}>
                  {wage}
                  {job.wageType ? ` ${t(`wageType.${job.wageType}`)}` : ''}
                </b>
              </p>
            )}
            {(job.benefits?.length ?? 0) > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {job.benefits.map((b) => {
                  const BIcon = BENEFIT_ICON[b] ?? Sparkles;
                  // Preset benefits get a one-line description; custom ones show
                  // just the label (benefitDesc.<slug> exists only for presets).
                  const desc = (JOB_BENEFIT_PRESETS as readonly string[]).includes(b)
                    ? t(`benefitDesc.${b}`)
                    : null;
                  return (
                    <div
                      key={b}
                      className="flex items-center gap-2.5 p-3"
                      style={{
                        border: '1px solid var(--cr-border)',
                        borderRadius: 'var(--cr-radius-md)',
                        background: 'var(--cr-surface-2)',
                      }}
                    >
                      <span
                        aria-hidden
                        className="grid h-9 w-9 shrink-0 place-items-center"
                        style={{
                          borderRadius: 'var(--cr-radius-md)',
                          background: 'var(--cr-accent-light)',
                          color: 'var(--cr-gold-700)',
                        }}
                      >
                        <BIcon size={16} aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <div
                          className="text-[13px] font-semibold"
                          style={{ color: 'var(--cr-text)' }}
                        >
                          {benefitLabel(b, t)}
                        </div>
                        {desc && (
                          <div className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                            {desc}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </DetailCard>
        )}

        {/* About company */}
        {employer && (
          <DetailCard>
            <SectionHeader icon={Building2}>{t('aboutCompanyHeading')}</SectionHeader>
            <div className="flex items-start gap-3">
              <span
                aria-hidden
                className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden"
                style={{
                  borderRadius: 'var(--cr-radius-md)',
                  background: 'var(--cr-surface-3)',
                  color: 'var(--cr-text-4)',
                  fontWeight: 700,
                }}
              >
                {employer.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small company logo
                  <img
                    src={employer.avatar}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover"
                  />
                ) : (
                  employer.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-[14px] font-bold" style={{ color: 'var(--cr-text)' }}>
                    {employer.name}
                  </span>
                  {employer.erpLinked && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold"
                      style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
                    >
                      <BadgeCheck size={12} aria-hidden /> {t('erpLinkedBadge')}
                    </span>
                  )}
                  {/* GST-verified badge: dormant forward hook - shows only once a real
                      GST-verification feature sets employer.gstVerified (off today).
                      Keep in sync with the card badge (JobCard showGstBadge). */}
                  {employer.gstVerified && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] font-bold"
                      style={{ background: 'var(--cr-success-bg)', color: 'var(--cr-success)' }}
                    >
                      <BadgeCheck size={12} aria-hidden /> {t('gstVerifiedBadge')}
                    </span>
                  )}
                </div>
                {/* Real signals only (followers / rating) - no fabricated verification. */}
                {(employer.followerCount != null ||
                  (employer.ratingCount != null && employer.ratingCount > 0)) && (
                  <div
                    className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px]"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {employer.ratingCount != null && employer.ratingCount > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Star
                          size={12}
                          aria-hidden
                          fill="var(--cr-gold-700)"
                          style={{ color: 'var(--cr-gold-700)' }}
                        />
                        {employer.ratingAvg?.toFixed(1)} ({employer.ratingCount})
                      </span>
                    )}
                    {employer.followerCount != null && (
                      <span>{t('followersCount', { count: employer.followerCount })}</span>
                    )}
                  </div>
                )}
                {employer.about && (
                  <p
                    className="mt-1.5 mb-0 text-[13px] leading-relaxed"
                    style={{ color: 'var(--cr-text-2)' }}
                  >
                    {employer.about}
                  </p>
                )}
                {employer.href && (
                  <Link
                    href={employer.href}
                    className="mt-1.5 inline-block text-[12.5px] font-semibold no-underline"
                    style={{ color: 'var(--cr-primary)' }}
                  >
                    {t('viewCompanyPage')}
                  </Link>
                )}
              </div>
            </div>
          </DetailCard>
        )}

        {/* Company: hiring funnel + review applications */}
        {isCompany && (
          <DetailCard id="job-applicants">
            <SectionHeader icon={Users}>
              {t('applicationsHeading', { count: appList.length })}
            </SectionHeader>

            {appList.length > 0 && (
              <div className="mb-4 grid grid-cols-3 gap-3">
                {(
                  [
                    { key: 'applied', value: funnel.applied },
                    { key: 'shortlisted', value: funnel.shortlisted },
                    { key: 'accepted', value: funnel.accepted },
                  ] as const
                ).map((s) => (
                  <div
                    key={s.key}
                    className="flex flex-col gap-0.5 p-3"
                    style={{
                      background: 'var(--cr-surface-2)',
                      border: '1px solid var(--cr-border)',
                      borderRadius: 'var(--cr-radius-md)',
                    }}
                  >
                    <span
                      className="text-[20px] font-extrabold"
                      style={{ color: 'var(--cr-text)' }}
                    >
                      {s.value}
                    </span>
                    <span
                      className="text-[11.5px] font-semibold"
                      style={{ color: 'var(--cr-text-4)' }}
                    >
                      {t(`applicationStatus.${s.key}`)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {appList.length === 0 ? (
              <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('noApplicationsYet')}
              </p>
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {appList.map((a) => {
                  const who = names[a.applicantUserId] ?? t('applicantFallback');
                  return (
                    <li key={a._id}>
                      <ApplicationCard
                        application={a}
                        applicantName={names[a.applicantUserId]}
                        actions={
                          <>
                            <StartConversationButton
                              recipientUserId={a.applicantUserId}
                              context={{ type: 'JobApplication', id: a._id }}
                              partyName={names[a.applicantUserId]}
                              dsSize="md"
                            />
                            {isOpen && (a.status === 'applied' || a.status === 'shortlisted') && (
                              <>
                                {a.status === 'applied' && (
                                  <DsButton
                                    dsVariant="ghost"
                                    onClick={() => handleSetStatus(a._id, 'shortlisted')}
                                    loading={busy}
                                    aria-label={t('shortlistAria', { name: who })}
                                  >
                                    {t('shortlist')}
                                  </DsButton>
                                )}
                                <DsButton
                                  dsVariant="ghost"
                                  onClick={() => handleSetStatus(a._id, 'declined')}
                                  loading={busy}
                                  aria-label={t('declineAria', { name: who })}
                                >
                                  {t('decline')}
                                </DsButton>
                                <DsButton
                                  dsVariant="primary"
                                  onClick={() => handleAccept(a._id)}
                                  loading={busy}
                                  aria-label={t('acceptAria', { name: who })}
                                >
                                  {t('accept')}
                                </DsButton>
                              </>
                            )}
                          </>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </DetailCard>
        )}

        {/* Karigar: apply + own application */}
        {!isCompany && (
          <DetailCard id="job-apply">
            <SectionHeader icon={Send}>
              {mine ? t('yourApplicationHeading') : t('applyHeading')}
            </SectionHeader>
            {!isOpen ? (
              <p className="m-0 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('jobNotOpen')}
              </p>
            ) : mine && mine.status === 'withdrawn' ? (
              <>
                <ApplicationCard application={mine} pipeline />
                <p className="mt-2 text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                  {t('applicationWithdrawnHint')}
                </p>
                <div
                  style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--cr-border)' }}
                >
                  <ApplicationComposer submitting={busy} onSubmit={handleApply} />
                </div>
              </>
            ) : (
              <>
                {mine && (
                  <div className="mb-3">
                    <ApplicationCard
                      application={mine}
                      pipeline
                      actions={
                        <>
                          <StartConversationButton
                            recipientUserId={job.companyUserId}
                            context={{ type: 'JobApplication', id: mine._id }}
                            label={tInbox('start.messageRecruiter')}
                            dsSize="md"
                          />
                          {(mine.status === 'applied' || mine.status === 'shortlisted') && (
                            <DsButton dsVariant="ghost" onClick={handleWithdraw} loading={busy}>
                              {t('withdrawApplication')}
                            </DsButton>
                          )}
                        </>
                      }
                    />
                  </div>
                )}
                {mine?.status !== 'accepted' && (
                  <ApplicationComposer initial={mine} submitting={busy} onSubmit={handleApply} />
                )}
              </>
            )}
          </DetailCard>
        )}

        {/* Mobile-only ad (same boost + Google slot as the rail, which is hidden below xl). */}
        <MobileAdInline promoted={promoted} />
      </main>

      <ConnectRightRail>
        {/* First-party promoted listing (boost). Sits atop the rail, under the
            Google connect.right.top slot ConnectRightRail owns. Renders nothing
            on a no-fill. Resolved in app/connect/jobs/[id]/page.tsx. */}
        {promoted ? <PromotedListingAdCard {...promoted} /> : null}
        {/* Summary + the primary action (apply / review), scrolling to the
            in-page section so the rail mirrors the reference's side card. */}
        <RailPanel title={t('summaryTitle')}>
          <div className="flex flex-col gap-3">
            {wage && (
              <div>
                <div className="text-[22px] font-extrabold" style={{ color: 'var(--cr-text)' }}>
                  {wage}
                  {job.wageType && (
                    <span
                      className="ml-1 text-[13px] font-semibold"
                      style={{ color: 'var(--cr-text-4)' }}
                    >
                      {t(`wageType.${job.wageType}`)}
                    </span>
                  )}
                </div>
                {location && (
                  <div
                    className="mt-0.5 inline-flex items-center gap-1 text-[12px]"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    <MapPin size={12} aria-hidden /> {location}
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { k: 'openings', v: String(job.openings), label: t('specOpenings') },
                  {
                    k: 'applied',
                    v: String(job.applicationsCount),
                    label: t('applicationStatus.applied'),
                  },
                  ...(daysLeft != null
                    ? [
                        {
                          k: 'days',
                          v: String(Math.max(0, daysLeft)),
                          label: t('daysLeftLabel'),
                          warn: closingSoon,
                        },
                      ]
                    : []),
                ] as { k: string; v: string; label: string; warn?: boolean }[]
              ).map((tile) => (
                <div
                  key={tile.k}
                  className="p-2.5"
                  style={{
                    border: '1px solid var(--cr-border)',
                    borderRadius: 'var(--cr-radius-md)',
                    background: 'var(--cr-surface-2)',
                  }}
                >
                  <div
                    className="text-[16px] font-extrabold"
                    style={{ color: tile.warn ? 'var(--cr-warning)' : 'var(--cr-text)' }}
                  >
                    {tile.v}
                  </div>
                  <div
                    className="text-[10.5px] font-semibold"
                    style={{ color: 'var(--cr-text-4)' }}
                  >
                    {tile.label}
                  </div>
                </div>
              ))}
            </div>
            {!isCompany && isOpen && mine?.status !== 'accepted' && (
              <DsButton
                dsVariant="primary"
                className="w-full"
                onClick={() =>
                  document
                    .getElementById('job-apply')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {t('applyNow')}
              </DsButton>
            )}
            {!isCompany && !isOpen && (
              <p className="m-0 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('jobNotOpen')}
              </p>
            )}
            {isCompany && appList.length > 0 && (
              <DsButton
                dsVariant="primary"
                className="w-full"
                onClick={() =>
                  document
                    .getElementById('job-applicants')
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              >
                {t('reviewApplicants')}
              </DsButton>
            )}
            {/* Share helps the poster distribute the post + a candidate refer a
                friend. Native share sheet on mobile, copy-link fallback. */}
            <DsButton
              dsVariant="ghost"
              className="w-full"
              icon={<Share2 size={15} aria-hidden />}
              onClick={handleShare}
            >
              {t('shareJob')}
            </DsButton>
            {/* Candidate apply-model microcopy: Connect-profile first, resume
                encouraged (not "no resume needed"). */}
            {!isCompany && isOpen && (
              <p
                className="m-0 text-center text-[11.5px] leading-snug"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {t('applyProfileHint')}
              </p>
            )}
          </div>
        </RailPanel>

        {/* How applying works -- candidate sees the 3-step explainer; the owner
            keeps the plain hiring-model note. */}
        {!isCompany ? (
          <RailPanel title={t('howTitle')}>
            <ol className="m-0 grid list-none gap-3 p-0">
              {([1, 2, 3] as const).map((n) => (
                <li key={n} className="flex items-start gap-2.5">
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold"
                    style={{ background: 'var(--cr-primary)', color: '#fff' }}
                  >
                    {n}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-bold" style={{ color: 'var(--cr-text)' }}>
                      {t(`howStep${n}Title`)}
                    </div>
                    <div className="text-[12px] leading-snug" style={{ color: 'var(--cr-text-4)' }}>
                      {t(`howStep${n}Body`)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </RailPanel>
        ) : (
          <RailPanel title={t('rail.title')}>
            <p className="m-0 text-[12.5px] leading-relaxed" style={{ color: 'var(--cr-text-4)' }}>
              {t('rail.body')}
            </p>
          </RailPanel>
        )}

        {/* Employer trust card (REAL signals only: ERP-linked, rating, followers,
            member since). No fabricated GST/Udyam verification. */}
        {employer && (
          <RailPanel title={t('employerTrustTitle')}>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden"
                style={{
                  borderRadius: 'var(--cr-radius-md)',
                  background: 'var(--cr-surface-3)',
                  color: 'var(--cr-text-4)',
                  fontWeight: 700,
                }}
              >
                {employer.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small company logo
                  <img
                    src={employer.avatar}
                    alt=""
                    aria-hidden
                    className="h-full w-full object-cover"
                  />
                ) : (
                  employer.name.slice(0, 1).toUpperCase()
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="truncate text-[13px] font-semibold"
                  style={{ color: 'var(--cr-text)' }}
                >
                  {employer.name}
                </div>
                {employer.href && (
                  <Link
                    href={employer.href}
                    className="text-[12px] font-semibold no-underline"
                    style={{ color: 'var(--cr-primary)' }}
                  >
                    {t('viewCompanyPage')}
                  </Link>
                )}
              </div>
            </div>
            {/* Trust signal rows -- each only rendered when the data is real. */}
            <div className="mt-3 flex flex-col gap-1.5">
              {employer.erpLinked && (
                <div
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: 'var(--cr-text-2)' }}
                >
                  <Shield size={13} aria-hidden style={{ color: 'var(--cr-primary)' }} />
                  {t('trustErpLinked')}
                </div>
              )}
              {employer.ratingCount != null && employer.ratingCount > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: 'var(--cr-text-2)' }}
                >
                  <Star
                    size={13}
                    aria-hidden
                    fill="var(--cr-gold-700)"
                    style={{ color: 'var(--cr-gold-700)' }}
                  />
                  {t('trustRating', {
                    avg: employer.ratingAvg?.toFixed(1) ?? '0.0',
                    count: employer.ratingCount,
                  })}
                </div>
              )}
              {employer.followerCount != null && employer.followerCount > 0 && (
                <div
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: 'var(--cr-text-2)' }}
                >
                  <Users size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
                  {t('followersCount', { count: employer.followerCount })}
                </div>
              )}
              {employer.memberSince && (
                <div
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium"
                  style={{ color: 'var(--cr-text-2)' }}
                >
                  <CalendarClock size={13} aria-hidden style={{ color: 'var(--cr-text-4)' }} />
                  {t('memberSince', { when: dayjs(employer.memberSince).format('MMM YYYY') })}
                </div>
              )}
            </div>
          </RailPanel>
        )}

        {/* Similar jobs near you (same trade / district, open). Compact rows -
            the full JobCard is board-width and would crowd the rail. */}
        {similarJobs.length > 0 && (
          <RailPanel title={t('similarJobsTitle')}>
            <div className="flex flex-col">
              {similarJobs.map((sj, i) => {
                const sjWage =
                  sj.wageMin != null && sj.wageMax != null
                    ? `${rupees(sj.wageMin)} - ${rupees(sj.wageMax)}`
                    : sj.wageMin != null
                      ? rupees(sj.wageMin)
                      : null;
                const sjLoc = [sj.location?.district, sj.location?.state]
                  .filter(Boolean)
                  .join(', ');
                const SjIcon: LucideIcon = (sj.role && ROLE_ICON[sj.role]) || Briefcase;
                return (
                  <Link
                    key={sj._id}
                    href={`/connect/jobs/${sj._id}`}
                    className="flex items-start gap-2.5 py-2.5 no-underline"
                    style={{ borderTop: i === 0 ? undefined : '1px solid var(--cr-divider)' }}
                  >
                    <span
                      aria-hidden
                      className="grid h-8 w-8 shrink-0 place-items-center"
                      style={{
                        borderRadius: 'var(--cr-radius-md)',
                        background: 'var(--cr-surface-3)',
                        color: 'var(--cr-text-4)',
                      }}
                    >
                      <SjIcon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="truncate text-[12.5px] font-semibold"
                        style={{ color: 'var(--cr-text)' }}
                      >
                        {sj.title}
                      </div>
                      <div className="text-[11.5px]" style={{ color: 'var(--cr-text-4)' }}>
                        {sjWage
                          ? `${sjWage}${sj.wageType ? ` ${t(`wageType.${sj.wageType}`)}` : ''}`
                          : ''}
                        {sjWage && sjLoc ? ' · ' : ''}
                        {sjLoc}
                      </div>
                    </div>
                  </Link>
                );
              })}
              <Link
                href="/connect/jobs"
                className="mt-2 text-[12.5px] font-semibold no-underline"
                style={{ color: 'var(--cr-primary)' }}
              >
                {t('browseAllJobs')}
              </Link>
            </div>
          </RailPanel>
        )}
      </ConnectRightRail>

      {/* Owner edit: reuses the post-a-job composer, prefilled (updateJob). */}
      {isCompany && (
        <JobComposer
          open={editOpen}
          submitting={saving}
          mode="edit"
          initial={job}
          onClose={() => setEditOpen(false)}
          onSubmit={handleEdit}
        />
      )}
    </ConnectPage>
  );
}
