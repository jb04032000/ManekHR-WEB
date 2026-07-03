'use client';

import { useEffect, useState } from 'react';
import { Modal, Form, Select, InputNumber, Input, Button, Alert, message } from 'antd';
import { adminGrantSubscription } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AdminGrantSubscriptionPayload, BillingCycle, Subscription } from '@/types';
import { UserPicker } from './UserPicker';
import { PlanPicker } from './PlanPicker';

interface Props {
  open: boolean;
  onCancel: () => void;
  onGranted: (sub: Subscription) => void;
  defaultUserId?: string;
}

interface FormValues {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  durationDays?: number;
  reason: string;
}

export function GrantSubscriptionModal({ open, onCancel, onGranted, defaultUserId }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        userId: defaultUserId,
        billingCycle: 'monthly',
      });
    }
  }, [open, defaultUserId, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: AdminGrantSubscriptionPayload = {
        userId: values.userId,
        planId: values.planId,
        billingCycle: values.billingCycle,
        durationDays: values.durationDays,
        reason: values.reason,
      };
      const sub = await adminGrantSubscription(payload);
      msgApi.success('Subscription granted');
      onGranted(sub);
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
      title={<span className="font-display font-bold">Grant Subscription</span>}
    >
      {ctx}
      <Alert
        type="info"
        showIcon
        title="Grants bypass payment. Use for negotiated deals, partner accounts, or compensation."
        className="mb-3"
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Customer"
          name="userId"
          rules={[{ required: true, message: 'Pick a customer' }]}
        >
          <UserPicker />
        </Form.Item>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Plan"
            name="planId"
            rules={[{ required: true, message: 'Pick a plan' }]}
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
          label="Duration (days) - optional override"
          name="durationDays"
          extra="Default: cycle duration. Use to grant a custom-length period."
        >
          <InputNumber min={1} max={3650} className="w-full" />
        </Form.Item>
        <Form.Item label="Reason" name="reason" rules={[{ required: true, min: 3, max: 500 }]}>
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="Why this grant?" />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Grant
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
