'use client';

import { useState } from 'react';
import { Modal, Button, Tag, Alert, Input, Select, Descriptions, message } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminApproveRefund, adminRejectRefund } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { RefundRequest } from '@/types';

interface Props {
  open: boolean;
  request: RefundRequest | null;
  onCancel: () => void;
  onResolved: (request: RefundRequest) => void;
}

export function RefundReviewModal({ open, request, onCancel, onResolved }: Props) {
  const [mode, setMode] = useState<'approve' | 'reject' | null>(null);
  const [speed, setSpeed] = useState<'normal' | 'optimum'>('normal');
  const [rejectReason, setRejectReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  if (!request) return null;

  const handleApprove = async () => {
    setBusy(true);
    try {
      const res = await adminApproveRefund(request._id, { speed });
      msgApi.success('Refund approved & initiated');
      onResolved(res);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason || rejectReason.length < 3) {
      msgApi.warning('Provide a rejection reason (≥ 3 chars)');
      return;
    }
    setBusy(true);
    try {
      const res = await adminRejectRefund(request._id, { reason: rejectReason });
      msgApi.success('Refund rejected');
      onResolved(res);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={580}
      destroyOnHidden
      title={<span className="font-display font-bold">Review Refund Request</span>}
    >
      {ctx}

      <Descriptions size="small" column={1} bordered className="mb-3">
        <Descriptions.Item label="Status">
          <Tag color="orange" className="capitalize">
            {request.status.replace('_', ' ')}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Amount requested">
          <strong>{Money.fromPaise(request.amountPaise).format()}</strong>
        </Descriptions.Item>
        <Descriptions.Item label="Reason">{request.reason}</Descriptions.Item>
        <Descriptions.Item label="Customer">{request.userId}</Descriptions.Item>
        <Descriptions.Item label="Payment">{request.subscriptionPaymentId}</Descriptions.Item>
        <Descriptions.Item label="Requested at">
          {dayjs(request.createdAt).format('DD MMM YYYY HH:mm')}
        </Descriptions.Item>
      </Descriptions>

      {!mode && (
        <div className="flex justify-end gap-2">
          <Button danger icon={<CloseCircleOutlined />} onClick={() => setMode('reject')}>
            Reject
          </Button>
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => setMode('approve')}>
            Approve
          </Button>
        </div>
      )}

      {mode === 'approve' && (
        <>
          <Alert
            type="success"
            showIcon
            title="Approving will immediately fire the Razorpay refund. The customer's payment method will be credited per the selected speed."
            className="mb-3"
          />
          <p className="mb-2 text-sm font-medium">Refund speed</p>
          <Select
            value={speed}
            onChange={setSpeed}
            className="mb-4 w-full"
            options={[
              { value: 'normal', label: 'Normal - 3 to 5 business days (free)' },
              { value: 'optimum', label: 'Optimum - instant (small fee)' },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button onClick={() => setMode(null)} disabled={busy}>
              Back
            </Button>
            <Button type="primary" loading={busy} onClick={handleApprove}>
              Confirm Approval
            </Button>
          </div>
        </>
      )}

      {mode === 'reject' && (
        <>
          <Alert
            type="warning"
            showIcon
            title="Rejecting will close the request without refunding. The customer is notified by email."
            className="mb-3"
          />
          <p className="mb-2 text-sm font-medium">Reason</p>
          <Input.TextArea
            rows={3}
            maxLength={500}
            showCount
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Outside refund window per policy section 3.2"
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button onClick={() => setMode(null)} disabled={busy}>
              Back
            </Button>
            <Button danger type="primary" loading={busy} onClick={handleReject}>
              Confirm Rejection
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
