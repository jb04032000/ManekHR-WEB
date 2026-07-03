'use client';

/**
 * ContextCard -- the pinned bar that says what a conversation is ABOUT.
 *
 * A typed renderer over `thread.context` (the BE-hydrated `ThreadContext` union):
 *  - inquiry           -> product card -> the listing
 *  - application       -> job card (+ EMPLOYER-only applicant snapshot + role actions) -> /connect/jobs/[id]
 *  - quote             -> RFQ card (+ role actions) -> /connect/rfq/[id]
 *  - candidate_request -> institute card (a "Hire our trained candidates" lead) -> /connect/company/[pageSlug]
 *    (Institutes Phase 2, Feature 4: a conversation lead, so NO inline actions; the owner just replies)
 * The subject row is a single tap target to the subject. Identity (the other
 * party) is NEVER repeated here -- the conversation header owns it. `system`
 * keeps a lean label; `dm` renders nothing; a deleted source entity renders a
 * minimal eyebrow-only fallback.
 *
 * Role-gated inline actions (employer shortlist/accept/reject, buyer accept/
 * decline, supplier update/withdraw) reuse the SAME server actions the job /
 * RFQ detail pages use; they optimistically patch the thread cache so the chip +
 * list stay in sync without a refetch. The employer applicant snapshot is gated
 * by `viewerRole` on the BE (never sent to the applicant) AND here.
 *
 * Cross-module links: subject + snapshot from inbox.service `hydrateContexts`;
 * actions -> jobs.actions / rfq.actions; cache -> inbox-cache `inboxKeys`. Keep
 * the `kind` branches in sync with the BE `ThreadContext` union.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import {
  Briefcase,
  FileText,
  ReceiptText,
  ChevronRight,
  History,
  GraduationCap,
} from 'lucide-react';
import { formatRupees } from '../marketplace/format';
import { setApplicationStatus, acceptApplication } from '../jobs/jobs.actions';
import { acceptQuote, declineQuote, shortlistQuote, withdrawQuote } from '../rfq/rfq.actions';
import { inboxKeys } from './inbox-cache';
import type { InboxThread, InboxThreadContext } from './inbox.types';
import type { ApplicationStatus, JobStatus } from '../jobs/jobs.types';
import type { QuoteStatus, RfqStatus } from '../rfq/rfq.types';
import type { InquiryStatus } from '../marketplace/marketplace.types';

const GOLD = 'var(--cn-gold, #c79a3a)';
const MUTED = 'var(--cr-text-4)';

type IconCmp = React.ComponentType<{ size?: number }>;
type AnyStatus = ApplicationStatus | QuoteStatus;

// Status -> chip tone. Translucent tint backgrounds read on light + dark themes.
type Tone = 'gold' | 'positive' | 'negative' | 'muted';
const TONE: Record<Tone, { fg: string; bg: string }> = {
  gold: { fg: '#8a6512', bg: 'rgba(199, 154, 58, 0.18)' },
  positive: { fg: '#1c7c4a', bg: 'rgba(28, 124, 74, 0.15)' },
  negative: { fg: '#b23a2a', bg: 'rgba(192, 57, 43, 0.13)' },
  muted: { fg: 'var(--cr-text-4)', bg: 'var(--cr-surface-2)' },
};

const APPLICATION_TONE: Record<ApplicationStatus, Tone> = {
  applied: 'gold',
  shortlisted: 'gold',
  accepted: 'positive',
  declined: 'negative',
  withdrawn: 'muted',
};
const QUOTE_TONE: Record<QuoteStatus, Tone> = {
  sent: 'gold',
  shortlisted: 'gold',
  accepted: 'positive',
  declined: 'negative',
  withdrawn: 'muted',
};
const INQUIRY_TONE: Record<InquiryStatus, Tone> = {
  sent: 'gold',
  viewed: 'gold',
  replied: 'positive',
  archived: 'muted',
};
// candidate_request status -> chip tone (Institutes Phase 2, Feature 4). Same
// sent/viewed/replied/archived lifecycle as an inquiry lead, so it reads the
// same: gold while pending/seen, positive once replied, muted when archived.
type CandidateRequestStatus = Extract<InboxThreadContext, { kind: 'candidate_request' }>['status'];
const CANDIDATE_REQUEST_TONE: Record<CandidateRequestStatus, Tone> = {
  sent: 'gold',
  viewed: 'gold',
  replied: 'positive',
  archived: 'muted',
};

export default function ContextCard({ thread }: { thread: InboxThread }) {
  const t = useTranslations('connect.inbox');
  const tj = useTranslations('connect.jobs');
  const channel = thread.channelType;
  if (channel === 'dm') return null;

  // System: lean, muted label (no party -- a system thread has no person).
  if (channel === 'system') {
    return <LeanCard icon={FileText} label={t('context.system')} accent={MUTED} />;
  }

  const ctx = thread.context;

  // Hydrated subject card per kind (the whole subject row deep-links to it).
  if (ctx) {
    if (ctx.kind === 'inquiry') return <InquiryCard ctx={ctx} t={t} />;
    if (ctx.kind === 'application')
      return <ApplicationCard thread={thread} ctx={ctx} t={t} tj={tj} />;
    if (ctx.kind === 'quote') return <QuoteCard thread={thread} ctx={ctx} t={t} />;
    if (ctx.kind === 'candidate_request') return <CandidateRequestCard ctx={ctx} t={t} />;
  }

  // Deleted source entity (a context channel whose entity / parent is gone):
  // minimal eyebrow-only fallback. No party name, not clickable.
  const fallbackLabel =
    channel === 'inquiry'
      ? t('context.inquiry')
      : channel === 'application'
        ? t('context.application')
        : channel === 'candidate_request'
          ? t('context.candidateRequest.title')
          : t('context.quote');
  const FallbackIcon =
    channel === 'inquiry'
      ? Briefcase
      : channel === 'application'
        ? FileText
        : channel === 'candidate_request'
          ? GraduationCap
          : ReceiptText;
  return <LeanCard icon={FallbackIcon} label={fallbackLabel} accent={MUTED} />;
}

// ── Per-kind cards ───────────────────────────────────────────────────────────

type Inquiry = Extract<InboxThreadContext, { kind: 'inquiry' }>;
function InquiryCard({ ctx, t }: { ctx: Inquiry; t: ReturnType<typeof useTranslations> }) {
  const price =
    ctx.priceType === 'negotiable' || ctx.priceMin === null
      ? t('context.negotiable')
      : ctx.priceType === 'range' && ctx.priceMax !== null && ctx.priceMax > ctx.priceMin
        ? `${formatRupees(ctx.priceMin)} - ${formatRupees(ctx.priceMax)}`
        : formatRupees(ctx.priceMin);
  const meta = joinMeta([
    price,
    ctx.moq != null
      ? `${t('context.moq', { count: ctx.moq })}${ctx.unit ? ` ${ctx.unit}` : ''}`
      : null,
  ]);
  return (
    <CardFrame>
      <MainRow
        href={`/connect/marketplace/listing/${ctx.listingId}`}
        ariaLabel={t('context.viewProductAria', { title: ctx.title })}
      >
        <Thumb image={ctx.coverImage} icon={Briefcase} accent={GOLD} />
        <Body eyebrow={t('context.inquiry')} title={ctx.title} meta={meta} accent={GOLD} />
        {ctx.status && (
          <StatusChip
            label={t(`context.inquiryStatus.${ctx.status}`)}
            tone={INQUIRY_TONE[ctx.status]}
          />
        )}
        <Cue />
      </MainRow>
    </CardFrame>
  );
}

type Application = Extract<InboxThreadContext, { kind: 'application' }>;
function ApplicationCard({
  thread,
  ctx,
  t,
  tj,
}: {
  thread: InboxThread;
  ctx: Application;
  t: ReturnType<typeof useTranslations>;
  tj: ReturnType<typeof useTranslations>;
}) {
  const qc = useQueryClient();
  const [override, setOverride] = useState<ApplicationStatus | null>(null);
  const status = override ?? ctx.status;
  const entityId = thread.contextEntityId;

  const wage = rupeeRange(ctx.wageMin, ctx.wageMax);
  const meta = joinMeta([
    ctx.companyName,
    wage ? `${wage}${ctx.wageType ? ` ${tj(`wageType.${ctx.wageType}`)}` : ''}` : null,
    ctx.district,
    parentNote(ctx.jobStatus, t, 'jobStatus'),
  ]);
  const seen = status === 'applied' && ctx.viewed;
  const chipLabel = seen ? t('context.viewed') : t(`context.applicationStatus.${status}`);
  const chipTone: Tone = seen ? 'gold' : APPLICATION_TONE[status];

  // Employer inline actions (the applicant side gets none -- the prompt scopes
  // application actions to the employer). Only while the application is live.
  const actions: ActionDef[] = [];
  if (
    ctx.viewerRole === 'employer' &&
    entityId &&
    (status === 'applied' || status === 'shortlisted')
  ) {
    if (status === 'applied') {
      actions.push({
        key: 'shortlist',
        label: t('actions.shortlist'),
        variant: 'default',
        run: () => setApplicationStatus(entityId, 'shortlisted'),
        newStatus: 'shortlisted',
      });
    }
    actions.push({
      key: 'accept',
      label: t('actions.accept'),
      variant: 'primary',
      confirm: t('actions.confirmAcceptApplication'),
      run: () => acceptApplication(entityId),
      newStatus: 'accepted',
    });
    actions.push({
      key: 'reject',
      label: t('actions.reject'),
      variant: 'danger',
      confirm: t('actions.confirmReject'),
      run: () => setApplicationStatus(entityId, 'declined'),
      newStatus: 'declined',
    });
  }

  const onActed = (next: AnyStatus) => {
    setOverride(next as ApplicationStatus);
    patchThreadStatus(qc, thread._id, next);
  };

  return (
    <CardFrame>
      <MainRow
        href={`/connect/jobs/${ctx.jobId}`}
        ariaLabel={t('context.viewJobAria', { title: ctx.title })}
      >
        <Thumb image={ctx.companyLogo} icon={Briefcase} accent={GOLD} />
        <Body eyebrow={t('context.application')} title={ctx.title} meta={meta} accent={GOLD} />
        <StatusChip label={chipLabel} tone={chipTone} />
        <Cue />
      </MainRow>
      {ctx.viewerRole === 'employer' && ctx.applicant && (
        <ApplicantSnapshot snap={ctx.applicant} t={t} />
      )}
      <CardActions actions={actions} t={t} onActed={onActed} />
    </CardFrame>
  );
}

type Quote = Extract<InboxThreadContext, { kind: 'quote' }>;
function QuoteCard({
  thread,
  ctx,
  t,
}: {
  thread: InboxThread;
  ctx: Quote;
  t: ReturnType<typeof useTranslations>;
}) {
  const qc = useQueryClient();
  const [override, setOverride] = useState<QuoteStatus | null>(null);
  const status = override ?? ctx.status;
  const entityId = thread.contextEntityId;

  const price = ctx.price != null ? formatRupees(ctx.price) : null;
  const qty = ctx.quantity != null ? `${ctx.quantity}${ctx.unit ? ` ${ctx.unit}` : ''}` : null;
  const budget = rupeeRange(ctx.budgetMin, ctx.budgetMax);
  const meta = joinMeta([
    price,
    qty ?? (price ? null : budget ? `${t('context.budget')} ${budget}` : null),
    ctx.district,
    parentNote(ctx.rfqStatus, t, 'rfqStatus'),
  ]);

  const live = status === 'sent' || status === 'shortlisted';
  const actions: ActionDef[] = [];
  if (ctx.viewerRole === 'buyer' && entityId && live) {
    if (status === 'sent') {
      actions.push({
        key: 'shortlist',
        label: t('actions.shortlist'),
        variant: 'default',
        run: () => shortlistQuote(entityId),
        newStatus: 'shortlisted',
      });
    }
    actions.push({
      key: 'accept',
      label: t('actions.acceptQuote'),
      variant: 'primary',
      confirm: t('actions.confirmAcceptQuote'),
      run: () => acceptQuote(entityId),
      newStatus: 'accepted',
    });
    actions.push({
      key: 'decline',
      label: t('actions.decline'),
      variant: 'danger',
      confirm: t('actions.confirmDecline'),
      run: () => declineQuote(entityId),
      newStatus: 'declined',
    });
  } else if (ctx.viewerRole === 'supplier' && entityId && live) {
    // "Update quote" is a structured form -> navigate to the RFQ composer.
    actions.push({
      key: 'update',
      label: t('actions.updateQuote'),
      variant: 'default',
      href: `/connect/rfq/${ctx.rfqId}`,
    });
    actions.push({
      key: 'withdraw',
      label: t('actions.withdraw'),
      variant: 'danger',
      confirm: t('actions.confirmWithdraw'),
      run: () => withdrawQuote(entityId),
      newStatus: 'withdrawn',
    });
  }

  const onActed = (next: AnyStatus) => {
    setOverride(next as QuoteStatus);
    patchThreadStatus(qc, thread._id, next);
  };

  return (
    <CardFrame>
      <MainRow
        href={`/connect/rfq/${ctx.rfqId}`}
        ariaLabel={t('context.viewRfqAria', { title: ctx.title })}
      >
        <Thumb image={ctx.sampleImage} icon={ReceiptText} accent={GOLD} />
        <Body eyebrow={t('context.quote')} title={ctx.title} meta={meta} accent={GOLD} />
        <StatusChip label={t(`context.quoteStatus.${status}`)} tone={QUOTE_TONE[status]} />
        <Cue />
      </MainRow>
      <CardActions actions={actions} t={t} onActed={onActed} />
    </CardFrame>
  );
}

type CandidateRequest = Extract<InboxThreadContext, { kind: 'candidate_request' }>;
/**
 * CandidateRequestCard (Institutes Phase 2, Feature 4): the institute-bound
 * "Hire our trained candidates" lead. The subject is the INSTITUTE page (logo +
 * name), the title reads "Hire our trained candidates", and the meta line shows
 * who sent it + the message snippet. The whole row deep-links to the institute
 * page (/connect/company/[pageSlug]) when the slug is known; a deleted page
 * (pageSlug null) renders the same card WITHOUT the link (no broken navigation).
 * No inline actions: a hire lead is a conversation, so the owner just replies in
 * the thread below. Cross-module: subject hydrated by inbox.service
 * `hydrateContexts` (candidate_request branch); deep-link target is the public
 * company page (CompanyPageView). The status chip maps the BE
 * sent/viewed/replied/archived lifecycle.
 */
