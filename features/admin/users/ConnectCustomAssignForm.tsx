'use client';

import { useState } from 'react';
import { App, Button, DatePicker, Form, InputNumber, Radio, Select } from 'antd';
import dayjs from 'dayjs';
import { adminCustomAssignPlan } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';

/**
 * Connect "Custom Assignment": create a Connect subscription with fully custom
 * limits, no pre-made plan required - the Connect parallel of the ERP Custom
 * Assignment tab. Calls adminCustomAssignPlan with product:'connect' so it never
 * touches the person's ERP plan (product-scoped supersede on the backend).
 *
 * Cross-module links: lib/actions adminCustomAssignPlan -> POST
 * admin/subscriptions/custom-assign. Watch: the connect block keys MUST match
 * PlanConnectEntitlementsDto exactly (backend forbidNonWhitelisted) - keep in
 * sync with the backend schema.
 *
 * Admin is English-only + AntD; no i18n here by design.
 */

const FREE_DEFAULTS = {
  maxListings: 25,
  maxStorefronts: 1,
  maxCompanyPages: 1,
  maxJobs: 10,
  leadsPerMonth: -1,
  storageMb: 500,
  includedBoostCredits: 0,
  searchPriority: 0,
  verifiedBadge: false,
  overLimitPolicy: 'freeze' as 'freeze' | 'hide_newest',
  overLimitGraceDays: 30,
};

type NumericKey =
  | 'maxListings'
  | 'maxStorefronts'
  | 'maxCompanyPages'
  | 'maxJobs'
  | 'leadsPerMonth'
  | 'storageMb'
  | 'includedBoostCredits'
  | 'searchPriority'
  | 'overLimitGraceDays';

// Numeric connect caps. -1 = unlimited where the min allows it.
const NUMERIC_FIELDS: Array<{ key: NumericKey; label: string; min: number }> = [
  { key: 'maxListings', label: 'Listings (-1 = unlimited)', min: -1 },
  { key: 'maxStorefronts', label: 'Storefronts (-1 = unlimited)', min: -1 },
  { key: 'maxCompanyPages', label: 'Company pages (-1 = unlimited)', min: -1 },
  { key: 'maxJobs', label: 'Open jobs (-1 = unlimited)', min: -1 },
  { key: 'leadsPerMonth', label: 'Leads / month (-1 = unlimited)', min: -1 },
  { key: 'storageMb', label: 'Storage MB (-1 = unlimited)', min: -1 },
  { key: 'includedBoostCredits', label: 'Boost credits / cycle', min: 0 },
  { key: 'searchPriority', label: 'Search priority', min: 0 },
  { key: 'overLimitGraceDays', label: 'Over-limit grace days', min: 0 },
];

export interface ConnectCustomAssignFormProps {
  userId: string;
  /** Called after a successful assignment so the parent can refetch + reload. */
  onAssigned: () => void;
}

export function ConnectCustomAssignForm({ userId, onAssigned }: ConnectCustomAssignFormProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const billingCycle = Form.useWatch('billingCycle', form) as string | undefined;

  // Auto-fill the period end from the chosen cycle (mirrors the ERP custom tab).
  const onCycleChange = (cycle: string) => {
    if (cycle === 'lifetime') return;
    const start = dayjs();
    const end = cycle === 'yearly' ? start.add(1, 'year') : start.add(1, 'month');
    form.setFieldValue('dateRange', [start, end]);
  };

  const disabledDate = (current: dayjs.Dayjs) => current && current < dayjs().startOf('day');

  const submit = async () => {
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return; // inline validation errors
    }
    setSaving(true);
    try {
      const isLifetime = values.billingCycle === 'lifetime';
      const range = values.dateRange as [dayjs.Dayjs, dayjs.Dayjs] | undefined;
      const startDate = isLifetime ? new Date().toISOString() : range![0].toISOString();
      const endDate = isLifetime ? new Date('2099-12-31').toISOString() : range![1].toISOString();
      await adminCustomAssignPlan({
        userId,
        product: 'connect',
        entitlements: {
          // ERP side is empty for a Connect sub; the connect block carries the limits.
          maxWorkspaces: 0,
          maxMembersPerWorkspace: 0,
          maxTotalMembers: 0,
          modules: [],
          features: {
            export: false,
            apiAccess: false,
            advancedRbac: false,
            customRoles: false,
            shifts: false,
            bills: false,
          },
          moduleAccess: [],
          connect: {
            maxListings: values.maxListings as number,
            maxStorefronts: values.maxStorefronts as number,
            maxCompanyPages: values.maxCompanyPages as number,
            maxJobs: values.maxJobs as number,
            leadsPerMonth: values.leadsPerMonth as number,
            storageMb: values.storageMb as number,
            includedBoostCredits: values.includedBoostCredits as number,
            searchPriority: values.searchPriority as number,
            verifiedBadge: values.verifiedBadge as boolean,
            overLimitPolicy: values.overLimitPolicy as 'freeze' | 'hide_newest',
            overLimitGraceDays: values.overLimitGraceDays as number,
          },
        },
        startDate,
        endDate,
        billingCycle: values.billingCycle as 'monthly' | 'yearly' | 'lifetime',
        status: values.status as 'active' | 'trial',
      });
      message.success('Custom Connect plan assigned.');
      onAssigned();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={{ billingCycle: 'monthly', status: 'active', ...FREE_DEFAULTS }}
    >
      <Form.Item name="billingCycle" label="Billing Cycle" rules={[{ required: true }]}>
        <Radio.Group
          onChange={(e) => onCycleChange(e.target.value as string)}
          optionType="button"
          options={[
            { value: 'monthly', label: 'Monthly' },
            { value: 'yearly', label: 'Yearly' },
            { value: 'lifetime', label: 'Lifetime' },
          ]}
        />
      </Form.Item>

      {billingCycle !== 'lifetime' && (
        <Form.Item
          name="dateRange"
          label="Subscription Period"
          rules={[{ required: true, message: 'Pick a period' }]}
        >
          <DatePicker.RangePicker style={{ width: '100%' }} disabledDate={disabledDate} />
        </Form.Item>
      )}

      <Form.Item name="status" label="Status">
        <Radio.Group
          optionType="button"
          options={[
            { value: 'active', label: 'Active' },
            { value: 'trial', label: 'Trial' },
          ]}
        />
      </Form.Item>

      <div
        style={{
          display: 'grid',
          gap: '0 16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        }}
      >
        {NUMERIC_FIELDS.map((f) => (
          <Form.Item key={f.key} name={f.key} label={f.label}>
            <InputNumber min={f.min} step={1} style={{ width: '100%' }} />
          </Form.Item>
        ))}
        <Form.Item name="verifiedBadge" label="Verified badge">
          <Select
            options={[
              { value: false, label: 'No' },
              { value: true, label: 'Yes' },
            ]}
          />
        </Form.Item>
        <Form.Item name="overLimitPolicy" label="Over-limit policy">
          <Select
            options={[
              { value: 'freeze', label: 'Freeze' },
              { value: 'hide_newest', label: 'Hide newest' },
            ]}
          />
        </Form.Item>
      </div>

      <Button type="primary" block loading={saving} onClick={submit}>
        Assign Custom Connect Plan
      </Button>
    </Form>
  );
}
