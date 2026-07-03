'use client';

/**
 * HireCandidatesModal (Institutes Phase 2, Feature 4): a business's
 * "Hire our trained candidates" composer for an institute page.
 *
 * Posts a hire lead through the `sendHireLead` action, which seeds an inbox
 * context thread (channel 'candidate_request') the institute owner replies to.
 * This is purely a lead signal, like the marketplace inquiry: there is no
 * negotiation here, so the success copy points the sender to their inbox rather
 * than implying a hire was confirmed.
 *
 * States (mirroring SendInquiryModal): the message form, an in-flight send, a
 * success panel, and an inline error. The self-lead case
 * (CONNECT_SELF_HIRE_LEAD_NOT_ALLOWED) reads as "this is your own page", which
 * the BE blocks; everything else maps to one friendly generic message.
 *
 * Cross-module links: `sendHireLead` -> company-page.actions -> BE
 * `:pageId/hire-leads`; the seeded thread renders as the CandidateRequestCard in
 * inbox/ContextCard.tsx. AntD v6: Modal `open=` + `destroyOnHidden` + the body
 * scrolls internally (capped maxHeight) so the title stays fixed. Keep the error
 * branch in sync with `HireLeadErrorCode`.
 */

import { useState } from 'react';
import { Input, Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { CircleCheck, Info } from 'lucide-react';
import DsButton from '@/components/ui/DsButton';
import { sendHireLead } from './company-page.actions';
import type { HireLeadErrorCode } from './entities.types';

const MAX_MESSAGE = 800;

interface HireCandidatesModalProps {
  /** The institute page the lead is sent to. */
  pageId: string;
  /** Institute display name, woven into the modal intro + success copy. */
  instituteName: string;
  open: boolean;
  onClose: () => void;
}

export default function HireCandidatesModal({
  pageId,
  instituteName,
  open,
  onClose,
}: HireCandidatesModalProps) {
  const t = useTranslations('connect.companyPage.hireCandidates');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<'form' | 'sending' | 'sent'>('form');
  const [errorCode, setErrorCode] = useState<HireLeadErrorCode | null>(null);

  // Reset on close so the modal opens clean every time (paired with
  // destroyOnHidden). Never rely on a closed-but-mounted overlay keeping stale
  // values.
  const handleClose = () => {
    setMessage('');
    setPhase('form');
    setErrorCode(null);
    onClose();
  };

  const handleSubmit = async () => {
    setPhase('sending');
    setErrorCode(null);
    const res = await sendHireLead(pageId, message);
    if (res.ok) {
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
      title={t('modalTitle')}
      footer={null}
      centered
      destroyOnHidden
      styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}
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
            {t('sentTitle')}
          </h3>
          <p style={{ margin: 0, fontSize: 13.5, color: 'var(--cr-text-4)', maxWidth: 360 }}>
            {t('sentBody')}
          </p>
          <DsButton dsVariant="primary" dsSize="sm" onClick={handleClose}>
            {t('close')}
          </DsButton>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cr-space-sm)' }}>
          {/* The lead-only note reads as a notice, not a floating sentence: a
              faint card + an info glyph (same pattern as SendInquiryModal). */}
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
              {t('intro', { name: instituteName })}
            </p>
          </div>

          <label
            htmlFor="hire-lead-message"
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--cr-text-2)' }}
          >
            {t('messageLabel')}
          </label>
          <Input.TextArea
            id="hire-lead-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={MAX_MESSAGE}
            showCount
            rows={4}
            placeholder={t('placeholder')}
          />
          {errorCode && (
            <p role="alert" style={{ margin: 0, fontSize: 13, color: 'var(--cr-error)' }}>
              {errorCode === 'selfLead' ? t('selfError') : t('genericError')}
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
