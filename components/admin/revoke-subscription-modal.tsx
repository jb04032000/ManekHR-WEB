'use client';

import { useEffect, useState, startTransition } from 'react';
import { Modal, Select, Input } from 'antd';
import type { Plan } from '@/types';

export interface RevokeSubscriptionParams {
  action: 'no-plan' | 'assign-free' | 'assign-plan';
  targetPlanId?: string;
  note?: string;
}

export interface RevokeSubscriptionModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (params: RevokeSubscriptionParams) => Promise<void>;
  plans: Plan[];
  loading?: boolean;
  title?: string;
  okText?: string;
}

export function RevokeSubscriptionModal({
  open,
  onCancel,
  onConfirm,
  plans,
  loading = false,
  title = 'Force Cancel Subscription',
  okText = 'Confirm',
}: RevokeSubscriptionModalProps) {
  const [action, setAction] = useState<'no-plan' | 'assign-free' | 'assign-plan'>('no-plan');
  const [targetPlanId, setTargetPlanId] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (open) {
      startTransition(() => {
        setAction('no-plan');
        setTargetPlanId(undefined);
        setNote('');
      });
    }
  }, [open]);

  const handleConfirm = async () => {
    if (action === 'assign-plan' && !targetPlanId) {
      return;
    }
    setConfirming(true);
    try {
      await onConfirm({
        action,
        targetPlanId: action === 'assign-plan' ? targetPlanId : undefined,
        note: note || undefined,
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleActionChange = (value: 'no-plan' | 'assign-free' | 'assign-plan') => {
    setAction(value);
    if (value !== 'assign-plan') {
      setTargetPlanId(undefined);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      title={<span className="font-display font-bold">{title}</span>}
      okText={okText}
      okButtonProps={{ danger: true, loading: loading || confirming }}
      onOk={handleConfirm}
      width={520}
    >
      <div className="mt-2 flex flex-col gap-4">
        <div>
          <p className="mb-2 text-sm font-medium">Action</p>
          <Select
            value={action}
            onChange={handleActionChange}
            className="w-full"
            options={[
              { value: 'no-plan', label: 'Remove All Access (No Plan)' },
              { value: 'assign-free', label: 'Downgrade to Free Plan' },
              { value: 'assign-plan', label: 'Assign a Different Plan' },
            ]}
          />
        </div>
        {action === 'assign-plan' && (
          <div>
            <p className="mb-2 text-sm font-medium">Select Plan</p>
            <Select
              value={targetPlanId}
              onChange={setTargetPlanId}
              placeholder="Choose a plan..."
              className="w-full"
              options={plans
                .filter((p) => p.isActive)
                .map((p) => ({
                  value: p._id,
                  label: `${p.name} (${p.tier})`,
                }))}
            />
          </div>
        )}
        <div>
          <p className="mb-2 text-sm font-medium">Reason / Note</p>
          <Input.TextArea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. User requested refund, mistaken purchase, support ticket #123..."
            rows={3}
          />
        </div>
      </div>
    </Modal>
  );
}