function CandidateRequestCard({
  ctx,
  t,
}: {
  ctx: CandidateRequest;
  t: ReturnType<typeof useTranslations>;
}) {
  // Sender + snippet on the meta line; the institute name is the subject title.
  const meta = joinMeta([
    ctx.fromUserName ? t('context.candidateRequest.fromLabel', { name: ctx.fromUserName }) : null,
    ctx.messageSnippet || null,
  ]);
  const body = (
    <>
      <Thumb image={ctx.pageLogo} icon={GraduationCap} accent={GOLD} />
      <Body
        eyebrow={t('context.candidateRequest.title')}
        title={ctx.pageName}
        meta={meta}
        accent={GOLD}
      />
      <StatusChip
        label={t(`context.candidateRequest.status.${ctx.status}`)}
        tone={CANDIDATE_REQUEST_TONE[ctx.status]}
      />
    </>
  );
  // Deleted-entity safety: no slug -> render the card without the deep-link (a
  // static row, no Cue), so a removed institute page never yields a dead link.
  if (!ctx.pageSlug) {
    return (
      <CardFrame>
        <div style={mainRowStyle} role="note">
          {body}
        </div>
      </CardFrame>
    );
  }
  return (
    <CardFrame>
      <MainRow
        href={`/connect/company/${ctx.pageSlug}`}
        ariaLabel={t('context.candidateRequest.viewInstituteAria', { name: ctx.pageName })}
      >
        {body}
        <Cue />
      </MainRow>
    </CardFrame>
  );
}

