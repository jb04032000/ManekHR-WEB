'use client';

import { useEffect, useState } from 'react';
import { Modal, Form, InputNumber, Input, Button, Alert, message } from 'antd';
import dayjs from 'dayjs';
import { adminExtendPeriod } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { Subscription } from '@/types';

interface Props {
  open: boolean;
  subscription: Subscription | null;
  onCancel: () => void;
  onExtended: (sub: Subscription) => void;
}

interface FormValues {
  additionalDays: number;
  reason: string;
}

export function ExtendPeriodModal({ open, subscription, onCancel, onExtended }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({ additionalDays: 30 });
    }
  }, [open, form]);

  if (!subscription) return null;

  const currentEnd = subscription.currentPeriodEnd ? dayjs(subscription.currentPeriodEnd) : null;

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const sub = await adminExtendPeriod(subscription._id, {
        additionalDays: values.additionalDays,
        reason: values.reason,
      });
      msgApi.success(`Period extended by ${values.additionalDays} days`);
      onExtended(sub);
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
      width={460}
      destroyOnHidden
      title={<span className="font-display font-bold">Extend Subscription Period</span>}
    >
      {ctx}
      <Alert
        type="info"
        showIcon
        className="mb-3"
        title={`Current period ends on ${currentEnd ? currentEnd.format('DD MMM YYYY') : '-'}.`}
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Additional days"
          name="additionalDays"
          rules={[{ required: true, type: 'number', min: 1, max: 3650 }]}
        >
          <InputNumber min={1} max={3650} className="w-full" />
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(p, n) => p.additionalDays !== n.additionalDays}>
          {({ getFieldValue }) => {
            const days = getFieldValue('additionalDays');
            const newEnd = currentEnd && days ? currentEnd.add(days, 'day') : null;
            return newEnd ? (
              <p className="-mt-2 mb-3 text-sm text-muted">
                New end date: <strong>{newEnd.format('DD MMM YYYY')}</strong>
              </p>
            ) : null;
          }}
        </Form.Item>
        <Form.Item label="Reason" name="reason" rules={[{ required: true, min: 3, max: 500 }]}>
          <Input.TextArea rows={3} maxLength={500} showCount placeholder="Why this extension?" />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Extend
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
