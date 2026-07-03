'use client';

import React, { useEffect, useState, useMemo, startTransition } from 'react';
import {
  Card,
  Switch,
  Button,
  Input,
  InputNumber,
  Select,
  Modal,
  Table,
  Tag,
  Space,
  message,
  Radio,
  Checkbox,
  Empty,
  Popconfirm,
  Alert,
  Collapse,
  Tooltip,
} from 'antd';
import {
  AppstoreOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CheckOutlined,
  ClusterOutlined,
  DeleteOutlined,
  EditOutlined,
  InfoCircleOutlined,
  LockOutlined,
  LoadingOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useWorkspaceStore, useAuthStore } from '@/lib/store';
import { getWorkspaceMembers } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { useComponentTemplateStore } from '@/features/salary/store/useComponentTemplateStore';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import {
  PAYROLL_PRESETS,
  FEATURE_GROUPS,
  FEATURE_META,
  BUILT_IN_TEMPLATE_CARDS,
} from '@/features/salary/constants/payroll-presets';
import {
  calculateComponents,
  validateComponentDefinitions,
} from '@/features/salary/utils/component-calculator';
import { LWF_RATES_DISPLAY } from '@/lib/constants/lwf-rates';
import { useTranslations } from 'next-intl';
import type { PayrollConfigFeatures } from '@/features/salary/constants/feature-access-map';
import type {
  PtSlabEntry,
  PayrollConfigStatutory,
  PayrollConfigCompliance,
  SalaryComponentDef,
  SalaryComponentTemplate,
} from '@/types';
import { DsPageHeader } from '@/components/ui';
import { DisbursementRulesPanel } from '@/app/(app)/dashboard/salary/components/salary/DisbursementRulesPanel';

type PayrollPreset = keyof typeof PAYROLL_PRESETS;
type WorkspaceMemberAccess = {
  userId?: string;
  role?: 'owner' | 'admin' | 'manager' | 'member' | string;
};

const PRESET_ICONS: Record<PayrollPreset, React.ReactNode> = {
  basic: <AppstoreOutlined />,
  standard: <ToolOutlined />,
  professional: <BankOutlined />,
  enterprise: <ClusterOutlined />,
};

const DEFAULT_STATUTORY_SETTINGS: PayrollConfigStatutory = {
  pfEnabled: false,
  pfEstablishmentCode: '',
  pfWageCeiling: 15000,
  esiEnabled: false,
  esiCode: '',
  esiGrossThreshold: 21000,
  ptEnabled: false,
  tdsEnabled: false,
  lwfEnabled: false,
  ptState: 'Gujarat',
  ptUseCustomSlabs: false,
  ptCustomSlabs: [],
};

const DEFAULT_COMPLIANCE_SETTINGS: PayrollConfigCompliance = {
  minimumWageMonthly: null,
  minimumWageCategory: 'unskilled',
  deductionCapPercent: 50,
  installmentAdvisoryOneThirdEnabled: true,
  installmentAdvisoryMaxMonths: 12,
};

const MINIMUM_WAGE_CATEGORY_OPTIONS = [
  { value: 'unskilled', label: 'Unskilled' },
  { value: 'semi_skilled', label: 'Semi-skilled' },
  { value: 'skilled', label: 'Skilled' },
  { value: 'highly_skilled', label: 'Highly skilled' },
] as const;

const PT_STATE_OPTIONS = [
  { value: 'Gujarat', label: 'Gujarat (Default)' },
  { value: 'Maharashtra', label: 'Maharashtra' },
  { value: 'Karnataka', label: 'Karnataka' },
  { value: 'Telangana', label: 'Telangana' },
  { value: 'West Bengal', label: 'West Bengal' },
  { value: 'Tamil Nadu', label: 'Tamil Nadu' },
  { value: 'Other', label: 'Other' },
];

const createDefaultPtSlab = (): PtSlabEntry => ({
  minSalary: 0,
  maxSalary: null,
  ptAmount: 0,
});

