'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Divider,
  Drawer,
  Empty,
  Form,
  Select,
  Space,
  Spin,
  Tabs,
  Tag,
} from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';
import { adminAssignPlan, adminCustomAssignPlan } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { getDefaultModuleAccessEntries } from '@/components/admin/module-access-editor';
import { ExistingPlanTab, CustomPlanTab, getEntitlementsDefaults } from './PlanAssignmentTabs';
import { ConnectWalletCard } from './ConnectWalletCard';
import { ConnectCustomAssignForm } from './ConnectCustomAssignForm';
import { ConnectEntitlementsPanel } from '@/features/connect/admin/entitlements/ConnectEntitlementsPanel';
import {
  getConnectEntitlements,
  setConnectEntitlementsOverride,
  clearConnectEntitlementsOverride,
} from '@/features/connect/admin/entitlements/entitlements.actions';
import type {
  AdminConnectEntitlementsView,
  ConnectAllowances,
} from '@/features/connect/admin/entitlements/entitlements.types';
import type {
  AdminUserWithSubscription,
  Plan,
  Tier,
  PlanEntitlements,
  ModuleAccessEntry,
} from '@/types';

/**
 * Unified "Manage Plans" drawer for one person: Business (ERP) on the left,
 * Connect on the right. Replaces the ERP-only "Manage Plan" modal on the admin
 * Users page now that a person can hold an ERP plan AND a Connect/bundle plan at
 * once.
 *
 * LEFT reuses the extracted ExistingPlanTab / CustomPlanTab (PlanAssignmentTabs)
 * so the ERP assignment UI stays DRY with the legacy modal. RIGHT has three
 * stacked sections: assign a Connect/bundle package (reuses adminAssignPlan -
 * the backend derives product from the plan), embed the existing
 * ConnectEntitlementsPanel for per-user custom limits, and embed
 * ConnectWalletCard for boost credits.
 *
 * Cross-module links: adminAssignPlan / adminCustomAssignPlan (ERP + Connect
 * package), features/connect/admin/entitlements (panel + override actions),
 * ConnectWalletCard (boost wallet). The host (app/admin/users) passes the plans
 * + tiers it already loaded and an onRefetch to refresh the user row after any
 * assign / override.
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
  /** Refresh the users table row after any assign / override. */
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

  // ── Business (ERP) side ─────────────────────────────
  const [erpTab, setErpTab] = useState('existing');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessEntry[]>(
    getDefaultModuleAccessEntries(),
  );
  const [savingErp, setSavingErp] = useState(false);

  // ── Connect package side ────────────────────────────
  const [connectPlanId, setConnectPlanId] = useState<string | undefined>(undefined);
  const [assigningConnect, setAssigningConnect] = useState(false);

  // ── Connect custom-limits (entitlements) embed ──────
  const [entView, setEntView] = useState<AdminConnectEntitlementsView | null>(null);
  const [entLoading, setEntLoading] = useState(false);
  const [entError, setEntError] = useState<string | null>(null);
  const [entSaving, setEntSaving] = useState(false);

  // Connect/bundle plans only - the backend derives product from the plan, so
  // assigning any of these grants the person their Connect allowances. Always
  // includes a seeded Free plan if present ("assign Free, then tune" flow).
  const connectPlans = plans.filter(
    (p) => p.isActive && (p.product === 'connect' || p.product === 'bundle'),
  );

  const loadEntitlements = useCallback(async (userId: string) => {
    setEntLoading(true);
    setEntError(null);
    setEntView(null);
    try {
      const v = await getConnectEntitlements(userId);
      setEntView(v);
    } catch (e) {
      setEntError(parseApiError(e));
    } finally {
      setEntLoading(false);
    }
  }, []);

  // Re-seed everything whenever the drawer opens for a (new) user.
  useEffect(() => {
    if (!open || !user) return;
    setErpTab('existing');
    setSelectedPlan(null);
    setModuleAccess(getDefaultModuleAccessEntries());
    setConnectPlanId(undefined);
    loadEntitlements(user._id);
  }, [open, user, loadEntitlements]);

  const disabledDate = (current: dayjs.Dayjs) => current && current < dayjs().startOf('day');

  // ── ERP: existing plan ──────────────────────────────
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

  // ── ERP: custom assignment ──────────────────────────
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

  // ── Connect: assign package ─────────────────────────
  const handleAssignConnect = async () => {
    if (!user || !connectPlanId) return;
    const plan = connectPlans.find((p) => p._id === connectPlanId);
    if (!plan) return;
    setAssigningConnect(true);
    try {
      // Reuse the ERP assign endpoint - the backend derives product from the
      // plan (connect/bundle), so no extra field is needed. We still send the
      // plan's entitlements so workspace caps on a bundle plan are honoured.
      const entitlements: PlanEntitlements = {
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
        connect: plan.entitlements?.connect,
      };
      await adminAssignPlan({
        userId: user._id,
        planId: plan._id,
        billingCycle: 'monthly',
        entitlements,
      });
      message.success('Connect package assigned.');
      setConnectPlanId(undefined);
      onRefetch();
      // Refresh the embedded custom-limits panel so plan defaults reflect the
      // newly assigned package (and the "assign first" prompt clears).
      await loadEntitlements(user._id);
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setAssigningConnect(false);
    }
  };

  // ── Connect: custom-limits override save / clear ────
  const handleEntSave = async (override: Partial<ConnectAllowances>) => {
    if (!user || !entView) return;
    setEntSaving(true);
    try {
      const v = await setConnectEntitlementsOverride(user._id, override);
      setEntView(v);
      message.success('Connect limits updated.');
      onRefetch();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setEntSaving(false);
    }
  };

  const handleEntClear = async () => {
    if (!user || !entView) return;
    setEntSaving(true);
    try {
      const v = await clearConnectEntitlementsOverride(user._id);
      setEntView(v);
      message.success('Connect overrides cleared.');
      onRefetch();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setEntSaving(false);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={
        <span className="font-display font-bold">Manage Plans{user ? ` - ${user.name}` : ''}</span>
      }
      // v6 Drawer takes width via `size` (number | string). Wide on desktop,
      // clamped to 96vw on narrow screens (where the two cards wrap to a stack).
      size="min(1360px, 96vw)"
      destroyOnHidden
    >
      {!user ? null : (
        // Flex (not grid) so Connect can take MORE room than Business: the ERP
        // side is a narrow vertical form, while the Connect side embeds a wide
        // limits table that needs the width. `minWidth: 0` on each card lets the
        // embedded table's horizontal scroll bound itself instead of blowing out
        // the layout; the row wraps to a full-width stack on narrow screens.
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 24,
            alignItems: 'flex-start',
          }}
        >
          {/* LEFT - Business (ERP) */}
          <Card
            title={<span className="font-display font-bold">Business (ERP)</span>}
            styles={{ body: { paddingTop: 12 } }}
            style={{ flex: '1 1 340px', minWidth: 0 }}
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

          {/* RIGHT - Connect (gets ~1.5x the width: it hosts the wide limits table) */}
          <Card
            title={<span className="font-display font-bold">Connect</span>}
            styles={{ body: { paddingTop: 12 } }}
            style={{ flex: '1.5 1 460px', minWidth: 0 }}
          >
            {/* (1) Assign - mirrors the ERP side: pick an existing Connect/bundle
                package, OR build a fully custom Connect plan (no pre-made plan
                needed) via ConnectCustomAssignForm. */}
            <Tabs
              size="small"
              items={[
                {
                  key: 'existing',
                  label: 'Assign Existing Plan',
                  children:
                    connectPlans.length === 0 ? (
                      <Alert
                        type="info"
                        showIcon
                        title="No active Connect or bundle plans exist yet. Create one on the Plans page, or use Custom Assignment."
                      />
                    ) : (
                      <Form layout="vertical">
                        <Form.Item label="Connect / bundle plan" className="mb-1">
                          <Space.Compact style={{ width: '100%' }}>
                            <Select
                              style={{ width: '100%' }}
                              placeholder="Choose a Connect or bundle plan"
                              value={connectPlanId}
                              onChange={setConnectPlanId}
                              options={connectPlans.map((p) => ({
                                value: p._id,
                                label: `${p.name} (${p.product === 'bundle' ? 'Bundle' : 'Connect'} · ${p.tier})`,
                              }))}
                            />
                            <Button
                              type="primary"
                              loading={assigningConnect}
                              disabled={!connectPlanId}
                              onClick={handleAssignConnect}
                            >
                              Assign
                            </Button>
                          </Space.Compact>
                        </Form.Item>
                      </Form>
                    ),
                },
                {
                  key: 'custom',
                  label: 'Custom Assignment',
                  children: (
                    <ConnectCustomAssignForm
                      userId={user._id}
                      onAssigned={() => {
                        onRefetch();
                        loadEntitlements(user._id);
                      }}
                    />
                  ),
                },
              ]}
            />

            <Divider className="my-3" />

            {/* (2) Custom limits - embed the existing entitlements panel */}
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="font-semibold">Custom limits</span>
                {entView?.plan?.name && <Tag color="gold">{entView.plan.name}</Tag>}
                {entView?.plan?.status && <Tag>{entView.plan.status}</Tag>}
              </div>
              {entLoading ? (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <Spin />
                </div>
              ) : entError ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span>Could not load Connect limits. {entError}</span>}
                >
                  <Button onClick={() => user && loadEntitlements(user._id)}>Retry</Button>
                </Empty>
              ) : entView ? (
                <ConnectEntitlementsPanel
                  view={entView}
                  saving={entSaving}
                  onSave={handleEntSave}
                  onClear={handleEntClear}
                  dense
                />
              ) : null}
            </div>

            <Divider className="my-3" />

            {/* (3) Boost credits - embed the wallet card */}
            <div>
              <p className="mb-2 font-semibold">Boost credits</p>
              <ConnectWalletCard userId={user._id} onAdjusted={onRefetch} />
            </div>
          </Card>
        </div>
      )}
    </Drawer>
  );
}
