'use client';

/**
 * SendInquiryModal - the buyer's "Contact seller" modal (M1.6.2).
 *
 * Posts an inquiry through the `sendInquiry` action (M1.5). The mediator model
 * means this is purely a lead signal: the buyer and seller agree price +
 * delivery off-platform, so the copy sets that expectation rather than implying
 * a checkout or chat.
 *
 * States: the message form, an in-flight send, a success panel, and an inline
 * error mapped from the discriminated `InquiryErrorCode`. The seller lead-cap
 * case reads as "this seller is full this month" so a buyer understands it is
 * the seller's limit, not their own mistake.
 */

import { useEffect, useState } from 'react';
import { Input, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { CircleCheck, Info } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { sendInquiry } from './marketplace.actions';
import type { InquiryErrorCode } from './marketplace.types';
import { ConnectEvents, trackEvent } from '@/lib/analytics-events';

const MAX_MESSAGE = 1000;

/** Quick-message starters a buyer can tap to prefill the inquiry. */
const TEMPLATE_KEYS = ['pricing', 'sample', 'availability'] as const;

/** Map each failure code to its localized `errors.*` key. */
const ERROR_KEY: Record<InquiryErrorCode, string> = {
  CONNECT_SELF_INQUIRY_NOT_ALLOWED: 'selfInquiry',
  CONNECT_SELLER_LEAD_CAP_REACHED: 'sellerCap',
  LISTING_NOT_FOUND: 'listingGone',
  RATE_LIMITED: 'rateLimited',
  UNKNOWN: 'generic',
};

interface SendInquiryModalProps {
  listingId: string;
  /** Seller display name, woven into the success copy when known. */
  sellerName?: string;
  open: boolean;
  onClose: () => void;
  /**
   * Course variant (Institutes Phase 1): when true the modal title + intro read
   * as "enrol" rather than "contact seller". COPY ONLY - the inquiry payload,
   * action, and telemetry are identical to a product inquiry.
   */
  enrol?: boolean;
}

export default function SendInquiryModal({
  listingId,
  sellerName,
  open,
  onClose,
  enrol = false,
}: SendInquiryModalProps) {
  const t = useTranslations('connect.marketplace.inquiry');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent'>('form');
  const [errorCode, setErrorCode] = useState<InquiryErrorCode | null>(null);

  // Additive funnel telemetry: listingInquiryStarted when the modal opens (the
  // composer is the start of the inquiry funnel). Keyed on `open` so it fires
  // once per open, not per render. Send logic is untouched. Keyless-safe sink.
  useEffect(() => {
    if (open) trackEvent(ConnectEvents.listingInquiryStarted, { listingId });
  }, [open, listingId]);

  const handleClose = () => {
    setMessage('');
    setPhase('form');
    setErrorCode(null);
    onClose();
  };

  const handleSubmit = async () => {
    setPhase('sending');
    setErrorCode(null);
    const res = await sendInquiry(listingId, message);
    if (res.ok) {
      // Additive funnel telemetry: listingInquirySent only on a real success
      // (res.ok), the inquiry-funnel conversion. Does not alter send behaviour.
      trackEvent(ConnectEvents.listingInquirySent, { listingId });
      setPhase('sent');
    } else {
      setErrorCode(res.code);
      setPhase('form');
    }
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      title={enrol ? t('enrolTitle') : t('title')}
      footer={null}
    >
      {phase === 'sent' ? (
        <div
          role="status"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 'var(--cr-space-sm)',
            padding: 'var(--cr-space-md) 0',
          }}
        >
          <span aria-hidden style={{ color: 'var(--cr-success)' }}>
            <CircleCheck size={40} />
          </span>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text)' }}>
            {t('successTitle')}
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--cr-text-4)', maxWidth: 360 }}>
            {sellerName ? t('successBodyNamed', { name: sellerName }) : t('successBody')}
          </p>
          <DsButton dsVariant="primary" dsSize="sm" onClick={handleClose}>
            {t('close')}
          </DsButton>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)' }}>
          {/* The "ManekHR does not handle payment" note reads as a notice, not a
              floating sentence: a faint card + an info glyph. */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: '8px 10px',
              borderRadius: 'var(--cr-radius-md)',
              border: '1px solid var(--cr-border)',
              background: 'var(--cr-surface-2)',
            }}
          >
            <Info
              size={15}
              aria-hidden
              style={{ flexShrink: 0, marginTop: 2, color: 'var(--cr-text-4)' }}
            />
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.5, color: 'var(--cr-text-3)' }}>
              {enrol ? t('enrolIntro') : t('intro')}
            </p>
          </div>

          {/* Quick-message starters: tap to prefill a common ask. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TEMPLATE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setMessage(t(`templates.${key}`))}
                style={{
                  border: '1px solid var(--cr-border)',
                  background: 'var(--cr-surface)',
                  borderRadius: 'var(--cr-radius-full)',
                  padding: '4px 11px',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--cr-text-2)',
                  cursor: 'pointer',
                }}
              >
                {t(`templateLabels.${key}`)}
              </button>
            ))}
          </div>

          <label
            htmlFor="inquiry-message"
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}
          >
            {t('messageLabel')}
          </label>
          <Input.TextArea
            id="inquiry-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE}
            showCount
            rows={4}
            placeholder={t('messagePlaceholder')}
          />
          {errorCode && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--cr-error)' }}>
              {t(`errors.${ERROR_KEY[errorCode]}`)}
            </p>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              marginTop: 'var(--cr-space-sm)',
            }}
          >
            <DsButton dsVariant="ghost" dsSize="sm" onClick={handleClose}>
              {t('cancel')}
            </DsButton>
            <DsButton
              dsVariant="primary"
              dsSize="sm"
              onClick={handleSubmit}
              disabled={phase === 'sending'}
              loading={phase === 'sending'}
            >
              {t('send')}
            </DsButton>
          </div>
        </div>
      )}
    </Modal>
  );
}
