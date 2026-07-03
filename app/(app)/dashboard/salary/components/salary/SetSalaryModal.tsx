'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Form,
  InputNumber,
  Input,
  Row,
  Col,
  Checkbox,
  Select,
  Tooltip,
  Button,
  Popover,
  Modal,
} from 'antd';
import type { FormInstance } from 'antd';
import {
  CalendarOutlined,
  FieldTimeOutlined,
  MobileOutlined,
  BankOutlined,
  EditOutlined,
  InfoCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { DsModal, SegmentedToggle, FileUpload } from '@/components/ui';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import type { SalaryRecord } from '../../types/salary-page.types';
import { useSalaryFeatures } from '@/features/salary/hooks/useSalaryFeatures';
import { useWorkspaceStore } from '@/lib/store';
import { useComponentTemplateStore } from '@/features/salary/store/useComponentTemplateStore';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { calculateComponents } from '@/features/salary/utils/component-calculator';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';
import type { EmployeeComponentOverride } from '@/types';

const { Option } = Select;
type SalaryDayBasis = 'fixed_month_days' | 'calendar_month_days';
type AttendancePayMode = 'default' | 'enabled' | 'disabled';

function getRecordTeamMember(record: SalaryRecord | null) {
  return record?.teamMember && typeof record.teamMember === 'object' ? record.teamMember : null;
}

function getInitialCompensationDraft(record: SalaryRecord | null): {
  ctcAmount: number | null;
  selectedTemplateId: string | null;
  componentOverrides: EmployeeComponentOverride[];
} {
  const member = getRecordTeamMember(record);
  const memberSalaryType = member?.salaryType || 'monthly';

  if (memberSalaryType === 'hourly') {
    return {
      ctcAmount: null,
      selectedTemplateId: null,
      componentOverrides: [],
    };
  }

  return {
    ctcAmount: member?.ctcAmount ?? null,
    selectedTemplateId: member?.componentTemplateId ?? null,
    componentOverrides: [...(member?.componentOverrides ?? [])],
  };
}

function getMonthLength(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

function resolveBasisDays(params: {
  salaryDayBasis: SalaryDayBasis;
  fixedMonthDays?: number | null;
  defaultWorkingDays: number;
  month: number;
  year: number;
}) {
  return params.salaryDayBasis === 'calendar_month_days'
    ? getMonthLength(params.month, params.year)
    : Math.max(
        1,
        Math.min(
          31,
          Number(params.fixedMonthDays ?? params.defaultWorkingDays) || params.defaultWorkingDays,
        ),
      );
}

function getMonthName(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
}

interface SetSalaryModalProps {
  open: boolean;
  record: SalaryRecord | null;
  form: FormInstance;
  saving: boolean;
  salaryMode: 'monthly' | 'hourly';
  setSalaryMode: (mode: 'monthly' | 'hourly') => void;
  paymentMethod: 'UPI' | 'BANK' | undefined;
  setPaymentMethod: (method: 'UPI' | 'BANK' | undefined) => void;
  passbookImage: string | File | null;
  setPassbookImage: (file: string | File | null) => void;
  qrCodeImage: string | File | null;
  setQrCodeImage: (file: string | File | null) => void;
  sameAsEmployeeName: boolean;
  setSameAsEmployeeName: (value: boolean) => void;
  onClose: () => void;
  onSubmit: (
    values: any,
    meta: {
      ctcAmount: number | null;
      selectedTemplateId: string | null;
      componentOverrides: EmployeeComponentOverride[];
    },
  ) => void;
  getRecordStatus: (record: SalaryRecord & { teamMember?: any }) => string;
}

export function SetSalaryModal({
  open,
  record,
  form,
  saving,
  salaryMode,
  setSalaryMode,
  paymentMethod,
  setPaymentMethod,
  passbookImage,
  setPassbookImage,
  qrCodeImage,
  setQrCodeImage,
  sameAsEmployeeName,
  setSameAsEmployeeName,
  onClose,
  onSubmit,
  getRecordStatus,
}: SetSalaryModalProps) {
  const t = useTranslations();
  const features = useSalaryFeatures();
  const showHourlySalary = features.hourlySalary.visible;
  const showBankDetails = features.bankDetails.visible;
  const showProofAttachments = features.proofAttachments.visible;
  // True when the caller lacks salary.sensitive_view - backend stripped bank/UPI fields.
  const bankSensitiveHidden =
    showBankDetails &&
    !!record?.teamMember &&
    typeof record.teamMember === 'object' &&
    !record.teamMember.bankDetails &&
    !record.teamMember.upiDetails;
  const showSalaryComponents = features.salaryComponents.visible;
  const currentWorkspaceId = useWorkspaceStore((state) => state.currentWorkspaceId);
  const payrollConfig = usePayrollConfigStore((state) => state.config);
  const { templates, fetchTemplates, isLoading: templatesLoading } = useComponentTemplateStore();
  const currencyFmt = useCurrencyFormatter();
  const [modalApi, modalContextHolder] = Modal.useModal();
  const [hasTouchedTemplateSelection, setHasTouchedTemplateSelection] = useState(false);
  const initialCompensationDraft = getInitialCompensationDraft(record);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [overrideDraftValue, setOverrideDraftValue] = useState<number | null>(null);
  const [ctcAmount, setCtcAmount] = useState<number | null>(initialCompensationDraft.ctcAmount);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initialCompensationDraft.selectedTemplateId,
  );
  const [componentOverrides, setComponentOverrides] = useState<EmployeeComponentOverride[]>(
    initialCompensationDraft.componentOverrides,
  );
  const salaryDayBasis =
    (Form.useWatch('salaryDayBasis', form) as SalaryDayBasis | undefined) ?? 'fixed_month_days';
  const fixedMonthDaysWatch =
    (Form.useWatch('fixedMonthDays', form) as number | null | undefined) ?? null;
  const attendancePayMode =
    (Form.useWatch('attendancePayMode', form) as AttendancePayMode | undefined) ?? 'default';
  const hourlyRate = Number(Form.useWatch('hourlyRate', form) ?? 0);
  const dailyHours = Number(Form.useWatch('dailyHours', form) ?? 8);
  const finalMonthlyOverride = Number(Form.useWatch('finalMonthlyOverride', form) ?? 0);
  const workspaceDefaultWorkingDays = Math.max(
    1,
    Math.min(31, Number(payrollConfig?.display?.defaultWorkingDays ?? 26) || 26),
  );
  const attendanceFeatureEnabled = payrollConfig?.features?.attendanceBasedPay !== false;
  const workspaceAttendanceDefault =
    payrollConfig?.rules?.attendancePayModeDefault === 'disabled' ? 'disabled' : 'enabled';
  const payrollMonth = record?.month ?? new Date().getMonth() + 1;
  const payrollYear = record?.year ?? new Date().getFullYear();
  const basisDays = resolveBasisDays({
    salaryDayBasis,
    fixedMonthDays: fixedMonthDaysWatch,
    defaultWorkingDays: workspaceDefaultWorkingDays,
    month: payrollMonth,
    year: payrollYear,
  });

  useEffect(() => {
    if (open && showSalaryComponents && currentWorkspaceId) {
      fetchTemplates(currentWorkspaceId);
    }
  }, [open, showSalaryComponents, currentWorkspaceId, fetchTemplates]);

  const defaultTemplate = useMemo(
    () => templates.find((template) => template.isDefault) || null,
    [templates],
  );

  const recordTeamMember = getRecordTeamMember(record);
  const memberHasAssignedTemplate =
    (recordTeamMember?.salaryType || 'monthly') !== 'hourly' &&
    !!recordTeamMember?.componentTemplateId;
  const effectiveSelectedTemplateId =
    open &&
    showSalaryComponents &&
    salaryMode === 'monthly' &&
    (ctcAmount ?? 0) > 0 &&
    !selectedTemplateId &&
    !memberHasAssignedTemplate &&
    !!defaultTemplate &&
    !hasTouchedTemplateSelection
      ? defaultTemplate._id
      : selectedTemplateId;

  const selectedTemplate = useMemo(() => {
    if (!effectiveSelectedTemplateId) return null;
    return templates.find((template) => template._id === effectiveSelectedTemplateId) || null;
  }, [templates, effectiveSelectedTemplateId]);

  const componentBreakdown = useMemo(() => {
    if (!ctcAmount || !selectedTemplate || salaryMode !== 'monthly') {
      return null;
    }

    try {
      return calculateComponents(ctcAmount, selectedTemplate.components, componentOverrides);
    } catch {
      return null;
    }
  }, [ctcAmount, selectedTemplate, componentOverrides, salaryMode]);

  useEffect(() => {
    if (
      componentBreakdown?.baseSalaryValue !== undefined &&
      showSalaryComponents &&
      salaryMode === 'monthly' &&
      ctcAmount
    ) {
      form.setFieldsValue({ baseSalary: componentBreakdown.baseSalaryValue });
    }
  }, [componentBreakdown, form, showSalaryComponents, salaryMode, ctcAmount]);

  const hasCtcValue = (ctcAmount ?? 0) > 0;
  const isCTCMode =
    showSalaryComponents &&
    salaryMode === 'monthly' &&
    hasCtcValue &&
    !!selectedTemplate &&
    !!componentBreakdown;
  const usingDefaultTemplateFallback =
    !memberHasAssignedTemplate &&
    !!selectedTemplate &&
    !!defaultTemplate &&
    effectiveSelectedTemplateId === defaultTemplate._id &&
    !selectedTemplateId;
  const aboveCtcTotal = useMemo(
    () =>
      componentBreakdown?.breakdown
        .filter((component) => !component.includedInCtc)
        .reduce((sum, component) => sum + component.calculatedAmount, 0) ?? 0,
    [componentBreakdown],
  );
  const structureGuidance = useMemo(() => {
    if (!hasCtcValue) {
      return {
        title: t('salary.setSalaryModal.ctcStructure.guidanceNoCtcTitle'),
        description: t('salary.setSalaryModal.ctcStructure.guidanceNoCtcBody'),
      };
    }

    if (templatesLoading && templates.length === 0) {
      return {
        title: t('salary.setSalaryModal.ctcStructure.guidanceLoadingTitle'),
        description: t('salary.setSalaryModal.ctcStructure.guidanceLoadingBody'),
      };
    }

    if (templates.length === 0) {
      return {
        title: t('salary.setSalaryModal.ctcStructure.guidanceNoTemplatesTitle'),
        description: t('salary.setSalaryModal.ctcStructure.guidanceNoTemplatesBody'),
      };
    }

    if (!selectedTemplate) {
      return {
        title: t('salary.setSalaryModal.ctcStructure.guidanceNoSelectionTitle'),
        description: t('salary.setSalaryModal.ctcStructure.guidanceNoSelectionBody'),
      };
    }

    if (usingDefaultTemplateFallback) {
      return {
        title: t('salary.setSalaryModal.ctcStructure.guidanceDefaultFallbackTitle'),
        description: t('salary.setSalaryModal.ctcStructure.guidanceDefaultFallbackBody'),
      };
    }

    if (memberHasAssignedTemplate) {
      return {
        title: t('salary.setSalaryModal.ctcStructure.guidanceExistingTitle'),
        description: t('salary.setSalaryModal.ctcStructure.guidanceExistingBody'),
      };
    }

    return {
      title: t('salary.setSalaryModal.ctcStructure.guidanceReviewTitle'),
      description: t('salary.setSalaryModal.ctcStructure.guidanceReviewBody'),
    };
  }, [
    hasCtcValue,
    memberHasAssignedTemplate,
    selectedTemplate,
    t,
    templates.length,
    templatesLoading,
    usingDefaultTemplateFallback,
  ]);

  const handleComponentOverride = (componentId: string, value: number) => {
    const existing = componentOverrides.filter((override) => override.componentId !== componentId);
    setComponentOverrides([...existing, { componentId, calcMode: 'fixed', value }]);
  };

  const removeComponentOverride = (componentId: string) => {
    setComponentOverrides(
      componentOverrides.filter((override) => override.componentId !== componentId),
    );
  };

  const openOverrideEditor = (componentId: string, currentAmount: number) => {
    setEditingComponentId(componentId);
    setOverrideDraftValue(currentAmount);
  };

  const closeOverrideEditor = () => {
    setEditingComponentId(null);
    setOverrideDraftValue(null);
  };

  const handleCtcAmountChange = (value: number | null) => {
    closeOverrideEditor();
    setCtcAmount(value);
  };

  const handleTemplateSelectionChange = (value: string | null) => {
    setHasTouchedTemplateSelection(true);
    closeOverrideEditor();
    setSelectedTemplateId(value);
    setComponentOverrides([]);
  };

  const applyOverrideEditor = () => {
    if (!editingComponentId || overrideDraftValue === null) {
      return;
    }

    const nextValue = Number(overrideDraftValue);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      return;
    }

    handleComponentOverride(editingComponentId, nextValue);
    closeOverrideEditor();
  };

  const handleModalClose = () => {
    setHasTouchedTemplateSelection(false);
    closeOverrideEditor();
    onClose();
  };

  const applySalaryModeChange = (nextMode: 'monthly' | 'hourly') => {
    if (nextMode === salaryMode) {
      return;
    }

    if (nextMode === 'hourly') {
      const currentBase = form.getFieldValue('baseSalary') || 0;
      const currentDailyHours = Number(form.getFieldValue('dailyHours') || 8);

      if (currentBase > 0 && currentDailyHours > 0 && basisDays > 0) {
        const estimatedHourly =
          Math.round((currentBase / basisDays / currentDailyHours) * 100) / 100;
        form.setFieldsValue({
          hourlyRate: estimatedHourly,
        });
      }

      setCtcAmount(null);
      setSelectedTemplateId(null);
      setComponentOverrides([]);
      closeOverrideEditor();
      setHasTouchedTemplateSelection(false);
      form.setFieldsValue({
        ctcAmount: null,
        componentTemplateId: null,
        componentOverrides: [],
        finalMonthlyOverride: undefined,
      });
      setSalaryMode('hourly');
      return;
    }

    const currentHourly = Number(form.getFieldValue('hourlyRate') || 0);
    const currentDailyHours = Number(form.getFieldValue('dailyHours') || 8);
    const currentOverride = Number(form.getFieldValue('finalMonthlyOverride') || 0);

    if (currentOverride > 0 || (currentHourly > 0 && currentDailyHours > 0)) {
      const estimatedMonthly =
        currentOverride > 0 ? currentOverride : currentHourly * currentDailyHours * basisDays;
      form.setFieldsValue({
        baseSalary: estimatedMonthly,
      });
    }

    closeOverrideEditor();
    form.setFieldsValue({
      hourlyRate: undefined,
      dailyHours: 8,
      finalMonthlyOverride: undefined,
    });
    setSalaryMode('monthly');
  };

  const handleSalaryModeChange = (nextMode: 'monthly' | 'hourly') => {
    if (nextMode === salaryMode) {
      return;
    }

    const hasMonthlyModeConfig =
      (ctcAmount ?? 0) > 0 || Boolean(selectedTemplateId) || componentOverrides.length > 0;
    const finalOverride = form.getFieldValue('finalMonthlyOverride');
    const hasHourlyModeConfig =
      hourlyRate > 0 ||
      (finalOverride !== undefined && finalOverride !== null && finalOverride !== '') ||
      dailyHours !== 8;

    const shouldConfirm =
      (salaryMode === 'monthly' && nextMode === 'hourly' && hasMonthlyModeConfig) ||
      (salaryMode === 'hourly' && nextMode === 'monthly' && hasHourlyModeConfig);

    if (!shouldConfirm) {
      applySalaryModeChange(nextMode);
      return;
    }

    const switchingToHourly = nextMode === 'hourly';
    modalApi.confirm({
      centered: true,
      title: switchingToHourly
        ? t('salary.setSalaryModal.switchModal.toHourlyTitle')
        : t('salary.setSalaryModal.switchModal.toMonthlyTitle'),
      content: switchingToHourly
        ? t('salary.setSalaryModal.switchModal.toHourlyContent')
        : t('salary.setSalaryModal.switchModal.toMonthlyContent'),
      okText: t('salary.setSalaryModal.switchModal.okText'),
      cancelText: switchingToHourly
        ? t('salary.setSalaryModal.switchModal.cancelToHourly')
        : t('salary.setSalaryModal.switchModal.cancelToMonthly'),
      onOk: () => applySalaryModeChange(nextMode),
    });
  };

  const dayBasisLabel =
    salaryDayBasis === 'calendar_month_days'
      ? t('salary.setSalaryModal.salaryCalculation.calendarBasisLabel', {
          days: basisDays,
          monthName: getMonthName(payrollMonth, payrollYear),
        })
      : t('salary.setSalaryModal.salaryCalculation.fixedBasisLabel', { days: basisDays });
  const attendanceModeLabel = !attendanceFeatureEnabled
    ? t('salary.setSalaryModal.salaryCalculation.attendanceDisabledTitle')
    : attendancePayMode === 'enabled'
      ? t('salary.setSalaryModal.salaryCalculation.attendanceBased')
      : attendancePayMode === 'disabled'
        ? t('salary.setSalaryModal.salaryCalculation.ignoreAttendance')
        : workspaceAttendanceDefault === 'enabled'
          ? t('salary.setSalaryModal.salaryCalculation.attendanceDefaultEnabled')
          : t('salary.setSalaryModal.salaryCalculation.attendanceDefaultDisabled');
  const calculationHelperTitle =
    salaryMode === 'monthly'
      ? t('salary.setSalaryModal.salaryCalculation.calculationHelperMonthly')
      : t('salary.setSalaryModal.salaryCalculation.calculationHelperHourly');
  const calculationHelperText =
    salaryMode === 'monthly'
      ? attendanceFeatureEnabled && attendancePayMode !== 'disabled'
        ? t('salary.setSalaryModal.salaryCalculation.calcBodyMonthlyAttendance', {
            basisLabel: dayBasisLabel.toLowerCase(),
          })
        : t('salary.setSalaryModal.salaryCalculation.calcBodyMonthlyNoAttendance')
      : attendanceFeatureEnabled && attendancePayMode !== 'disabled'
        ? t('salary.setSalaryModal.salaryCalculation.calcBodyHourlyAttendance', {
            basisLabel: dayBasisLabel.toLowerCase(),
          })
        : t('salary.setSalaryModal.salaryCalculation.calcBodyHourlyNoAttendance', {
            basisLabel: dayBasisLabel.toLowerCase(),
          });

  return (
    <DsModal
      forceRender
      open={open}
      onCancel={handleModalClose}
      title={
        <span className="font-display">
          {record && getRecordStatus(record) === 'salary_not_set'
            ? t('salary.setSalaryModal.titleSet')
            : t('salary.setSalaryModal.titleEdit')}{' '}
          -{' '}
          {record?.teamMember &&
          typeof record.teamMember === 'object' &&
          'name' in record.teamMember
            ? record.teamMember.name
            : ''}
        </span>
      }
      onOk={() => form.submit()}
      confirmLoading={saving}
      okText={t('salary.setSalaryModal.okText')}
      width={640}
      scrollHeight="calc(100vh - 200px)"
    >
      {modalContextHolder}
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) =>
          onSubmit(values, {
            ctcAmount,
            selectedTemplateId: effectiveSelectedTemplateId,
            componentOverrides,
          })
        }
        requiredMark={false}
        initialValues={{
          dailyHours: 8,
          salaryDayBasis: 'fixed_month_days',
          fixedMonthDays: workspaceDefaultWorkingDays,
          attendancePayMode: 'default',
        }}
      >
        {showHourlySalary && (
          <div className="mb-5">
            <SegmentedToggle
              sectionLabel={t('salary.setSalaryModal.salaryMode.sectionLabel')}
              options={[
                {
                  value: 'monthly',
                  label: t('salary.setSalaryModal.salaryMode.monthly'),
                  icon: <CalendarOutlined />,
                },
                {
                  value: 'hourly',
                  label: t('salary.setSalaryModal.salaryMode.hourly'),
                  icon: <FieldTimeOutlined />,
                },
              ]}
              value={salaryMode}
              onChange={(val) => handleSalaryModeChange(val as 'monthly' | 'hourly')}
            />
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <InfoCircleOutlined className="mt-0.5 text-sm text-slate-600" />
                <div>
                  <p className="m-0 text-[13px] font-semibold text-heading">
                    {salaryMode === 'monthly'
                      ? t('salary.setSalaryModal.salaryMode.monthlyModeTitle')
                      : t('salary.setSalaryModal.salaryMode.hourlyModeTitle')}
                  </p>
                  <p className="m-0 mt-1 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                    {salaryMode === 'monthly'
                      ? t('salary.setSalaryModal.salaryMode.monthlyModeBody')
                      : t('salary.setSalaryModal.salaryMode.hourlyModeBody')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--cr-border,var(--cr-border))] bg-[var(--cr-surface,#fff)]">
          <div className="border-b border-[var(--cr-border,var(--cr-border))] bg-[var(--cr-surface-secondary,var(--cr-bg))] px-4 py-3">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-muted,var(--cr-text-4))] uppercase">
              {t('salary.setSalaryModal.salaryCalculation.sectionLabel')}
            </p>
            <p className="m-0 mt-1 text-sm text-[var(--cr-muted,var(--cr-text-4))]">
              {t('salary.setSalaryModal.salaryCalculation.sectionDescription')}
            </p>
          </div>

          <div className="space-y-4 px-4 py-4">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="salaryDayBasis"
                  label={t('salary.setSalaryModal.salaryCalculation.dayBasisLabel')}
                  rules={[
                    {
                      required: true,
                      message: t('salary.setSalaryModal.salaryCalculation.dayBasisRequired'),
                    },
                  ]}
                >
                  <Select>
                    <Option value="fixed_month_days">
                      {t('salary.setSalaryModal.salaryCalculation.fixedMonthDays')}
                    </Option>
                    <Option value="calendar_month_days">
                      {t('salary.setSalaryModal.salaryCalculation.calendarMonthDays')}
                    </Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="fixedMonthDays"
                  label={t('salary.setSalaryModal.salaryCalculation.fixedMonthDaysField')}
                  extra={t('salary.setSalaryModal.salaryCalculation.fixedMonthDaysExtra')}
                  rules={[
                    {
                      validator: async (_, value) => {
                        if (salaryDayBasis !== 'fixed_month_days') {
                          return;
                        }
                        const numericValue = Number(value);
                        if (
                          Number.isFinite(numericValue) &&
                          numericValue >= 1 &&
                          numericValue <= 31
                        ) {
                          return;
                        }
                        throw new Error(
                          t('salary.setSalaryModal.salaryCalculation.fixedMonthDaysValidation'),
                        );
                      },
                    },
                  ]}
                >
                  <InputNumber
                    className="w-full"
                    min={1}
                    max={31}
                    disabled={salaryDayBasis !== 'fixed_month_days'}
                    placeholder={t(
                      'salary.setSalaryModal.salaryCalculation.fixedMonthDaysPlaceholder',
                    )}
                  />
                </Form.Item>
              </Col>
            </Row>

            {attendanceFeatureEnabled ? (
              <Form.Item
                name="attendancePayMode"
                label={t('salary.setSalaryModal.salaryCalculation.attendanceBehaviorLabel')}
              >
                <Select>
                  <Option value="default">
                    {workspaceAttendanceDefault === 'enabled'
                      ? t('salary.setSalaryModal.salaryCalculation.attendanceDefaultEnabled')
                      : t('salary.setSalaryModal.salaryCalculation.attendanceDefaultDisabled')}
                  </Option>
                  <Option value="enabled">
                    {t('salary.setSalaryModal.salaryCalculation.attendanceBased')}
                  </Option>
                  <Option value="disabled">
                    {t('salary.setSalaryModal.salaryCalculation.ignoreAttendance')}
                  </Option>
                </Select>
              </Form.Item>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <InfoCircleOutlined className="mt-0.5 text-sm text-slate-600" />
                  <div>
                    <p className="m-0 text-[13px] font-semibold text-heading">
                      {t('salary.setSalaryModal.salaryCalculation.attendanceDisabledTitle')}
                    </p>
                    <p className="m-0 mt-1 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                      {t('salary.setSalaryModal.salaryCalculation.attendanceDisabledBody')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <InfoCircleOutlined className="mt-0.5 text-sm text-slate-600" />
                <div>
                  <p className="m-0 text-[13px] font-semibold text-heading">
                    {calculationHelperTitle}
                  </p>
                  <p className="m-0 mt-1 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                    {calculationHelperText}
                  </p>
                  <p className="m-0 mt-2 text-[11px] text-slate-600">
                    {`${dayBasisLabel}. ${attendanceModeLabel}.`}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {salaryMode === 'monthly' ? (
          <>
            {showSalaryComponents && (
              <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--cr-border,var(--cr-border))] bg-[var(--cr-surface,#fff)]">
                <div className="border-b border-[var(--cr-border,var(--cr-border))] bg-[var(--cr-surface-secondary,var(--cr-bg))] px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-muted,var(--cr-text-4))] uppercase">
                        {t('salary.setSalaryModal.ctcStructure.sectionLabel')}
                      </p>
                      <p className="m-0 mt-1 text-sm text-[var(--cr-muted,var(--cr-text-4))]">
                        {t('salary.setSalaryModal.ctcStructure.sectionDescription')}
                      </p>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[var(--cr-subtle,var(--cr-text-5))] shadow-sm">
                      {hasCtcValue
                        ? selectedTemplate
                          ? t('salary.setSalaryModal.ctcStructure.statusReady')
                          : t('salary.setSalaryModal.ctcStructure.statusChoose')
                        : t('salary.setSalaryModal.ctcStructure.statusEnterCtc')}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-faint">
                      {t('salary.setSalaryModal.ctcStructure.ctcLabel', {
                        symbol: currencyFmt.symbol,
                      })}
                    </label>
                    <InputNumber
                      className="w-full"
                      style={{ minWidth: 280 }}
                      min={0}
                      prefix={currencyFmt.symbol}
                      size="large"
                      placeholder={t('salary.setSalaryModal.ctcStructure.ctcPlaceholder')}
                      value={ctcAmount}
                      onChange={(val) => handleCtcAmountChange(val as number | null)}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-faint">
                      {t('salary.setSalaryModal.ctcStructure.structureLabel')}
                    </label>
                    <Select
                      className="w-full"
                      placeholder={
                        hasCtcValue
                          ? t('salary.setSalaryModal.ctcStructure.structurePlaceholderUnlocked')
                          : t('salary.setSalaryModal.ctcStructure.structurePlaceholderLocked')
                      }
                      value={effectiveSelectedTemplateId}
                      onChange={(val) => handleTemplateSelectionChange(val as string | null)}
                      loading={templatesLoading}
                      disabled={!hasCtcValue || templates.length === 0}
                      allowClear
                      onClear={() => handleTemplateSelectionChange(null)}
                    >
                      {templates.map((template) => (
                        <Select.Option key={template._id} value={template._id}>
                          {template.name}{' '}
                          {template.isDefault
                            ? t('salary.setSalaryModal.ctcStructure.templateDefault')
                            : ''}
                        </Select.Option>
                      ))}
                    </Select>
                  </div>

                  <div
                    className={`rounded-xl border px-3.5 py-3 ${
                      hasCtcValue && selectedTemplate
                        ? 'border-sky-200 bg-sky-50/70'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <InfoCircleOutlined
                        className={`mt-0.5 text-sm ${
                          hasCtcValue && selectedTemplate ? 'text-sky-600' : 'text-slate-600'
                        }`}
                      />
                      <div>
                        <p className="m-0 text-[13px] font-semibold text-heading">
                          {structureGuidance.title}
                        </p>
                        <p className="m-0 mt-1 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                          {structureGuidance.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  {componentBreakdown && selectedTemplate && (
                    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
                            {t('salary.setSalaryModal.breakdown.sectionLabel')}
                          </p>
                          <p className="m-0 mt-1 text-sm font-semibold text-heading">
                            {selectedTemplate.name}
                          </p>
                          {componentOverrides.length > 0 && (
                            <p className="m-0 mt-1 text-xs text-slate-600">
                              {componentOverrides.length === 1
                                ? t('salary.setSalaryModal.breakdown.overridesApplied', {
                                    count: componentOverrides.length,
                                  })
                                : t('salary.setSalaryModal.breakdown.overridesAppliedPlural', {
                                    count: componentOverrides.length,
                                  })}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-slate-600 uppercase">
                            {t('salary.setSalaryModal.breakdown.totalCtcLabel')}
                          </p>
                          <p className="m-0 mt-1 text-lg font-bold text-heading">
                            {currencyFmt.full(ctcAmount || 0)}
                          </p>
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100">
                        {componentBreakdown.breakdown.map((component) => {
                          const templateComponent = selectedTemplate.components.find(
                            (entry) => entry.id === component.componentId,
                          );
                          const override = componentOverrides.find(
                            (entry) => entry.componentId === component.componentId,
                          );
                          const hasOverride = Boolean(override);
                          const isBalancing = templateComponent?.calcMode === 'balancing';

                          let calcDescription = '';
                          if (templateComponent) {
                            if (hasOverride) {
                              calcDescription = t(
                                'salary.setSalaryModal.breakdown.calcCustomFixed',
                              );
                            } else if (templateComponent.calcMode === 'percent_of_ctc') {
                              calcDescription = t(
                                'salary.setSalaryModal.breakdown.calcPercentCtc',
                                { value: templateComponent.value ?? 0 },
                              );
                            } else if (templateComponent.calcMode === 'percent_of_component') {
                              const referenceComponent = selectedTemplate.components.find(
                                (entry) => entry.id === templateComponent.referenceComponentId,
                              );
                              calcDescription = t(
                                'salary.setSalaryModal.breakdown.calcPercentComponent',
                                {
                                  value: templateComponent.value ?? 0,
                                  referenceName:
                                    referenceComponent?.name ||
                                    t('salary.setSalaryModal.breakdown.calcLinkedComponent'),
                                },
                              );
                            } else if (templateComponent.calcMode === 'fixed') {
                              calcDescription = t('salary.setSalaryModal.breakdown.calcFixed');
                            } else if (templateComponent.calcMode === 'balancing') {
                              calcDescription = t('salary.setSalaryModal.breakdown.calcBalancing');
                            }
                          }

                          return (
                            <div
                              key={component.componentId}
                              className={`flex items-start justify-between gap-3 px-4 py-3 transition-colors ${
                                editingComponentId === component.componentId
                                  ? 'bg-sky-50/70'
                                  : 'bg-white'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`font-semibold ${
                                      component.isBasicComponent ? 'text-sky-700' : 'text-heading'
                                    }`}
                                  >
                                    {component.name}
                                  </span>
                                  {component.isBasicComponent && (
                                    <Tooltip
                                      title={t(
                                        'salary.setSalaryModal.breakdown.tooltipBasicComponent',
                                      )}
                                    >
                                      <InfoCircleOutlined className="text-xs text-sky-500" />
                                    </Tooltip>
                                  )}
                                  {!component.includedInCtc && (
                                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">
                                      {t('salary.setSalaryModal.breakdown.tagAboveCTC')}
                                    </span>
                                  )}
                                  {hasOverride && (
                                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-violet-700 uppercase">
                                      {t('salary.setSalaryModal.breakdown.tagOverridden')}
                                    </span>
                                  )}
                                </div>
                                <p className="m-0 mt-1 text-xs text-slate-600">{calcDescription}</p>
                              </div>

                              <div className="flex items-start gap-1">
                                <div className="min-w-[110px] text-right">
                                  <p className="m-0 text-sm font-semibold text-heading">
                                    {currencyFmt.full(component.calculatedAmount)}
                                  </p>
                                </div>

                                {!isBalancing && (
                                  <div className="flex items-center gap-1">
                                    <Popover
                                      trigger="click"
                                      open={editingComponentId === component.componentId}
                                      onOpenChange={(nextOpen) => {
                                        if (!nextOpen) {
                                          closeOverrideEditor();
                                        }
                                      }}
                                      placement="leftTop"
                                      styles={{
                                        root: { paddingBottom: 4 },
                                        container: {
                                          padding: 0,
                                          borderRadius: 20,
                                          overflow: 'hidden',
                                          border: '1px solid var(--cr-primary-border)',
                                          boxShadow: '0 22px 50px rgba(15, 23, 42, 0.18)',
                                        },
                                      }}
                                      content={
                                        <div className="w-[320px] overflow-hidden rounded-[20px] bg-white">
                                          <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-white px-4 py-3">
                                            <p className="m-0 text-[10px] font-semibold tracking-[0.16em] text-sky-700 uppercase">
                                              {t(
                                                'salary.setSalaryModal.breakdown.overridePopoverLabel',
                                              )}
                                            </p>
                                            <p className="m-0 mt-1 text-base font-semibold text-heading">
                                              {t(
                                                'salary.setSalaryModal.breakdown.overridePopoverTitle',
                                                { name: component.name },
                                              )}
                                            </p>
                                            <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-sky-100">
                                              <span className="text-slate-600">
                                                {t(
                                                  'salary.setSalaryModal.breakdown.overrideCurrentLabel',
                                                )}
                                              </span>
                                              <span className="text-heading">
                                                {currencyFmt.full(component.calculatedAmount)}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="px-4 py-4">
                                            <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.16em] text-slate-600 uppercase">
                                              {t(
                                                'salary.setSalaryModal.breakdown.overrideAmountLabel',
                                              )}
                                            </label>
                                            <InputNumber
                                              className="w-full"
                                              style={{ width: '100%' }}
                                              size="large"
                                              min={0}
                                              precision={2}
                                              prefix={currencyFmt.symbol}
                                              value={overrideDraftValue}
                                              onChange={(value) =>
                                                setOverrideDraftValue(value as number | null)
                                              }
                                            />
                                            <p className="m-0 mt-2 text-[11px] text-slate-600">
                                              {t('salary.setSalaryModal.breakdown.overrideHint')}
                                            </p>
                                          </div>

                                          <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
                                            <Button size="small" onClick={closeOverrideEditor}>
                                              {t(
                                                'salary.setSalaryModal.breakdown.overrideCancelButton',
                                              )}
                                            </Button>
                                            <Button
                                              type="primary"
                                              size="small"
                                              onClick={applyOverrideEditor}
                                              disabled={
                                                overrideDraftValue === null ||
                                                !Number.isFinite(Number(overrideDraftValue)) ||
                                                Number(overrideDraftValue) < 0
                                              }
                                            >
                                              {t(
                                                'salary.setSalaryModal.breakdown.overrideApplyButton',
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      }
                                    >
                                      <Tooltip
                                        title={t('salary.setSalaryModal.breakdown.tooltipOverride')}
                                      >
                                        <Button
                                          type="text"
                                          shape="circle"
                                          size="small"
                                          className={`${
                                            editingComponentId === component.componentId
                                              ? '!bg-sky-100 !text-sky-700 hover:!bg-sky-200'
                                              : '!text-slate-600 hover:!bg-slate-100 hover:!text-sky-600'
                                          }`}
                                          icon={<EditOutlined />}
                                          onClick={() =>
                                            openOverrideEditor(
                                              component.componentId,
                                              override?.value ?? component.calculatedAmount,
                                            )
                                          }
                                        />
                                      </Tooltip>
                                    </Popover>

                                    {hasOverride && (
                                      <Tooltip
                                        title={t(
                                          'salary.setSalaryModal.breakdown.tooltipResetOverride',
                                        )}
                                      >
                                        <Button
                                          type="text"
                                          shape="circle"
                                          size="small"
                                          className="!text-violet-700 hover:!bg-violet-50 hover:!text-violet-700"
                                          icon={<CloseCircleOutlined />}
                                          onClick={() =>
                                            removeComponentOverride(component.componentId)
                                          }
                                        />
                                      </Tooltip>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {aboveCtcTotal > 0 && (
                        <div className="flex items-center justify-between border-t border-amber-100 bg-amber-50 px-4 py-2.5 text-sm">
                          <span className="font-medium text-amber-700">
                            {t('salary.setSalaryModal.breakdown.aboveCtcTotal')}
                          </span>
                          <span className="font-semibold text-amber-800">
                            {currencyFmt.full(aboveCtcTotal)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Form.Item
              name="baseSalary"
              label={
                isCTCMode
                  ? t('salary.setSalaryModal.basePay.labelCTCMode', { symbol: currencyFmt.symbol })
                  : t('salary.setSalaryModal.basePay.labelDirect', { symbol: currencyFmt.symbol })
              }
              rules={[{ required: true, message: t('salary.setSalaryModal.basePay.required') }]}
              extra={isCTCMode ? t('salary.setSalaryModal.basePay.extraCTCMode') : undefined}
            >
              <InputNumber
                className="w-full"
                style={{ minWidth: 280 }}
                min={0}
                prefix={currencyFmt.symbol}
                size="large"
                placeholder={t('salary.setSalaryModal.basePay.placeholder')}
                disabled={isCTCMode}
              />
            </Form.Item>
          </>
        ) : showHourlySalary ? (
          <>
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
              <div className="flex items-start gap-2.5">
                <InfoCircleOutlined className="mt-0.5 text-sm text-slate-600" />
                <div>
                  <p className="m-0 text-[13px] font-semibold text-heading">
                    {t('salary.setSalaryModal.hourlyPay.infoTitle')}
                  </p>
                  <p className="m-0 mt-1 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                    {t('salary.setSalaryModal.hourlyPay.infoBody')}
                  </p>
                </div>
              </div>
            </div>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="hourlyRate"
                  label={t('salary.setSalaryModal.hourlyPay.rateLabel', {
                    symbol: currencyFmt.symbol,
                  })}
                  rules={[
                    { required: true, message: t('salary.setSalaryModal.hourlyPay.rateRequired') },
                  ]}
                >
                  <InputNumber
                    className="w-full"
                    style={{ minWidth: 180 }}
                    min={0}
                    prefix={currencyFmt.symbol}
                    size="large"
                    placeholder={t('salary.setSalaryModal.hourlyPay.ratePlaceholder')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="dailyHours"
                  label={t('salary.setSalaryModal.hourlyPay.hoursPerDayLabel')}
                >
                  <InputNumber
                    className="w-full"
                    style={{ minWidth: 140 }}
                    min={1}
                    max={24}
                    placeholder={t('salary.setSalaryModal.hourlyPay.hoursPlaceholder')}
                  />
                </Form.Item>
              </Col>
            </Row>
            <p className="mb-3 text-sm text-gray-700 dark:text-faint">
              <CalendarOutlined className="mr-1.5" />
              {dayBasisLabel}
            </p>
          </>
        ) : null}

        {salaryMode === 'hourly' && (
          <>
            <div className="my-4 border-t border-gray-200 dark:border-gray-700"></div>

            <Form.Item shouldUpdate>
              {() => {
                const calculatedSalary = hourlyRate * dailyHours * basisDays;
                const displaySalary =
                  finalMonthlyOverride > 0 ? finalMonthlyOverride : calculatedSalary;

                return (
                  <div className="mb-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 p-4 text-white">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-semibold tracking-wider uppercase opacity-80">
                        {finalMonthlyOverride > 0
                          ? t('salary.setSalaryModal.hourlyPay.finalMonthlyPayOverride')
                          : t('salary.setSalaryModal.hourlyPay.estimatedMonthlyPay')}
                      </span>
                      <RupeeOutlined className="text-xl opacity-60" />
                    </div>
                    <div className="mb-1 font-display text-3xl font-bold">
                      {currencyFmt.inline(displaySalary)}
                    </div>
                    {finalMonthlyOverride <= 0 && (
                      <div className="text-sm opacity-80">
                        {`${currencyFmt.full(hourlyRate)}/hr x ${dailyHours} hrs x ${basisDays} days`}
                      </div>
                    )}
                    {finalMonthlyOverride > 0 && (
                      <div className="mt-1 text-xs opacity-70">
                        {t('salary.setSalaryModal.hourlyPay.overrideOriginal', {
                          amount: currencyFmt.inline(calculatedSalary),
                        })}
                      </div>
                    )}
                  </div>
                );
              }}
            </Form.Item>

            <Form.Item
              name="finalMonthlyOverride"
              label={t('salary.setSalaryModal.hourlyPay.overrideMonthlyLabel', {
                symbol: currencyFmt.symbol,
              })}
              extra={t('salary.setSalaryModal.hourlyPay.overrideMonthlyExtra')}
            >
              <InputNumber
                className="w-full"
                style={{ minWidth: 280 }}
                min={0}
                prefix={currencyFmt.symbol}
                placeholder={t('salary.setSalaryModal.hourlyPay.overrideMonthlyPlaceholder')}
              />
            </Form.Item>
          </>
        )}

        <div className="my-4 border-t border-gray-200 dark:border-gray-700"></div>

        {bankSensitiveHidden && (
          <p className="mb-4 text-sm text-neutral-400">{t('salary.sensitiveHidden')}</p>
        )}

        {showBankDetails && !bankSensitiveHidden && (
          <div className="mb-4">
            <SegmentedToggle
              sectionLabel={t('salary.setSalaryModal.payment.sectionLabel')}
              options={[
                {
                  value: 'UPI',
                  label: t('salary.setSalaryModal.payment.upi'),
                  icon: <MobileOutlined />,
                },
                {
                  value: 'BANK',
                  label: t('salary.setSalaryModal.payment.bankTransfer'),
                  icon: <BankOutlined />,
                },
              ]}
              value={paymentMethod}
              onChange={(val) => {
                setPaymentMethod(val as 'UPI' | 'BANK');
                form.setFieldsValue({
                  preferredMethod: val as 'UPI' | 'BANK',
                });
              }}
            />
          </div>
        )}

        {showBankDetails && !bankSensitiveHidden && paymentMethod === 'UPI' && (
          <>
            <Form.Item name="upiId" label={t('salary.setSalaryModal.payment.upiIdLabel')}>
              <Input placeholder={t('salary.setSalaryModal.payment.upiIdPlaceholder')} />
            </Form.Item>
            {showProofAttachments && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-faint">
                  {t('salary.setSalaryModal.payment.upiQrLabel')}
                </label>
                <FileUpload
                  category="proofs"
                  value={qrCodeImage || undefined}
                  onChange={(file) => setQrCodeImage(file as string | File | null)}
                  accept="image/jpeg,image/png,image/webp"
                />
              </div>
            )}
          </>
        )}

        {!bankSensitiveHidden && paymentMethod === 'BANK' && (
          <>
            <Form.Item name="bankName" label={t('salary.setSalaryModal.payment.bankNameLabel')}>
              <Input placeholder={t('salary.setSalaryModal.payment.bankNamePlaceholder')} />
            </Form.Item>
            <div className="mb-3">
              <Checkbox
                checked={sameAsEmployeeName}
                onChange={(e) => setSameAsEmployeeName(e.target.checked)}
              >
                <span className="text-sm">
                  {t('salary.setSalaryModal.payment.sameAsEmployeeName')}
                </span>
              </Checkbox>
            </div>
            <Form.Item
              name="accountHolderName"
              label={t('salary.setSalaryModal.payment.accountHolderLabel')}
            >
              <Input
                placeholder={t('salary.setSalaryModal.payment.accountHolderPlaceholder')}
                disabled={sameAsEmployeeName}
              />
            </Form.Item>
            <Form.Item
              name="accountNumber"
              label={t('salary.setSalaryModal.payment.accountNumberLabel')}
            >
              <Input placeholder={t('salary.setSalaryModal.payment.accountNumberPlaceholder')} />
            </Form.Item>
            <Form.Item
              name="confirmAccountNumber"
              label={t('salary.setSalaryModal.payment.confirmAccountLabel')}
              dependencies={['accountNumber']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('accountNumber') === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(
                      new Error(t('salary.setSalaryModal.payment.accountMismatch')),
                    );
                  },
                }),
              ]}
            >
              <Input placeholder={t('salary.setSalaryModal.payment.confirmAccountPlaceholder')} />
            </Form.Item>
            <Form.Item name="ifscCode" label={t('salary.setSalaryModal.payment.ifscLabel')}>
              <Input
                placeholder={t('salary.setSalaryModal.payment.ifscPlaceholder')}
                className="uppercase"
                onChange={(e) => (e.target.value = e.target.value.toUpperCase())}
              />
            </Form.Item>
            {showProofAttachments && (
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-faint">
                  {t('salary.setSalaryModal.payment.passbookLabel')}
                </label>
                <FileUpload
                  category="proofs"
                  value={passbookImage || undefined}
                  onChange={(file) => setPassbookImage(file as string | File | null)}
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                />
              </div>
            )}
          </>
        )}

        {!bankSensitiveHidden && (paymentMethod === 'UPI' || paymentMethod === 'BANK') && (
          <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Form.Item
              name="preferredPayoutMethod"
              label={t('salary.setSalaryModal.payment.preferredPayoutLabel')}
              extra={t('salary.setSalaryModal.payment.preferredPayoutExtra')}
              initialValue={paymentMethod}
            >
              <Select placeholder={t('salary.setSalaryModal.payment.preferredPayoutPlaceholder')}>
                <Option value="BANK">{t('salary.setSalaryModal.payment.bankTransfer')}</Option>
                <Option value="UPI">{t('salary.setSalaryModal.payment.upi')}</Option>
              </Select>
            </Form.Item>
          </div>
        )}
      </Form>
    </DsModal>
  );
}
