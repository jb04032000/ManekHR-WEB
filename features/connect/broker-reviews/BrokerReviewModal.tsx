'use client';

/**
 * BrokerReviewModal - the reviewer's write/edit form for a verified-but-anonymous
 * review of a broker, anchored to a CONFIRMED introduction they received (Slice
 * 3wB). An AntD v6 Modal hosting a star picker (required >= 1), an optional
 * comment, and a visibility control (stay anonymous vs show my name). On open it
 * prefills via getMyBrokerReview(introductionId) so an existing review opens in
 * edit mode; submit calls upsertBrokerReview and toasts the outcome.
 *
 * Closest analogs: the inline write form in components/connect/SellerReviews.tsx
 * (RatingStars interactive + textarea + maxLength + "rating<1 -> warn" + AntApp
 * toast) and features/connect/jobs/JobComposer.tsx (the v6 Modal shell - open,
 * destroyOnHidden, styles.body scroll).
 *
 * Cross-module: opened from features/connect/introductions/IntroductionsList.tsx
 * for one received introduction; the broker is DERIVED from the introduction
 * BE-side (the body never forges it). Keep in sync with broker-reviews.actions.ts
 * (upsertBrokerReview / getMyBrokerReview) + broker-reviews.types.ts.
 */

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { App as AntApp, Modal, Input, Radio, Popconfirm } from 'antd';
import { ShieldCheck } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import RatingStars from '@/components/connect/RatingStars';
import {
  getMyBrokerReview,
  upsertBrokerReview,
  withdrawBrokerReview,
} from './broker-reviews.actions';
import type { BrokerReviewVisibility } from './broker-reviews.types';

interface BrokerReviewModalProps {
  /** Whether the modal is open. */
  open: boolean;
  /** The confirmed introduction this review is anchored to (the trust anchor). */
  introductionId: string;
  /** The broker's display name - used in the title + the rating prompt. */
  brokerName?: string;
  /** Close the modal (no save). */
  onClose: () => void;
  /** Called after a successful save so the host can refresh / re-label its row. */
  onSaved: () => void;
}

const MAX_LEN = 1000;

export default function BrokerReviewModal({
  open,
  introductionId,
  brokerName,
  onClose,
  onSaved,
}: BrokerReviewModalProps) {
  const t = useTranslations('connect.brokerReviews.form');
  const { message } = AntApp.useApp();

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  // Stay anonymous by default (matches the BE default when visibility is omitted).
  const [visibility, setVisibility] = useState<BrokerReviewVisibility>('anonymous');
  // True once we already have a review for this introduction (edit vs create).
  const [isEdit, setIsEdit] = useState(false);
  // The existing review's id (edit mode only) - drives the Withdraw action.
  const [reviewId, setReviewId] = useState<string | null>(null);
  // Starts true: the prefill fetch runs on mount, so the Save button is disabled
  // until we know whether this is a create or an edit (no synchronous reset needed).
  const [prefilling, setPrefilling] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  // On open, prefill from the caller's existing review for this introduction (if
  // any) so it opens in edit mode; a no-review / logged-out caller resolves null
  // and we keep the blank create defaults. The host only mounts this modal once a
  // row is picked (and destroyOnHidden remounts AntD's inner tree), so the state
  // starts blank - the effect only writes state AFTER the fetch resolves.
  useEffect(() => {
    if (!open) return;
    let live = true;
    void getMyBrokerReview(introductionId).then((res) => {
      if (!live) return;
      if (res.ok && res.data) {
        setRating(res.data.rating);
        setText(res.data.text ?? '');
        setVisibility(res.data.visibility);
        setReviewId(res.data._id);
        setIsEdit(true);
      }
      setPrefilling(false);
    });
    return () => {
      live = false;
    };
  }, [open, introductionId]);

  const submit = async () => {
    if (rating < 1) {
      message.warning(t('ratingRequired'));
      return;
    }
    setSubmitting(true);
    const res = await upsertBrokerReview({
      introductionId,
      rating,
      text: text.trim() || undefined,
      visibility,
    });
    setSubmitting(false);
    if (!res.ok) {
      message.error(res.error);
      return;
    }
    message.success(t('saveSuccess'));
    onSaved();
    onClose();
  };

  // Reviewer-only withdraw (DPDP, soft-delete BE-side). Edit mode only - we need
  // the existing review's id. Popconfirm-guarded by the caller before this fires.
  const withdraw = async () => {
    if (!reviewId) return;
    setWithdrawing(true);
    const res = await withdrawBrokerReview(reviewId);
    setWithdrawing(false);
    if (!res.ok) {
      message.error(res.error);
      return;
    }
    message.success(t('withdrawSuccess'));
    onSaved();
    onClose();
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={brokerName ? t('titleNamed', { broker: brokerName }) : t('title')}
      footer={null}
      destroyOnHidden
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
      centered
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Star picker (required >= 1). brokerName personalizes the prompt. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {brokerName ? t('rateNamed', { broker: brokerName }) : t('rating')}
          </span>
          <RatingStars
            value={rating}
            interactive
            onSelect={setRating}
            label={t('rating')}
            size={20}
          />
        </div>

        {/* Optional comment. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('commentLabel')}
          </span>
          <Input.TextArea
            value={text}
            maxLength={MAX_LEN}
            showCount
            rows={4}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('commentPlaceholder')}
          />
        </div>

        {/* Visibility: stay anonymous (default) vs show my name. The helper
            explains an anonymous review shows only initials + role + city. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--cr-text-2)' }}>
            {t('visibilityLabel')}
          </span>
          <Radio.Group
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as BrokerReviewVisibility)}
            options={[
              { label: t('visibilityAnonymous'), value: 'anonymous' },
              { label: t('visibilityNamed'), value: 'named' },
            ]}
            optionType="button"
          />
          {/* Prominent inline reassurance beside the visibility control - a shield +
              one short line so the reviewer sees the privacy default at a glance.
              The icon is aria-hidden; the longer explanation stays in visibilityHelp
              below. Keep in sync with the introductions privacy callout + the broker
              reviews section caption. */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12.5,
              fontWeight: 600,
              color: 'var(--cr-success, #047857)',
            }}
          >
            <ShieldCheck size={14} aria-hidden />
            {t('privacyNote')}
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--cr-text-4, #9ca3af)', lineHeight: 1.5 }}>
            {t('visibilityHelp')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          {/* Withdraw is reviewer-only DPDP control - edit mode only (create has
              no review to withdraw). Popconfirm-guarded; pushed left of the
              Cancel / Save pair. */}
          {isEdit && (
            <Popconfirm
              title={t('withdrawConfirm')}
              okText={t('withdraw')}
              cancelText={t('cancel')}
              okButtonProps={{ danger: true, loading: withdrawing }}
              onConfirm={withdraw}
            >
              <DsButton
                dsVariant="danger"
                disabled={submitting || withdrawing}
                style={{ marginRight: 'auto' }}
              >
                {t('withdraw')}
              </DsButton>
            </Popconfirm>
          )}
          <DsButton dsVariant="ghost" onClick={onClose} disabled={submitting || withdrawing}>
            {t('cancel')}
          </DsButton>
          <DsButton
            dsVariant="primary"
            loading={submitting}
            disabled={prefilling || withdrawing}
            onClick={submit}
          >
            {isEdit ? t('saveEdit') : t('save')}
          </DsButton>
        </div>
      </div>
    </Modal>
  );
}
