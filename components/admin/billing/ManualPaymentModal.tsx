'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Form,
  Select,
  InputNumber,
  Input,
  DatePicker,
  Button,
  Alert,
  message,
} from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { adminRecordManualPayment } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AdminManualPaymentPayload, BillingCycle } from '@/types';
import { UserPicker } from './UserPicker';
import { PlanPicker } from './PlanPicker';

interface Props {
  open: boolean;
  onCancel: () => void;
  onRecorded: () => void;
  defaultUserId?: string;
}

interface FormValues {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amountRupees: number;
  paymentMethod: AdminManualPaymentPayload['paymentMethod'];
  receiptNumber?: string;
  paymentDate?: Dayjs;
  notes?: string;
}

export function ManualPaymentModal({ open, onCancel, onRecorded, defaultUserId }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        userId: defaultUserId,
        billingCycle: 'monthly',
        paymentMethod: 'neft',
        paymentDate: dayjs(),
      });
    }
  }, [open, defaultUserId, form]);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const payload: AdminManualPaymentPayload = {
        userId: values.userId,
        planId: values.planId,
        billingCycle: values.billingCycle,
        amountPaise: Math.round(values.amountRupees * 100),
        paymentMethod: values.paymentMethod,
        receiptNumber: values.receiptNumber,
        paymentDate: values.paymentDate?.toISOString(),
        notes: values.notes,
      };
      await adminRecordManualPayment(payload);
      msgApi.success('Manual payment recorded');
      onRecorded();
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
      width={580}
      destroyOnHidden
      title={<span className="font-display font-bold">Record Manual Payment</span>}
    >
      {ctx}
      <Alert
        type="info"
        showIcon
        className="mb-3"
        title="Use for offline NEFT / cheque / cash receipts. Excluded from Razorpay reconciliation. An invoice will still be generated."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Customer"
          name="userId"
          rules={[{ required: true }]}
        >
          <UserPicker />
        </Form.Item>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <Form.Item label="Plan" name="planId" rules={[{ required: true }]}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <Form.Item
            label="Amount (₹)"
            name="amountRupees"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber min={1} precision={2} className="w-full" addonBefore="₹" />
          </Form.Item>
          <Form.Item label="Payment method" name="paymentMethod" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'neft', label: 'NEFT / Bank transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'cash', label: 'Cash' },
                { value: 'wire', label: 'Wire transfer' },
                { value: 'other', label: 'Other' },
              ]}
            />
          </Form.Item>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <Form.Item label="Receipt / reference no." name="receiptNumber">
            <Input maxLength={60} />
          </Form.Item>
          <Form.Item label="Payment date" name="paymentDate">
            <DatePicker className="w-full" />
          </Form.Item>
        </div>
        <Form.Item label="Notes" name="notes">
          <Input.TextArea rows={2} maxLength={500} showCount />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Record Payment
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
