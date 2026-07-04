'use client';
import { useEffect, useState, useCallback, useRef, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Space,
  Popconfirm,
  message,
  Tag,
  Row,
  Col,
  Divider,
  Tooltip,
  Alert,
  Modal as ConfirmModal,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CrownOutlined,
  ThunderboltOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import {
  getAdminPlans,
  createAdminPlan,
  updateAdminPlan,
  deleteAdminPlan,
  getTiers,
} from '@/lib/actions';
import type {
  Plan,
  ModuleAccessEntry,
  Tier,
  PlatformAccess,
  CreatePlanPayload,
  LocalizedText,
} from '@/types';
import { parseApiError } from '@/lib/utils';
import {
  FEATURE_ACCESS_REGISTRY,
  FEATURE_ACCESS_MAP,
} from '@/lib/constants/feature-access.registry';
import { ModuleAccessEditor } from '@/components/admin/module-access-editor';
import {
  getTierColor,
  countUnlockedFeatures,
  formatEntitlementValue,
  getDefaultModuleAccessEntries,
  isTierAtOrAbove,
  reconcileModuleAccessWithRegistry,
} from '@/lib/utils/subscription.utils';
import { EntitlementsFormFields } from '@/components/admin/entitlements-form-fields';
import { EntitlementsDisplay } from '@/components/admin/entitlements-display';
import { CommunicationsEditor } from '@/components/admin/communications-editor';
import type { PlanCommunicationsEntitlements } from '@/types';

const { Option } = Select;

function getDefaultModuleAccessFromTier(tier: Tier | null): ModuleAccessEntry[] {
  // Both paths are reconciled against FEATURE_ACCESS_REGISTRY so the editor can
  // manage every module + sub-feature key. The registry-fallback branch is
  // already complete (reconcile is idempotent + safe there); the
  // tier.defaultModuleAccess branch is the drift source — older tier defaults
  // carry no entry for newer modules (machines/locations/...), so without this
  // their editor controls were dead no-ops. See reconcileModuleAccessWithRegistry.
  if (!tier?.defaultModuleAccess || tier.defaultModuleAccess.length === 0) {
    return reconcileModuleAccessWithRegistry(
      FEATURE_ACCESS_REGISTRY.filter((mod) => mod.module !== 'bills').map((mod) => ({
        module: mod.module,
        enabled: mod.module === 'shifts' || mod.module === 'roles' ? false : true,
        subFeatures: mod.subFeatures.map((sf) => ({
          key: sf.key,
          access: 'full' as const,
        })),
      })),
    );
  }
  return reconcileModuleAccessWithRegistry(tier.defaultModuleAccess as ModuleAccessEntry[]);
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();
  // i18n for the new signup-default + trial controls (admin.plansEditor.*).
  // The rest of this admin page is still hardcoded English; only the new
  // strings are translated so all four locales stay in parity.
  const t = useTranslations('admin');

  const [moduleAccess, setModuleAccess] = useState<ModuleAccessEntry[]>([]);
  const [selectedTierKey, setSelectedTierKey] = useState<string>('free');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingTierKey, setPendingTierKey] = useState<string | null>(null);
  const [platformAccess, setPlatformAccess] = useState<string>('both');
  const [communications, setCommunications] = useState<PlanCommunicationsEntitlements>({});
  // Live product value so the Connect allowance section shows only for
  // connect / bundle plans (ERP plans never see it).
  const watchedProduct = Form.useWatch('product', form);

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [plansRes, tiersRes] = await Promise.all([getAdminPlans(), getTiers()]);
      startTransition(() => {
        setPlans(Array.isArray(plansRes) ? plansRes : []);
        setTiers(Array.isArray(tiersRes) ? tiersRes : []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const getTierDefaults = (
    tierKey: string,
  ): { maxWorkspaces: number; maxMembersPerWorkspace: number; maxTotalMembers: number } | null => {
    const tier = tiers.find((t) => t.key === tierKey);
    if (!tier?.defaultEntitlements) return null;
    return {
      maxWorkspaces: tier.defaultEntitlements.maxWorkspaces ?? 1,
      maxMembersPerWorkspace: tier.defaultEntitlements.maxMembersPerWorkspace ?? 5,
      maxTotalMembers: tier.defaultEntitlements.maxTotalMembers ?? 5,
    };
  };

  const applyTierDefaults = (tierKey: string) => {
    const tier = tiers.find((t) => t.key === tierKey);
    const newModuleAccess = getDefaultModuleAccessFromTier(tier || null);
    setModuleAccess(newModuleAccess);
    const numericDefaults = getTierDefaults(tierKey);
    if (numericDefaults) {
      // Nested shape to match <EntitlementsFormFields namePrefix="entitlements">
      // (array names -> values.entitlements.*). A dot-string key would miss the
      // visible inputs. Keep in sync with openEdit / handleSave.
      form.setFieldsValue({
        entitlements: {
          maxWorkspaces: numericDefaults.maxWorkspaces,
          maxMembersPerWorkspace: numericDefaults.maxMembersPerWorkspace,
          maxTotalMembers: numericDefaults.maxTotalMembers,
        },
      });
    }
  };

  const openAdd = () => {
    setEditing(null);
    setSelectedTierKey(tiers.length > 0 ? tiers[0].key : 'free');
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      product: 'erp',
      // New plans default to no trial + not the signup-default plan + not the
      // trial plan (whose entitlements define what the trial unlocks).
      trialDurationDays: 0,
      isDefault: false,
      isTrialPlan: false,
      // Pricing defaults: no upfront discount, installments on, split over 12.
      upfrontDiscountPercent: 0,
      installmentsEnabled: true,
      installmentMonths: 12,
      // GST defaults: ON at 18%, tax-exclusive (owner decision). Mirror backend.
      gstEnabled: true,
      gstRatePercent: 18,
      isPriceTaxInclusive: false,
      // Card content (per-plan marketing) starts empty: no tagline override, no
      // feature bullets, so the cards show the static i18n defaults until an admin
      // fills these in. Mirrors backend Plan.marketing.tagline / .featureHighlights.
      marketing: { tagline: {}, featureHighlights: [] },
      tier: tiers.length > 0 ? tiers[0].key : 'free',
      entitlements: {
        maxWorkspaces: 1,
        maxMembersPerWorkspace: 5,
        maxTotalMembers: 5,
        platformAccess: 'both',
        maxSessionsPerPlatform: 3,
        maxSessionsTotal: 5,
      },
    });
    const tier = tiers.length > 0 ? tiers[0] : null;
    setModuleAccess(getDefaultModuleAccessFromTier(tier));
    setPlatformAccess('both');
    setCommunications({});
    setValidationErrors([]);
    setModalOpen(true);
  };

  const openEdit = (p: Plan) => {
    setEditing(p);
    setSelectedTierKey(p.tier);
    // Reset first (mirrors openAdd) so a previously-opened plan's nested
    // entitlements never carry over into this one. Without this + the Modal's
    // destroyOnHidden the nested cap inputs kept the last value typed.
    form.resetFields();
    form.setFieldsValue({
      name: p.name,
      tier: p.tier,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      isActive: p.isActive,
      // Signup defaults: free-trial length + whether this is THE default plan
      // new sign-ups land on. Mirror backend Plan.trialDurationDays/isDefault.
      trialDurationDays: p.trialDurationDays ?? 0,
      isDefault: p.isDefault ?? false,
      // Whether this is THE trial plan for its product (its access = trial access).
      isTrialPlan: p.isTrialPlan ?? false,
      // Pricing knobs. Fall back to the backend defaults (0 / on / 12) when a
      // plan predates these fields so a save never silently flips them.
      upfrontDiscountPercent: p.upfrontDiscountPercent ?? 0,
      installmentsEnabled: p.installmentsEnabled ?? true,
      installmentMonths: p.installmentMonths ?? 12,
      // GST knobs. Default ON at 18% (tax-exclusive) when a plan predates the
      // fields, matching the backend contract (gstEnabled undefined/true = ON).
      gstEnabled: p.gstEnabled ?? true,
      gstRatePercent: p.gstRatePercent ?? 18,
      isPriceTaxInclusive: p.isPriceTaxInclusive ?? false,
      // Card content (per-plan marketing): prefill the tagline + feature bullets
      // from the plan so the editor is the source of truth. Empty object/array
      // when unset, so the inputs render blank (and the card falls back to static).
      marketing: {
        tagline: p.marketing?.tagline ?? {},
        featureHighlights: p.marketing?.featureHighlights ?? [],
      },
      // The three workspace caps are rendered by <EntitlementsFormFields
      // namePrefix="entitlements"> which uses NESTED array names
      // (['entitlements','maxWorkspaces']) -> AntD stores them at
      // values.entitlements.maxWorkspaces. So init them with the nested shape,
      // NOT a dot-string key (a dot-string is a single flat field AntD never
      // splits, so it would populate a disjoint hidden field, not the input).
      // Keep in sync with the shared entitlements-form-fields name shape.
      entitlements: {
        maxWorkspaces: p.entitlements?.maxWorkspaces,
        maxMembersPerWorkspace: p.entitlements?.maxMembersPerWorkspace,
        maxTotalMembers: p.entitlements?.maxTotalMembers,
      },
      'entitlements.platformAccess': p.entitlements?.platformAccess || 'both',
      'entitlements.maxSessionsPerPlatform': p.entitlements?.maxSessionsPerPlatform || 3,
      'entitlements.maxSessionsTotal': p.entitlements?.maxSessionsTotal || 5,
      'entitlements.emailsPerMonth': (p.entitlements as any)?.emailsPerMonth ?? 0,
      product: p.product || 'erp',
      'entitlements.connect.maxListings': p.entitlements?.connect?.maxListings ?? 0,
      'entitlements.connect.leadsPerMonth': p.entitlements?.connect?.leadsPerMonth ?? 0,
      'entitlements.connect.includedBoostCredits':
        p.entitlements?.connect?.includedBoostCredits ?? 0,
      'entitlements.connect.verifiedBadge': p.entitlements?.connect?.verifiedBadge ?? false,
      'entitlements.connect.searchPriority': p.entitlements?.connect?.searchPriority ?? 0,
      // Count caps. When a plan lacks them, prefill the TRUE system defaults
      // (1 company / 1 storefront / 10 jobs = CONNECT_FREE_DEFAULT_ALLOWANCES),
      // NOT -1: the effective default is LIMITED, not unlimited, so showing -1
      // would let a save silently flip the default plan to unlimited.
      'entitlements.connect.maxCompanyPages': p.entitlements?.connect?.maxCompanyPages ?? 1,
      'entitlements.connect.maxStorefronts': p.entitlements?.connect?.maxStorefronts ?? 1,
      'entitlements.connect.maxJobs': p.entitlements?.connect?.maxJobs ?? 10,
      // Over-limit (grandfathering) policy + grace window. Default freeze / 30d.
      'entitlements.connect.overLimitPolicy': p.entitlements?.connect?.overLimitPolicy ?? 'freeze',
      'entitlements.connect.overLimitGraceDays': p.entitlements?.connect?.overLimitGraceDays ?? 30,
    });

    const existingAccess = p.entitlements?.moduleAccess;
    if (existingAccess && existingAccess.length > 0) {
      // Reconcile against the registry before editing: older plans stored newer
      // modules as {enabled:true, subFeatures:[]} (FULL at runtime) or omitted
      // them entirely, so their editor controls were dead. reconcile backfills
      // the missing keys (empty-enabled → 'full' to preserve runtime FULL,
      // others → 'locked') and keeps unknown legacy modules so a save can't drop
      // persisted data. See reconcileModuleAccessWithRegistry.
      setModuleAccess(reconcileModuleAccessWithRegistry(existingAccess));
    } else {
      const tier = tiers.find((t) => t.key === p.tier);
      setModuleAccess(getDefaultModuleAccessFromTier(tier || null));
    }
    setPlatformAccess(p.entitlements?.platformAccess || 'both');
    setCommunications(
      ((p.entitlements as any)?.communications ?? {}) as PlanCommunicationsEntitlements,
    );
    setValidationErrors([]);
    setModalOpen(true);
  };

  // Deep link from the Connect admin home (?editTier=connect_free): open the
  // matching plan's editor in one click once plans load. Read from window
  // (client-only) so this admin page needs no useSearchParams Suspense boundary.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (autoOpenedRef.current || plans.length === 0 || typeof window === 'undefined') return;
    const editTier = new URLSearchParams(window.location.search).get('editTier');
    if (!editTier) return;
    const target = plans.find((p) => p.tier === editTier);
    if (target) {
      autoOpenedRef.current = true;
      openEdit(target);
    }
    // openEdit is stable enough here; the ref guards against any re-fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const handleTierChange = (tierKey: string) => {
    if (moduleAccess.length > 0) {
      setPendingTierKey(tierKey);
      setConfirmModalOpen(true);
    } else {
      setSelectedTierKey(tierKey);
      applyTierDefaults(tierKey);
    }
  };

  const confirmApplyDefaults = () => {
    if (pendingTierKey) {
      setSelectedTierKey(pendingTierKey);
      applyTierDefaults(pendingTierKey);
      setPendingTierKey(null);
    }
    setConfirmModalOpen(false);
  };

  const validateModuleAccess = (): boolean => {
    const errors: string[] = [];
    const enabledModules = moduleAccess.filter((m) => m.enabled);

    if (enabledModules.length === 0) {
      errors.push('At least one module must be enabled');
    }

    for (const mod of enabledModules) {
      const modDef = FEATURE_ACCESS_MAP[mod.module];
      if (!modDef) continue;

      for (const sf of mod.subFeatures) {
        const sfDef = modDef.subFeatures.find((s) => s.key === sf.key);
        if (sfDef && !sfDef.supportsLimited && sf.access === 'limited') {
          errors.push(`'Limited' is not supported for '${sfDef.label}' in ${modDef.label}`);
        }
      }
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = async (vals: Record<string, any>) => {
    if (!validateModuleAccess()) {
      msgApi.error('Please fix the validation errors before saving');
      return;
    }

    setSaving(true);
    const product = (vals.product as CreatePlanPayload['product']) ?? 'erp';

    // Card content (per-plan marketing): build the localized tagline + ordered
    // feature bullets from the form. Blank locales (and rows with a blank en, the
    // canonical/required locale) are dropped so the card falls back to the static
    // i18n copy (pickLocalized in ErpPricingTable / PlanCard). We spread the plan's
    // EXISTING marketing first so the $set on the whole marketing object never wipes
    // untouched subfields (badge / displayOrder / isHighlighted / ...) this form
    // does not edit. Mirrors backend Plan.marketing.tagline / .featureHighlights.
    const cleanLocalized = (v?: Record<string, unknown>): LocalizedText | undefined => {
      if (!v) return undefined;
      const en = String(v.en ?? '').trim();
      if (!en) return undefined;
      const out: LocalizedText = { en };
      for (const k of ['gu', 'gu-en', 'hi-en'] as const) {
        const s = String(v[k] ?? '').trim();
        if (s) out[k] = s;
      }
      return out;
    };
    const marketingVals = (vals.marketing ?? {}) as {
      tagline?: Record<string, unknown>;
      featureHighlights?: Array<Record<string, unknown> | undefined>;
    };
    const taglineClean = cleanLocalized(marketingVals.tagline);
    const featuresClean = (
      Array.isArray(marketingVals.featureHighlights) ? marketingVals.featureHighlights : []
    )
      .map((row) => cleanLocalized(row))
      .filter((row): row is LocalizedText => Boolean(row));
    const marketing = {
      ...(editing?.marketing ?? {}),
      tagline: taglineClean,
      featureHighlights: featuresClean,
    };

    const payload = {
      name: vals.name as string,
      tier: vals.tier as string,
      product,
      monthlyPrice: vals.monthlyPrice as number,
      yearlyPrice: vals.yearlyPrice as number,
      isActive: vals.isActive as boolean,
      // Signup controls. trialDurationDays sent as a number (0 = no trial).
      // isDefault sent as a boolean; backend clears the prior default on this
      // product when it's true (single-default invariant) so we only send true.
      // Mirrors backend CreatePlanDto.trialDurationDays / .isDefault.
      trialDurationDays: (vals.trialDurationDays as number) ?? 0,
      isDefault: (vals.isDefault as boolean) ?? false,
      // Trial-plan flag. When true the backend forces isPubliclyVisible:false
      // (never buyable) and clears any prior trial plan on this product
      // (single-trial invariant, like isDefault). Mirrors backend CreatePlanDto.
      isTrialPlan: (vals.isTrialPlan as boolean) ?? false,
      // Pricing knobs. upfrontDiscountPercent = % off the yearly price for a
      // single upfront payment; installmentsEnabled = allow 0%-interest monthly
      // installments; installmentMonths = how many the yearly price splits into.
      // Mirror backend CreatePlanDto; enforced server-side (0-100 / bool / 1-24).
      upfrontDiscountPercent: (vals.upfrontDiscountPercent as number) ?? 0,
      installmentsEnabled: (vals.installmentsEnabled as boolean) ?? true,
      installmentMonths: (vals.installmentMonths as number) ?? 12,
      // GST controls — TOP-LEVEL (not inside entitlements), mirroring the backend
      // CreatePlanDto. Default ON at 18% (tax-exclusive) when a field is absent.
      // gstEnabled false makes the backend zero GST everywhere; the rate is then
      // ignored. Keep in sync with openAdd/openEdit defaults.
      gstEnabled: (vals.gstEnabled as boolean) ?? true,
      gstRatePercent: (vals.gstRatePercent as number) ?? 18,
      isPriceTaxInclusive: (vals.isPriceTaxInclusive as boolean) ?? false,
      entitlements: {
        // The three caps come back NESTED (values.entitlements.*) because
        // <EntitlementsFormFields namePrefix="entitlements"> uses array names.
        // Read them off vals.entitlements, not the old dot-string key (which is
        // a disjoint field that stays undefined -> would persist the ?? fallback,
        // not the value the admin actually typed). Keep in sync with openEdit.
        maxWorkspaces: (vals.entitlements?.maxWorkspaces as number) ?? 1,
        maxMembersPerWorkspace: (vals.entitlements?.maxMembersPerWorkspace as number) ?? 5,
        maxTotalMembers: (vals.entitlements?.maxTotalMembers as number) ?? 5,
        platformAccess: (vals['entitlements.platformAccess'] as PlatformAccess) ?? 'both',
        maxSessionsPerPlatform: (vals['entitlements.maxSessionsPerPlatform'] as number) ?? -1,
        maxSessionsTotal: (vals['entitlements.maxSessionsTotal'] as number) ?? -1,
        emailsPerMonth: (vals['entitlements.emailsPerMonth'] as number) ?? 0,
        modules: moduleAccess.filter((m) => m.enabled).map((m) => m.module),
        features: {
          export: selectedTierKey !== 'free',
          apiAccess: selectedTierKey === 'enterprise',
          advancedRbac: selectedTierKey !== 'free',
          customRoles: selectedTierKey !== 'free',
          shifts: selectedTierKey !== 'free',
          bills: false,
        },
        moduleAccess,
        communications,
        ...(product !== 'erp'
          ? {
              connect: {
                maxListings: (vals['entitlements.connect.maxListings'] as number) ?? 0,
                leadsPerMonth: (vals['entitlements.connect.leadsPerMonth'] as number) ?? 0,
                includedBoostCredits:
                  (vals['entitlements.connect.includedBoostCredits'] as number) ?? 0,
                verifiedBadge: (vals['entitlements.connect.verifiedBadge'] as boolean) ?? false,
                searchPriority: (vals['entitlements.connect.searchPriority'] as number) ?? 0,
                // Count caps: company pages / storefronts / open jobs. -1 =
                // unlimited. Fall back to the TRUE system defaults (1/1/10), not
                // -1, so a cleared field never silently grants unlimited.
                maxCompanyPages: (vals['entitlements.connect.maxCompanyPages'] as number) ?? 1,
                maxStorefronts: (vals['entitlements.connect.maxStorefronts'] as number) ?? 1,
                maxJobs: (vals['entitlements.connect.maxJobs'] as number) ?? 10,
                // Over-limit (grandfathering) policy + grace days. freeze =
                // existing items stay live + creation blocked (today's behavior);
                // hide_newest = hide the newest excess from public after grace.
                overLimitPolicy:
                  (vals['entitlements.connect.overLimitPolicy'] as 'freeze' | 'hide_newest') ??
                  'freeze',
                overLimitGraceDays:
                  (vals['entitlements.connect.overLimitGraceDays'] as number) ?? 30,
              },
            }
          : {}),
      },
      // Per-plan card content (localized tagline + feature bullets), built above
      // with the existing marketing subfields preserved. Sent at the payload ROOT
      // (mirrors backend CreatePlanDto.marketing -> PlanMarketingDto).
      marketing,
    };
    try {
      if (editing) {
        await updateAdminPlan(editing._id, payload);
        msgApi.success('Plan updated');
      } else {
        await createAdminPlan(payload);
        msgApi.success('Plan created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAdminPlan(id);
      msgApi.success('Plan deleted');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleDeactivate = async (plan: Plan, newStatus: boolean) => {
    try {
      const result = await updateAdminPlan(plan._id, { isActive: newStatus });
      if (
        result &&
        'affectedSubscriberCount' in result &&
        result.affectedSubscriberCount &&
        result.affectedSubscriberCount > 0
      ) {
        msgApi.info(
          `Plan deactivated. ${result.affectedSubscriberCount} subscribers will keep access until their subscription expires.`,
        );
      } else {
        msgApi.success(`Plan ${newStatus ? 'activated' : 'deactivated'}`);
      }
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  return (
    <>
      {ctx}
      <ConfirmModal
        open={confirmModalOpen}
        title="Apply Tier Defaults?"
        onOk={confirmApplyDefaults}
        onCancel={() => {
          setConfirmModalOpen(false);
          setPendingTierKey(null);
        }}
        okText="Yes, apply defaults"
        cancelText="Cancel"
      >
        <p>This will overwrite your current module access configuration. Continue?</p>
      </ConfirmModal>

      <Card
        title={<span className="font-display font-bold">Subscription Plans</span>}
        loading={loading}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Create Plan
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {plans.map((plan) => {
            const stats = plan.entitlements?.moduleAccess
              ? countUnlockedFeatures(plan.entitlements.moduleAccess)
              : {
                  modules: plan.entitlements?.modules?.length ?? 0,
                  features: 0,
                  total: 0,
                };

            return (
              <Col xs={24} sm={12} lg={6} key={plan._id}>
                <div className="card-hover relative rounded-[18px] border-[1.5px] border-border bg-surface p-6">
                  {!plan.isActive && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[18px] bg-white/70">
                      <Tag color="error">Inactive</Tag>
                    </div>
                  )}
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Tag color={getTierColor(tiers, plan.tier)} className="font-bold capitalize">
                        {/* Crown shows for any tier at or above Growth (dynamic via tier.displayOrder). */}
                        {isTierAtOrAbove(tiers, plan.tier, 'growth') && (
                          <CrownOutlined className="mr-1" />
                        )}
                        {plan.tier}
                      </Tag>
                      {plan.product && plan.product !== 'erp' && (
                        <Tag color={plan.product === 'bundle' ? 'gold' : 'geekblue'}>
                          {plan.product === 'bundle' ? 'Bundle' : 'Connect'}
                        </Tag>
                      )}
                      {/* Signup-default marker: the single plan per product new
                          sign-ups are auto-assigned (backend Plan.isDefault). Gives
                          the admin context before they flip the toggle in the editor. */}
                      {plan.isDefault && (
                        <Tooltip title={t('plansEditor.defaultTagTooltip')}>
                          <Tag color="green">{t('plansEditor.defaultTag')}</Tag>
                        </Tooltip>
                      )}
                      {/* The connect_free plan is the LIVE default: getAllowances
                          falls back to it for every user without a paid Connect
                          sub, so editing it changes all free users instantly. */}
                      {plan.tier === 'connect_free' && (
                        <Tooltip title="Default for new and free Connect users. Edit this plan to change everyone's starting limits, live.">
                          <Tag color="green">Default</Tag>
                        </Tooltip>
                      )}
                      {(plan as any).activeSubscriberCount > 0 && (
                        <Tag color="blue">{(plan as any).activeSubscriberCount} users</Tag>
                      )}
                    </div>
                    <Space
                      size={4}
                      className="shrink-0"
                      style={{ position: 'relative', zIndex: 20 }}
                    >
                      <Tooltip
                        title={
                          ((plan as any).activeSubscriberCount || 0) > 0
                            ? `Deactivating will affect ${(plan as any).activeSubscriberCount} subscribers`
                            : plan.isActive
                              ? 'Deactivate plan'
                              : 'Activate plan'
                        }
                      >
                        <Switch
                          size="small"
                          checked={plan.isActive}
                          aria-label={
                            plan.isActive ? `Deactivate ${plan.name}` : `Activate ${plan.name}`
                          }
                          onChange={(checked) => handleDeactivate(plan, checked)}
                        />
                      </Tooltip>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        aria-label={`Edit ${plan.name}`}
                        onClick={() => openEdit(plan)}
                      />
                      <Popconfirm
                        title="Delete plan?"
                        description={
                          ((plan as any).activeSubscriberCount || 0) > 0
                            ? `This plan has ${(plan as any).activeSubscriberCount} active subscribers`
                            : null
                        }
                        onConfirm={() => handleDelete(plan._id)}
                        okButtonProps={{ danger: true }}
                      >
                        <Button
                          type="text"
                          size="small"
                          danger
                          aria-label={`Delete ${plan.name}`}
                          icon={<DeleteOutlined />}
                        />
                      </Popconfirm>
                    </Space>
                  </div>
                  <h2 className="m-0 mb-1 font-display text-lg font-bold text-heading">
                    {plan.name}
                  </h2>
                  <p className="m-0 mb-1 font-display text-2xl font-extrabold text-primary">
                    ₹{plan.monthlyPrice}
                    <span className="text-[13px] font-normal text-subtle">/mo</span>
                  </p>
                  <p className="m-0 mb-3.5 text-xs text-subtle">₹{plan.yearlyPrice}/yr</p>
                  <Divider className="my-3" />
                  <EntitlementsDisplay
                    entitlements={plan.entitlements}
                    moduleAccessStats={stats}
                    product={plan.product}
                  />
                </div>
              </Col>
            );
          })}
          {plans.length === 0 && !loading && (
            <Col span={24}>
              <p className="py-8 text-center text-subtle">
                No plans configured. Create your first plan.
              </p>
            </Col>
          )}
        </Row>
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={
          <span className="font-display font-bold">{editing ? 'Edit Plan' : 'Create Plan'}</span>
        }
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={780}
        // Binding rule: tall content scrolls INSIDE the body, never the whole
        // modal - cap the body + scroll it so the title + OK/Cancel footer stay
        // pinned (this plan form is long: entitlements + module access + connect).
        centered
        // Remount the body clean on each open so no stale form state (esp. the
        // nested entitlements caps) carries between plans. Repo binding rule:
        // stateful form modals reset on close. v6 prop (NOT destroyOnClose).
        destroyOnHidden
        styles={{ body: { maxHeight: '70vh', overflowY: 'auto' } }}
        className="admin-plans-modal"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark={false}
          className="mt-4"
        >
          {/* Connect product removed (2026-07-04) — ManekHR is ERP-only, so this
              is a single fixed value now (kept as a Select for minimal diff /
              easy revert if a second product line ever returns). The Connect
              allowance section below is gated on watchedProduct !== 'erp', so
              it never renders once this is locked to 'erp'. */}
          <Form.Item
            name="product"
            label="Product Line"
            rules={[{ required: true }]}
            initialValue="erp"
          >
            <Select size="large" disabled>
              <Option value="erp">ERP (workspace plan)</Option>
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="name" label="Plan Name" rules={[{ required: true }]}>
                <Input size="large" placeholder="e.g. Pro Plan" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tier" label="Tier" rules={[{ required: true }]}>
                <Select size="large" onChange={handleTierChange}>
                  {tiers.map((tier) => (
                    <Option key={tier.key} value={tier.key}>
                      <Tag color={tier.color}>{tier.name}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="monthlyPrice" label="Monthly Price (₹)" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={0} prefix="₹" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="yearlyPrice" label="Yearly Price (₹)" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={0} prefix="₹" size="large" />
              </Form.Item>
            </Col>
          </Row>

          {/* ERP-only sections (workspace entitlements + platform/sessions). A
              Connect plan is person-centric, so these are hidden when
              product='connect'. Bundle (ERP + Connect) shows them. */}
          {watchedProduct !== 'connect' && (
            <>
              <Divider className="my-1 text-xs">
                Entitlements
                <Tooltip title="Set all entitlement limits to unlimited (-1)">
                  <Button
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => {
                      // Nested shape to match <EntitlementsFormFields
                      // namePrefix="entitlements"> (array names ->
                      // values.entitlements.*). A dot-string key would set a
                      // disjoint field and leave the visible inputs unchanged.
                      form.setFieldsValue({
                        entitlements: {
                          maxWorkspaces: -1,
                          maxMembersPerWorkspace: -1,
                          maxTotalMembers: -1,
                        },
                      });
                    }}
                    className="ml-2 text-green-700"
                  >
                    Set All Unlimited
                  </Button>
                </Tooltip>
              </Divider>
              <EntitlementsFormFields namePrefix="entitlements" min={-1} showUnlimitedButton />

              <Divider className="my-1 text-xs">Platform Access & Sessions</Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item name="entitlements.platformAccess" label="Platform Access">
                    <Select size="large" value={platformAccess} onChange={setPlatformAccess}>
                      <Option value="both">Both (Web + Mobile)</Option>
                      <Option value="web_only">Web Only</Option>
                      <Option value="mobile_only">Mobile Only</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="entitlements.maxSessionsPerPlatform" label="Sessions/Platform">
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="entitlements.maxSessionsTotal" label="Total Sessions">
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.emailsPerMonth"
                    label="Monthly Email Limit (0 = unlimited)"
                  >
                    <InputNumber className="w-full" min={0} placeholder="0 = unlimited" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {watchedProduct && watchedProduct !== 'erp' && (
            <>
              <Divider className="my-1 text-xs">
                Connect Allowances
                <Tooltip title="These control the Connect marketplace + network limits a subscriber on this plan gets. Use -1 for unlimited where supported.">
                  <QuestionCircleOutlined className="ml-1 text-faint" />
                </Tooltip>
                <Tooltip title="Set listings and leads to unlimited (-1)">
                  <Button
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => {
                      form.setFieldsValue({
                        'entitlements.connect.maxListings': -1,
                        'entitlements.connect.leadsPerMonth': -1,
                      });
                    }}
                    className="ml-2 text-green-700"
                  >
                    Set Generous
                  </Button>
                </Tooltip>
              </Divider>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.maxListings"
                    label={
                      <span>
                        Max Listings{' '}
                        <Tooltip title="How many marketplace listings a seller on this plan can have live at once. -1 = unlimited.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.leadsPerMonth"
                    label={
                      <span>
                        Leads / Month{' '}
                        <Tooltip title="How many buyer inquiries (leads) a seller can receive each month. Leads stay free for everyone, so -1 = unlimited is the usual setting.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.includedBoostCredits"
                    label={
                      <span>
                        Boost Credits / Cycle{' '}
                        <Tooltip title="Free wallet credits granted each billing cycle to boost (advertise) listings. They expire at cycle end and do not roll over. 0 = none.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={0} placeholder="0 = none" />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12} align="bottom">
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.searchPriority"
                    label={
                      <span>
                        Search Priority{' '}
                        <Tooltip title="Boosts this seller's listings higher in marketplace search results. 0 = normal ranking; a higher number ranks above lower ones.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={0} placeholder="0 = normal" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.verifiedBadge"
                    label={
                      <span>
                        Verified Badge{' '}
                        <Tooltip title="Shows a blue Verified mark on this seller's listings and profile, which buyers trust more.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              {/* Count caps: company pages / storefronts / open jobs. -1 =
                  unlimited. These are also tunable per person via the admin
                  Connect entitlements override; this sets the plan default. */}
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.maxCompanyPages"
                    label={
                      <span>
                        Max company pages{' '}
                        <Tooltip title="How many company pages a subscriber on this plan can publish. -1 = unlimited.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.maxStorefronts"
                    label={
                      <span>
                        Max storefronts{' '}
                        <Tooltip title="How many storefronts a subscriber on this plan can run. -1 = unlimited.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.maxJobs"
                    label={
                      <span>
                        Max open jobs{' '}
                        <Tooltip title="How many open job posts a subscriber on this plan can have live at once. -1 = unlimited.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={-1} placeholder="-1 = unlimited" />
                  </Form.Item>
                </Col>
              </Row>
              {/* Over-limit (grandfathering) policy + grace window. Controls what
                  happens to a seller who is OVER a count cap (items predating a
                  cap drop, or after an admin lowers their override). Default
                  freeze = today's behavior. Surfaced on GET /me/connect/usage and
                  enforced by the backend ConnectOverLimitService. */}
              <Row gutter={12} align="bottom">
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.overLimitPolicy"
                    label={
                      <span>
                        Over-Limit Policy{' '}
                        <Tooltip title="What happens when a seller is over a count limit. Freeze: their existing items stay live but they cannot add more. Hide newest: after a grace period, their newest items beyond the limit are hidden from public view (never deleted; reversible the moment they remove items or upgrade).">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <Select>
                      <Option value="freeze">Freeze (block new, keep existing live)</Option>
                      <Option value="hide_newest">Hide newest (after grace)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item
                    name="entitlements.connect.overLimitGraceDays"
                    label={
                      <span>
                        Grace Period (days){' '}
                        <Tooltip title="Days after a seller first goes over a limit before the Hide-newest policy hides anything. Ignored under Freeze. 0 = hide immediately.">
                          <QuestionCircleOutlined className="text-faint" />
                        </Tooltip>
                      </span>
                    }
                  >
                    <InputNumber className="w-full" min={0} placeholder="30" />
                  </Form.Item>
                </Col>
              </Row>
            </>
          )}

          {/* ERP module access + communications - hidden for connect-only plans
              (a Connect plan grants only the CONNECT module). Bundle shows them. */}
          {watchedProduct !== 'connect' && (
            <>
              <Divider className="my-1 text-xs">
                Module Access
                <Tooltip title="Apply tier defaults to all modules">
                  <Button
                    type="link"
                    size="small"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleTierChange(selectedTierKey)}
                    className="ml-2"
                  >
                    Apply {tiers.find((t) => t.key === selectedTierKey)?.name || selectedTierKey}{' '}
                    Defaults
                  </Button>
                </Tooltip>
              </Divider>

              {validationErrors.length > 0 && (
                <Alert type="error" title={validationErrors.join('. ')} className="mb-4" showIcon />
              )}

              <ModuleAccessEditor
                moduleAccess={moduleAccess}
                onChange={setModuleAccess}
                errors={[]}
              />

              <CommunicationsEditor value={communications} onChange={setCommunications} />
            </>
          )}

          {/* Signup defaults: free-trial length + which plan new sign-ups are
              auto-assigned. Product-agnostic (applies to ERP/Connect/Bundle), so
              they live at the form root, not inside a product-gated section.
              Mirrors backend CreatePlanDto.trialDurationDays / .isDefault; the
              backend enforces the single-default-per-product invariant. */}
          <Divider className="my-1 text-xs">{t('plansEditor.signupSection')}</Divider>
          <Row gutter={12} align="bottom">
            <Col span={8}>
              <Form.Item
                name="trialDurationDays"
                label={t('plansEditor.trialDurationLabel')}
                help={t('plansEditor.trialDurationHelp')}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  step={1}
                  precision={0}
                  placeholder="0"
                  aria-label={t('plansEditor.trialDurationLabel')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="isDefault"
                label={t('plansEditor.isDefaultLabel')}
                help={t('plansEditor.isDefaultHelp')}
                valuePropName="checked"
              >
                <Switch aria-label={t('plansEditor.isDefaultLabel')} />
              </Form.Item>
            </Col>
            {/* Trial-plan flag: this plan's module access + entitlements define
                what the trial unlocks (it's a normal plan, configured by the
                editors above). Backend forces it non-buyable + single per product.
                Mirrors backend Plan.isTrialPlan. */}
            <Col span={8}>
              <Form.Item
                name="isTrialPlan"
                label={t('plansEditor.isTrialPlanLabel')}
                help={t('plansEditor.isTrialPlanHelp')}
                valuePropName="checked"
              >
                <Switch aria-label={t('plansEditor.isTrialPlanLabel')} />
              </Form.Item>
            </Col>
          </Row>

          {/* Pricing knobs: upfront discount + monthly installments. Product-
              agnostic, so they live alongside the signup defaults. Mirror backend
              CreatePlanDto.upfrontDiscountPercent / .installmentsEnabled /
              .installmentMonths; the backend validates the ranges (0-100 / 1-24). */}
          <Divider className="my-1 text-xs">{t('plansEditor.pricingSection')}</Divider>
          <Row gutter={12} align="bottom">
            <Col span={8}>
              <Form.Item
                name="upfrontDiscountPercent"
                label={t('plansEditor.upfrontDiscountLabel')}
                help={t('plansEditor.upfrontDiscountHelp')}
              >
                <InputNumber
                  className="w-full"
                  min={0}
                  max={100}
                  step={1}
                  precision={0}
                  suffix="%"
                  placeholder="0"
                  aria-label={t('plansEditor.upfrontDiscountLabel')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="installmentsEnabled"
                label={t('plansEditor.installmentsEnabledLabel')}
                help={t('plansEditor.installmentsEnabledHelp')}
                valuePropName="checked"
              >
                <Switch aria-label={t('plansEditor.installmentsEnabledLabel')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="installmentMonths"
                label={t('plansEditor.installmentMonthsLabel')}
                help={t('plansEditor.installmentMonthsHelp')}
              >
                <InputNumber
                  className="w-full"
                  min={1}
                  max={24}
                  step={1}
                  precision={0}
                  placeholder="12"
                  aria-label={t('plansEditor.installmentMonthsLabel')}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* GST controls (optional/configurable per plan). GST is ON by default
              at 18%. When the toggle is off, the rate is ignored and the backend
              zeroes GST everywhere (checkout shows no GST line, cards show no GST
              note). Mirror backend CreatePlanDto.gstEnabled / .gstRatePercent /
              .isPriceTaxInclusive; the backend validates the rate range (0-50). */}
          <Row gutter={12} align="bottom">
            <Col span={8}>
              <Form.Item
                name="gstEnabled"
                label={t('plansEditor.gstEnabledLabel')}
                help={t('plansEditor.gstEnabledHelp')}
                valuePropName="checked"
              >
                <Switch aria-label={t('plansEditor.gstEnabledLabel')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="gstRatePercent"
                label={t('plansEditor.gstRateLabel')}
                help={t('plansEditor.gstRateHelp')}
              >
                {/* Always editable; the rate is simply ignored when GST is off
                    (kept simple per the spec — no watched-disable). */}
                <InputNumber
                  className="w-full"
                  min={0}
                  max={50}
                  step={1}
                  precision={0}
                  suffix="%"
                  placeholder="18"
                  aria-label={t('plansEditor.gstRateLabel')}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="isPriceTaxInclusive"
                label={t('plansEditor.gstInclusiveLabel')}
                help={t('plansEditor.gstInclusiveHelp')}
                valuePropName="checked"
              >
                <Switch aria-label={t('plansEditor.gstInclusiveLabel')} />
              </Form.Item>
            </Col>
          </Row>

          {/* Card content (per-plan marketing): the tagline + ordered feature
              bullets shown on the pricing cards, in all four languages. Any blank
              field falls back to the static i18n copy (pickLocalized in
              components/marketing/ErpPricingTable.tsx + the in-app PlanCard.tsx).
              Product-agnostic, so it lives at the form root. Mirrors backend
              Plan.marketing.tagline / .featureHighlights; handleSave preserves any
              other marketing subfields it does not edit. */}
          <Divider className="my-1 text-xs">{t('plansEditor.cardContentSection')}</Divider>
          <p className="mb-3 text-xs text-[var(--cr-neutral-500)]">
            {t('plansEditor.cardContentHint')}
          </p>

          {/* Tagline: one localized line, 4 language inputs (en is canonical). */}
          <p className="mb-1 text-sm font-medium">{t('plansEditor.taglineLabel')}</p>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name={['marketing', 'tagline', 'en']} label={t('plansEditor.langEnglish')}>
                <Input
                  aria-label={`${t('plansEditor.taglineLabel')} ${t('plansEditor.langEnglish')}`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['marketing', 'tagline', 'gu']}
                label={t('plansEditor.langGujarati')}
              >
                <Input
                  aria-label={`${t('plansEditor.taglineLabel')} ${t('plansEditor.langGujarati')}`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['marketing', 'tagline', 'gu-en']}
                label={t('plansEditor.langGujaratiRoman')}
              >
                <Input
                  aria-label={`${t('plansEditor.taglineLabel')} ${t('plansEditor.langGujaratiRoman')}`}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name={['marketing', 'tagline', 'hi-en']}
                label={t('plansEditor.langHindiRoman')}
              >
                <Input
                  aria-label={`${t('plansEditor.taglineLabel')} ${t('plansEditor.langHindiRoman')}`}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* Feature bullets: ordered list; each row is one bullet in 4 languages.
              Add / remove rows; order is the render order. */}
          <p className="mt-2 mb-1 text-sm font-medium">{t('plansEditor.featureLabel')}</p>
          <Form.List name={['marketing', 'featureHighlights']}>
            {(fields, { add, remove }) => (
              <div className="flex flex-col gap-3">
                {fields.map((field, idx) => (
                  <div
                    key={field.key}
                    className="rounded-lg border border-[var(--cr-neutral-200)] p-3"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--cr-neutral-600)]">
                        {t('plansEditor.featureLabel')} {idx + 1}
                      </span>
                      <Button
                        type="text"
                        danger
                        size="small"
                        icon={<DeleteOutlined />}
                        onClick={() => remove(field.name)}
                        aria-label={`${t('plansEditor.removeFeature')} ${idx + 1}`}
                      />
                    </div>
                    <Row gutter={12}>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'en']}
                          label={t('plansEditor.langEnglish')}
                          className="mb-2"
                        >
                          <Input
                            aria-label={`${t('plansEditor.featureLabel')} ${idx + 1} ${t('plansEditor.langEnglish')}`}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'gu']}
                          label={t('plansEditor.langGujarati')}
                          className="mb-2"
                        >
                          <Input
                            aria-label={`${t('plansEditor.featureLabel')} ${idx + 1} ${t('plansEditor.langGujarati')}`}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'gu-en']}
                          label={t('plansEditor.langGujaratiRoman')}
                          className="mb-2"
                        >
                          <Input
                            aria-label={`${t('plansEditor.featureLabel')} ${idx + 1} ${t('plansEditor.langGujaratiRoman')}`}
                          />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name={[field.name, 'hi-en']}
                          label={t('plansEditor.langHindiRoman')}
                          className="mb-2"
                        >
                          <Input
                            aria-label={`${t('plansEditor.featureLabel')} ${idx + 1} ${t('plansEditor.langHindiRoman')}`}
                          />
                        </Form.Item>
                      </Col>
                    </Row>
                  </div>
                ))}
                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />} block>
                  {t('plansEditor.addFeature')}
                </Button>
              </div>
            )}
          </Form.List>

          <Form.Item name="isActive" label="Active" valuePropName="checked" className="mt-4">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
