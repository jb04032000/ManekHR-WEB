'use client';

import * as React from 'react';
import { Button, Card, DatePicker, Form, Input, InputNumber, Radio, Select, Tag } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import {
  ModuleAccessEditor,
  getDefaultModuleAccessEntries,
} from '@/components/admin/module-access-editor';
import { getTierColor } from '@/lib/utils/subscription.utils';
import type { Plan, Tier, PlanEntitlements, ModuleAccessEntry } from '@/types';

/**
 * Business (ERP) plan-assignment tab bodies, extracted from app/admin/users so
 * BOTH the legacy "Manage Plan" modal and the new unified ManagePlansDrawer can
 * render the same UI (kept DRY - single source of truth for these forms).
 *
 * These are presentational: the host page owns data fetching, the selected-plan
 * state, and the assign handlers, and passes them in as props. Cross-module
 * links: adminAssignPlan / adminCustomAssignPlan (the host calls them),
 * components/admin/module-access-editor (the module grid).
 *
 * Admin is English-only + AntD (matches app/admin/*); no i18n here by design.
 */

/** Plan entitlement defaults used to pre-fill the custom-assignment form. */
export const getEntitlementsDefaults = (plan: Plan): PlanEntitlements => {
  return {
    maxWorkspaces: plan.entitlements?.maxWorkspaces ?? 1,
    maxMembersPerWorkspace: plan.entitlements?.maxMembersPerWorkspace ?? 5,
    maxTotalMembers: plan.entitlements?.maxTotalMembers ?? 5,
    modules: plan.entitlements?.modules ?? [],
    features: plan.entitlements?.features ?? {
      export: false,
      apiAccess: false,
      advancedRbac: false,
      customRoles: false,
      shifts: false,
      bills: false,
    },
    moduleAccess: plan.entitlements?.moduleAccess ?? getDefaultModuleAccessEntries(),
  };
};

export interface ExistingPlanTabProps {
  plans: Plan[];
  tiers: Tier[];
  selectedPlan: Plan | null;
  setSelectedPlan: (plan: Plan | null) => void;
  handlePlanSelect: (planId: string, form: FormInstance) => void;
  saving: boolean;
  handleAssignPlan: (form: FormInstance) => void;
}

export function ExistingPlanTab({
  plans,
  tiers,
  selectedPlan,
  handlePlanSelect,
  saving,
  handleAssignPlan,
}: ExistingPlanTabProps) {
  const [form] = Form.useForm();

  return (
    <Form form={form} layout="vertical">
      <Form.Item
        name="planId"
        label="Select Plan"
        rules={[{ required: true, message: 'Please select a plan' }]}
      >
        <Select
          placeholder="Choose a plan"
          onChange={(planId) => handlePlanSelect(planId, form)}
          size="large"
        >
          {plans
            .filter((p: Plan) => p.isActive)
            .map((p: Plan) => (
              <Select.Option key={p._id} value={p._id}>
                <div className="flex items-center justify-between">
                  <span>
                    <Tag color={getTierColor(tiers, p.tier)} className="mr-2">
                      {p.tier}
                    </Tag>
                    {p.name}
                  </span>
                  <span className="text-subtle">₹{p.monthlyPrice}/mo</span>
                </div>
              </Select.Option>
            ))}
        </Select>
      </Form.Item>

      {selectedPlan && (
        <Card size="small" className="mb-4 bg-gray-50">
          <p className="mb-2 font-semibold">Plan Details:</p>
          <p>
            Max Workspaces:{' '}
            {selectedPlan.entitlements?.maxWorkspaces === -1
              ? 'Unlimited'
              : selectedPlan.entitlements?.maxWorkspaces}
          </p>
          <p>
            Max Members per Workspace:{' '}
            {selectedPlan.entitlements?.maxMembersPerWorkspace === -1
              ? 'Unlimited'
              : selectedPlan.entitlements?.maxMembersPerWorkspace}
          </p>
          <p>
            Max Total Members:{' '}
            {selectedPlan.entitlements?.maxTotalMembers === -1
              ? 'Unlimited'
              : selectedPlan.entitlements?.maxTotalMembers}
          </p>
        </Card>
      )}

      <Form.Item name="billingCycle" label="Billing Cycle" rules={[{ required: true }]}>
        <Radio.Group>
          <Radio.Button value="monthly">Monthly</Radio.Button>
          <Radio.Button value="yearly">Yearly</Radio.Button>
          <Radio.Button value="lifetime">Lifetime</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item name="note" label="Admin Note (optional)">
        <Input.TextArea rows={2} placeholder="Reason for this assignment..." />
      </Form.Item>

      <Button
        type="primary"
        block
        loading={saving}
        onClick={() => handleAssignPlan(form)}
        disabled={!selectedPlan}
      >
        Assign Plan
      </Button>
    </Form>
  );
}

