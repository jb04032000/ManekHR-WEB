'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  Form,
  InputNumber,
  Switch,
  Select,
  Button,
  Spin,
  Alert,
  Tag,
  Input,
  message,
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { adminGetRefundPolicy, adminUpdateRefundPolicy } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { RefundPolicy } from '@/types';

export function RefundPolicyForm() {
  const [form] = Form.useForm<RefundPolicy>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reasonInput, setReasonInput] = useState('');
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    let cancelled = false;
    adminGetRefundPolicy()
      .then((p) => !cancelled && form.setFieldsValue(p ?? {}))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [form]);

  const handleSubmit = async (values: RefundPolicy) => {
    setSaving(true);
    try {
      const saved = await adminUpdateRefundPolicy(values);
      form.setFieldsValue(saved ?? values);
      msgApi.success('Refund policy saved');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const addReason = () => {
    const trimmed = reasonInput.trim();
    if (!trimmed) return;
    const current = form.getFieldValue('reasons') ?? [];
    if (current.includes(trimmed)) return;
    form.setFieldValue('reasons', [...current, trimmed]);
    setReasonInput('');
  };

  if (loading) {
    return (
      <Card className="rounded-2xl">
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-2xl" title="Refund Policy">
      {ctx}
      <Alert
        type="info"
        showIcon
        className="mb-4"
        title="Customer self-service refunds within the eligible window auto-execute. Outside the window, requests enter the admin queue (or auto-reject if self-service is disabled)."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Customer self-service enabled"
            name="customerSelfServiceEnabled"
            valuePropName="checked"
            extra="When off, all refunds are admin-only"
          >
            <Switch />
          </Form.Item>
          <Form.Item label="Eligible within (days)" name="eligibleWithinDays">
            <InputNumber min={0} max={180} className="w-full" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item label="Allow partial refunds" name="allowPartial" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item
            label="Require 2nd admin approval (after window)"
            name="requireSecondAdminApprovalAfterWindow"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </div>

        <Form.Item
          label="Auto-downgrade subscription on full refund"
          name="autoDowngradeOnFullRefund"
          valuePropName="checked"
          extra="When a payment is fully refunded, automatically cancel the linked subscription"
        >
          <Switch />
        </Form.Item>

        <Form.Item label="Default refund speed" name="speed">
          <Select
            options={[
              { value: 'normal', label: 'Normal - 3 to 5 business days (free)' },
              { value: 'optimum', label: 'Optimum - instant (extra fee)' },
            ]}
          />
        </Form.Item>

        <Form.Item label="Refund reasons (presented to customers)" name="reasons">
          <Form.Item noStyle shouldUpdate>
            {({ getFieldValue, setFieldValue }) => {
              const reasons: string[] = getFieldValue('reasons') ?? [];
              return (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {reasons.map((r) => (
                    <Tag
                      key={r}
                      closable
                      onClose={() =>
                        setFieldValue(
                          'reasons',
                          reasons.filter((x) => x !== r),
                        )
                      }
                    >
                      {r}
                    </Tag>
                  ))}
                </div>
              );
            }}
          </Form.Item>
          <div className="flex gap-2">
            <Input
              value={reasonInput}
              onChange={(e) => setReasonInput(e.target.value)}
              onPressEnter={addReason}
              placeholder="Add a reason"
              maxLength={120}
            />
            <Button icon={<PlusOutlined />} onClick={addReason}>
              Add
            </Button>
          </div>
        </Form.Item>

        <div className="flex justify-end pt-2">
          <Button type="primary" htmlType="submit" loading={saving}>
            Save Refund Policy
          </Button>
        </div>
      </Form>
    </Card>
  );
}
