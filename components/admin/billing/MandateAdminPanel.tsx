'use client';

import { useState } from 'react';
import { Card, Button, Tag, Modal, Input, Popconfirm, message } from 'antd';
import {
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { adminCancelMandate, adminPauseMandate, adminResumeMandate } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { Subscription } from '@/types';

interface Props {
  /** Customer's user id (admin acts on their behalf). */
  userId: string;
  /** Their current subscription - used to display current mandate status. */
  subscription: Subscription;
  onChanged?: () => void;
}

/**
 * Admin-on-behalf mandate controls. Mirrors the customer-facing
 * MandateManager but routes through `admin/subscriptions/mandate/*`
 * endpoints which require IsAdminGuard and accept `userId` in the body.
 */
export function MandateAdminPanel({ userId, subscription, onChanged }: Props) {
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [cancelAtCycleEnd, setCancelAtCycleEnd] = useState(true);
  const [busy, setBusy] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const [msgApi, ctx] = message.useMessage();

  if (!subscription.razorpaySubscriptionId) return null;

  const isPaused = subscription.status === 'paused' || subscription.isPaused;
  const isCancelled = subscription.status === 'cancelled';

  const handlePause = async () => {
    setBusy('pause');
    try {
      await adminPauseMandate({ userId, reason: pauseReason || undefined });
      msgApi.success('Mandate paused');
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
      await adminResumeMandate({ userId });
      msgApi.success('Mandate resumed');
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
      await adminCancelMandate({ userId, cancelAtCycleEnd });
      msgApi.success(
        cancelAtCycleEnd ? 'Cancellation scheduled at cycle end' : 'Cancelled immediately',
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

      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <ThunderboltOutlined className="text-xl text-blue-700" />
        </div>
        <div className="flex-1">
          <p className="m-0 mb-0.5 text-base font-semibold text-heading">Customer&apos;s Mandate</p>
          <p className="m-0 font-mono text-xs text-muted">{subscription.razorpaySubscriptionId}</p>
        </div>
        <Tag color={isCancelled ? 'red' : isPaused ? 'orange' : 'green'}>
          {isCancelled ? 'Cancelled' : isPaused ? 'Paused' : 'Active'}
        </Tag>
      </div>

      <div className="flex flex-wrap gap-2">
        {!isCancelled && !isPaused && (
          <Button
            icon={<PauseCircleOutlined />}
            onClick={() => setPauseModalOpen(true)}
            loading={busy === 'pause'}
          >
            Pause Mandate
          </Button>
        )}
        {!isCancelled && isPaused && (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleResume}
            loading={busy === 'resume'}
          >
            Resume Mandate
          </Button>
        )}
        {!isCancelled && (
          <Popconfirm
            title="Cancel customer's mandate?"
            description={
              <div className="max-w-[280px]">
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
        title={<span className="font-display font-bold">Pause Mandate</span>}
        okText="Pause Mandate"
        okButtonProps={{ loading: busy === 'pause', danger: true }}
        onOk={handlePause}
        width={460}
      >
        <p className="mb-2 text-sm text-muted">Reason (optional - surfaces in audit log)</p>
        <Input.TextArea
          rows={3}
          maxLength={280}
          showCount
          value={pauseReason}
          onChange={(e) => setPauseReason(e.target.value)}
        />
      </Modal>
    </Card>
  );
}
