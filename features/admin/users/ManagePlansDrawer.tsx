'use client';

import { useEffect, useState } from 'react';
import { App, Card, Drawer, Tabs } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import { adminAssignPlan, adminCustomAssignPlan } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { getDefaultModuleAccessEntries } from '@/components/admin/module-access-editor';
import { ExistingPlanTab, CustomPlanTab, getEntitlementsDefaults } from './PlanAssignmentTabs';
import type {
  AdminUserWithSubscription,
  Plan,
  Tier,
  PlanEntitlements,
  ModuleAccessEntry,
} from '@/types';

/**
 * "Manage Plan" drawer for one person: assign an existing ERP plan or build a
 * custom assignment. Replaces the legacy "Manage Plan" modal on the admin
 * Users page.
 *
 * Reuses the extracted ExistingPlanTab / CustomPlanTab (PlanAssignmentTabs)
 * so the plan-assignment UI stays DRY with the legacy modal.
 *
 * Cross-module links: adminAssignPlan / adminCustomAssignPlan (lib/actions).
 * The host (app/admin/users) passes the plans + tiers it already loaded and an
 * onRefetch to refresh the user row after any assign.
 *
 * Admin is English-only + AntD (matches app/admin/*); no i18n here by design.
 */

interface ExistingPlanFormValues {
  planId: string;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  note?: string;
}

interface CustomPlanFormValues {
  basePlanId?: string;
  dateRange?: [dayjs.Dayjs, dayjs.Dayjs];
  maxWorkspaces: number;
  maxMembersPerWorkspace: number;
  maxTotalMembers: number;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  status: 'active' | 'trial';
  note?: string;
}

export interface ManagePlansDrawerProps {
  open: boolean;
  onClose: () => void;
  user: AdminUserWithSubscription | null;
  plans: Plan[];
  tiers: Tier[];
  /** Refresh the users table row after any assign. */
  onRefetch: () => void;
}

