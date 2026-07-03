'use client';

import { useEffect, useState } from 'react';
import { Modal, Form, Input, Button, Alert, message } from 'antd';
import { adminOverrideEntitlements } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { Subscription } from '@/types';

interface Props {
  open: boolean;
  subscription: Subscription | null;
  onCancel: () => void;
  onSaved: (sub: Subscription) => void;
}

interface FormValues {
  overrideJson: string;
  reason: string;
}

/**
 * Sparse-JSON entitlements override. Admin pastes the partial
 * entitlements payload they want merged into the subscription's
 * appliedEntitlements. The BE shallow-merges + audit-logs the diff.
 */
export function EntitlementsOverrideModal({ open, subscription, onCancel, onSaved }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [submitting, setSubmitting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    if (open && subscription) {
      form.resetFields();
      form.setFieldsValue({
        overrideJson: JSON.stringify(subscription.entitlementsOverride ?? {}, null, 2),
      });
    }
  }, [open, subscription, form]);

  if (!subscription) return null;

  const handleSubmit = async () => {
    const values = await form.validateFields();
    setParseError(null);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(values.overrideJson);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('JSON must be a non-array object');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid JSON';
      setParseError(msg);
      return;
    }

    setSubmitting(true);
    try {
      const sub = await adminOverrideEntitlements(subscription._id, {
        override: parsed,
        reason: values.reason,
      });
      msgApi.success('Entitlements overridden');
      onSaved(sub);
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
      width={620}
      destroyOnHidden
      title={<span className="font-display font-bold">Override Entitlements</span>}
    >
      {ctx}
      <Alert
        type="warning"
        showIcon
        className="mb-3"
        title="Sparse override - only the keys you supply are merged into appliedEntitlements. The rest of the plan defaults remain in effect."
        description={`Example: {"maxWorkspaces": 50, "features": {"export": true}}`}
      />

      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Override JSON"
          name="overrideJson"
          rules={[{ required: true, message: 'Provide override JSON' }]}
        >
          <Input.TextArea rows={10} className="font-mono text-xs" />
        </Form.Item>
        {parseError && <Alert type="error" title={parseError} className="mb-3" showIcon />}
        <Form.Item label="Reason" name="reason" rules={[{ required: true, min: 3, max: 500 }]}>
          <Input.TextArea
            rows={2}
            maxLength={500}
            showCount
            placeholder="e.g. negotiated 50-workspace cap for Acme"
          />
        </Form.Item>
        <div className="flex justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={submitting}>
            Save Override
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
