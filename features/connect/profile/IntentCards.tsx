'use client';

/**
 * IntentCards - the rich "open to" cards on the Connect profile, replacing the
 * flat openTo pills. One card per active `openTo` intent, each with a detail
 * line, a CTA, and (for the owner) an audience hint + edit pencil.
 *
 * Shared by the owner profile (`/connect/profile`, `isOwner`) and the public
 * profile (`/u/[slug]`). A sibling `AvatarStatusRibbon` shows the single
 * highest-priority intent as a photo badge; this component shows ALL active
 * intents as actionable cards.
 *
 * Cross-module links - each visitor CTA deep-links into another Connect
 * surface: hiring -> jobs board (`/connect/jobs?employer=`), customOrders ->
 * RFQ (`/connect/rfq?to=`), deals -> marketplace (`/connect/marketplace?seller=`),
 * work -> inbox DM (a real Message control via `StartConversationButton` for a
 * signed-in visitor; logged-out falls back to the `/connect` join link). The
 * rfq/marketplace/inbox targets key off the canonical `subjectUserId` (User _id)
 * when present, falling back to the `userId` share token. The jobs employer
 * filter uses the share token. The owner hiring card also gets a "find
 * available karigars" shortcut into people search (`?type=people&openToWork=true`);
 * the owner customOrders ("Providing services") card gets a sibling "find a
 * service" shortcut (`?type=people&providingServices=true`).
 *
 * Gotchas:
 *  - Auth gate: a logged-out viewer (`!isOwner && !isSignedIn`) gets a CTA that
 *    routes to `/connect` (join) instead of the deep link, since the deep target
 *    needs an account. Signed-in non-owners get the real deep link.
 *  - Owner mode never shows the visitor deep link; it shows a "Manage" affordance
 *    that calls `onEdit` (owners manage intents through the openTo editor for now).
 *  - Render order is fixed (hiring, customOrders, deals, work) regardless of the
 *    openTo key order. Keep the four `t('intents.<key>.*')` namespaces in sync
 *    with the message files.
 */

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Pencil,
  Sparkles,
  Handshake,
  Briefcase,
  UserPlus,
  Users,
  Globe,
  Search,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ConnectOpenTo, ConnectOpenToDetails, ProfileOpenJobs } from '../profile.types';
// Message CTA -> inbox `startInboxDm` (self-hides when the inbox module is off).
// Replaces the dead `/connect/inbox?to=` link on the visitor `work` card.
import StartConversationButton from '@/features/connect/inbox/StartConversationButton';

interface IntentCardsProps {
  openTo: ConnectOpenTo;
  openToDetails: ConnectOpenToDetails;
  isOwner: boolean;
  /** Logged-in non-owner viewer? false for logged-out. Drives CTA auth routing. */
  isSignedIn?: boolean;
  /** Subject share token for profile-relative links (handle or id). */
  userId: string;
  /** Subject canonical User id for inbox / inquiry / quote targets. */
  subjectUserId?: string;
  /** Live hiring numbers for the Hiring card. */
  openJobs?: ProfileOpenJobs;
  /** Owner-only: open the openTo edit modal. */
  onEdit?: () => void;
}

// Fixed display order, independent of the openTo object key order.
// `customOrders` is reframed as "Providing services" (freelancer / job-work
// layer; its CTA opens the RFQ quote flow) and renders alongside work/hiring -
// it is INDEPENDENT, so a person can show "Open to work" AND "Providing
// services". `deals` stays PAUSED (revive by adding it back here + the editor's
// VISIBLE_OPEN_TO_KEYS + the ribbon PRIORITY).
const INTENT_ORDER: (keyof ConnectOpenTo)[] = ['hiring', 'work', 'customOrders'];

