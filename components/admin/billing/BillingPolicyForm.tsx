'use client';

import { useEffect, useState } from 'react';
import { Card, Form, InputNumber, Switch, Input, Button, Spin, Alert, message } from 'antd';
import { env } from '@/lib/env';
import { adminGetBillingPolicy, adminUpdateBillingPolicy } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { BillingPolicy } from '@/types';

export function BillingPolicyForm() {
  const [form] = Form.useForm<BillingPolicy>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  useEffect(() => {
    let cancelled = false;
    adminGetBillingPolicy()
      .then((p) => !cancelled && form.setFieldsValue(p ?? {}))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [form]);

  const handleSubmit = async (values: BillingPolicy) => {
    setSaving(true);
    try {
      const saved = await adminUpdateBillingPolicy(values);
      form.setFieldsValue(saved ?? values);
      msgApi.success('Billing policy saved');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
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
    <Card className="rounded-2xl" title="Billing Policy">
      {ctx}
      <Alert
        type="info"
        showIcon
        className="mb-4"
        title="Defaults are sane and ship with v1. Edit only when business rules change. Every change is audit-logged."
      />
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <h2 className="mt-2 mb-2 font-display text-base font-semibold">Failed-payment retry</h2>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Max retry attempts"
            name={['failedPaymentRetry', 'maxAttempts']}
            extra="Razorpay-side retry count (informational; configure in dashboard)"
          >
            <InputNumber min={1} max={10} className="w-full" />
          </Form.Item>
          <Form.Item
            label="Retry interval (days)"
            name={['failedPaymentRetry', 'retryIntervalDays']}
          >
            <InputNumber min={1} max={30} className="w-full" />
          </Form.Item>
        </div>

        <h2 className="mt-4 mb-2 font-display text-base font-semibold">Grace period</h2>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          <Form.Item label="Duration (days)" name={['gracePeriod', 'durationDays']}>
            <InputNumber min={0} max={60} className="w-full" />
          </Form.Item>
          <Form.Item
            label="Read-only mode"
            name={['gracePeriod', 'readOnlyMode']}
            valuePropName="checked"
            extra="Block writes during grace"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Show contact-sales CTA"
            name={['gracePeriod', 'showContactSalesCta']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </div>

        <h2 className="mt-4 mb-2 font-display text-base font-semibold">Trial defaults</h2>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-3">
          <Form.Item label="Default duration (days)" name={['trial', 'defaultDurationDays']}>
            <InputNumber min={0} max={365} className="w-full" />
          </Form.Item>
          <Form.Item
            label="Card required"
            name={['trial', 'defaultCardRequired']}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Reminder days before end"
            name={['trial', 'reminderEmailDaysBeforeEnd']}
          >
            <InputNumber min={0} max={30} className="w-full" />
          </Form.Item>
        </div>

        <h2 className="mt-4 mb-2 font-display text-base font-semibold">
          Marketing automation (D4)
        </h2>
        <Alert
          type="info"
          showIcon
          className="mb-3"
          title="Lifecycle emails sent automatically by daily/hourly crons. Disable any campaign that conflicts with your CRM."
        />
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Trial expiry reminder"
            name={['marketing', 'sendTrialReminder']}
            valuePropName="checked"
            extra="Uses trial.reminderEmailDaysBeforeEnd above"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Pre-renewal notice"
            name={['marketing', 'sendRenewalNotice']}
            valuePropName="checked"
            extra="Heads-up before mandate auto-charges"
          >
            <Switch />
          </Form.Item>
        </div>
        <Form.Item
          label="Renewal notice - days before end"
          name={['marketing', 'renewalNoticeDaysBeforeEnd']}
        >
          <InputNumber min={1} max={30} className="w-full md:w-1/2" />
        </Form.Item>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Win-back email"
            name={['marketing', 'sendWinBack']}
            valuePropName="checked"
            extra="Re-engagement after cancellation"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Win-back delay (days after cancel)"
            name={['marketing', 'winBackAfterDays']}
          >
            <InputNumber min={1} max={180} className="w-full" />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item
            label="Abandoned-checkout follow-up"
            name={['marketing', 'sendAbandonedCheckout']}
            valuePropName="checked"
            extra="Nudge users who started but never paid"
          >
            <Switch />
          </Form.Item>
          <Form.Item
            label="Abandoned-checkout delay (hours)"
            name={['marketing', 'abandonedCheckoutAfterHours']}
          >
            <InputNumber min={1} max={168} className="w-full" />
          </Form.Item>
        </div>

        <h2 className="mt-4 mb-2 font-display text-base font-semibold">
          Sales contact (rendered in dunning emails + banner)
        </h2>
        <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <Form.Item label="Sales email" name="salesContactEmail" rules={[{ type: 'email' }]}>
            <Input maxLength={120} placeholder={env.supportEmail} />
          </Form.Item>
          <Form.Item label="Sales phone" name="salesContactPhone">
            <Input maxLength={40} placeholder="+91 99999 99999" />
          </Form.Item>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="primary" htmlType="submit" loading={saving}>
            Save Billing Policy
          </Button>
        </div>
      </Form>
    </Card>
  );
}