export interface CustomPlanTabProps {
  plans: Plan[];
  tiers: Tier[];
  handleCustomPlanSelect: (planId: string, customForm: FormInstance) => void;
  disabledDate: (current: dayjs.Dayjs) => boolean;
  moduleAccess: ModuleAccessEntry[];
  setModuleAccess: (access: ModuleAccessEntry[]) => void;
  saving: boolean;
  handleCustomAssign: (customForm: FormInstance) => void;
}

export function CustomPlanTab({
  plans,
  tiers,
  handleCustomPlanSelect,
  disabledDate,
  moduleAccess,
  setModuleAccess,
  saving,
  handleCustomAssign,
}: CustomPlanTabProps) {
  const [customForm] = Form.useForm();
  const selectedBillingCycle = Form.useWatch('billingCycle', customForm);
  const isLifetime = selectedBillingCycle === 'lifetime';

  const calculateEndDate = (startDate: dayjs.Dayjs, billingCycle: string): dayjs.Dayjs => {
    if (billingCycle === 'yearly') {
      return startDate.add(1, 'year').subtract(1, 'day');
    }
    return startDate.add(1, 'month').subtract(1, 'day');
  };

  const handleDateChange = (dates: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => {
    if (!dates || !dates[0] || isLifetime) return;

    const billingCycle = customForm.getFieldValue('billingCycle') || 'monthly';
    const endDate = calculateEndDate(dates[0], billingCycle);

    customForm.setFieldValue('dateRange', [dates[0], endDate]);
  };

  const handleBillingCycleChange = (cycle: string) => {
    if (cycle === 'lifetime') {
      customForm.setFieldValue('dateRange', undefined);
      return;
    }

    const currentRange = customForm.getFieldValue('dateRange');
    const startDate = currentRange?.[0] || dayjs();
    const endDate = calculateEndDate(startDate, cycle);
    customForm.setFieldValue('dateRange', [startDate, endDate]);
  };

  // Initialize date range on mount
  React.useEffect(() => {
    const billingCycle = customForm.getFieldValue('billingCycle') || 'monthly';
    if (billingCycle !== 'lifetime') {
      const startDate = dayjs();
      const endDate = calculateEndDate(startDate, billingCycle);
      customForm.setFieldValue('dateRange', [startDate, endDate]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Form form={customForm} layout="vertical">
      <Form.Item name="basePlanId" label="Base Plan (optional - pre-fills entitlements)">
        <Select
          placeholder="Select base plan or leave empty"
          allowClear
          onChange={(planId) => handleCustomPlanSelect(planId, customForm)}
          size="large"
        >
          {plans.map((p: Plan) => (
            <Select.Option key={p._id} value={p._id}>
              <Tag color={getTierColor(tiers, p.tier)} className="mr-2">
                {p.tier}
              </Tag>
              {p.name}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item
        name="billingCycle"
        label="Billing Cycle"
        rules={[{ required: true }]}
        initialValue="monthly"
      >
        <Radio.Group onChange={(e) => handleBillingCycleChange(e.target.value)}>
          <Radio.Button value="monthly">Monthly</Radio.Button>
          <Radio.Button value="yearly">Yearly</Radio.Button>
          <Radio.Button value="lifetime">Lifetime</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {!isLifetime && (
        <Form.Item
          name="dateRange"
          label="Subscription Period"
          rules={[{ required: true, message: 'Please select date range' }]}
        >
          <DatePicker.RangePicker
            style={{ width: '100%' }}
            disabledDate={disabledDate}
            size="large"
            onChange={handleDateChange}
          />
        </Form.Item>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Form.Item
          name="maxWorkspaces"
          label="Max Workspaces"
          rules={[{ required: true }]}
          initialValue={1}
        >
          <InputNumber min={1} className="w-full" size="large" />
        </Form.Item>
        <Form.Item
          name="maxMembersPerWorkspace"
          label="Max Members/Workspace"
          rules={[{ required: true }]}
          initialValue={5}
        >
          <InputNumber min={1} className="w-full" size="large" />
        </Form.Item>
        <Form.Item
          name="maxTotalMembers"
          label="Max Total Members"
          rules={[{ required: true }]}
          initialValue={5}
        >
          <InputNumber min={1} className="w-full" size="large" />
        </Form.Item>
      </div>

      <Form.Item name="status" label="Status" initialValue="active">
        <Radio.Group>
          <Radio.Button value="active">Active</Radio.Button>
          <Radio.Button value="trial">Trial</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <div className="mb-4">
        <p className="mb-2 font-semibold">Module Access:</p>
        <ModuleAccessEditor moduleAccess={moduleAccess} onChange={setModuleAccess} />
      </div>

      <Form.Item name="note" label="Admin Note (optional)">
        <Input.TextArea rows={2} placeholder="Reason for this assignment..." />
      </Form.Item>

      <Button type="primary" block loading={saving} onClick={() => handleCustomAssign(customForm)}>
        Assign Custom Plan
      </Button>
    </Form>
  );
}