// ── Employer-only applicant snapshot ─────────────────────────────────────────

type Snap = NonNullable<Application['applicant']>;
function ApplicantSnapshot({ snap, t }: { snap: Snap; t: ReturnType<typeof useTranslations> }) {
  const top = snap.matchedSkills.slice(0, 3);
  const hasAny = snap.headline || top.length > 0 || snap.district || snap.pastApplicant;
  if (!hasAny) return null;
  return (
    <div style={snapshotStyle}>
      {snap.headline && (
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: 'var(--cr-text-2)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {snap.headline}
        </span>
      )}
      <span
        style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 3 }}
      >
        {top.map((s) => (
          <span key={s} style={skillChipStyle}>
            {s}
          </span>
        ))}
        {snap.matchedSkills.length > 0 && snap.jobSkillCount > 0 && (
          <span style={{ fontSize: 11, color: 'var(--cr-text-4)' }}>
            {t('snapshot.skills', {
              matched: snap.matchedSkills.length,
              total: snap.jobSkillCount,
            })}
          </span>
        )}
        {snap.district && (
          <span style={{ fontSize: 11, color: 'var(--cr-text-4)' }}>{snap.district}</span>
        )}
        {snap.pastApplicant && (
          <span style={pastBadgeStyle}>
            <History size={11} aria-hidden />
            {t('snapshot.pastApplicant')}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Inline role-gated actions ────────────────────────────────────────────────

interface ActionDef {
  key: string;
  label: string;
  variant: 'primary' | 'danger' | 'default';
  /** A confirm prompt for consequential actions; omit for light ones (shortlist). */
  confirm?: string;
  /** Navigate instead of mutate (supplier "Update quote" -> the RFQ composer). */
  href?: string;
  run?: () => Promise<{ ok: boolean; error?: string }>;
  newStatus?: AnyStatus;
}

function CardActions({
  actions,
  t,
  onActed,
}: {
  actions: ActionDef[];
  t: ReturnType<typeof useTranslations>;
  onActed: (next: AnyStatus) => void;
}) {
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (actions.length === 0) return null;

  const run = async (a: ActionDef) => {
    if (!a.run) return;
    setPendingKey(a.key);
    setError(null);
    try {
      const res = await a.run();
      if (res.ok) {
        setConfirmKey(null);
        if (a.newStatus) onActed(a.newStatus);
      } else {
        setError(res.error || t('actions.failed'));
      }
    } catch {
      setError(t('actions.failed'));
    } finally {
      setPendingKey(null);
    }
  };

  const confirming = actions.find((a) => a.key === confirmKey);

  return (
    <div style={actionsRowStyle}>
      {confirming ? (
        <>
          <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: 'var(--cr-text-2)' }}>
            {confirming.confirm}
          </span>
          <button
            type="button"
            style={btnStyle(confirming.variant === 'danger' ? 'danger' : 'primary')}
            disabled={!!pendingKey}
            onClick={() => void run(confirming)}
          >
            {pendingKey ? t('actions.working') : t('actions.yes')}
          </button>
          <button type="button" style={btnStyle('default')} onClick={() => setConfirmKey(null)}>
            {t('actions.cancel')}
          </button>
        </>
      ) : (
        <>
          {actions.map((a) =>
            a.href ? (
              <Link key={a.key} href={a.href} className="no-underline" style={btnStyle(a.variant)}>
                {a.label}
              </Link>
            ) : (
              <button
                key={a.key}
                type="button"
                style={btnStyle(a.variant)}
                disabled={!!pendingKey}
                onClick={() => (a.confirm ? setConfirmKey(a.key) : void run(a))}
              >
                {pendingKey === a.key ? t('actions.working') : a.label}
              </button>
            ),
          )}
          {error && (
            <span role="alert" style={{ fontSize: 11.5, color: 'var(--cr-error)' }}>
              {error}
            </span>
          )}
        </>
      )}
    </div>
  );
}

