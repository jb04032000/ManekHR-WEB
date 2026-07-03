'use client';

/**
 * `SellerReviews` - the full reviews & ratings block for a seller (marketplace
 * Phase C, R3). Renders the aggregate header, the public review list (with the
 * reviewer's identity + a report action), and - for a signed-in member who is
 * NOT the seller - an inline write / edit / delete form. One self-contained
 * client component reused by the profile page, the company page Reviews tab,
 * and the listing detail page.
 *
 * Person-centric: a buyer rates a seller by `subjectUserId`; the reviewer is
 * always the JWT subject (never sent in the body). Self-review is blocked
 * BE-side and the form is hidden for the seller themselves.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations, useFormatter } from 'next-intl';
import { App as AntApp } from 'antd';
import { Flag, Loader2, Lock } from 'lucide-react';
import { useAuthStore } from '@/lib/store';
import DsButton from '@/components/ui/DsButton';
import RatingStars from '@/components/connect/RatingStars';
import {
  deleteReview,
  getMyReview,
  getSellerReviews,
  reportReview,
  upsertReview,
} from '@/features/connect/reviews/reviews.actions';
import type {
  ConnectReview,
  MyReview,
  RatingAggregate,
  ReviewAuthor,
  SellerReviewsPage,
} from '@/features/connect/reviews/reviews.types';

interface SellerReviewsProps {
  /** The seller being reviewed (a `User` id). */
  subjectUserId: string;
  /** Seller display name - used in the "Review {name}" affordance. */
  subjectName?: string;
  /** Server-fetched aggregate from the host read (optional warm start). */
  initialAggregate?: RatingAggregate;
  /**
   * Login-gate the review LIST for a logged-out viewer (public profile, owner
   * decision 2026-06-10). When set and the viewer is a guest, the individual
   * reviews are not fetched or shown -- only the aggregate (star average) plus a
   * sign-in prompt. The aggregate stays public as social proof. Default false so
   * the other public hosts (company page, listing detail) are unaffected.
   */
  lockListForGuests?: boolean;
}

const MAX_LEN = 1000;

function authorOf(r: ConnectReview): ReviewAuthor | null {
  return r.reviewerUserId && typeof r.reviewerUserId === 'object' ? r.reviewerUserId : null;
}

function initial(name?: string): string {
  return (name?.trim()?.[0] ?? '?').toUpperCase();
}

