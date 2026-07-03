'use client';

/**
 * `BrokerReviews` - the VISITOR display for a broker's verified-but-anonymous
 * reviews (Slice 3wA). Renders a PROOF-LED header (confirmed introductions +
 * distinct people + review count, stars secondary) and a list of anonymized
 * review cards. Display-only: the write/edit/reply form lives on a confirmed
 * introduction (Slice 3wB), not here.
 *
 * Closest analog: components/connect/SellerReviews.tsx (aggregate header, honest
 * empty state, guest login-gate via `lockListForGuests`/`guestLocked`,
 * AntApp.useApp() toasts, useAuthStore current-user). The "Verified introduction"
 * pill copies the confirmed-credential BadgeCheck visual from ProfileView's
 * TrainingList. Data comes from getBrokerPublicProfile (the @Public BE route).
 *
 * Cross-module: mounted in features/connect/profile/ProfileView.tsx only when
 * profile.isBroker; the proof counts come live from the introductions module
 * (confirmed, non-deleted intros) via the broker-reviews service aggregate.
 * Keep in sync with broker-reviews.types.ts + the BE getPublicBrokerProfile shape.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { App as AntApp, Input } from 'antd';
import { BadgeCheck, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import RatingStars from '@/components/connect/RatingStars';
import { InfoTooltip } from '@/components/ui';
import {
  getBrokerPublicProfile,
  replyBrokerReview,
} from '@/features/connect/broker-reviews/broker-reviews.actions';
import type {
  PublicBrokerProfile,
  PublicBrokerReviewCard,
} from '@/features/connect/broker-reviews/broker-reviews.types';

interface BrokerReviewsProps {
  /** The broker being reviewed (a canonical `User` id). */
  brokerUserId: string;
  /**
   * Login-gate the review LIST for a logged-out viewer (mirrors SellerReviews,
   * owner decision 2026-06-10). When the viewer is a guest the individual review
   * cards are not shown - only the proof header (social proof stays public) plus
   * a sign-in prompt. Default true so the public profile gates the cards.
   */
  lockListForGuests?: boolean;
  /**
   * True when the viewer is the profile owner (the reviewed broker). Unlocks the
   * owner-only "Reply" affordance on each card that has no reply yet (the BE
   * allows exactly one reply per review). ProfileView passes its own `isOwner`.
   * Visitors (non-owners) see the read-only display unchanged.
   */
  isOwner?: boolean;
}

