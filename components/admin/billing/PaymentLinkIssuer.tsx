'use client';

import { useState } from 'react';
import { Modal, Form, InputNumber, Select, Input, Button, Alert, message, Tag } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { adminIssuePaymentLink } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { AdminIssuePaymentLinkPayload, AdminPaymentLinkResult, BillingCycle } from '@/types';
import { UserPicker } from './UserPicker';
import { PlanPicker } from './PlanPicker';

interface Props {
  open: boolean;
  onCancel: () => void;
  onIssued: (result: AdminPaymentLinkResult) => void;
  /** Pre-fill user when opened from per-user context. */
  defaultUserId?: string;
}

interface FormValues {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amountOverrideRupees?: number;
  reason?: string;
  expireInDays?: number;
}

export function PaymentLinkIssuer({ open, onCancel, onIssued, defaultUserId }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [issued, setIssued] = useState<AdminPaymentLinkResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: AdminIssuePaymentLinkPayload = {
        userId: values.userId,
        planId: values.planId,
        billingCycle: values.billingCycle,
        amountOverridePaise:
          values.amountOverrideRupees !== undefined
            ? Math.round(values.amountOverrideRupees * 100)
            : undefined,
        reason: values.reason,
        expireInSeconds:
          values.expireInDays !== undefined ? values.expireInDays * 86400 : undefined,
      };
      const result = await adminIssuePaymentLink(payload);
      setIssued(result);
      msgApi.success('Payment link created');
      onIssued(result);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!issued) return;
    await navigator.clipboard.writeText(issued.shortUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setIssued(null);
    setCopied(false);
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={560}
      destroyOnHidden
      title={<span className="font-display font-bold">Issue Payment Link</span>}
    >
      {ctx}

      {issued ? (
        <div className="flex flex-col gap-3">
          <Alert
            type="success"
            showIcon
            title="Payment link created"
            description="Share this link with the customer. The link expires per the configured TTL."
          />
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
            <p className="m-0 mb-1 text-xs text-subtle">Amount</p>
            <p className="m-0 mb-2 text-lg font-bold text-heading">
              {Money.fromPaise(issued.amountPaise).format()}
            </p>
            <p className="m-0 mb-1 text-xs text-subtle">Shareable URL</p>
            <div className="flex items-center gap-2">
              <Input value={issued.shortUrl} readOnly />
              <Button
                icon={copied ? <CheckOutlined /> : <CopyOutlined />}
                onClick={handleCopy}
                type={copied ? 'primary' : 'default'}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
            <p className="mt-2 mb-0 text-xs text-subtle">
              Razorpay link id <Tag>{issued.razorpayPaymentLinkId}</Tag>
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              onClick={() => {
                setIssued(null);
                form.resetFields();
              }}
            >
              Issue Another
            </Button>
            <Button type="primary" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            billingCycle: 'monthly',
            userId: defaultUserId,
            expireInDays: 7,
          }}
        >
          <Form.Item
            label="Customer"
            name="userId"
            rules={[{ required: true, message: 'Select a customer' }]}
          >
            <UserPicker />
          </Form.Item>

          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item
              label="Plan"
              name="planId"
              rules={[{ required: true, message: 'Select a plan' }]}
            >
              <PlanPicker />
            </Form.Item>

            <Form.Item label="Billing cycle" name="billingCycle" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'monthly', label: 'Monthly' },
                  { value: 'yearly', label: 'Yearly' },
                ]}
              />
            </Form.Item>
          </div>

          <Form.Item
            label="Negotiated amount (₹) - optional override"
            name="amountOverrideRupees"
            extra="Leave blank to charge the plan's standard quote"
          >
            <InputNumber min={1} precision={2} className="w-full" addonBefore="₹" />
          </Form.Item>

          <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
            <Form.Item
              label="Link expires in (days)"
              name="expireInDays"
              rules={[
                {
                  type: 'number',
                  min: 1,
                  max: 90,
                  message: '1–90 days',
                },
              ]}
            >
              <InputNumber min={1} max={90} className="w-full" />
            </Form.Item>

            <Form.Item label="Internal reason / note" name="reason">
              <Input maxLength={500} placeholder="e.g. negotiated annual deal" />
            </Form.Item>
          </div>

          <Alert
            type="info"
            showIcon
            className="mb-3"
            title="The customer receives the link via email/SMS from Razorpay. On payment, the standard webhook fires; an invoice is generated and a Subscription is created automatically."
          />

          <div className="flex justify-end gap-2">
            <Button onClick={handleClose}>Cancel</Button>
            <Button type="primary" htmlType="submit" loading={submitting}>
              Create Link
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