/** Per-intent icon + subtle accent token (optional flourish). */
const INTENT_META: Record<keyof ConnectOpenTo, { icon: ReactNode }> = {
  hiring: { icon: <UserPlus size={16} aria-hidden /> },
  customOrders: { icon: <Sparkles size={16} aria-hidden /> },
  deals: { icon: <Handshake size={16} aria-hidden /> },
  work: { icon: <Briefcase size={16} aria-hidden /> },
};

export default function IntentCards({
  openTo,
  openToDetails,
  isOwner,
  isSignedIn = false,
  userId,
  subjectUserId,
  openJobs,
  onEdit,
}: IntentCardsProps) {
  const t = useTranslations('connect.profile.intents');
  const activeKeys = INTENT_ORDER.filter((k) => openTo[k]);

  // Owner with no active intents - a single dashed prompt mirroring the
  // EmptyHint style in ProfileView.tsx.
  if (isOwner && activeKeys.length === 0) {
    return (
      <div
        className="flex flex-col items-start gap-2 p-4 text-[13px]"
        style={{
          border: '1px dashed var(--cr-border)',
          borderRadius: 'var(--cr-radius-lg)',
          background: 'var(--cr-surface-2)',
          color: 'var(--cr-text-3)',
        }}
      >
        <span>{t('emptyOwner')}</span>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[13px] font-semibold"
            style={{ color: 'var(--cr-primary)' }}
          >
            <Pencil size={14} aria-hidden />
            {t('manage')}
          </button>
        )}
      </div>
    );
  }

  // Non-owner with nothing active - render nothing.
  if (activeKeys.length === 0) return null;

  // Inbox / RFQ / marketplace targets prefer the canonical User id, falling
  // back to the share token.
  const subject = subjectUserId ?? userId;
  // A logged-out viewer can't act on a deep link - route to the join page.
  const needsAuthGate = !isOwner && !isSignedIn;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {activeKeys.map((key) => (
        <IntentCard
          key={key}
          intentKey={key}
          detail={openToDetails[key]?.detail}
          audience={openToDetails[key]?.audience ?? 'all'}
          isOwner={isOwner}
          needsAuthGate={needsAuthGate}
          userId={userId}
          subject={subject}
          openJobs={key === 'hiring' ? openJobs : undefined}
          onEdit={onEdit}
          t={t}
        />
      ))}
    </div>
  );
}

/* ── One card ───────────────────────────────────────────────────────── */