export default function BrokerReviews({
  brokerUserId,
  lockListForGuests = true,
  isOwner = false,
}: BrokerReviewsProps) {
  const t = useTranslations('connect.brokerReviews');
  const format = useFormatter();
  // Toast the reply outcome (owner reply affordance, Slice 3wB write); the
  // provider must be present even on a read-only render.
  const { message } = AntApp.useApp();

  const currentUserId = useAuthStore((s) => s.user?._id ?? null);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  // A logged-out viewer on a gated host. Decided post-hydration so the cards
  // never flash for a guest (same stance as SellerReviews).
  const guestLocked = lockListForGuests && isHydrated && !currentUserId;

  const [data, setData] = useState<PublicBrokerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Refetch the proof-led profile in place (no spinner flash). Reused by the
  // owner's reply affordance so a posted reply shows immediately.
  const reload = useCallback(async () => {
    const res = await getBrokerPublicProfile(brokerUserId);
    if (res.ok) setData(res.data);
  }, [brokerUserId]);

  useEffect(() => {
    // Wait for hydration so we know whether the viewer is a guest before
    // deciding to fetch the gated cards. A gated guest skips the fetch entirely;
    // the render checks `guestLocked` before `loading` so no mount spinner shows.
    if (!isHydrated) return;
    if (guestLocked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot flip; render gates on guestLocked first
      setLoading(false);
      return;
    }
    let live = true;
    void getBrokerPublicProfile(brokerUserId).then((res) => {
      if (!live) return;
      if (res.ok) setData(res.data);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [isHydrated, guestLocked, brokerUserId]);

  const aggregate = data?.aggregate;
  const reviews = data?.reviews ?? [];
  const hasProof = !!aggregate && aggregate.introductionsConfirmed > 0;

  return (
    <section aria-label={t('title')} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Proof-led header: lead with confirmed introductions + reviews, then a
          "100% from verified introductions" trust line, then the star average
          (secondary). A "Why is this private?" explainer sits by the title. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('title')}
          </h3>
          <InfoTooltip text={t('whyPrivate.title')} body={t('whyPrivate.body')} />
        </span>

        {/* Always-visible privacy caption under the header so a visitor is reassured
            even without opening the "Why is this private?" tooltip (which keeps the
            longer explanation). Kept short to avoid duplicating the tooltip body.
            Keep in sync with the introductions privacy callout + the review modal note. */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: 6,
            fontSize: 12.5,
            lineHeight: 1.5,
            color: 'var(--cr-text-3, #6b7280)',
          }}
        >
          <ShieldCheck size={14} aria-hidden style={{ marginTop: 2, flexShrink: 0 }} />
          {t('privacyCaption')}
        </span>

        {hasProof ? (
          <>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-text-2)' }}>
              {t('proofLine', {
                count: aggregate.introductionsConfirmed,
                reviews: aggregate.ratingCount,
              })}
            </span>
            <span style={{ fontSize: 13, color: 'var(--cr-text-3, #6b7280)' }}>
              {t('verifiedLine', { people: aggregate.distinctPeople })}
            </span>
            {aggregate.ratingCount > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--cr-text)' }}>
                  {aggregate.ratingAvg.toFixed(1)}
                </span>
                <RatingStars value={aggregate.ratingAvg} size={15} />
              </span>
            )}
          </>
        ) : (
          !loading &&
          !guestLocked && (
            <span style={{ fontSize: 13, color: 'var(--cr-text-4, #9ca3af)' }}>{t('noProof')}</span>
          )
        )}
      </div>

      {/* List - login-gated for a guest on a gated host: the proof header above
          stays visible, the cards are replaced by a sign-in prompt. */}
      {guestLocked ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 8,
            padding: 14,
            borderRadius: 'var(--cr-radius-md, 10px)',
            border: '1px solid var(--cr-border-light, #e5e7eb)',
            background: 'var(--cr-surface-2, #f9fafb)',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cr-text-2)',
            }}
          >
            <Lock size={14} aria-hidden />
            {t('signInToRead')}
          </span>
          <Link
            href="/connect"
            className="no-underline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '6px 14px',
              borderRadius: 'var(--cr-radius-full, 999px)',
              fontSize: 12.5,
              fontWeight: 600,
              background: 'var(--cr-primary)',
              color: '#ffffff',
            }}
          >
            {t('signInCta')}
          </Link>
        </div>
      ) : loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Loader2 className="animate-spin" size={20} aria-label={t('loading')} />
        </div>
      ) : reviews.length > 0 ? (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {reviews.map((r) => (
            <BrokerReviewCard
              key={r._id}
              review={r}
              format={format}
              t={t}
              isOwner={isOwner}
              onReplied={reload}
              message={message}
            />
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--cr-text-4, #9ca3af)' }}>{t('empty')}</p>
      )}
    </section>
  );
}

/**
 * One anonymized broker-review card. Shows initials (anonymous) OR the name
 * (named opt-in) + the role label (+ city when present) on the identity line,
 * a read-only star rating, the text, the "Verified introduction" pill (the
 * confirmed-credential BadgeCheck visual from TrainingList), an optional broker
 * reply, and a date. NEVER renders a reviewer id - the card payload omits it.
 *
 * Owner-only: when `isOwner` and the card has no reply yet, a compact reply box
 * (textarea + Send) calls replyBrokerReview(_id) then `onReplied` to refetch.
 * The BE allows exactly one reply, so a replied card just shows the reply (no
 * edit). Visitors never see the reply box.
 */
