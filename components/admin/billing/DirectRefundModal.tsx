'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Switch,
  Button,
  Alert,
  message,
} from 'antd';
import { adminDirectRefund } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { RefundRequest, SubscriptionPayment, AdminDirectRefundPayload } from '@/types';

interface Props {
  open: boolean;
  payment: SubscriptionPayment | null;
  onCancel: () => void;
  onIssued: (refund: RefundRequest) => void;
}

interface FormValues {
  refundType: 'full' | 'partial';
  amountRupees?: number;
  reason: string;
  speed: 'normal' | 'optimum';
  bypassWindow: boolean;
}

export function DirectRefundModal({ open, payment, onCancel, onIssued }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    if (open && payment) {
      form.resetFields();
      form.setFieldsValue({
        refundType: 'full',
        speed: 'normal',
        bypassWindow: false,
      });
    }
  }, [open, payment, form]);

  if (!payment) return null;

  const refundedSoFarPaise = (payment.refunds ?? []).reduce(
    (s, r) => s + (r.status !== 'failed' ? r.amountPaise : 0),
    0,
  );
  const remainingPaise = Math.max(0, payment.totalPaise - refundedSoFarPaise);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload: AdminDirectRefundPayload = {
      reason: values.reason,
      speed: values.speed,
      bypassWindow: values.bypassWindow,
      amountPaise:
        values.refundType === 'partial' && values.amountRupees
          ? Math.round(values.amountRupees * 100)
          : undefined,
    };
    setSubmitting(true);
    try {
      const res = await adminDirectRefund(payment._id, payload);
      msgApi.success('Refund initiated');
      onIssued(res);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onCancel}
      footer={null}
      width={520}
      destroyOnHidden
      title={<span className="font-display font-bold">Direct Refund</span>}
    >
      {ctx}

      <Alert
        type="warning"
        showIcon
        className="mb-3"
        title="Direct refunds bypass customer request flow. Use only for goodwill / billing-error correction. The action is logged in the audit trail."
      />

      <div className="mb-4 rounded-lg bg-gray-50 px-3 py-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Original payment</span>
          <span className="font-medium">{Money.fromPaise(payment.totalPaise).format()}</span>
        </div>
        {refundedSoFarPaise > 0 && (
          <div className="mt-1 flex justify-between text-sm">
            <span className="text-muted">Already refunded</span>
            <span className="text-orange-700">−{Money.fromPaise(refundedSoFarPaise).format()}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 text-sm">
          <span className="font-medium">Eligible for refund</span>
          <span className="font-bold">{Money.fromPaise(remainingPaise).format()}</span>
        </div>
      </div>

      {remainingPaise === 0 ? (
        <Alert type="info" title="Nothing left to refund on this payment." showIcon />
      ) : (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Refund amount" name="refundType">
            <Radio.Group>
              <Radio.Button value="full">
                Full ({Money.fromPaise(remainingPaise).format()})
              </Radio.Button>
              <Radio.Button value="partial">Partial</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(p, n) => p.refundType !== n.refundType}>
            {({ getFieldValue }) =>
              getFieldValue('refundType') === 'partial' ? (
                <Form.Item
                  label="Amount (₹)"
                  name="amountRupees"
                  rules={[
                    { required: true, message: 'Enter an amount' },
                    {
                      validator: (_, value) => {
                        if (typeof value !== 'number') return Promise.resolve();
                        if (value <= 0) return Promise.reject('Must be > 0');
                        if (value * 100 > remainingPaise)
                          return Promise.reject(
                            `Cannot exceed ${Money.fromPaise(remainingPaise).format()}`,
                          );
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <InputNumber min={1} precision={2} className="w-full" addonBefore="₹" />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            label="Internal reason"
            name="reason"
            rules={[{ required: true, min: 3, max: 500 }]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Why this direct refund?"
            />
          </Form.Item>

          <Form.Item label="Speed" name="speed">
            <Select
              options={[
                { value: 'normal', label: 'Normal - 3 to 5 business days (free)' },
                { value: 'optimum', label: 'Optimum - instant (small fee)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="Bypass refund-window check"
            name="bypassWindow"
            valuePropName="checked"
            extra="Allow refund even if the policy's eligible window has passed"
          >
            <Switch />
          </Form.Item>

          <div className="flex justify-end gap-2">
            <Button onClick={onCancel} disabled={submitting}>
              Cancel
            </Button>
            <Button danger type="primary" htmlType="submit" loading={submitting}>
              Issue Refund
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
