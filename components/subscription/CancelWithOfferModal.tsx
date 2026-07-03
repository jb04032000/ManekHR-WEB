'use client';

import { useState } from 'react';
import { env } from '@/lib/env';
import { Modal, Button, Radio, Input, Alert } from 'antd';
import {
  PauseCircleOutlined,
  HeartOutlined,
  ArrowDownOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Subscription } from '@/types';

type Step = 'reason' | 'retention' | 'confirm';
type Outcome = 'pause' | 'downgrade' | 'cancel';

const REASONS = [
  'Too expensive',
  'Not using it enough',
  'Missing a feature I need',
  'Found a better alternative',
  'Temporary break',
  'Other',
];

interface Props {
  open: boolean;
  subscription: Subscription | null;
  onCancel: () => void;
  onPauseInstead: () => void;
  onConfirmCancel: (reason: string) => void | Promise<void>;
  /** Whether this subscription is mandate-bound (pause-instead supported). */
  hasMandate?: boolean;
  cancelling?: boolean;
}

export function CancelWithOfferModal({
  open,
  subscription,
  onCancel,
  onPauseInstead,
  onConfirmCancel,
  hasMandate = false,
  cancelling = false,
}: Props) {
  const [step, setStep] = useState<Step>('reason');
  const [reason, setReason] = useState<string>(REASONS[0]);
  const [reasonNote, setReasonNote] = useState('');
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const periodEnd = subscription?.currentPeriodEnd
    ? dayjs(subscription.currentPeriodEnd).format('DD MMM YYYY')
    : 'period end';

  const reset = () => {
    setStep('reason');
    setReason(REASONS[0]);
    setReasonNote('');
    setOutcome(null);
  };

  const handleClose = () => {
    reset();
    onCancel();
  };

  const composedReason = reasonNote ? `${reason}: ${reasonNote}` : reason;

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnHidden
      title={
        <span className="font-display font-bold">
          {step === 'confirm' ? 'Confirm cancellation' : 'We hate to see you go'}
        </span>
      }
    >
      {step === 'reason' && (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm text-muted">Help us improve - why are you cancelling?</p>
          <Radio.Group
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex flex-col gap-1"
          >
            {REASONS.map((r) => (
              <Radio key={r} value={r}>
                {r}
              </Radio>
            ))}
          </Radio.Group>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            placeholder="Anything else you'd like to share?"
            value={reasonNote}
            onChange={(e) => setReasonNote(e.target.value)}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={handleClose}>Keep Subscription</Button>
            <Button type="primary" onClick={() => setStep('retention')}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'retention' && (
        <div className="flex flex-col gap-3">
          <Alert type="info" showIcon title="Before you cancel - here are some alternatives:" />
          {hasMandate && (
            <OfferCard
              icon={<PauseCircleOutlined className="text-2xl text-blue-700" />}
              title="Pause instead"
              desc="Stop charges immediately. Resume anytime - your data stays safe."
              cta="Pause Auto-Renew"
              onClick={() => {
                handleClose();
                onPauseInstead();
              }}
            />
          )}
          <OfferCard
            icon={<ArrowDownOutlined className="text-2xl text-green-700" />}
            title="Downgrade to a lower plan"
            desc="Keep core features at a lower price. Switch back anytime."
            cta="See Cheaper Plans"
            onClick={() => {
              handleClose();
              window.location.href = '/account/subscription/plans';
            }}
          />
          <OfferCard
            icon={<HeartOutlined className="text-2xl text-red-700" />}
            title="Talk to us"
            desc="Our team can often resolve concerns or offer a custom plan."
            cta="Contact Support"
            onClick={() => {
              window.location.href = `mailto:${env.supportEmail}?subject=Considering cancellation`;
            }}
          />

          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-3">
            <Button type="text" onClick={() => setStep('reason')}>
              ← Back
            </Button>
            <Button
              danger
              icon={<StopOutlined />}
              onClick={() => {
                setOutcome('cancel');
                setStep('confirm');
              }}
            >
              Cancel Anyway
            </Button>
          </div>
        </div>
      )}

      {step === 'confirm' && outcome === 'cancel' && (
        <div className="flex flex-col gap-3">
          <Alert
            type="warning"
            showIcon
            title={`Your subscription will end on ${periodEnd}`}
            description={
              hasMandate
                ? 'Auto-renew will be cancelled at cycle end. You keep access until then. After that you lose access to paid features.'
                : 'You keep access until the period ends. After that you lose access to paid features.'
            }
          />
          <p className="m-0 text-sm text-muted">
            Cancellation reason: <strong>{composedReason}</strong>
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={handleClose}>Keep Subscription</Button>
            <Button
              danger
              type="primary"
              loading={cancelling}
              onClick={async () => {
                await onConfirmCancel(composedReason);
              }}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function OfferCard({
  icon,
  title,
  desc,
  cta,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-200 p-3 transition-colors hover:border-blue-300">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50">
        {icon}
      </div>
      <div className="flex-1">
        <p className="m-0 mb-0.5 text-sm font-semibold text-heading">{title}</p>
        <p className="m-0 mb-2 text-xs text-muted">{desc}</p>
        <Button size="small" type="primary" ghost onClick={onClick}>
          {cta}
        </Button>
      </div>
    </div>
  );
}
