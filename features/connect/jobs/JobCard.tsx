'use client';

/**
 * A single job on the board / a company's list. Links to the job detail and
 * carries inline Save + Apply controls so a candidate never has to open the
 * detail just to act. Every signal is a REAL field (role, skills, machine type,
 * wage, openings, deadline) -- no fabricated rating / hire-speed. The wage strip
 * keeps pay first-class (daily-wage / piece-rate / monthly).
 *
 * Cross-module links:
 * - jobs.actions.saveJob / unsaveJob / applyToJob (BE connect/jobs endpoints).
 * - useBoardEmployers builds the `employer` ref (page name+logo / person name);
 *   `erpLinked` drives the QUIET "ERP verified" badge and is NEVER set for a
 *   person (`isPerson` true) -- keep that invariant when feeding this prop.
 * - JobApplyConfirm is the apply confirm sheet opened by the Apply button.
 * - JobBoard passes viewerId/initialSaved/alreadyApplied per card (seeded SSR).
 *
 * INTERACTION & CURSOR CONTRACT (the owner has been burned by click bugs):
 * - The root is a `<div className="relative">`, NOT an `<a>`. The ONLY full-card
 *   link is the title `<Link>` whose `::after` overlay (after:absolute
 *   after:inset-0) stretches over the whole card -- so a click anywhere opens the
 *   detail while staying a single, keyboard- and screen-reader-accessible link.
 * - Save + Apply are REAL controls layered ABOVE that overlay via
 *   `relative z-[2]` (the stretched ::after sits at the card's default stacking
 *   level; z-[2] + position:relative lifts the buttons + the AntD click wave over
 *   it). They click independently -- NO onClick on the wrapper, NO
 *   stopPropagation hacks. Gotcha: if you drop `relative` or the z-index, the
 *   stretched link eats the button taps and Save/Apply silently navigate instead.
 * - Owner-on-own-job (viewerId === job.companyUserId) and the My-jobs tab
 *   (showOwnerStats) hide Save/Apply entirely -- you do not apply to your own job.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { App } from 'antd';
import {
  type LucideIcon,
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Brush,
  Briefcase,
  CalendarClock,
  Clock,
  Cog,
  Eye,
  IndianRupee,
  MapPin,
  PenTool,
  Scissors,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { parseApiError } from '@/lib/utils';
import { track } from '@/lib/analytics';
import { categoryLabel } from '../search.types';
import { saveJob, unsaveJob } from './jobs.actions';
import JobApplyConfirm from './JobApplyConfirm';
// Per-item "Sample" disclosure pill on seeded demo jobs (job.isDemo). One source
// of truth with the jobs/search demo down-rank (backend demo-rank.ts).
import SampleBadge from '@/components/connect/SampleBadge';
import type { Job, MyApplicationView, JobEmployerRef, JobRole } from './jobs.types';

dayjs.extend(relativeTime);

function rupees(n: number): string {
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Role -> icon. Hand-work roles get the gold tile; machine/oversight roles indigo. */
const ROLE_ICON: Record<JobRole, LucideIcon> = {
  karigar: Brush,
  helper: Scissors,
  operator: Cog,
  designer: PenTool,
  supervisor: Users,
};
const GOLD_ROLES: JobRole[] = ['karigar', 'helper'];

const MAX_TAGS = 3;
const CLOSING_SOON_DAYS = 3;
// At or above this many openings a job is "bulk" hiring -- a meaningful signal to
// a karigar scanning the board (group/contract work), so we surface it.
const BULK_OPENINGS = 10;