// ── Shared pieces ────────────────────────────────────────────────────────────

/** The outer card chrome (border + bg). The subject row inside is the tap link. */
function CardFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="cn-context-card" style={frameStyle}>
      {children}
    </div>
  );
}

/** The subject row -- one focusable tap target to the listing / job / RFQ. */
function MainRow({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className="cn-context-card-main no-underline"
      style={mainRowStyle}
    >
      {children}
    </Link>
  );
}

/** System / deleted-entity fallback: icon tile + eyebrow only, no name, no link. */
function LeanCard({ icon: Icon, label, accent }: { icon: IconCmp; label: string; accent: string }) {
  return (
    <div style={{ ...frameStyle, ...mainRowStyle }} role="note">
      <span aria-hidden style={{ ...iconTileStyle, background: accent }}>
        <Icon size={17} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={eyebrowStyle(accent)}>{label}</span>
      </span>
    </div>
  );
}

function Thumb({
  image,
  icon: Icon,
  accent,
}: {
  image: string | null;
  icon: IconCmp;
  accent: string;
}) {
  if (image) {
    return (
      <span
        aria-hidden
        style={{
          ...thumbStyle,
          background: `center / cover no-repeat url(${JSON.stringify(image)})`,
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        ...thumbStyle,
        display: 'grid',
        placeItems: 'center',
        color: '#fff',
        background: accent,
      }}
    >
      <Icon size={18} />
    </span>
  );
}

function Body({
  eyebrow,
  title,
  meta,
  accent,
}: {
  eyebrow: string;
  title: string;
  meta: string | null;
  accent: string;
}) {
  return (
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={eyebrowStyle(accent)}>{eyebrow}</span>
      <span
        style={{
          display: 'block',
          marginTop: 1,
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--cr-text)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
      {meta && (
        <span
          style={{
            display: 'block',
            fontSize: 12,
            color: 'var(--cr-text-3)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {meta}
        </span>
      )}
    </span>
  );
}

function StatusChip({ label, tone }: { label: string; tone: Tone }) {
  const c = TONE[tone];
  return (
    <span
      style={{
        flex: '0 0 auto',
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.02em',
        padding: '2px 7px',
        borderRadius: 'var(--cr-radius-full, 999px)',
        color: c.fg,
        background: c.bg,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

/** The trailing tap affordance (the whole subject row is the link; this is the cue). */
function Cue() {
  return (
    <ChevronRight size={16} aria-hidden style={{ flex: '0 0 auto', color: 'var(--cr-text-4)' }} />
  );
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Patch the selected thread's context.status across the cached thread lists so
 *  the chip + list row reflect an inline action without a full refetch. */
function patchThreadStatus(
  qc: ReturnType<typeof useQueryClient>,
  threadId: string,
  status: AnyStatus,
): void {
  for (const channel of ['all', 'application', 'quote']) {
    qc.setQueryData<InboxThread[] | undefined>(inboxKeys.threads(channel), (old) =>
      old?.map((th) =>
        th._id === threadId && th.context && 'status' in th.context
          ? ({ ...th, context: { ...th.context, status } } as InboxThread)
          : th,
      ),
    );
  }
}

/** A rupee single value / range / null (both bounds missing). */
function rupeeRange(min: number | null, max: number | null): string | null {
  if (min != null && max != null && max > min) return `${formatRupees(min)} - ${formatRupees(max)}`;
  if (min != null) return formatRupees(min);
  return null;
}

/** Join the non-empty meta parts with a middot. */
function joinMeta(parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => !!p);
  return kept.length ? kept.join(' · ') : null;
}

/** A muted "Job closed / filled" / "RFQ awarded / closed" parent-lifecycle note,
 *  only when the parent is NOT open. */
function parentNote(
  status: JobStatus | RfqStatus,
  t: ReturnType<typeof useTranslations>,
  group: 'jobStatus' | 'rfqStatus',
): string | null {
  if (status === 'open') return null;
  return t(`context.${group}.${status}`);
}

const eyebrowStyle = (accent: string): React.CSSProperties => ({
  display: 'block',
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: accent,
});

function btnStyle(variant: 'primary' | 'danger' | 'default'): React.CSSProperties {
  const base: React.CSSProperties = {
    flex: '0 0 auto',
    fontSize: 12,
    fontWeight: 600,
    padding: '5px 11px',
    borderRadius: 'var(--cr-radius-full, 999px)',
    cursor: 'pointer',
    border: '1px solid var(--cr-border)',
    background: 'var(--cr-surface)',
    color: 'var(--cr-text-2)',
    lineHeight: 1.2,
  };
  if (variant === 'primary') {
    return {
      ...base,
      background: 'var(--cr-primary)',
      borderColor: 'var(--cr-primary)',
      color: '#fff',
    };
  }
  if (variant === 'danger') {
    return { ...base, color: '#b23a2a', borderColor: 'rgba(192, 57, 43, 0.4)' };
  }
  return base;
}

const thumbStyle: React.CSSProperties = {
  width: 46,
  height: 46,
  flex: '0 0 auto',
  borderRadius: 8,
  background: 'var(--cr-surface-2)',
};

const iconTileStyle: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 9,
  flex: '0 0 auto',
  display: 'grid',
  placeItems: 'center',
  color: '#fff',
};

const skillChipStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '1px 7px',
  borderRadius: 'var(--cr-radius-full, 999px)',
  color: '#1c7c4a',
  background: 'rgba(28, 124, 74, 0.13)',
  whiteSpace: 'nowrap',
};

const pastBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 11,
  fontWeight: 600,
  color: '#8a6512',
};

const frameStyle: React.CSSProperties = {
  // No side margin: the conversation pane centers the card in the shared column.
  margin: '10px 0 0',
  background: 'var(--cr-surface)',
  border: '1px solid var(--cr-border-light)',
  borderRadius: 'var(--cr-radius-md)',
  boxShadow: '0 1px 2px rgba(40, 30, 10, 0.05)',
  color: 'inherit',
};

const mainRowStyle: React.CSSProperties = {
  padding: '9px 12px',
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  color: 'inherit',
};

const snapshotStyle: React.CSSProperties = {
  padding: '7px 12px 0',
  borderTop: '1px solid var(--cr-border-light)',
  marginTop: 2,
};

const actionsRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
  padding: '9px 12px',
};