function IntentCard({
  intentKey,
  detail,
  audience,
  isOwner,
  needsAuthGate,
  userId,
  subject,
  openJobs,
  onEdit,
  t,
}: {
  intentKey: keyof ConnectOpenTo;
  detail?: string;
  audience: 'all' | 'network';
  isOwner: boolean;
  needsAuthGate: boolean;
  userId: string;
  subject: string;
  openJobs?: ProfileOpenJobs;
  onEdit?: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const meta = INTENT_META[intentKey];
  const title = t(`${intentKey}.title`);
  const detailLine = detail?.trim() || t(`${intentKey}.fallback`);

  // The deep-link target + CTA label per intent. hiring uses the live
  // applicant count; the others are static labels.
  const { href, ctaLabel, roles } = ctaFor(intentKey, { userId, subject, openJobs, t });
  // Auth-gate: a logged-out viewer's CTA points at the join page instead.
  const ctaHref = needsAuthGate ? '/connect' : href;

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-2 p-4"
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 'var(--cr-radius-lg)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className="m-0 inline-flex items-center gap-2 text-[14px] font-semibold"
          style={{ color: 'var(--cr-text)' }}
        >
          <span style={{ color: 'var(--cr-primary)' }}>{meta.icon}</span>
          {title}
        </h3>
        {isOwner && onEdit && (
          <button
            type="button"
            onClick={onEdit}
            aria-label={t('manage')}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-muted transition-colors hover:bg-surface-2 hover:text-heading"
          >
            <Pencil size={14} aria-hidden />
          </button>
        )}
      </div>

      <p className="m-0 text-[13px] leading-relaxed" style={{ color: 'var(--cr-text-2)' }}>
        {detailLine}
      </p>

      {/* Owner: audience hint only. Editing is the top-right pencil (matches
          the other profile sections) - the duplicate "Manage" text button was
          removed since it did the same thing as the pencil. */}
      {isOwner ? (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: 'var(--cr-text-3)' }}
          >
            {audience === 'network' ? (
              <Users size={12} aria-hidden />
            ) : (
              <Globe size={12} aria-hidden />
            )}
            {audience === 'network' ? t('audience.labelNetwork') : t('audience.labelAll')}
          </span>
          {/* Owner "hiring" card -> a shortcut into people search filtered to
              karigars open to work. Cross-module link: people search reads
              `?type=people&openToWork=true`. Only on hiring (finding workers
              belongs to the one who is hiring). */}
          {intentKey === 'hiring' && (
            <Link
              href="/connect/search?type=people&openToWork=true"
              className="inline-flex items-center gap-1 text-[11px] font-semibold no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              <Search size={12} aria-hidden />
              {t('hiring.findKarigars')}
            </Link>
          )}
          {/* Owner "Providing services" card -> shortcut into people search
              filtered to others offering services. Cross-module link: people
              search reads `?type=people&providingServices=true` (mirrors the
              hiring -> openToWork shortcut). */}
          {intentKey === 'customOrders' && (
            <Link
              href="/connect/search?type=people&providingServices=true"
              className="inline-flex items-center gap-1 text-[11px] font-semibold no-underline"
              style={{ color: 'var(--cr-primary)' }}
            >
              <Search size={12} aria-hidden />
              {t('customOrders.findAServiceShortcut')}
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {/* Visitor `work` card: a real Message control (resolves/opens an inbox
              DM) instead of the dead `?to=` link. Only for a signed-in non-owner
              with a known subject id; logged-out keeps the `/connect` join link.
              StartConversationButton self-hides if the inbox module is off. */}
          {intentKey === 'work' && !needsAuthGate && subject ? (
            <StartConversationButton
              recipientUserId={subject}
              label={t('work.cta')}
              dsVariant="primary"
              dsSize="sm"
            />
          ) : (
            <Link
              href={ctaHref}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold no-underline"
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--cr-radius-full)',
                background: 'var(--cr-primary-light)',
                color: 'var(--cr-primary)',
              }}
            >
              {ctaLabel}
            </Link>
          )}
          {/* hiring shows the open-role count alongside the applicant CTA. */}
          {roles && (
            <span className="text-[12px] font-medium" style={{ color: 'var(--cr-text-3)' }}>
              {roles}
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/* ── CTA wiring ─────────────────────────────────────────────────────── */

/** Resolve the deep-link href + CTA label (and optional roles hint) per intent. */
function ctaFor(
  intentKey: keyof ConnectOpenTo,
  {
    userId,
    subject,
    openJobs,
    t,
  }: {
    userId: string;
    subject: string;
    openJobs?: ProfileOpenJobs;
    t: ReturnType<typeof useTranslations>;
  },
): { href: string; ctaLabel: string; roles?: string } {
  switch (intentKey) {
    case 'hiring':
      // jobs board filtered to this employer's roles; live applicant count.
      return {
        href: `/connect/jobs?employer=${userId}`,
        ctaLabel: t('hiring.cta', { applicants: openJobs?.applicants ?? 0 }),
        roles: openJobs?.count ? t('hiring.roles', { count: openJobs.count }) : undefined,
      };
    case 'customOrders':
      // RFQ flow - request a quote from this subject. Route is best-effort.
      return { href: `/connect/rfq?to=${subject}`, ctaLabel: t('customOrders.cta') };
    case 'deals':
      // marketplace seller view - send a wholesale inquiry.
      return { href: `/connect/marketplace?seller=${subject}`, ctaLabel: t('deals.cta') };
    case 'work':
    default:
      // inbox DM - message the person directly.
      return { href: `/connect/inbox?to=${subject}`, ctaLabel: t('work.cta') };
  }
}
