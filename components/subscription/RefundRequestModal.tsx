'use client';

import { useState, useEffect } from 'react';
import { Modal, Form, Input, Radio, InputNumber, Alert, Button, message } from 'antd';
import { requestRefund } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { SubscriptionPayment, RefundRequest } from '@/types';

const COMMON_REASONS = [
  'Duplicate charge',
  'Subscribed by mistake',
  'Did not use the service',
  'Found a better alternative',
  'Service did not meet expectations',
  'Technical issues',
  'Other',
];

interface Props {
  open: boolean;
  payment: SubscriptionPayment | null;
  onCancel: () => void;
  onSuccess: (request: RefundRequest) => void;
}

export function RefundRequestModal({ open, payment, onCancel, onSuccess }: Props) {
  const [form] = Form.useForm<{
    refundType: 'full' | 'partial';
    amountRupees?: number;
    reasonCategory: string;
    reasonNote: string;
  }>();
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    if (open && payment) {
      form.resetFields();
      form.setFieldsValue({
        refundType: 'full',
        reasonCategory: COMMON_REASONS[0],
      });
    }
  }, [open, payment, form]);

  if (!payment) return null;

  const refundedSoFarPaise = (payment.refunds ?? []).reduce(
    (sum, r) => sum + (r.status !== 'failed' ? r.amountPaise : 0),
    0,
  );
  const remainingPaise = Math.max(0, payment.totalPaise - refundedSoFarPaise);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const reason =
      values.reasonCategory === 'Other'
        ? values.reasonNote
        : values.reasonNote
          ? `${values.reasonCategory}: ${values.reasonNote}`
          : values.reasonCategory;

    setSubmitting(true);
    try {
      const result = await requestRefund(payment._id, {
        reason,
        amountPaise:
          values.refundType === 'partial' && values.amountRupees
            ? Math.round(values.amountRupees * 100)
            : undefined,
      });
      msgApi.success(
        result.status === 'processed' || result.status === 'approved'
          ? 'Refund initiated. You will see the credit in 3–5 business days.'
          : 'Refund request submitted. Our team will review within 48 hours.',
      );
      onSuccess(result);
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
      title={<span className="font-display font-bold">Request Refund</span>}
    >
      {ctx}

      <div className="px-3 py-2.5 bg-gray-50 rounded-lg mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Original payment</span>
          <span className="font-medium">{Money.fromPaise(payment.totalPaise).format()}</span>
        </div>
        {refundedSoFarPaise > 0 && (
          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">Already refunded</span>
            <span className="text-orange-700">
              −{Money.fromPaise(refundedSoFarPaise).format()}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm mt-1 pt-1 border-t border-gray-200">
          <span className="font-medium">Eligible for refund</span>
          <span className="font-bold text-heading">
            {Money.fromPaise(remainingPaise).format()}
          </span>
        </div>
        {payment.invoiceNumber && (
          <p className="text-xs text-subtle mt-2 mb-0">
            Invoice {payment.invoiceNumber}
          </p>
        )}
      </div>

      {remainingPaise === 0 ? (
        <Alert
          type="warning"
          showIcon
          title="No refundable balance"
          description="This payment has already been fully refunded."
        />
      ) : (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Refund Amount" name="refundType">
            <Radio.Group>
              <Radio.Button value="full">
                Full ({Money.fromPaise(remainingPaise).format()})
              </Radio.Button>
              <Radio.Button value="partial">Partial</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, next) => prev.refundType !== next.refundType}
          >
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
                        if (value <= 0) return Promise.reject('Must be greater than 0');
                        if (value * 100 > remainingPaise)
                          return Promise.reject(
                            `Cannot exceed ${Money.fromPaise(remainingPaise).format()}`,
                          );
                        return Promise.resolve();
                      },
                    },
                  ]}
                >
                  <InputNumber
                    min={1}
                    max={remainingPaise / 100}
                    precision={2}
                    className="w-full"
                    addonBefore="₹"
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            label="Reason"
            name="reasonCategory"
            rules={[{ required: true, message: 'Select a reason' }]}
          >
            <Radio.Group className="flex flex-col gap-1">
              {COMMON_REASONS.map((r) => (
                <Radio key={r} value={r}>
                  {r}
                </Radio>
              ))}
            </Radio.Group>
          </Form.Item>

          <Form.Item
            label="Additional Notes"
            name="reasonNote"
            rules={[
              {
                validator: (_, value) => {
                  const cat = form.getFieldValue('reasonCategory');
                  if (cat === 'Other' && !value)
                    return Promise.reject('Required when reason is Other');
                  if (value && value.length > 500)
                    return Promise.reject('Max 500 characters');
                  return Promise.resolve();
                },
              },
            ]}
          >
            <Input.TextArea
              rows={3}
              maxLength={500}
              showCount
              placeholder="Tell us more (optional)"
            />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            className="mb-3"
            title="Refunds within the policy window are processed automatically. Outside the window, our team reviews within 48 hours. Funds reach you in 3–5 business days via the original payment method."
          />

          <div className="flex justify-end gap-2">
            <Button onClick={onCancel}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting} danger>
              Submit Refund Request
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