function BrokerReviewCard({
  review,
  format,
  t,
  isOwner,
  onReplied,
  message,
}: {
  review: PublicBrokerReviewCard;
  format: ReturnType<typeof useFormatter>;
  t: ReturnType<typeof useTranslations>;
  isOwner: boolean;
  onReplied: () => void | Promise<void>;
  message: ReturnType<typeof AntApp.useApp>['message'];
}) {
  // A named card leads with the name; an anonymous card leads with the initials
  // digest (e.g. "R.P."), falling back to a generic "Member" when initials are
  // absent. The role label localizes buyer/seller; city appears only when the BE
  // kept it (thin-market coarsening drops a unique tuple's city).
  const display = review.name ?? review.initials ?? t('anonymous');
  const roleLabel = t(`role.${review.role}`);

  // Owner reply affordance: shown only when this card has no reply yet.
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);
  const sendReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    setReplying(true);
    const res = await replyBrokerReview(review._id, text);
    setReplying(false);
    if (!res.ok) {
      message.error(res.error);
      return;
    }
    message.success(t('replySuccess'));
    setReplyText('');
    await onReplied();
  };

  return (
    <li
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        paddingBottom: 14,
        borderBottom: '1px solid var(--cr-border-light, #f0f0f0)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>{display}</span>
        <span style={{ fontSize: 13, color: 'var(--cr-text-3, #6b7280)' }}>
          {review.city ? t('roleFromCity', { role: roleLabel, city: review.city }) : roleLabel}
        </span>
        <RatingStars value={review.rating} size={13} />
        {review.createdAt && (
          <span style={{ fontSize: 12, color: 'var(--cr-text-4, #9ca3af)' }}>
            {format.dateTime(new Date(review.createdAt), { dateStyle: 'medium' })}
          </span>
        )}
      </div>

      {/* Verified-introduction pill - same BadgeCheck + success-token visual as
          the "Confirmed by [Institute]" credential pill in TrainingList. */}
      <span
        className="inline-flex items-center gap-1 text-[12px] font-semibold"
        style={{
          alignSelf: 'flex-start',
          padding: '2px 9px',
          borderRadius: 'var(--cr-radius-full)',
          background: 'var(--cr-success-light, var(--cr-primary-light))',
          color: 'var(--cr-success, var(--cr-primary))',
        }}
      >
        <BadgeCheck size={13} aria-hidden />
        {t('verifiedPill')}
      </span>

      {review.text && (
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: 'var(--cr-text-2)',
            whiteSpace: 'pre-wrap',
          }}
        >
          {review.text}
        </p>
      )}

      {/* Broker's single reply (when present) - a distinct indented block so it
          reads as the broker answering the reviewer. */}
      {review.brokerReply && (
        <div
          style={{
            marginTop: 2,
            padding: '8px 12px',
            borderRadius: 'var(--cr-radius-md, 10px)',
            background: 'var(--cr-surface-2, #f9fafb)',
            borderInlineStart: '3px solid var(--cr-border, #d4d4d8)',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--cr-text-3, #6b7280)' }}>
            {t('brokerReply')}
          </div>
          <p
            style={{
              margin: '2px 0 0',
              fontSize: 13,
              color: 'var(--cr-text-2)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {review.brokerReply.text}
          </p>
        </div>
      )}

      {/* Owner-only reply box - only on a card with no reply yet (one reply max,
          enforced BE-side). Calls replyBrokerReview then refetches the profile. */}
      {isOwner && !review.brokerReply && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Input.TextArea
            value={replyText}
            maxLength={1000}
            rows={2}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t('replyPlaceholder')}
            aria-label={t('replyLabel')}
          />
          <DsButton
            dsVariant="ghost"
            dsSize="sm"
            loading={replying}
            disabled={!replyText.trim()}
            onClick={sendReply}
            style={{ alignSelf: 'flex-start' }}
          >
            {t('replySend')}
          </DsButton>
        </div>
      )}
    </li>
  );
}
