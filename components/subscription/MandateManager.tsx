'use client';

import { useState } from 'react';
import { Card, Button, Tag, Modal, Input, Alert, Popconfirm, message } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { cancelMandate, pauseMandate, resumeMandate } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { Subscription } from '@/types';

interface Props {
  subscription: Subscription;
  /** Called after any mandate action succeeds so the parent can re-fetch state. */
  onChanged?: () => void;
}

export function MandateManager({ subscription, onChanged }: Props) {
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [cancelAtCycleEnd, setCancelAtCycleEnd] = useState(true);
  const [busy, setBusy] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [msgApi, ctx] = message.useMessage();

  if (!subscription.razorpaySubscriptionId) return null;

  const isPaused = subscription.status === 'paused' || subscription.isPaused;
  const isCancelled = subscription.status === 'cancelled';
  const periodEnd = subscription.currentPeriodEnd
    ? dayjs(subscription.currentPeriodEnd).format('DD MMM YYYY')
    : '-';

  const handlePause = async () => {
    setBusy('pause');
    try {
      await pauseMandate({ reason: pauseReason || undefined });
      msgApi.success('Mandate pause requested. Confirmation will arrive shortly.');
      setPauseModalOpen(false);
      setPauseReason('');
      onChanged?.();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleResume = async () => {
    setBusy('resume');
    try {
      await resumeMandate();
      msgApi.success('Mandate resumed. Auto-renew will continue at next cycle.');
      onChanged?.();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async () => {
    setBusy('cancel');
    try {
      await cancelMandate({ cancelAtCycleEnd });
      msgApi.success(
        cancelAtCycleEnd
          ? `Cancelled. You keep access until ${periodEnd}.`
          : 'Cancelled immediately.',
      );
      onChanged?.();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="rounded-2xl">
      {ctx}

      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-blue-100">
          <ThunderboltOutlined className="text-2xl text-blue-700" />
        </div>
        <div className="flex-1">
          <p className="m-0 mb-0.5 font-display text-lg font-bold text-heading">
            Auto-Renew Mandate
          </p>
          <p className="m-0 text-sm text-muted">
            {isCancelled
              ? 'Mandate cancelled. Access continues until the period ends.'
              : isPaused
                ? 'Paused. No charges will be made until resumed.'
                : 'Active. Renews automatically at the end of every cycle.'}
          </p>
        </div>
        <Tag color={isCancelled ? 'red' : isPaused ? 'orange' : 'green'}>
          {isCancelled ? 'Cancelled' : isPaused ? 'Paused' : 'Active'}
        </Tag>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <InfoTile
          icon={<CalendarOutlined />}
          label="Next renewal"
          value={isCancelled || isPaused ? '-' : periodEnd}
        />
        <InfoTile
          label="Razorpay subscription"
          value={subscription.razorpaySubscriptionId.slice(0, 18) + '…'}
          mono
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!isCancelled && !isPaused && (
          <Button
            icon={<PauseCircleOutlined />}
            onClick={() => setPauseModalOpen(true)}
            loading={busy === 'pause'}
          >
            Pause
          </Button>
        )}
        {!isCancelled && isPaused && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleResume}
            loading={busy === 'resume'}
          >
            Resume
          </Button>
        )}
        {!isCancelled && (
          <Popconfirm
            title="Cancel auto-renew?"
            description={
              <div className="max-w-[260px]">
                <p className="m-0 mb-2 text-sm">
                  {cancelAtCycleEnd
                    ? `You keep access through ${periodEnd}.`
                    : 'Access ends immediately. No refund for unused time.'}
                </p>
                <Button
                  size="small"
                  type="link"
                  className="px-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelAtCycleEnd((c) => !c);
                  }}
                >
                  Switch to {cancelAtCycleEnd ? 'cancel immediately' : 'cancel at cycle end'}
                </Button>
              </div>
            }
            okText="Yes, Cancel"
            okButtonProps={{ danger: true, loading: busy === 'cancel' }}
            onConfirm={handleCancel}
          >
            <Button danger icon={<StopOutlined />}>
              Cancel Mandate
            </Button>
          </Popconfirm>
        )}
      </div>

      <Modal
        open={pauseModalOpen}
        onCancel={() => setPauseModalOpen(false)}
        title={<span className="font-display font-bold">Pause Auto-Renew</span>}
        okText="Pause Mandate"
        okButtonProps={{ loading: busy === 'pause' }}
        onOk={handlePause}
        width={460}
      >
        <Alert
          type="info"
          showIcon
          className="mb-4"
          title="Paused mandates do not charge. Your access continues until the current period ends. Resume anytime to restart auto-renew."
        />
        <p className="mb-2 text-sm font-medium">Reason (optional)</p>
        <Input.TextArea
          rows={3}
          maxLength={280}
          showCount
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
          placeholder="Help us improve - why are you pausing?"
        />
      </Modal>
    </Card>
  );
}

function InfoTile({
  icon,
  label,
  value,
  mono,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 px-3 py-2">
      <p className="m-0 mb-0.5 flex items-center gap-1 text-xs text-subtle">
        {icon}
        {label}
      </p>
      <p className={`m-0 text-sm font-medium text-heading ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}