export default function SellerReviews({
  subjectUserId,
  subjectName,
  initialAggregate,
  lockListForGuests = false,
}: SellerReviewsProps) {
  const t = useTranslations('connect.reviews');
  const format = useFormatter();
  const { message } = AntApp.useApp();

  const currentUserId = useAuthStore((s) => s.user?._id ?? null);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const isOwner = !!currentUserId && currentUserId === subjectUserId;
  const canReview = isHydrated && !!currentUserId && !isOwner;
  // A logged-out viewer on a host that gates the list (the public profile). We
  // wait for hydration before deciding so the list never flashes for a guest.
  const guestLocked = lockListForGuests && isHydrated && !currentUserId;

  const [page, setPage] = useState<SellerReviewsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [myReview, setMyReview] = useState<MyReview | null>(null);

  // Inline form state.
  const [formOpen, setFormOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    // No synchronous setState before the first await: `loading` starts true for
    // the mount spinner, and a post-write reload updates in place (no flash).
    const res = await getSellerReviews(subjectUserId);
    if (res.ok) setPage(res.data);
    setLoading(false);
  }, [subjectUserId]);

  useEffect(() => {
    // Wait until the auth store hydrates so we know whether the viewer is a
    // guest before deciding to fetch (the list is login-gated when
    // `lockListForGuests`). A guest on a gated host skips the fetch entirely --
    // the render checks `guestLocked` before `loading`, so the mount spinner
    // never shows and we need not touch state here.
    if (!isHydrated || guestLocked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount fetch; setState lands post-await
    void load();
  }, [isHydrated, guestLocked, load]);

  useEffect(() => {
    // All `myReview`-dependent UI (write button, form, delete) is gated on
    // `canReview`, so a stale value after logout never surfaces - no reset needed.
    if (!canReview) return;
    let live = true;
    void getMyReview(subjectUserId).then((res) => {
      if (live && res.ok) setMyReview(res.data);
    });
    return () => {
      live = false;
    };
  }, [canReview, subjectUserId]);

  const openForm = useCallback(() => {
    setRating(myReview?.rating ?? 0);
    setText(myReview?.text ?? '');
    setFormOpen(true);
  }, [myReview]);

  const submit = useCallback(async () => {
    if (rating < 1) {
      message.warning(t('ratingRequired'));
      return;
    }
    setSubmitting(true);
    const res = await upsertReview({ subjectUserId, rating, text: text.trim() || undefined });
    setSubmitting(false);
    if (!res.ok) {
      message.error(res.error);
      return;
    }
    message.success(t('submitSuccess'));
    setMyReview(res.data);
    setFormOpen(false);
    await load();
  }, [rating, text, subjectUserId, message, t, load]);

  const remove = useCallback(async () => {
    setSubmitting(true);
    const res = await deleteReview(subjectUserId);
    setSubmitting(false);
    if (!res.ok) {
      message.error(res.error);
      return;
    }
    message.success(t('deleteSuccess'));
    setMyReview(null);
    setFormOpen(false);
    await load();
  }, [subjectUserId, message, t, load]);

  const report = useCallback(
    async (reviewId: string) => {
      const res = await reportReview(reviewId);
      if (res.ok) message.success(t('reportSuccess'));
      else message.error(res.error);
    },
    [message, t],
  );

  const loadMore = useCallback(async () => {
    if (!page?.nextCursor) return;
    setLoadingMore(true);
    const res = await getSellerReviews(subjectUserId, page.nextCursor);
    setLoadingMore(false);
    if (res.ok) {
      setPage((prev) =>
        prev
          ? {
              ...res.data,
              // Cursor pages omit the star distribution (first-page-only on the
              // backend) - keep the one we already have so the bars never vanish.
              distribution: res.data.distribution ?? prev.distribution,
              reviews: [...prev.reviews, ...res.data.reviews],
            }
          : res.data,
      );
    }
  }, [page, subjectUserId]);

  const aggregate = page?.aggregate ?? initialAggregate ?? { ratingAvg: 0, ratingCount: 0 };
  const hasReviews = aggregate.ratingCount > 0;
  const distribution = page?.distribution;

  return (
    <section aria-label={t('title')} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header: aggregate + write button */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--cr-text)' }}>
            {t('title')}
          </h3>
          {hasReviews ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--cr-text)' }}>
                {aggregate.ratingAvg.toFixed(1)}
              </span>
              <RatingStars value={aggregate.ratingAvg} size={16} />
              <span style={{ fontSize: 13, color: 'var(--cr-text-3, #6b7280)' }}>
                {t('totalReviews', { count: aggregate.ratingCount })}
              </span>
            </span>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--cr-text-4, #9ca3af)' }}>
              {t('noReviews')}
            </span>
          )}
        </div>
        {canReview && !formOpen && (
          <DsButton dsVariant="ghost" dsSize="sm" onClick={openForm}>
            {myReview ? t('editReview') : t('writeReview')}
          </DsButton>
        )}
      </div>

      {/* Score panel: big average + per-star bars (prototype "Buyer reviews"
          anatomy). Real counts from the backend distribution; hidden while the
          first page loads or when the seller is unrated. */}
      {hasReviews && distribution && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 22,
            padding: 14,
            borderRadius: 'var(--cr-radius-md, 10px)',
            border: '1px solid var(--cr-border-light, #e5e7eb)',
            background: 'var(--cr-surface-2, #f9fafb)',
          }}
        >
          <div style={{ textAlign: 'center', flex: 'none' }}>
            <div
              style={{
                fontSize: 34,
                fontWeight: 800,
                lineHeight: 1,
                color: 'var(--cr-text)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {aggregate.ratingAvg.toFixed(1)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
              <RatingStars value={aggregate.ratingAvg} size={14} />
            </div>
            <div style={{ fontSize: 11, color: 'var(--cr-text-4, #9ca3af)', marginTop: 4 }}>
              {t('totalReviews', { count: aggregate.ratingCount })}
            </div>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
            }}
          >
            {(['5', '4', '3', '2', '1'] as const).map((star) => {
              const count = distribution[star] ?? 0;
              const pct = aggregate.ratingCount > 0 ? (count / aggregate.ratingCount) * 100 : 0;
              return (
                <div
                  key={star}
                  role="img"
                  aria-label={t('starBarAria', { star: Number(star), count })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    fontSize: 11,
                    color: 'var(--cr-text-4, #9ca3af)',
                  }}
                >
                  <span
                    aria-hidden
                    style={{ width: 26, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {star}&#9733;
                  </span>
                  <span
                    aria-hidden
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: 'var(--cr-border-light, #e5e7eb)',
                      overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block',
                        height: '100%',
                        width: `${pct}%`,
                        background: 'var(--cr-gold-500, #c9a227)',
                      }}
                    />
                  </span>
                  <span aria-hidden style={{ width: 24, fontVariantNumeric: 'tabular-nums' }}>
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inline write / edit form */}
      {canReview && formOpen && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 'var(--cr-radius-md, 10px)',
            border: '1px solid var(--cr-border-light, #e5e7eb)',
            background: 'var(--cr-surface-2, #f9fafb)',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {subjectName ? t('rateNamed', { name: subjectName }) : t('rating')}
          </span>
          <RatingStars
            value={rating}
            interactive
            onSelect={setRating}
            label={t('rating')}
            size={20}
          />
          <textarea
            value={text}
            maxLength={MAX_LEN}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('commentPlaceholder')}
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              padding: '8px 10px',
              fontSize: 14,
              borderRadius: 'var(--cr-radius-sm, 8px)',
              border: '1px solid var(--cr-border, #d4d4d8)',
              background: 'var(--cr-surface, #fff)',
              color: 'var(--cr-text)',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <DsButton dsVariant="primary" dsSize="sm" loading={submitting} onClick={submit}>
              {t('submit')}
            </DsButton>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              disabled={submitting}
              onClick={() => setFormOpen(false)}
            >
              {t('cancel')}
            </DsButton>
            {myReview && (
              <DsButton
                dsVariant="danger"
                dsSize="sm"
                disabled={submitting}
                onClick={remove}
                style={{ marginLeft: 'auto' }}
              >
                {t('deleteReview')}
              </DsButton>
            )}
          </div>
        </div>
      )}

      {/* List -- login-gated for a guest on a gated host (the public profile):
          show a sign-in prompt instead of fetching/rendering the reviews. The
          aggregate header above stays visible as public social proof. */}
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
      ) : page && page.reviews.length > 0 ? (
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
          {page.reviews.map((r) => {
            const author = authorOf(r);
            const ownReview = !!currentUserId && author?._id === currentUserId;
            return (
              <li
                key={r._id}
                style={{
                  display: 'flex',
                  gap: 12,
                  paddingBottom: 14,
                  borderBottom: '1px solid var(--cr-border-light, #f0f0f0)',
                }}
              >
                {author?.profilePicture ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={author.profilePicture}
                    alt={author.name ?? ''}
                    width={36}
                    height={36}
                    style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                  />
                ) : (
                  <span
                    aria-hidden
                    style={{
                      width: 36,
                      height: 36,
                      flexShrink: 0,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      background: 'var(--cr-surface-2, #eef2ff)',
                      color: 'var(--cr-primary, #4f46e5)',
                      fontWeight: 700,
                      fontSize: 15,
                    }}
                  >
                    {initial(author?.name)}
                  </span>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cr-text)' }}>
                      {author?.name ?? t('anonymous')}
                    </span>
                    <RatingStars value={r.rating} size={13} />
                    {r.createdAt && (
                      <span style={{ fontSize: 12, color: 'var(--cr-text-4, #9ca3af)' }}>
                        {format.dateTime(new Date(r.createdAt), { dateStyle: 'medium' })}
                      </span>
                    )}
                  </div>
                  {r.text && (
                    <p
                      style={{
                        margin: '4px 0 0',
                        fontSize: 14,
                        color: 'var(--cr-text-2)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {r.text}
                    </p>
                  )}
                </div>
                {isHydrated && !!currentUserId && !ownReview && (
                  <button
                    type="button"
                    onClick={() => report(r._id)}
                    title={t('reportReview')}
                    aria-label={t('reportReview')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--cr-text-4, #9ca3af)',
                      padding: 4,
                      height: 'fit-content',
                    }}
                  >
                    <Flag size={15} aria-hidden />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        !canReview && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--cr-text-4, #9ca3af)' }}>
            {isHydrated && !currentUserId ? t('signInToReview') : t('beFirst')}
          </p>
        )
      )}

      {page?.nextCursor && (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          loading={loadingMore}
          onClick={loadMore}
          style={{ alignSelf: 'center' }}
        >
          {t('loadMore')}
        </DsButton>
      )}
    </section>
  );
}