export default function PayrollSettingsPage() {
  const t = useTranslations();
  const [msgApi, contextHolder] = message.useMessage();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const { user } = useAuthStore();
  const [canManage, setCanManage] = useState(true);
  /** isOwner is stricter than canManage - owner-only controls (DisbursementRulesPanel) use this. */
  const [isOwner, setIsOwner] = useState(false);
  const features = useSalaryFeatures();

  const getErrorMessage = (error: unknown, fallback: string) => {
    const parsed = parseApiError(error);
    return parsed || fallback;
  };

  useEffect(() => {
    if (!currentWorkspaceId || !user?._id) return;
    getWorkspaceMembers(currentWorkspaceId)
      .then((res) => {
        if (res.ok && Array.isArray(res.data)) {
          const members = res.data as WorkspaceMemberAccess[];
          const me = members.find((member) => member.userId === user._id);
          setCanManage(me?.role === 'owner' || me?.role === 'admin');
          // DisbursementRulesPanel is owner-only per D-01 requirement
          setIsOwner(me?.role === 'owner');
        }
      })
      .catch(() => {});
  }, [currentWorkspaceId, user?._id]);

  const { config, fetchConfig, updateConfig, applyPreset } = usePayrollConfigStore();
  const {
    templates,
    isLoading: templatesLoading,
    fetchTemplates,
    seedTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
  } = useComponentTemplateStore();

  const [displaySettings, setDisplaySettings] = useState({
    currencyCode: 'INR',
    currencySymbol: '\u20B9',
    defaultWorkingDays: 26,
    // Persisted for future payroll scheduling support, but intentionally hidden in the UI
    // until it has a real effect on salary generation, payments, or reminders.
    payDay: 1,
    payCycle: 'monthly' as 'monthly' | 'biweekly' | 'weekly',
  });
  const [ruleSettings, setRuleSettings] = useState({
    attendancePayModeDefault: 'enabled' as 'enabled' | 'disabled',
  });
  const [statutorySettings, setStatutorySettings] = useState<PayrollConfigStatutory>(
    DEFAULT_STATUTORY_SETTINGS,
  );
  const [isSavingDisplay, setIsSavingDisplay] = useState(false);
  const [isSavingStatutory, setIsSavingStatutory] = useState(false);
  const [isSavingLwf, setIsSavingLwf] = useState(false);
  const [complianceSettings, setComplianceSettings] = useState<PayrollConfigCompliance>(
    DEFAULT_COMPLIANCE_SETTINGS,
  );
  const [isSavingCompliance, setIsSavingCompliance] = useState(false);
  const [pendingFeatureKey, setPendingFeatureKey] = useState<keyof PayrollConfigFeatures | null>(
    null,
  );
  const [applyingPreset, setApplyingPreset] = useState<PayrollPreset | null>(null);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SalaryComponentTemplate | null>(null);
  const [editName, setEditName] = useState('');
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editComponents, setEditComponents] = useState<SalaryComponentDef[]>([]);

  useEffect(() => {
    if (currentWorkspaceId) {
      fetchConfig(currentWorkspaceId);
      fetchTemplates(currentWorkspaceId);
    }
  }, [currentWorkspaceId, fetchConfig, fetchTemplates]);

  useEffect(() => {
    startTransition(() => {
      if (config?.display) {
        setDisplaySettings({
          currencyCode: config.display.currencyCode || 'INR',
          currencySymbol: config.display.currencySymbol || '\u20B9',
          defaultWorkingDays: config.display.defaultWorkingDays || 26,
          payDay: config.display.payDay || 1,
          payCycle: config.display.payCycle || 'monthly',
        });
      }
      if (config?.rules) {
        setRuleSettings({
          attendancePayModeDefault: config.rules.attendancePayModeDefault || 'enabled',
        });
      }
    });
  }, [config?.display, config?.rules]);

  useEffect(() => {
    startTransition(() => {
      setStatutorySettings({
        ...DEFAULT_STATUTORY_SETTINGS,
        ...(config?.statutory ?? {}),
      });
    });
  }, [config?.statutory]);

  useEffect(() => {
    startTransition(() => {
      setComplianceSettings({
        ...DEFAULT_COMPLIANCE_SETTINGS,
        ...(config?.compliance ?? {}),
      });
    });
  }, [config?.compliance]);

  const handleApplyPreset = (preset: PayrollPreset) => {
    if (!currentWorkspaceId) return;
    if (!canManage) return;
    modalApi.confirm({
      title: t('salary.settings.presets.confirmTitle', { label: PAYROLL_PRESETS[preset].label }),
      content: t('salary.settings.presets.confirmContent', {
        label: PAYROLL_PRESETS[preset].label,
      }),
      onOk: async () => {
        setApplyingPreset(preset);
        try {
          await applyPreset(currentWorkspaceId, preset);
          msgApi.success(
            t('salary.settings.presets.applySuccess', { label: PAYROLL_PRESETS[preset].label }),
          );
        } catch (error) {
          msgApi.error(getErrorMessage(error, t('salary.settings.presets.applyError')));
        } finally {
          setApplyingPreset(null);
        }
      },
    });
  };

  const handleFeatureToggle = async (feature: keyof PayrollConfigFeatures, checked: boolean) => {
    if (!currentWorkspaceId) return;
    setPendingFeatureKey(feature);
    try {
      await updateConfig(currentWorkspaceId, { features: { [feature]: checked } });
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.features.toggleError')));
    } finally {
      setPendingFeatureKey((current) => (current === feature ? null : current));
    }
  };

  const handleSaveDisplay = async () => {
    if (!currentWorkspaceId) return;
    setIsSavingDisplay(true);
    try {
      await updateConfig(currentWorkspaceId, {
        display: displaySettings,
        rules: ruleSettings,
      });
      msgApi.success(t('salary.settings.defaults.saveSuccess'));
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.defaults.saveError')));
    } finally {
      setIsSavingDisplay(false);
    }
  };

  const handleSaveStatutory = async () => {
    if (!currentWorkspaceId) return;
    setIsSavingStatutory(true);
    try {
      const currentStatutory = config?.statutory ?? DEFAULT_STATUTORY_SETTINGS;
      await updateConfig(currentWorkspaceId, {
        statutory: {
          ...currentStatutory,
          ...statutorySettings,
        },
      });
      msgApi.success(t('salary.settings.statutory.saveSuccess'));
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.statutory.saveError')));
    } finally {
      setIsSavingStatutory(false);
    }
  };

  const handleSaveLwf = async () => {
    if (!currentWorkspaceId) return;
    setIsSavingLwf(true);
    try {
      await updateConfig(currentWorkspaceId, {
        statutory: {
          lwfEnabled: statutorySettings.lwfEnabled,
        },
      });
      msgApi.success(t('salary.settings.statutory.lwf.saveSuccess'));
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.statutory.lwf.saveError')));
    } finally {
      setIsSavingLwf(false);
    }
  };

  const handleSaveCompliance = async () => {
    if (!currentWorkspaceId) return;
    setIsSavingCompliance(true);
    try {
      await updateConfig(currentWorkspaceId, {
        compliance: {
          ...complianceSettings,
          // Ensure null is sent explicitly so the backend guard becomes inactive.
          minimumWageMonthly: complianceSettings.minimumWageMonthly ?? null,
        },
      });
      msgApi.success(t('salary.settings.compliance.saveSuccess'));
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.compliance.saveError')));
    } finally {
      setIsSavingCompliance(false);
    }
  };

  const addPtCustomSlab = () => {
    setStatutorySettings((current) => ({
      ...current,
      ptCustomSlabs: [...current.ptCustomSlabs, createDefaultPtSlab()],
    }));
  };

  const updatePtCustomSlab = <K extends keyof PtSlabEntry>(
    index: number,
    field: K,
    value: PtSlabEntry[K],
  ) => {
    setStatutorySettings((current) => ({
      ...current,
      ptCustomSlabs: current.ptCustomSlabs.map((slab, slabIndex) =>
        slabIndex === index
          ? {
              ...slab,
              [field]: value,
            }
          : slab,
      ),
    }));
  };

  const removePtCustomSlab = (index: number) => {
    setStatutorySettings((current) => ({
      ...current,
      ptCustomSlabs: current.ptCustomSlabs.filter((_slab, slabIndex) => slabIndex !== index),
    }));
  };

  const handleSeedTemplate = async (templateKey: string) => {
    if (!currentWorkspaceId) return;
    try {
      await seedTemplate(currentWorkspaceId, {
        templateKey: templateKey as 'simple' | 'standard_india' | 'ctc_with_pf',
      });
      msgApi.success(t('salary.settings.templates.addSuccess'));
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.templates.addError')));
    }
  };

  const openEditModal = (template: SalaryComponentTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditIsDefault(template.isDefault);
    setEditComponents(template.components.map((c) => ({ ...c })));
    setEditModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingTemplate(null);
    setEditName('');
    setEditIsDefault(false);
    setEditComponents([]);
    setEditModalOpen(true);
  };

  const handleSaveTemplate = async () => {
    if (!currentWorkspaceId) return;
    const validation = validateComponentDefinitions(editComponents);
    if (!validation.valid) {
      msgApi.error(validation.errors.join('; '));
      return;
    }
    try {
      if (editingTemplate) {
        await updateTemplate(currentWorkspaceId, editingTemplate._id, {
          name: editName,
          isDefault: editIsDefault,
          components: editComponents,
        });
        msgApi.success(t('salary.settings.templates.modal.updateSuccess'));
      } else {
        await createTemplate(currentWorkspaceId, {
          name: editName,
          isDefault: editIsDefault,
          components: editComponents,
        });
        msgApi.success(t('salary.settings.templates.modal.createSuccess'));
      }
      setEditModalOpen(false);
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.templates.modal.saveError')));
    }
  };

  const handleDeleteTemplate = async (template: SalaryComponentTemplate) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteTemplate(currentWorkspaceId, template._id);
      msgApi.success(t('salary.settings.templates.deleteSuccess'));
    } catch (error) {
      msgApi.error(getErrorMessage(error, t('salary.settings.templates.deleteError')));
    }
  };

  const addComponent = () => {
    const newId = `temp_${Date.now()}_${editComponents.length}`;
    setEditComponents([
      ...editComponents,
      {
        id: newId,
        name: '',
        calcMode: 'percent_of_ctc',
        value: 0,
        includedInCtc: true,
        isBasicComponent: editComponents.length === 0,
        isTaxable: true,
        sortOrder: editComponents.length,
      },
    ]);
  };

  const removeComponent = (index: number) => {
    const updated = editComponents.filter((_, i) => i !== index);
    setEditComponents(updated.map((c, i) => ({ ...c, sortOrder: i })));
  };

  const updateComponent = <K extends keyof SalaryComponentDef>(
    index: number,
    field: K,
    value: SalaryComponentDef[K],
  ) => {
    const updated = [...editComponents];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };
    if (field === 'isBasicComponent' && value) {
      updated.forEach((c, i) => {
        if (i !== index) c.isBasicComponent = false;
      });
    }
    setEditComponents(updated);
  };

  const livePreview = useMemo(() => {
    if (editComponents.length === 0) return null;
    try {
      return calculateComponents(50000, editComponents);
    } catch {
      return null;
    }
  }, [editComponents]);

  const validationErrors = useMemo(() => {
    if (editComponents.length === 0) return [];
    return validateComponentDefinitions(editComponents).errors;
  }, [editComponents]);

  const isCustomConfiguration = config?.preset === 'custom';

  const currentPresetLabel =
    config?.preset && config.preset !== 'custom'
      ? PAYROLL_PRESETS[config.preset as PayrollPreset]?.label || null
      : null;

  const isDefaultsDirty = useMemo(() => {
    if (!config?.display || !config?.rules) return false;

    return (
      config.display.currencyCode !== displaySettings.currencyCode ||
      config.display.currencySymbol !== displaySettings.currencySymbol ||
      config.display.defaultWorkingDays !== displaySettings.defaultWorkingDays ||
      config.display.payCycle !== displaySettings.payCycle ||
      config.rules.attendancePayModeDefault !== ruleSettings.attendancePayModeDefault
    );
  }, [config?.display, config?.rules, displaySettings, ruleSettings]);

  const isStatutoryDirty = useMemo(() => {
    const currentStatutory = {
      ...DEFAULT_STATUTORY_SETTINGS,
      ...(config?.statutory ?? {}),
    };

    return (
      currentStatutory.pfEnabled !== statutorySettings.pfEnabled ||
      currentStatutory.pfEstablishmentCode !== statutorySettings.pfEstablishmentCode ||
      currentStatutory.pfWageCeiling !== statutorySettings.pfWageCeiling ||
      currentStatutory.esiEnabled !== statutorySettings.esiEnabled ||
      currentStatutory.esiCode !== statutorySettings.esiCode ||
      currentStatutory.esiGrossThreshold !== statutorySettings.esiGrossThreshold ||
      currentStatutory.ptEnabled !== statutorySettings.ptEnabled ||
      currentStatutory.tdsEnabled !== statutorySettings.tdsEnabled ||
      currentStatutory.lwfEnabled !== statutorySettings.lwfEnabled ||
      currentStatutory.ptState !== statutorySettings.ptState ||
      currentStatutory.ptUseCustomSlabs !== statutorySettings.ptUseCustomSlabs ||
      JSON.stringify(currentStatutory.ptCustomSlabs ?? []) !==
        JSON.stringify(statutorySettings.ptCustomSlabs ?? [])
    );
  }, [config?.statutory, statutorySettings]);

  const isComplianceDirty = useMemo(() => {
    const current = { ...DEFAULT_COMPLIANCE_SETTINGS, ...(config?.compliance ?? {}) };
    return (
      current.minimumWageMonthly !== complianceSettings.minimumWageMonthly ||
      current.minimumWageCategory !== complianceSettings.minimumWageCategory ||
      current.deductionCapPercent !== complianceSettings.deductionCapPercent ||
      current.installmentAdvisoryOneThirdEnabled !==
        complianceSettings.installmentAdvisoryOneThirdEnabled ||
      current.installmentAdvisoryMaxMonths !== complianceSettings.installmentAdvisoryMaxMonths
    );
  }, [config?.compliance, complianceSettings]);

  const ptCustomSlabColumns = [
    {
      title: t('salary.settings.statutory.pt.colMinSalary'),
      key: 'minSalary',
      render: (_value: unknown, _record: PtSlabEntry, index: number) => (
        <InputNumber
          className="w-full"
          min={0}
          value={statutorySettings.ptCustomSlabs[index]?.minSalary}
          onChange={(value) => updatePtCustomSlab(index, 'minSalary', value ?? 0)}
          disabled={!canManage}
        />
      ),
    },
    {
      title: t('salary.settings.statutory.pt.colMaxSalary'),
      key: 'maxSalary',
      render: (_value: unknown, _record: PtSlabEntry, index: number) => (
        <InputNumber
          className="w-full"
          min={0}
          value={statutorySettings.ptCustomSlabs[index]?.maxSalary ?? undefined}
          onChange={(value) => updatePtCustomSlab(index, 'maxSalary', value ?? null)}
          placeholder={t('salary.settings.statutory.pt.colMaxSalaryPlaceholder')}
          disabled={!canManage}
        />
      ),
    },
    {
      title: t('salary.settings.statutory.pt.colPtAmount'),
      key: 'ptAmount',
      render: (_value: unknown, _record: PtSlabEntry, index: number) => (
        <InputNumber
          className="w-full"
          min={0}
          value={statutorySettings.ptCustomSlabs[index]?.ptAmount}
          onChange={(value) => updatePtCustomSlab(index, 'ptAmount', value ?? 0)}
          disabled={!canManage}
        />
      ),
    },
    {
      title: t('salary.settings.statutory.pt.colActions'),
      key: 'actions',
      width: 96,
      align: 'right' as const,
      render: (_value: unknown, _record: PtSlabEntry, index: number) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removePtCustomSlab(index)}
          disabled={!canManage || statutorySettings.ptCustomSlabs.length === 1}
        />
      ),
    },
  ];

  const lwfRateColumns = [
    {
      title: t('salary.settings.statutory.lwf.colState'),
      dataIndex: 'state',
      key: 'state',
    },
    {
      title: t('salary.settings.statutory.lwf.colEmployee'),
      dataIndex: 'employee',
      key: 'employee',
      align: 'right' as const,
      render: (value: number) => `₹${value}`,
    },
    {
      title: t('salary.settings.statutory.lwf.colEmployer'),
      dataIndex: 'employer',
      key: 'employer',
      align: 'right' as const,
      render: (value: number) => `₹${value}`,
    },
    {
      title: t('salary.settings.statutory.lwf.colMonths'),
      dataIndex: 'months',
      key: 'months',
    },
  ];

  const showTemplatesSection = config?.features?.salaryComponents ?? true;

  const templateColumns = [
    {
      title: t('salary.settings.templates.colName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: t('salary.settings.templates.colComponents'),
      key: 'componentCount',
      width: 120,
      render: (_value: unknown, r: SalaryComponentTemplate) => (
        <span>
          {r.components.length !== 1
            ? t('salary.settings.templates.componentCountPlural', { count: r.components.length })
            : t('salary.settings.templates.componentCount', { count: r.components.length })}
        </span>
      ),
    },
    {
      title: t('salary.settings.templates.colDefault'),
      key: 'isDefault',
      width: 100,
      render: (_value: unknown, r: SalaryComponentTemplate) =>
        r.isDefault ? (
          <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            {t('salary.settings.templates.defaultTag')}
          </span>
        ) : (
          <span className="text-muted">-</span>
        ),
    },
    {
      title: t('salary.settings.templates.colActions'),
      key: 'actions',
      width: 120,
      render: (_value: unknown, r: SalaryComponentTemplate) => (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(r)}
            disabled={!canManage}
            aria-label={t('salary.settings.templates.editAriaLabel', { name: r.name })}
          />
          <Popconfirm
            title={t('salary.settings.templates.deleteConfirmTitle')}
            description={t('salary.settings.templates.deleteConfirmDescription')}
            onConfirm={() => handleDeleteTemplate(r)}
            okText={t('salary.settings.templates.deleteOkText')}
            cancelText={t('salary.settings.templates.deleteCancelText')}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!canManage}
              aria-label={t('salary.settings.templates.deleteAriaLabel', { name: r.name })}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="w-full px-4 py-6 md:px-6">
      {contextHolder}
      {modalContextHolder}

      <div className="flex flex-col gap-8">
        <DsPageHeader
          title={t('salary.settings.pageTitle')}
          sub={t('salary.settings.pageDescription')}
        />

        {!canManage && (
          <Alert
            type="warning"
            title={t('salary.settings.accessWarning')}
            showIcon
            icon={<LockOutlined />}
          />
        )}

        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
              <AppstoreOutlined />
              <span>{t('salary.settings.presets.sectionLabel')}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="m-0 text-xl font-bold text-heading">
                {t('salary.settings.presets.heading')}
              </h2>
              {isCustomConfiguration ? (
                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                  {t('salary.settings.presets.badgeCustom')}
                </span>
              ) : currentPresetLabel ? (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                  <CheckOutlined className="mr-1" />
                  {t('salary.settings.presets.badgeActive', { label: currentPresetLabel })}
                </span>
              ) : null}
            </div>
            <p className="m-0 text-sm text-subtle">{t('salary.settings.presets.description')}</p>
            {isCustomConfiguration && (
              <p className="m-0 text-xs text-amber-700">
                {t('salary.settings.presets.customWarning')}
              </p>
            )}
          </div>

          <Card variant="outlined" className="border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(PAYROLL_PRESETS) as PayrollPreset[]).map((key) => {
                const preset = PAYROLL_PRESETS[key];
                const isActive = config?.preset === key;
                const isApplyingThisPreset = applyingPreset === key;
                return (
                  <Card
                    key={key}
                    variant="outlined"
                    hoverable={false}
                    className={`relative h-full overflow-hidden border transition-all duration-200 ${
                      canManage && !applyingPreset
                        ? 'cursor-pointer hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'
                        : 'cursor-default'
                    } ${
                      isActive
                        ? 'border-2 border-blue-500 bg-blue-50 shadow-[0_10px_28px_rgba(37,99,235,0.12)] ring-2 ring-blue-100'
                        : 'border border-slate-200 bg-white'
                    } ${isApplyingThisPreset ? 'pointer-events-none opacity-80' : ''}`}
                    onClick={() => {
                      if (canManage && !applyingPreset) {
                        handleApplyPreset(key);
                      }
                    }}
                    styles={{ body: { padding: '18px' } }}
                  >
                    {isActive && <div className="absolute inset-x-0 top-0 h-1 bg-blue-500" />}
                    <div
                      className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl text-lg"
                      style={{
                        background: isActive ? 'var(--cr-info-50)' : 'var(--cr-bg)',
                        color: isActive ? 'var(--cr-info-700)' : 'var(--cr-text-4)',
                      }}
                    >
                      {isApplyingThisPreset ? <LoadingOutlined spin /> : PRESET_ICONS[key]}
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="m-0 text-sm font-semibold text-heading">{preset.label}</h3>
                      <p className="m-0 text-xs text-subtle">{preset.description}</p>
                      <p className="m-0 text-[11px] text-faint">{preset.subtitle}</p>
                    </div>
                    {isApplyingThisPreset ? (
                      <span className="mt-3 inline-flex items-center rounded-full border border-blue-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                        <LoadingOutlined spin className="mr-1" />
                        {t('salary.settings.presets.badgeApplying')}
                      </span>
                    ) : isActive ? (
                      <Tag color="blue" className="mt-3">
                        <CheckOutlined />{' '}
                        {t('salary.settings.presets.badgeActive', { label: preset.label })}
                      </Tag>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
              <ToolOutlined />
              <span>{t('salary.settings.features.sectionLabel')}</span>
            </div>
            <h2 className="m-0 text-xl font-bold text-heading">
              {t('salary.settings.features.heading')}
            </h2>
            <p className="m-0 text-sm text-subtle">{t('salary.settings.features.description')}</p>
          </div>

          {applyingPreset && (
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              <LoadingOutlined spin />
              <span>
                {t('salary.settings.features.applyingBadge', {
                  label: PAYROLL_PRESETS[applyingPreset].label,
                })}
              </span>
            </div>
          )}

          <div
            className={`grid grid-cols-1 gap-6 transition-opacity duration-200 xl:grid-cols-3 ${
              applyingPreset ? 'opacity-80' : 'opacity-100'
            }`}
          >
            {Object.entries(FEATURE_GROUPS).map(([groupKey, group]) => (
              <Card
                variant="outlined"
                key={groupKey}
                title={group.title}
                className="h-full border-slate-200 shadow-sm"
              >
                <div className="space-y-4">
                  {group.features.map((featureKey) => {
                    const meta = FEATURE_META[featureKey];
                    if (!meta) return null;
                    const enabled =
                      config?.features?.[featureKey as keyof PayrollConfigFeatures] ?? true;
                    const isPending = pendingFeatureKey === featureKey;
                    return (
                      <div key={featureKey} className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="m-0 text-sm font-medium text-heading">{meta.label}</p>
                          <p className="m-0 mt-0.5 text-xs text-subtle">{meta.description}</p>
                        </div>
                        <Switch
                          checked={enabled}
                          onChange={(checked) =>
                            handleFeatureToggle(featureKey as keyof PayrollConfigFeatures, checked)
                          }
                          loading={isPending || Boolean(applyingPreset)}
                          disabled={!config || !canManage || Boolean(applyingPreset)}
                        />
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
              <SettingOutlined />
              <span>{t('salary.settings.defaults.sectionLabel')}</span>
            </div>
            <h2 className="m-0 text-xl font-bold text-heading">
              {t('salary.settings.defaults.heading')}
            </h2>
            <p className="m-0 text-sm text-subtle">{t('salary.settings.defaults.description')}</p>
          </div>

          <Card variant="outlined" className="border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.defaults.currencyCodeLabel')}
                </label>
                <Input
                  value={displaySettings.currencyCode}
                  onChange={(e) =>
                    setDisplaySettings({
                      ...displaySettings,
                      currencyCode: e.target.value,
                    })
                  }
                  placeholder="INR"
                  aria-label={t('salary.settings.defaults.currencyCodeAriaLabel')}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.defaults.currencySymbolLabel')}
                </label>
                <Input
                  value={displaySettings.currencySymbol}
                  onChange={(e) =>
                    setDisplaySettings({
                      ...displaySettings,
                      currencySymbol: e.target.value,
                    })
                  }
                  placeholder="\u20B9"
                  aria-label={t('salary.settings.defaults.currencySymbolAriaLabel')}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.defaults.workingDaysLabel')}
                </label>
                <InputNumber
                  className="w-full"
                  min={1}
                  max={31}
                  value={displaySettings.defaultWorkingDays}
                  onChange={(value) =>
                    setDisplaySettings({
                      ...displaySettings,
                      defaultWorkingDays: value || 26,
                    })
                  }
                  aria-label={t('salary.settings.defaults.workingDaysAriaLabel')}
                />
                <p className="mt-2 text-xs text-subtle">
                  {t('salary.settings.defaults.workingDaysHint')}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.defaults.attendanceDefaultLabel')}
                </label>
                <Select
                  className="w-full"
                  value={ruleSettings.attendancePayModeDefault}
                  onChange={(value) =>
                    setRuleSettings({
                      attendancePayModeDefault: value,
                    })
                  }
                  disabled={!config?.features?.attendanceBasedPay}
                  aria-label={t('salary.settings.defaults.attendanceDefaultAriaLabel')}
                >
                  <Select.Option value="enabled">
                    {t('salary.settings.defaults.attendanceBased')}
                  </Select.Option>
                  <Select.Option value="disabled">
                    {t('salary.settings.defaults.ignoreAttendance')}
                  </Select.Option>
                </Select>
                <p className="mt-2 text-xs text-subtle">
                  {t('salary.settings.defaults.attendanceDefaultHint')}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.defaults.payCycleLabel')}
                </label>
                <Select
                  className="w-full"
                  value={displaySettings.payCycle}
                  onChange={(value) =>
                    setDisplaySettings({
                      ...displaySettings,
                      payCycle: value,
                    })
                  }
                  aria-label={t('salary.settings.defaults.payCycleAriaLabel')}
                >
                  <Select.Option value="monthly">
                    {t('salary.settings.defaults.payCycleMonthly')}
                  </Select.Option>
                  <Select.Option value="biweekly">
                    {t('salary.settings.defaults.payCycleBiweekly')}
                  </Select.Option>
                  <Select.Option value="weekly">
                    {t('salary.settings.defaults.payCycleWeekly')}
                  </Select.Option>
                </Select>
              </div>
            </div>
            <div className="mt-6 space-y-4">
              {!config?.features?.attendanceBasedPay && (
                <Alert
                  className="m-0"
                  type="info"
                  showIcon
                  title={t('salary.settings.defaults.attendanceDisabledAlert')}
                  description={t('salary.settings.defaults.attendanceDisabledAlertDescription')}
                />
              )}
              <Alert
                className="m-0"
                type="info"
                showIcon
                title={t('salary.settings.defaults.seedAlert')}
                description={t('salary.settings.defaults.seedAlertDescription')}
              />
              <p className="m-0 text-xs text-subtle">{t('salary.settings.defaults.saveHint')}</p>
            </div>
          </Card>
        </section>

        {features.statutoryCompliance.enabled && (
          <section className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
                <BankOutlined />
                <span>{t('salary.settings.statutory.sectionLabel')}</span>
              </div>
              <h2 className="m-0 text-xl font-bold text-heading">
                {t('salary.settings.statutory.heading')}
              </h2>
              <p className="m-0 text-sm text-subtle">
                {t('salary.settings.statutory.description')}
              </p>
            </div>

            <Card variant="outlined" className="border-slate-200 shadow-sm">
              <Collapse
                className="rounded-xl border border-slate-200 bg-slate-50/40"
                items={[
                  {
                    key: 'pf',
                    label: t('salary.settings.statutory.pf.panelLabel'),
                    children: (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.pf.enableLabel')}
                              </label>
                              <p className="m-0 mt-1 text-xs text-subtle">
                                {t('salary.settings.statutory.pf.enableHint')}
                              </p>
                            </div>
                            <Switch
                              checked={statutorySettings.pfEnabled}
                              onChange={(checked) =>
                                setStatutorySettings((current) => ({
                                  ...current,
                                  pfEnabled: checked,
                                }))
                              }
                              disabled={!canManage}
                            />
                          </div>
                        </div>

                        {statutorySettings.pfEnabled && (
                          <>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.pf.establishmentCodeLabel')}
                              </label>
                              <Input
                                value={statutorySettings.pfEstablishmentCode}
                                onChange={(e) =>
                                  setStatutorySettings((current) => ({
                                    ...current,
                                    pfEstablishmentCode: e.target.value,
                                  }))
                                }
                                placeholder="AAA/1234/0001234"
                                disabled={!canManage}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.pf.wageCeilingLabel')}
                              </label>
                              <InputNumber
                                className="w-full"
                                min={1000}
                                max={15000}
                                value={statutorySettings.pfWageCeiling}
                                onChange={(value) =>
                                  setStatutorySettings((current) => ({
                                    ...current,
                                    pfWageCeiling: value ?? 15000,
                                  }))
                                }
                                disabled={!canManage}
                              />
                              <p className="mt-2 text-xs text-subtle">
                                {t('salary.settings.statutory.pf.wageCeilingHint')}
                              </p>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 md:col-span-2">
                              {t('salary.settings.statutory.pf.ratesNote')}
                            </div>
                          </>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'esi',
                    label: t('salary.settings.statutory.esi.panelLabel'),
                    children: (
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-white p-4 md:col-span-2">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.esi.enableLabel')}
                              </label>
                              <p className="m-0 mt-1 text-xs text-subtle">
                                {t('salary.settings.statutory.esi.enableHint')}
                              </p>
                            </div>
                            <Switch
                              checked={statutorySettings.esiEnabled}
                              onChange={(checked) =>
                                setStatutorySettings((current) => ({
                                  ...current,
                                  esiEnabled: checked,
                                }))
                              }
                              disabled={!canManage}
                            />
                          </div>
                        </div>

                        {statutorySettings.esiEnabled && (
                          <>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.esi.employerCodeLabel')}
                              </label>
                              <Input
                                value={statutorySettings.esiCode}
                                onChange={(e) =>
                                  setStatutorySettings((current) => ({
                                    ...current,
                                    esiCode: e.target.value,
                                  }))
                                }
                                placeholder="31-12345-101"
                                disabled={!canManage}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.esi.grossThresholdLabel')}
                              </label>
                              <InputNumber
                                className="w-full"
                                min={10000}
                                value={statutorySettings.esiGrossThreshold}
                                onChange={(value) =>
                                  setStatutorySettings((current) => ({
                                    ...current,
                                    esiGrossThreshold: value ?? 21000,
                                  }))
                                }
                                disabled={!canManage}
                              />
                              <p className="mt-2 text-xs text-subtle">
                                {t('salary.settings.statutory.esi.grossThresholdHint')}
                              </p>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 md:col-span-2">
                              {t('salary.settings.statutory.esi.ratesNote')}
                            </div>
                          </>
                        )}
                      </div>
                    ),
                  },
                  {
                    key: 'pt',
                    label: t('salary.settings.statutory.pt.panelLabel'),
                    children: (
                      <div className="space-y-4">
                        <div className="rounded-lg border border-slate-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.pt.enableLabel')}
                              </label>
                              <p className="m-0 mt-1 text-xs text-subtle">
                                {t('salary.settings.statutory.pt.enableHint')}
                              </p>
                            </div>
                            <Switch
                              checked={statutorySettings.ptEnabled}
                              onChange={(checked) =>
                                setStatutorySettings((current) => ({
                                  ...current,
                                  ptEnabled: checked,
                                }))
                              }
                              disabled={!canManage}
                            />
                          </div>
                        </div>

                        {statutorySettings.ptEnabled && (
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-sm font-medium text-gray-700">
                                {t('salary.settings.statutory.pt.stateLabel')}
                              </label>
                              <Select
                                className="w-full"
                                value={statutorySettings.ptState}
                                onChange={(value) =>
                                  setStatutorySettings((current) => ({
                                    ...current,
                                    ptState: value,
                                  }))
                                }
                                options={PT_STATE_OPTIONS}
                                disabled={!canManage}
                              />
                              <p className="mt-2 text-xs text-subtle">
                                {t('salary.settings.statutory.pt.stateHint')}
                              </p>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-white p-4">
                              <div className="flex items-center justify-between gap-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700">
                                    {t('salary.settings.statutory.pt.customSlabsLabel')}
                                  </label>
                                  <p className="m-0 mt-1 text-xs text-subtle">
                                    {t('salary.settings.statutory.pt.customSlabsHint')}
                                  </p>
                                </div>
                                <Switch
                                  checked={statutorySettings.ptUseCustomSlabs}
                                  onChange={(checked) =>
                                    setStatutorySettings((current) => ({
                                      ...current,
                                      ptUseCustomSlabs: checked,
                                      ptCustomSlabs:
                                        checked && current.ptCustomSlabs.length === 0
                                          ? [createDefaultPtSlab()]
                                          : current.ptCustomSlabs,
                                    }))
                                  }
                                  disabled={!canManage}
                                />
                              </div>
                            </div>

                            {statutorySettings.ptUseCustomSlabs && (
                              <div className="space-y-3 md:col-span-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="m-0 text-sm font-medium text-gray-700">
                                      {t('salary.settings.statutory.pt.customSlabsTitle')}
                                    </p>
                                    <p className="m-0 mt-1 text-xs text-subtle">
                                      {t('salary.settings.statutory.pt.customSlabsDescription')}
                                    </p>
                                  </div>
                                  <Button
                                    type="dashed"
                                    icon={<PlusOutlined />}
                                    onClick={addPtCustomSlab}
                                    disabled={!canManage}
                                  >
                                    {t('salary.settings.statutory.pt.addRowButton')}
                                  </Button>
                                </div>

                                <Table
                                  columns={ptCustomSlabColumns}
                                  dataSource={statutorySettings.ptCustomSlabs}
                                  rowKey={(_, index) => String(index)}
                                  pagination={false}
                                  size="small"
                                />
                              </div>
                            )}

                            <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 md:col-span-2">
                              {t('salary.settings.statutory.pt.ratesNote')}
                            </div>
                          </div>
                        )}
                      </div>
                    ),
                  },
                  ...(features.statutoryTds.enabled
                    ? [
                        {
                          key: 'tds',
                          label: t('salary.settings.statutory.tds.panelLabel'),
                          children: (
                            <div className="space-y-4">
                              <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      {t('salary.settings.statutory.tds.enableLabel')}
                                    </label>
                                    <p className="m-0 mt-1 text-xs text-subtle">
                                      {t('salary.settings.statutory.tds.enableHint')}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={statutorySettings.tdsEnabled}
                                    onChange={(checked) =>
                                      setStatutorySettings((current) => ({
                                        ...current,
                                        tdsEnabled: checked,
                                      }))
                                    }
                                    disabled={!canManage}
                                  />
                                </div>
                              </div>

                              {statutorySettings.tdsEnabled && (
                                <div className="grid grid-cols-1 gap-4">
                                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                                    <p className="m-0 text-sm font-medium text-gray-700">
                                      {t('salary.settings.statutory.tds.projectionTitle')}
                                    </p>
                                    <p className="m-0 mt-2 text-xs leading-5 text-subtle">
                                      {t('salary.settings.statutory.tds.projectionBody')}
                                    </p>
                                  </div>

                                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 font-medium text-blue-700">
                                    {t('salary.settings.statutory.tds.scopeNote')}
                                  </div>
                                </div>
                              )}
                            </div>
                          ),
                        },
                      ]
                    : []),
                  ...(features.lwfTracking.enabled
                    ? [
                        {
                          key: 'lwf',
                          label: t('salary.settings.statutory.lwf.panelLabel'),
                          children: (
                            <div className="space-y-4">
                              <div className="rounded-lg border border-slate-200 bg-white p-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700">
                                      {t('salary.settings.statutory.lwf.enableLabel')}
                                    </label>
                                    <p className="m-0 mt-1 text-xs text-subtle">
                                      {t('salary.settings.statutory.lwf.enableHint')}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={statutorySettings.lwfEnabled}
                                    onChange={(checked) =>
                                      setStatutorySettings((current) => ({
                                        ...current,
                                        lwfEnabled: checked,
                                      }))
                                    }
                                    disabled={!canManage}
                                  />
                                </div>
                              </div>

                              {statutorySettings.lwfEnabled && (
                                <div className="space-y-4">
                                  <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 font-medium text-blue-700">
                                    {t('salary.settings.statutory.lwf.ratesNote')}
                                  </div>

                                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                                    <div className="mb-3">
                                      <p className="m-0 text-sm font-medium text-gray-700">
                                        {t('salary.settings.statutory.lwf.ratesTableTitle')}
                                      </p>
                                    </div>
                                    <Table
                                      columns={lwfRateColumns}
                                      dataSource={LWF_RATES_DISPLAY}
                                      rowKey="state"
                                      size="small"
                                      pagination={false}
                                    />
                                    <p className="m-0 mt-3 text-xs text-subtle">
                                      {t('salary.settings.statutory.lwf.ratesFootnote')}
                                    </p>
                                  </div>

                                  <div className="rounded-lg border border-slate-200 bg-white p-4">
                                    <p className="m-0 text-xs leading-5 text-subtle">
                                      {t('salary.settings.statutory.lwf.fallbackStateNote', {
                                        state: statutorySettings.ptState ?? 'Gujarat',
                                      })}
                                    </p>
                                  </div>

                                  <div className="flex justify-end">
                                    <Button
                                      type="primary"
                                      onClick={handleSaveLwf}
                                      loading={isSavingLwf}
                                      disabled={!canManage}
                                    >
                                      {t('salary.settings.statutory.lwf.saveButton')}
                                    </Button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ),
                        },
                      ]
                    : []),
                ]}
              />

              <div className="mt-6 flex justify-end">
                <Button
                  type="primary"
                  onClick={handleSaveStatutory}
                  loading={isSavingStatutory}
                  disabled={!canManage || !isStatutoryDirty}
                >
                  {t('salary.settings.statutory.saveButton')}
                </Button>
              </div>
            </Card>
          </section>
        )}

        {/* Compliance section */}
        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
              <SafetyCertificateOutlined />
              <span>{t('salary.settings.compliance.sectionLabel')}</span>
            </div>
            <h2 className="m-0 text-xl font-bold text-heading">
              {t('salary.settings.compliance.heading')}
            </h2>
            <p className="m-0 text-sm text-subtle">{t('salary.settings.compliance.description')}</p>
          </div>

          <Card variant="outlined" className="border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Minimum wage (monthly) */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.compliance.minWageLabel')}
                </label>
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  prefix="&#8377;"
                  value={complianceSettings.minimumWageMonthly ?? undefined}
                  onChange={(value) =>
                    setComplianceSettings((current) => ({
                      ...current,
                      minimumWageMonthly: value === null || value === undefined ? null : value,
                    }))
                  }
                  placeholder={t('salary.settings.compliance.minWagePlaceholder')}
                  disabled={!canManage}
                />
                <p className="mt-1.5 text-xs text-subtle">
                  {t('salary.settings.compliance.minWageHint')}
                </p>
              </div>

              {/* Wage category */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('salary.settings.compliance.wageCategoryLabel')}
                </label>
                <Select
                  className="w-full"
                  value={complianceSettings.minimumWageCategory}
                  onChange={(value) =>
                    setComplianceSettings((current) => ({
                      ...current,
                      minimumWageCategory: value,
                    }))
                  }
                  options={MINIMUM_WAGE_CATEGORY_OPTIONS.map((opt) => ({
                    value: opt.value,
                    label: t(`salary.settings.compliance.wageCategory_${opt.value}`),
                  }))}
                  disabled={!canManage}
                />
                <p className="mt-1.5 text-xs text-subtle">
                  {t('salary.settings.compliance.wageCategoryHint')}
                </p>
              </div>

              {/* Deduction cap */}
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {t('salary.settings.compliance.deductionCapLabel')}
                </label>
                <Radio.Group
                  value={complianceSettings.deductionCapPercent}
                  onChange={(e) =>
                    setComplianceSettings((current) => ({
                      ...current,
                      deductionCapPercent: e.target.value as 50 | 75,
                    }))
                  }
                  disabled={!canManage}
                >
                  <Radio value={50}>{t('salary.settings.compliance.deductionCap50')}</Radio>
                  <Radio value={75}>
                    <span className="inline-flex items-center gap-1">
                      {t('salary.settings.compliance.deductionCap75')}
                      <Tooltip
                        title={t('salary.settings.compliance.deductionCap75Tooltip')}
                        styles={{ root: { maxWidth: 320 } }}
                      >
                        <InfoCircleOutlined className="cursor-help text-xs text-subtle" />
                      </Tooltip>
                    </span>
                  </Radio>
                </Radio.Group>
              </div>

              {/* Advisory one-third toggle */}
              <div className="flex items-start justify-between gap-4 md:col-span-2">
                <div>
                  <p className="m-0 text-sm font-medium text-gray-700">
                    {t('salary.settings.compliance.advisoryOneThirdLabel')}
                  </p>
                  <p className="m-0 mt-0.5 text-xs text-subtle">
                    {t('salary.settings.compliance.advisoryOneThirdHint')}
                  </p>
                </div>
                <Checkbox
                  checked={complianceSettings.installmentAdvisoryOneThirdEnabled}
                  onChange={(e) =>
                    setComplianceSettings((current) => ({
                      ...current,
                      installmentAdvisoryOneThirdEnabled: e.target.checked,
                    }))
                  }
                  disabled={!canManage}
                />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 font-medium text-amber-700">
                {t('salary.settings.compliance.legalNote')}
              </div>
              <div className="flex justify-end">
                <Button
                  type="primary"
                  onClick={handleSaveCompliance}
                  loading={isSavingCompliance}
                  disabled={!canManage || !isComplianceDirty}
                >
                  {t('salary.settings.compliance.saveButton')}
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* Disbursement & Attendance Rules - owner-only (D-01/D-03). Links: DisbursementRulesPanel → salary.api.ts wrappers. */}
        <section className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
              <SettingOutlined />
              <span>
                {t('salary.settings.disbursement.sectionLabel', {
                  defaultValue: 'DISBURSEMENT & ATTENDANCE RULES',
                })}
              </span>
            </div>
            <h2 className="m-0 text-xl font-bold text-heading">
              {t('salary.settings.disbursement.heading', {
                defaultValue: 'Disbursement & Attendance Rules',
              })}
            </h2>
            <p className="m-0 text-sm text-subtle">
              {t('salary.settings.disbursement.description', {
                defaultValue:
                  'Configure when salary can be paid, the regularization window, salary-loss posting, and how holidays/week-offs affect attendance calculations.',
              })}
            </p>
          </div>

          <DisbursementRulesPanel workspaceId={currentWorkspaceId ?? ''} isOwner={isOwner} />
        </section>

        {showTemplatesSection && (
          <section className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-subtle uppercase">
                <ClusterOutlined />
                <span>{t('salary.settings.templates.sectionLabel')}</span>
              </div>
              <h2 className="m-0 text-xl font-bold text-heading">
                {t('salary.settings.templates.heading')}
              </h2>
              <p className="m-0 text-sm text-subtle">
                {t('salary.settings.templates.description')}
              </p>
            </div>

            <Card
              variant="outlined"
              title={t('salary.settings.templates.quickSetupTitle')}
              className="border-slate-200 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                {BUILT_IN_TEMPLATE_CARDS.map((card) => {
                  const alreadyExists = templates.some((template) => template.name === card.name);
                  return (
                    <Card
                      key={card.key}
                      variant="outlined"
                      size="small"
                      className="h-full border-slate-200 transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm"
                    >
                      <h4 className="mb-1 text-sm font-semibold text-heading">{card.name}</h4>
                      <p className="mb-3 text-xs text-subtle">{card.description}</p>
                      {alreadyExists ? (
                        <Tag color="green">
                          <CheckCircleOutlined /> {t('salary.settings.templates.alreadyAddedTag')}
                        </Tag>
                      ) : (
                        <Button
                          size="small"
                          type="primary"
                          loading={templatesLoading}
                          onClick={() => handleSeedTemplate(card.key)}
                          disabled={!canManage}
                        >
                          {t('salary.settings.templates.addTemplateButton')}
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </Card>

            <Card
              variant="outlined"
              title={t('salary.settings.templates.yourTemplatesTitle')}
              className="!mt-6 border-slate-200 shadow-sm"
              extra={
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={openCreateModal}
                  disabled={!canManage}
                >
                  {t('salary.settings.templates.createCustomButton')}
                </Button>
              }
            >
              {templates.length === 0 ? (
                <Empty description={t('salary.settings.templates.emptyDescription')} />
              ) : (
                <Table
                  columns={templateColumns}
                  dataSource={templates}
                  rowKey="_id"
                  pagination={false}
                  size="small"
                  rowClassName={() => 'transition-colors hover:bg-slate-50'}
                />
              )}
            </Card>
          </section>
        )}
      </div>

      {canManage && isDefaultsDirty && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-4 md:px-6">
          <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-2xl border border-blue-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
            <div className="min-w-0">
              <p className="m-0 text-sm font-semibold text-heading">
                {t('salary.settings.defaults.unsavedBannerTitle')}
              </p>
              <p className="m-0 mt-0.5 text-xs text-subtle">
                {t('salary.settings.defaults.unsavedBannerDescription')}
              </p>
            </div>
            <Button
              type="primary"
              onClick={handleSaveDisplay}
              loading={isSavingDisplay}
              disabled={!canManage}
            >
              {t('salary.settings.defaults.saveButton')}
            </Button>
          </div>
        </div>
      )}

      {/* Template Edit Modal */}
      <Modal
        title={
          editingTemplate
            ? t('salary.settings.templates.modal.titleEdit')
            : t('salary.settings.templates.modal.titleCreate')
        }
        open={editModalOpen}
        onOk={handleSaveTemplate}
        onCancel={() => setEditModalOpen(false)}
        width={800}
        okText={
          editingTemplate
            ? t('salary.settings.templates.modal.okTextUpdate')
            : t('salary.settings.templates.modal.okTextCreate')
        }
        cancelText={t('salary.settings.templates.modal.cancelText')}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('salary.settings.templates.modal.templateNameLabel')}
              </label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('salary.settings.templates.modal.templateNamePlaceholder')}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                checked={editIsDefault}
                onChange={(e) => setEditIsDefault(e.target.checked)}
              >
                {t('salary.settings.templates.modal.isDefaultLabel')}
              </Checkbox>
            </div>
          </div>

          <div className="my-3 border-t border-gray-200 dark:border-gray-700" />

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              {t('salary.settings.templates.modal.componentsHeading')}
            </h4>
            <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={addComponent}>
              {t('salary.settings.templates.modal.addComponentButton')}
            </Button>
          </div>

          {editComponents.map((comp, idx) => (
            <div
              key={comp.id}
              className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <span className="w-6 text-xs font-semibold text-faint">#{idx + 1}</span>
                <Input
                  size="small"
                  placeholder={t('salary.settings.templates.modal.componentNamePlaceholder')}
                  value={comp.name}
                  onChange={(e) => updateComponent(idx, 'name', e.target.value)}
                  className="flex-1"
                />
                <Select
                  size="small"
                  style={{ width: 160 }}
                  value={comp.calcMode}
                  onChange={(v) => updateComponent(idx, 'calcMode', v)}
                >
                  <Select.Option value="percent_of_ctc">
                    {t('salary.settings.templates.modal.calcModePercentCtc')}
                  </Select.Option>
                  <Select.Option value="percent_of_component">
                    {t('salary.settings.templates.modal.calcModePercentComponent')}
                  </Select.Option>
                  <Select.Option value="fixed">
                    {t('salary.settings.templates.modal.calcModeFixed')}
                  </Select.Option>
                  <Select.Option value="balancing">
                    {t('salary.settings.templates.modal.calcModeBalancing')}
                  </Select.Option>
                </Select>
                <Button size="small" danger type="text" onClick={() => removeComponent(idx)}>
                  <DeleteOutlined />
                </Button>
              </div>

              <div className="ml-8 flex items-center gap-4">
                {comp.calcMode !== 'balancing' && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-faint">
                      {t('salary.settings.templates.modal.valueLabel')}
                    </span>
                    <InputNumber
                      size="small"
                      style={{ width: 80 }}
                      min={0}
                      value={comp.value}
                      onChange={(v) => updateComponent(idx, 'value', v ?? undefined)}
                    />
                  </div>
                )}

                {comp.calcMode === 'percent_of_component' && (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-faint">
                      {t('salary.settings.templates.modal.refLabel')}
                    </span>
                    <Select
                      size="small"
                      style={{ width: 140 }}
                      value={comp.referenceComponentId}
                      onChange={(v) => updateComponent(idx, 'referenceComponentId', v)}
                    >
                      {editComponents
                        .filter((c) => c.id !== comp.id)
                        .map((c) => (
                          <Select.Option key={c.id} value={c.id}>
                            {c.name || t('salary.settings.templates.modal.unnamedComponent')}
                          </Select.Option>
                        ))}
                    </Select>
                  </div>
                )}

                <Checkbox
                  checked={comp.includedInCtc}
                  onChange={(e) => updateComponent(idx, 'includedInCtc', e.target.checked)}
                >
                  <span className="text-xs">{t('salary.settings.templates.modal.inCtcLabel')}</span>
                </Checkbox>

                <Radio
                  checked={comp.isBasicComponent}
                  onChange={() => updateComponent(idx, 'isBasicComponent', true)}
                >
                  <span className="text-xs">{t('salary.settings.templates.modal.basicLabel')}</span>
                </Radio>

                <Checkbox
                  checked={comp.isTaxable}
                  onChange={(e) => updateComponent(idx, 'isTaxable', e.target.checked)}
                >
                  <span className="text-xs">
                    {t('salary.settings.templates.modal.taxableLabel')}
                  </span>
                </Checkbox>
              </div>
            </div>
          ))}

          {editComponents.length === 0 && (
            <Empty
              description={t('salary.settings.templates.modal.noComponentsEmpty')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          )}

          {validationErrors.length > 0 && (
            <div className="space-y-0.5 text-xs text-red-700">
              {validationErrors.map((err, i) => (
                <div key={i}>{err}</div>
              ))}
            </div>
          )}

          {livePreview && (
            <div className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <h4 className="mb-2 text-xs font-semibold tracking-wider text-gray-700 uppercase">
                {t('salary.settings.templates.modal.livePreviewHeading', {
                  symbol: displaySettings.currencySymbol ?? '',
                })}
              </h4>
              <div className="space-y-1">
                {livePreview.breakdown.map((comp) => (
                  <div key={comp.componentId} className="flex justify-between text-sm">
                    <span
                      className={
                        comp.isBasicComponent ? 'font-medium text-blue-700' : 'text-gray-600'
                      }
                    >
                      {comp.name}
                      {!comp.includedInCtc ? ' *' : ''}
                    </span>
                    <span className="font-medium">
                      {displaySettings.currencySymbol}
                      {comp.calculatedAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
              {livePreview.breakdown.some((c) => !c.includedInCtc) && (
                <div className="mt-1.5 border-t border-gray-100 pt-1 text-[10px] text-faint">
                  {t('salary.settings.templates.modal.aboveCtcNote')}
                </div>
              )}
              <div className="mt-2 text-xs text-faint">
                {t('salary.settings.templates.modal.baseSalaryLabel', {
                  symbol: displaySettings.currencySymbol ?? '',
                  amount: livePreview.baseSalaryValue.toLocaleString('en-IN'),
                })}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