export default function JobCard({
  job,
  matchedSkills,
  employer,
  viewerId,
  initialSaved = false,
  alreadyApplied = false,
  showOwnerStats = false,
  variant = 'list',
  promoted = false,
  onOpen,
  onApplied,
}: {
  job: Job;
  matchedSkills?: string[];
  /** Resolved employer identity (useBoardEmployers). Undefined = not resolved
   *  yet (the batch is in flight) -> render no employer row rather than a flash. */
  employer?: JobEmployerRef;
  /** The viewer's own user id. When it equals job.companyUserId the card hides
   *  Save/Apply (you do not act on your own posting). */
  viewerId?: string;
  /** Seeds the Save control's filled state (from the viewer's saved set). */
  initialSaved?: boolean;
  /** The viewer already applied -> Apply renders disabled "Applied". */
  alreadyApplied?: boolean;
  /** My-jobs tab: show the private views count, hide Save/Apply. */
  showOwnerStats?: boolean;
  /** Outer layout only; the inner anatomy is shared. */
  variant?: 'list' | 'grid';
  /** Paid PROMOTED unit (boost): renders a gold left-edge accent + soft lift and a
   *  small "Promoted" disclosure pill on the card. Set by PromotedJobs; the organic
   *  list leaves it false so a normal card is unchanged. */
  promoted?: boolean;
  /** Optional: fired with the job id when the card is OPENED (title link tapped).
   *  Only the promoted block wires this (-> connect.jobs.promoted_click); the
   *  organic list leaves it unset so a normal open is not tracked as an ad click. */
  onOpen?: (jobId: string) => void;
  /** Fired with the created application (enriched into a MyApplicationView using
   *  this card's job + employer) after a quick apply, so JobBoard can add it to the
   *  My applications tab live. The card flips locally regardless. */
  onApplied?: (application: MyApplicationView) => void;
}) {
  const t = useTranslations('connect.jobs');
  const tCat = useTranslations('connect.search.listing.category');
  // Shared ad disclosure label ("Promoted") used across feed/marketplace/jobs; only
  // rendered when `promoted` is set. Links: connect.ads.promotedLabel.
  const tAds = useTranslations('connect.ads');
  const { message } = App.useApp();

  // --- Save (optimistic) + Apply (confirm sheet) local state ---
  const [saved, setSaved] = useState(initialSaved);
  const [savingBookmark, setSavingBookmark] = useState(false);
  const [applied, setApplied] = useState(alreadyApplied);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Owner-on-own-job: hide the candidate controls. The My-jobs tab (showOwnerStats)
  // is the same intent from the other direction (your own postings).
  const isOwnJob = !!viewerId && job.companyUserId === viewerId;
  const showActions = !isOwnJob && !showOwnerStats;
  // An owner-facing card: the viewer's own job on the board, or any My-jobs row.
  // Drives the status pill, the applicant count, and the Manage action set.
  const isOwnerCard = isOwnJob || showOwnerStats;
  // Grid cards are NARROW (the board/promoted grid fits ~260px columns), so the
  // title and the status+wage block can NOT sit side-by-side -- the nowrap wage
  // block would crush the title to one-word-per-line and overlap it. In grid the
  // header STACKS (title, then status+wage below); list keeps them inline. Keep in
  // sync with the grid container in JobBoard/PromotedJobs (auto-fill minmax 260px).
  const isGrid = variant === 'grid';

  const wage =
    job.wageMin != null && job.wageMax != null
      ? `${rupees(job.wageMin)} - ${rupees(job.wageMax)}`
      : job.wageMin != null
        ? rupees(job.wageMin)
        : null;
  const location = [job.location?.district, job.location?.state].filter(Boolean).join(', ');

  // role is an open string now: a custom role has no preset icon, so it falls
  // back to the neutral Briefcase tile (cast guards the preset-keyed lookup).
  const Icon: LucideIcon = (job.role && ROLE_ICON[job.role as JobRole]) || Briefcase;
  const goldTile = job.role ? GOLD_ROLES.includes(job.role as JobRole) : false;

  const isMatched =
    !!matchedSkills?.length && (job.skills ?? []).some((s) => matchedSkills.includes(s));

  // Closing-soon: an open job whose real deadline is within N days.
  const daysLeft =
    job.status === 'open' && job.closesAt
      ? dayjs(job.closesAt).startOf('day').diff(dayjs().startOf('day'), 'day')
      : null;
  const closingSoon = daysLeft != null && daysLeft >= 0 && daysLeft <= CLOSING_SOON_DAYS;
  const closesLabel =
    daysLeft == null || daysLeft < 0
      ? null
      : daysLeft === 0
        ? t('closesToday')
        : daysLeft === 1
          ? t('closesTomorrow')
          : t('closesInDays', { count: daysLeft });

  const tags = (job.skills ?? []).slice(0, MAX_TAGS);
  const extraTags = Math.max(0, (job.skills?.length ?? 0) - MAX_TAGS);
  const isBulk = job.openings >= BULK_OPENINGS;

  // Status pill: closing-soon takes visual priority over a plain "open".
  const statusTone = closingSoon
    ? { bg: 'var(--cr-warning-bg)', fg: 'var(--cr-warning)', label: t('closingSoon') }
    : job.status === 'open'
      ? { bg: 'var(--cr-success-bg)', fg: 'var(--cr-success)', label: t('status.open') }
      : job.status === 'filled'
        ? { bg: 'var(--cr-primary-light)', fg: 'var(--cr-primary)', label: t('status.filled') }
        : { bg: 'var(--cr-surface-3)', fg: 'var(--cr-text-4)', label: t('status.closed') };

  // EVERY card shows a status pill (owner + seeker parity - the two cards must read
  // as the same component). An open, not-closing job shows a green status dot; its
  // label is "Active" on an owner card, "Open" on a seeker card. Closing soon /
  // filled / closed use the shared statusTone label on both.
  const showStatusPill = true;
  const statusIsActive = job.status === 'open' && !closingSoon;
  const statusLabel = statusIsActive
    ? isOwnerCard
      ? t('card.statusActive')
      : t('status.open')
    : statusTone.label;

  // QUIET ERP-verified badge: page-posted employers that run on the ERP only.
  // Never for a person (isPerson) -- a person has no ERP concept (see the ref).
  const showErpBadge = !!employer?.erpLinked && !employer.isPerson;
  // Forward hook: a real GST-verification feature would set employer.gstVerified
  // (page-only, never a person). The badge below is wired but stays off until the
  // BE populates the flag - we never claim GST verification we have not performed.
  const showGstBadge = !!employer?.gstVerified && !employer.isPerson;

  // --- Save handler: optimistic flip, roll back + toast on failure. ---
  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    setSavingBookmark(true);
    // Analytics: a Save action from a board card. Fired on the SAVE direction only
    // (next === true), not on un-save, since the event measures save intent from
    // the list. Fired optimistically (before the round-trip) like the UI flip.
    if (next) track('connect.jobs.save_from_card', { jobId: job._id });
    try {
      const res = next ? await saveJob(job._id) : await unsaveJob(job._id);
      if (!res.ok) {
        setSaved(!next);
        message.error(res.error);
        return;
      }
      void message.success(next ? t('savedToast') : t('unsavedToast'));
    } catch (e) {
      setSaved(!next);
      message.error(parseApiError(e));
    } finally {
      setSavingBookmark(false);
    }
  };

  // Apply is blocked (disabled control) when already applied or the job is not
  // open; the in-locale reason explains why so the disabled state never reads as
  // a dead button.
  const applyBlockedReason = applied
    ? t('card.applied')
    : job.status === 'filled'
      ? t('card.filledShort')
      : job.status !== 'open'
        ? t('card.closedShort')
        : null;

  const initial = employer?.name?.trim()?.charAt(0)?.toUpperCase() || '?';

  // Shared meta spans (location + posted + openings + owner-only applicants/views
  // + closes). Extracted so the three footer layouts (seeker one-row, owner
  // two-row, my-jobs meta-only) render the identical content without duplication.
  const metaSpans = (
    <>
      {location && (
        <span className="inline-flex items-center gap-1">
          <MapPin size={12} aria-hidden /> {location}
        </span>
      )}
      {job.createdAt && (
        <span className="inline-flex items-center gap-1">
          <Clock size={12} aria-hidden /> {t('postedAgo', { when: dayjs(job.createdAt).fromNow() })}
        </span>
      )}
      {isBulk ? (
        <span
          className="inline-flex items-center gap-1 font-semibold"
          style={{ color: 'var(--cr-gold-700)' }}
        >
          <Users size={12} aria-hidden /> {t('card.bulkNeeded', { count: job.openings })}
        </span>
      ) : (
        job.openings > 1 && (
          <span className="inline-flex items-center gap-1">
            <Users size={12} aria-hidden /> {t('openingsCount', { count: job.openings })}
          </span>
        )
      )}
      {/* Applicants = owner-only key signal (board own-job card + My-jobs); hidden
          from seekers. A "N new/unreviewed" split is deferred (no BE field). */}
      {isOwnerCard && (
        <span
          className="inline-flex items-center gap-1"
          style={{ color: 'var(--cr-primary)', fontWeight: 600 }}
        >
          <Users size={12} aria-hidden />{' '}
          {t('card.applicantsCount', { count: job.applicationsCount })}
        </span>
      )}
      {showOwnerStats && (
        <span className="inline-flex items-center gap-1">
          <Eye size={12} aria-hidden /> {t('viewsCount', { count: job.views })}
        </span>
      )}
      {closesLabel && (
        <span
          className="inline-flex items-center gap-1"
          style={closingSoon ? { color: 'var(--cr-warning)', fontWeight: 600 } : undefined}
        >
          <CalendarClock size={12} aria-hidden /> {closesLabel}
        </span>
      )}
    </>
  );

  // Job cards are text rows (no cover / visual area), so a job video gets NO card
  // badge - it is shown on the detail page only (deliberate: there is no visual slot).
  return (
    <div
      // GRID: h-full + flex column so every card in a row matches the tallest one
      // (the grid li stretches; h-full fills it) and the footer can pin to the
      // bottom (mt-auto below) -- so the Apply/Save row lines up across the row.
      className={`relative transition-[box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[0_4px_18px_rgba(16,24,40,0.08)] ${
        isGrid ? 'flex h-full flex-col' : ''
      }`}
      style={{
        background: 'var(--cr-surface)',
        border: `1px solid ${isMatched ? 'var(--cr-primary-border)' : 'var(--cr-border)'}`,
        borderRadius: 'var(--cr-radius-lg)',
        // Tightened from 16 -> 14 so list rows are denser (target 4-5 above the
        // fold) without crowding the action zone.
        padding: 14,
        // PROMOTED (boost): a gold left-edge accent + a soft warm resting lift so a
        // paid job reads as featured without a heavy container. The inline shadow
        // outranks the hover:shadow- class (the hover translate still applies), which
        // is fine here - the resting lift IS the promoted look. Keep in sync with the
        // pill below.
        ...(promoted
          ? {
              borderLeft: '4px solid var(--cn-gold, #c79a3a)',
              boxShadow: '0 6px 20px -8px rgba(120,90,20,0.28), 0 1px 3px rgba(16,24,40,0.06)',
            }
          : null),
      }}
    >
      {/* PROMOTED disclosure pill: a small ivory-gold "Promoted" tag with a soft
          shadow (the design the owner picked), at the card's top-left. One tag per
          promoted card (LinkedIn/Indeed style); reuses connect.ads.promotedLabel so
          the jobs/marketplace/feed disclosure all read identically. */}
      {promoted && (
        <div className="mb-3">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase"
            style={{
              letterSpacing: '0.08em',
              background: 'var(--cr-gold-50, #f8f1df)',
              color: 'var(--cr-gold-700)',
              border: '1px solid var(--cr-gold-200, #ecdcae)',
              boxShadow: '0 2px 6px rgba(120,90,20,0.16)',
            }}
          >
            <Sparkles size={12} aria-hidden />
            {tAds('promotedLabel')}
          </span>
        </div>
      )}

      {/* GRID: flex-1 + items-stretch makes this icon+content row fill the card
          height so the content column can push its footer to the bottom. */}
      <div className={`flex gap-3 ${isGrid ? 'flex-1 items-stretch' : 'items-start'}`}>
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center"
          style={{
            borderRadius: 'var(--cr-radius-md)',
            background: goldTile ? 'var(--cr-accent-light)' : 'var(--cr-primary-light)',
            color: goldTile ? 'var(--cr-gold-700)' : 'var(--cr-primary)',
          }}
        >
          <Icon size={22} aria-hidden />
        </span>

        {/* GRID: flex column so the footer (mt-auto) drops to the card bottom while
            the variable content (title/tags) sits at the top. */}
        <div className={`min-w-0 flex-1 ${isGrid ? 'flex flex-col' : ''}`}>
          <div
            className={isGrid ? 'flex flex-col gap-1.5' : 'flex items-start justify-between gap-3'}
          >
            {/* The ONLY full-card link. Its ::after overlay stretches over the
                whole card; Save/Apply sit above it (relative z-[2]). hover:underline
                only the title text. flex-1 min-w-0 lets the title wrap + take the
                left space while the wage holds the top-right. */}
            <Link
              href={`/connect/jobs/${job._id}`}
              onClick={onOpen ? () => onOpen(job._id) : undefined}
              // The applicant count is an OWNER-ONLY signal (see footer + showStatusPill
              // gating below): seekers never see it, so the aria-label drops it for them
              // too (cardAriaSeeker) and only exposes it on the owner / My-jobs view.
              aria-label={
                showOwnerStats
                  ? t('cardAria', {
                      title: job.title,
                      status: t(`status.${job.status}`),
                      count: job.applicationsCount,
                    })
                  : t('cardAriaSeeker', {
                      title: job.title,
                      status: t(`status.${job.status}`),
                    })
              }
              className={`min-w-0 text-[15px] leading-snug font-semibold no-underline after:absolute after:inset-0 after:content-[''] hover:underline ${
                isGrid ? '' : 'flex-1'
              }`}
              style={{ color: 'var(--cr-text)' }}
            >
              {job.title}
            </Link>
            {/* Top-right: WAGE (pay primacy) + the status pill, right-aligned. This
                fills the card's right side (the reference layout); previously the
                wage was buried in the body-left, leaving the top-right empty. The
                wage uses tabular-nums + a muted "/ day" unit (wageType.* already
                carries the slash). Status pill carries signal only when NOT a plain
                open seeker job (showStatusPill). */}
            {(wage || showStatusPill || job.isDemo) && (
              // LIST: ONE line (status + wage), not a vertical stack -- stacking made
              // the title row two lines tall on owner cards, pushing the employer row
              // down and leaving a gap under the title; inline keeps it one line and
              // matches the reference (status left of wage). GRID: the header already
              // stacks (isGrid), so this sits BELOW the title and may flex-wrap (no
              // shrink-0) rather than crush the narrow card.
              <div className={`flex items-center gap-2 ${isGrid ? 'flex-wrap' : 'shrink-0'}`}>
                {/* Sample disclosure for a seeded demo job. relative z-[2] keeps it
                    above the stretched title-link overlay (same layer as Save/Apply). */}
                {job.isDemo && (
                  <span className="relative z-[2] inline-flex">
                    <SampleBadge size="sm" />
                  </span>
                )}
                {showStatusPill && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap"
                    style={{ background: statusTone.bg, color: statusTone.fg }}
                  >
                    {statusIsActive && (
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ background: 'var(--cr-success)' }}
                      />
                    )}
                    {statusLabel}
                  </span>
                )}
                {wage && (
                  <span
                    className="inline-flex items-baseline text-[15px] font-extrabold whitespace-nowrap"
                    style={{ color: 'var(--cr-text)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    <IndianRupee size={13} aria-hidden className="self-center" />
                    {wage.replace(/₹/g, '')}
                    {job.wageType && (
                      <span
                        className="ml-1 text-[11px] font-medium"
                        style={{ color: 'var(--cr-text-4)' }}
                      >
                        {t(`wageType.${job.wageType}`)}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Employer row: only when resolved. Logo/initial + name (plain text,
              NOT a link -- the title is the single card link) + a quiet ERP badge. */}
          {employer && (
            <div className="mt-1 flex items-center gap-1.5">
              {employer.logo ? (
                // eslint-disable-next-line @next/next/no-img-element -- small avatar, remote logo URL
                <img
                  src={employer.logo}
                  alt=""
                  aria-hidden
                  className="h-4 w-4 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-bold"
                  style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-4)' }}
                >
                  {initial}
                </span>
              )}
              <span
                className="truncate text-[12px] font-medium"
                style={{ color: 'var(--cr-text-3)' }}
              >
                {employer.name}
              </span>
              {showErpBadge && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: 'var(--cr-success-bg)', color: 'var(--cr-success)' }}
                  title={t('card.erpVerified')}
                >
                  <ShieldCheck size={10} aria-hidden /> {t('card.erpVerified')}
                </span>
              )}
              {/* GST-verified badge: dormant forward hook (showGstBadge stays false
                  until a real GST-verification feature sets employer.gstVerified). */}
              {showGstBadge && (
                <span
                  className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                  style={{ background: 'var(--cr-success-bg)', color: 'var(--cr-success)' }}
                  title={t('card.gstVerified')}
                >
                  <BadgeCheck size={10} aria-hidden /> {t('card.gstVerified')}
                </span>
              )}
            </div>
          )}

          {isMatched && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
              style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
            >
              <Zap size={11} aria-hidden /> {t('matchesSkills')}
            </span>
          )}

          {/* Category line. The pay-type pill was dropped as redundant - the wage's
              "/ day" suffix (top-right) already states how it is paid. Location +
              posted + openings live in the single muted meta line below. */}
          <div className="mt-2 text-[12px]" style={{ color: 'var(--cr-text-4)' }}>
            <span>{categoryLabel(job.category, tCat)}</span>
          </div>

          {(tags.length > 0 || job.machineType) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((s) => (
                <span
                  key={s}
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-3)' }}
                >
                  {s}
                </span>
              ))}
              {extraTags > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-4)' }}
                >
                  {t('skillsMoreCount', { count: extraTags })}
                </span>
              )}
              {job.machineType && (
                // Unified with the skill chips (one muted style) - the old indigo
                // machine pill made the tag row visually noisy.
                <span
                  className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'var(--cr-surface-3)', color: 'var(--cr-text-3)' }}
                >
                  {job.machineType}
                </span>
              )}
            </div>
          )}

          {/* FOOTER. Layout differs by card (all share `metaSpans`):
              - SEEKER (list): one row -> [Apply] [meta (me-auto)] [Save icon], so
                Apply anchors the left edge and the icon-only Save the far-right edge.
              - OWNER (list): a meta line, then an action row spread [Manage] ... [View].
              - My-jobs / no-actions: just the meta line.
              GRID stacks full-width. Interaction & Cursor Contract: action controls
              are real elements layered ABOVE the title's stretched ::after via
              relative z-[2] - the whole card stays clickable to the detail and the
              controls click independently (NO wrapper onClick / stopPropagation). */}
          <div
            // GRID: mt-auto pins this footer (meta + Apply/Save) to the card bottom
            // so the action buttons line up across an equal-height row; LIST keeps a
            // fixed mt-2.5 (cards are full-width, no equal-height row to align to).
            className={`border-t pt-2 ${isGrid ? 'mt-auto' : 'mt-2.5'}`}
            style={{ borderColor: 'var(--cr-divider)' }}
          >
            {showActions ? (
              // SEEKER: same 3-part structure as the owner card so the two read as
              // one component - meta line, then a full-width action row with Apply
              // pinned left (me-auto) and the icon-only Save at the far-right edge
              // (its right edge lines up with the owner's View applicants edge).
              <div className="flex flex-col gap-2.5">
                <div
                  className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {metaSpans}
                </div>
                <div
                  className={`relative z-[2] flex items-center gap-2 ${
                    variant === 'grid' ? 'flex-col items-stretch' : ''
                  }`}
                >
                  {applyBlockedReason ? (
                    <span
                      aria-disabled
                      className={`inline-flex h-10 cursor-not-allowed items-center justify-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold ${
                        variant === 'grid' ? 'w-full' : 'me-auto'
                      }`}
                      style={{
                        background: applied ? 'var(--cr-success-bg)' : 'var(--cr-surface-3)',
                        color: applied ? 'var(--cr-success)' : 'var(--cr-text-4)',
                      }}
                    >
                      {applied && <Send size={13} aria-hidden />}
                      {applyBlockedReason}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      className={`relative z-[2] inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
                        variant === 'grid' ? 'w-full' : 'me-auto'
                      }`}
                      style={{
                        background: 'var(--cr-primary)',
                        color: '#fff',
                        outlineColor: 'var(--cr-primary)',
                      }}
                    >
                      <Send size={13} aria-hidden /> {t('card.apply')}
                    </button>
                  )}
                  {/* Save: icon-only 40x40 (grid = full-width). Meaning via the filled
                      bookmark + colour + aria-label/title (no visible text label). */}
                  <button
                    type="button"
                    onClick={toggleSave}
                    disabled={savingBookmark}
                    aria-disabled={savingBookmark}
                    aria-pressed={saved}
                    aria-label={saved ? t('savedAria') : t('saveAria')}
                    title={saved ? t('card.saved') : t('card.save')}
                    className={`relative z-[2] inline-flex h-10 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
                      savingBookmark ? 'cursor-not-allowed' : 'cursor-pointer'
                    } ${variant === 'grid' ? 'w-full' : 'w-10'}`}
                    style={{
                      borderColor: saved ? 'var(--cr-primary)' : 'var(--cr-border)',
                      background: saved ? 'var(--cr-primary-light)' : 'var(--cr-surface)',
                      color: saved ? 'var(--cr-primary)' : 'var(--cr-text-3)',
                      outlineColor: 'var(--cr-primary)',
                    }}
                  >
                    <Bookmark size={16} aria-hidden fill={saved ? 'currentColor' : 'none'} />
                  </button>
                </div>
              </div>
            ) : isOwnJob && !showOwnerStats ? (
              // OWNER: meta line, then an action row spread - Manage (left) | View (right).
              <div className="flex flex-col gap-2.5">
                <div
                  className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
                  style={{ color: 'var(--cr-text-4)' }}
                >
                  {metaSpans}
                </div>
                <div
                  className={`relative z-[2] flex items-center gap-2 ${
                    variant === 'grid' ? 'flex-col items-stretch' : ''
                  }`}
                >
                  <Link
                    href={`/connect/jobs/${job._id}`}
                    // color inline (#fff): a global anchor rule overrides text-white;
                    // me-auto (list) pins Manage left and View applicants far-right.
                    className={`relative z-[2] inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full px-4 text-[12.5px] font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
                      variant === 'grid' ? 'w-full' : 'me-auto'
                    }`}
                    style={{
                      background: 'var(--cr-primary)',
                      color: '#fff',
                      outlineColor: 'var(--cr-primary)',
                    }}
                  >
                    <Settings size={14} aria-hidden /> {t('card.manage')}
                  </Link>
                  <Link
                    href={`/connect/jobs/${job._id}#job-applicants`}
                    className={`relative z-[2] inline-flex h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-4 text-[12.5px] font-semibold no-underline transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${
                      variant === 'grid' ? 'w-full' : ''
                    }`}
                    style={{
                      borderColor: 'var(--cr-border)',
                      background: 'var(--cr-surface)',
                      color: 'var(--cr-text-2)',
                      outlineColor: 'var(--cr-primary)',
                    }}
                  >
                    {t('card.viewApplicants')} <ArrowRight size={14} aria-hidden />
                  </Link>
                </div>
              </div>
            ) : (
              // My-jobs tab / no actions: meta line only.
              <div
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]"
                style={{ color: 'var(--cr-text-4)' }}
              >
                {metaSpans}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick-apply modal (the shared ApplicationComposer). Sits outside the action
          row but still inside the card; AntD renders it in a portal so the stretched
          link never covers it. On success it flips the card to "Applied" locally AND
          bubbles the created application up (onApplied) so the board reflects it in
          My applications. */}
      {showActions && (
        <JobApplyConfirm
          job={job}
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          onApplied={(application) => {
            setApplied(true);
            setConfirmOpen(false);
            // Enrich into a MyApplicationView using THIS card's job + employer so the
            // board's My applications tab can render it without a refetch.
            onApplied?.({
              ...application,
              job: {
                id: job._id,
                title: job.title,
                role: job.role ?? null,
                location: job.location ?? null,
              },
              employer: { name: employer?.name ?? '' },
            });
          }}
        />
      )}
    </div>
  );
}