export function ManagePlansDrawer({
  open,
  onClose,
  user,
  plans,
  tiers,
  onRefetch,
}: ManagePlansDrawerProps) {
  const { message } = App.useApp();

  const [erpTab, setErpTab] = useState('existing');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessEntry[]>(
    getDefaultModuleAccessEntries(),
  );
  const [savingErp, setSavingErp] = useState(false);

  // Re-seed everything whenever the drawer opens for a (new) user.
  useEffect(() => {
    if (!open || !user) return;
    setErpTab('existing');
    setSelectedPlan(null);
    setModuleAccess(getDefaultModuleAccessEntries());
  }, [open, user]);

  const disabledDate = (current: dayjs.Dayjs) => current && current < dayjs().startOf('day');

  // ── Existing plan ───────────────────────────────────
  const handlePlanSelect = (planId: string, form: FormInstance) => {
    const plan = plans.find((p) => p._id === planId);
    setSelectedPlan(plan || null);
    if (plan) form.setFieldsValue({ billingCycle: 'monthly' });
  };

  const handleAssignPlan = async (form: FormInstance) => {
    if (!user || !selectedPlan) return;
    try {
      const values = (await form.validateFields()) as ExistingPlanFormValues;
      setSavingErp(true);
      const entitlements: PlanEntitlements = {
        maxWorkspaces: selectedPlan.entitlements?.maxWorkspaces ?? 1,
        maxMembersPerWorkspace: selectedPlan.entitlements?.maxMembersPerWorkspace ?? 5,
        maxTotalMembers: selectedPlan.entitlements?.maxTotalMembers ?? 5,
        modules: selectedPlan.entitlements?.modules ?? [],
        features: selectedPlan.entitlements?.features ?? {
          export: false,
          apiAccess: false,
          advancedRbac: false,
          customRoles: false,
          shifts: false,
          bills: false,
        },
        moduleAccess: selectedPlan.entitlements?.moduleAccess ?? getDefaultModuleAccessEntries(),
      };
      await adminAssignPlan({
        userId: user._id,
        planId: values.planId,
        billingCycle: values.billingCycle,
        entitlements,
        note: values.note,
      });
      message.success('Business plan assigned.');
      onRefetch();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return; // form validation, not an API error
      message.error(parseApiError(e));
    } finally {
      setSavingErp(false);
    }
  };

  // ── Custom assignment ───────────────────────────────
  const handleCustomPlanSelect = (planId: string, customForm: FormInstance) => {
    if (planId) {
      const plan = plans.find((p) => p._id === planId);
      if (plan) {
        const entitlements = getEntitlementsDefaults(plan);
        customForm.setFieldsValue({
          maxWorkspaces: entitlements.maxWorkspaces,
          maxMembersPerWorkspace: entitlements.maxMembersPerWorkspace,
          maxTotalMembers: entitlements.maxTotalMembers,
        });
        setModuleAccess(entitlements.moduleAccess || getDefaultModuleAccessEntries());
      }
    } else {
      customForm.setFieldsValue({
        maxWorkspaces: 1,
        maxMembersPerWorkspace: 5,
        maxTotalMembers: 5,
      });
      setModuleAccess(getDefaultModuleAccessEntries());
    }
  };

  const handleCustomAssign = async (customForm: FormInstance) => {
    if (!user) return;
    try {
      const values = (await customForm.validateFields()) as CustomPlanFormValues;
      setSavingErp(true);
      const entitlements: PlanEntitlements = {
        maxWorkspaces: values.maxWorkspaces,
        maxMembersPerWorkspace: values.maxMembersPerWorkspace,
        maxTotalMembers: values.maxTotalMembers,
        modules: [],
        features: {
          export: false,
          apiAccess: false,
          advancedRbac: false,
          customRoles: false,
          shifts: false,
          bills: false,
        },
        moduleAccess,
      };
      const isLifetimeCycle = values.billingCycle === 'lifetime';
      const startDate = isLifetimeCycle
        ? new Date().toISOString()
        : values.dateRange![0].toISOString();
      const endDate = isLifetimeCycle
        ? new Date('2099-12-31').toISOString()
        : values.dateRange![1].toISOString();
      await adminCustomAssignPlan({
        userId: user._id,
        planId: values.basePlanId || undefined,
        entitlements,
        startDate,
        endDate,
        billingCycle: values.billingCycle,
        status: values.status || 'active',
        note: values.note,
      });
      message.success('Custom business plan assigned.');
      onRefetch();
    } catch (e) {
      if ((e as { errorFields?: unknown }).errorFields) return;
      message.error(parseApiError(e));
    } finally {
      setSavingErp(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="font-display font-bold">Manage Plan{user ? ` - ${user.name}` : ''}</span>
      }
      // v6 Drawer takes width via `size` (number | string); clamped on narrow screens.
      size="min(640px, 96vw)"
      destroyOnHidden
    >
      {!user ? null : (
        <Card
          title={<span className="font-display font-bold">Business (ERP)</span>}
          styles={{ body: { paddingTop: 12 } }}
        >
          <Tabs
            activeKey={erpTab}
            onChange={setErpTab}
            items={[
              {
                key: 'existing',
                label: 'Assign Existing Plan',
                children: (
                  <ExistingPlanTab
                    plans={plans}
                    tiers={tiers}
                    selectedPlan={selectedPlan}
                    setSelectedPlan={setSelectedPlan}
                    handlePlanSelect={handlePlanSelect}
                    saving={savingErp}
                    handleAssignPlan={handleAssignPlan}
                  />
                ),
              },
              {
                key: 'custom',
                label: 'Custom Assignment',
                children: (
                  <CustomPlanTab
                    plans={plans}
                    tiers={tiers}
                    handleCustomPlanSelect={handleCustomPlanSelect}
                    disabledDate={disabledDate}
                    moduleAccess={moduleAccess}
                    setModuleAccess={setModuleAccess}
                    saving={savingErp}
                    handleCustomAssign={handleCustomAssign}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
    </Drawer>
  );
}
