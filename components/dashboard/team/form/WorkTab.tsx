'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  TimePicker,
  Button,
  Collapse,
  Row,
  Col,
  Radio,
  Switch,
  Tag,
  Tooltip,
  Alert,
  type FormInstance,
} from 'antd';
import {
  PlusOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  LockOutlined,
  ToolOutlined,
  InfoCircleOutlined,
  RightOutlined,
  PieChartOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { LockedOverlay } from '@/components/subscription/LockedOverlay';
import type { TeamMember, Shift, Role, EmployeeComponentOverride, Location } from '@/types';
import { useComponentTemplateStore } from '@/features/salary/store/useComponentTemplateStore';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import { formatIndianAmountInput, parseAmountInput } from '@/lib/format/indian-amount';
import SegmentedToggle from '@/components/ui/SegmentedToggle';
import { calculateComponents } from '@/features/salary/utils/component-calculator';
import { DAYS_OF_WEEK } from '@/lib/utils';
import WeeklyOffPicker from './WeeklyOffPicker';
import {
  // Used by commented-out Karigar block - keep for re-enable.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  KARIGAR_SKILL_OPTIONS,
  INDIAN_STATE_AND_UT_OPTIONS,
  maskPanNumber,
} from './memberFormDefaults';
import { useMemberFormOptions } from './useMemberFormOptions';

const { Option } = Select;

// AssignedMachinesRow removed (2026-07-04) — Machines module deleted; the
// component always rendered null anyway (no data source).

interface WorkTabProps {
  form: FormInstance;
  mode: 'view' | 'add' | 'edit';
  editMode: boolean;
  member: TeamMember | null;
  workspaceId: string;
  roles: Role[];
  localShifts: Shift[];
  localDesignations: string[];
  /** Workspace Locations master list (shared with Machines). Drives the
   *  work-location radio. Defaults to [] so existing callers are unaffected. */
  locations?: Location[];
  allMembers?: TeamMember[];
  onOpenCreateShift: () => void;
  onOpenCreateDesignation: () => void;
  componentOverrides: EmployeeComponentOverride[];
  setComponentOverrides: React.Dispatch<React.SetStateAction<EmployeeComponentOverride[]>>;
  editingOverride: string | null;
  setEditingOverride: React.Dispatch<React.SetStateAction<string | null>>;
  /** Read-side view gates that mirror the BE read-filter
   *  (`crewroster-backend/src/modules/team/team-read-filter.ts`). Default true
   *  so the Add-member wizard and other callers are unaffected; the member-
   *  detail view passes the caller's per-group `*.view` result so a viewer
   *  without pay/statutory view never sees those (server-stripped) fields. */
  canViewPay?: boolean;
  canViewStatutory?: boolean;
}

export default function WorkTab({
  form,
  mode,
  editMode,
  member,
  workspaceId,
  roles,
  localShifts,
  localDesignations,
  locations = [],
  allMembers = [],
  onOpenCreateShift,
  onOpenCreateDesignation,
  componentOverrides,
  setComponentOverrides,
  editingOverride,
  setEditingOverride,
  canViewPay = true,
  canViewStatutory = true,
}: WorkTabProps) {
  const t = useTranslations('team');
  const { employmentTypeOptions, maritalStatusOptions } = useMemberFormOptions();
  const router = useRouter();
  const { templates, fetchTemplates, isLoading: templatesLoading } = useComponentTemplateStore();

  const salaryType = Form.useWatch('salaryType', form);
  const salaryAmount = Form.useWatch('salaryAmount', form);
  const dailyHours = Form.useWatch('dailyHours', form);
  const finalMonthlyOverride = Form.useWatch('finalMonthlyOverride', form);
  const pfApplicable = Form.useWatch('pfApplicable', form);
  const esiApplicable = Form.useWatch('esiApplicable', form);
  const isNonItrFiler = Form.useWatch('isNonItrFiler', form);
  const ctcAmountWatch = Form.useWatch('ctcAmount', form) as number | undefined;
  const componentTemplateIdWatch = Form.useWatch('componentTemplateId', form) as string | undefined;
  // Used by commented-out Karigar block - keep for re-enable.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const isKarigarWatch = Form.useWatch('isKarigar', form) as boolean | undefined;
  const salaryDayBasis = Form.useWatch('salaryDayBasis', form) as
    | 'fixed_month_days'
    | 'calendar_month_days'
    | undefined;
  const fixedMonthDaysWatch = Form.useWatch('fixedMonthDays', form) as number | undefined;

  // When a work location is picked from the master list, mirror its NAME into
  // the `location` field. That keeps the ID card + legacy displays working
  // without a server-side lookup, while `locationId` stays the canonical link.
  const locationIdWatch = Form.useWatch('locationId', form) as string | undefined;
  useEffect(() => {
    if (!locationIdWatch) return;
    const loc = locations.find((l) => (l._id ?? l.id) === locationIdWatch);
    if (loc) form.setFieldValue('location', loc.name);
  }, [locationIdWatch, locations, form]);

  const payrollConfig = usePayrollConfigStore((s) => s.config);
  const fetchPayrollConfig = usePayrollConfigStore((s) => s.fetchConfig);
  const workspaceDefaultWorkingDays = Math.max(
    1,
    Math.min(31, Number(payrollConfig?.display?.defaultWorkingDays ?? 26) || 26),
  );
  const attendanceFeatureEnabled = payrollConfig?.features?.attendanceBasedPay !== false;
  const workspaceAttendanceDefault =
    payrollConfig?.rules?.attendancePayModeDefault === 'disabled' ? 'disabled' : 'enabled';

  useEffect(() => {
    if (workspaceId && !payrollConfig) {
      void fetchPayrollConfig(workspaceId);
    }
  }, [workspaceId, payrollConfig, fetchPayrollConfig]);

  useEffect(() => {
    if (payrollConfig && (fixedMonthDaysWatch === undefined || fixedMonthDaysWatch === null)) {
      // Owner decision 2026-05-22: default Fixed Month Days to the workspace
      // payroll config when set, otherwise 30 (standard month-days salary
      // denominator) rather than the working-days fallback (26).
      const configured = payrollConfig?.display?.defaultWorkingDays;
      const def = Math.max(1, Math.min(31, Number(configured ?? 30) || 30));
      form.setFieldValue('fixedMonthDays', def);
    }
  }, [payrollConfig, fixedMonthDaysWatch, form]);

  const previewBasisDays = (() => {
    if (salaryDayBasis === 'calendar_month_days') {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    }
    return (
      Number(fixedMonthDaysWatch ?? workspaceDefaultWorkingDays) || workspaceDefaultWorkingDays
    );
  })();
  const estimatedMonthlySalary =
    salaryType === 'monthly'
      ? salaryAmount || 0
      : (salaryAmount || 0) * (dailyHours || 0) * previewBasisDays;
  const finalSalary = finalMonthlyOverride || estimatedMonthlySalary;

  const selectedTemplate = templates.find((tpl) => tpl._id === componentTemplateIdWatch);
  const ctcBreakdown = useMemo(() => {
    if (!selectedTemplate || !ctcAmountWatch) return null;
    try {
      return calculateComponents(
        ctcAmountWatch,
        selectedTemplate.components as Parameters<typeof calculateComponents>[1],
        componentOverrides,
      );
    } catch {
      return null;
    }
  }, [ctcAmountWatch, selectedTemplate, componentOverrides]);

  const shift = member ? localShifts.find((s) => s._id === member.shift?.id) : undefined;

  const rolesAccess = useFeatureAccess('roles');
  const ctcAccess = useFeatureAccess('salary', 'salary_components');
  const statutoryAccess = useFeatureAccess('salary', 'statutory_compliance');
  const tdsAccess = useFeatureAccess('salary', 'statutory_tds');

  return (
    <>
      {/* Employment Details Section */}
      <div className="mb-5 border-b border-gray-100 pb-2.5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
          {t('workEmploymentTitle')}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
          {t('workEmploymentHelper')}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Work location — single-select radio from the workspace Locations
            master list. Stores locationId; the picked location's name is
            mirrored into `location` (see effect above) for the ID card. Owner
            manages the list at /dashboard/workspace/locations (Workspace
            Settings — restored standalone 2026-07-04, no longer under Machines). */}
        {locations.length === 0 ? (
          // Gate: an employee's work location can only be picked from the workspace
          // Locations master list. When none exist, prompt the owner to create one
          // first instead of allowing a free-text value.
          <div>
            <span className="mb-1.5 block text-sm font-medium text-gray-600">Work location</span>
            <Alert
              showIcon
              type="warning"
              title="No locations configured yet"
              description={
                <span>
                  Add at least one work location before assigning employees.{' '}
                  <Link
                    href="/dashboard/workspace/locations"
                    style={{ textDecoration: 'underline' }}
                  >
                    Go to Locations
                  </Link>
                  .
                </span>
              }
            />
          </div>
        ) : (
          <Form.Item
            name="locationId"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                Work location
                {mode === 'add' && <span className="ml-1 text-gray-400"> *</span>}
              </span>
            }
            rules={
              mode === 'add' ? [{ required: true, message: 'Select a work location' }] : undefined
            }
          >
            <Radio.Group className="flex flex-col gap-2">
              {locations
                .filter((l) => l.isActive !== false)
                .map((loc) => (
                  <Radio key={loc._id ?? loc.id} value={loc._id ?? loc.id}>
                    {loc.name}
                  </Radio>
                ))}
            </Radio.Group>
          </Form.Item>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="designation"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelDesignation')}
                {mode === 'add' && <span className="ml-1 text-gray-400">*</span>}
              </span>
            }
            rules={
              mode === 'add'
                ? [{ required: true, message: t('workRequiredDesignation') }]
                : undefined
            }
          >
            <Select
              placeholder={t('workPlaceholderDesignation')}
              allowClear
              showSearch
              className="rounded-lg"
              popupRender={(menu) => (
                <>
                  {menu}
                  {editMode && (
                    <div style={{ padding: '8px', borderTop: '1px solid var(--cr-border-light)' }}>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<PlusOutlined />}
                        block
                        onClick={onOpenCreateDesignation}
                      >
                        {t('workCreateNewDesignation')}
                      </Button>
                    </div>
                  )}
                </>
              )}
            >
              {localDesignations.map((d) => (
                <Option key={d} value={d}>
                  {d}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="dateOfJoining"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelJoiningDate')}
                {mode === 'add' && <span className="ml-1 text-gray-400">*</span>}
              </span>
            }
            rules={
              mode === 'add' ? [{ required: true, message: t('workRequiredJoining') }] : undefined
            }
          >
            <DatePicker
              className="w-full rounded-lg"
              format="YYYY-MM-DD"
              placeholder={t('workPlaceholderJoiningDate')}
            />
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="employmentType"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelEmploymentType')}
              </span>
            }
            className="mb-0"
          >
            <Select placeholder={t('workPlaceholderEmploymentType')} className="rounded-lg">
              {employmentTypeOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="rbacRoleId"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelPermissionRole')}
              </span>
            }
            className="mb-0"
          >
            {rolesAccess.isLocked ? (
              <Tooltip title={t('workLockedRoleTooltip')}>
                <Select
                  placeholder={t('workPlaceholderLockedRole')}
                  disabled
                  className="rounded-lg"
                  suffixIcon={<LockOutlined className="text-faint" />}
                />
              </Tooltip>
            ) : (
              <Select
                placeholder={t('workPlaceholderRole')}
                allowClear
                className="rounded-lg"
                popupRender={(menu) => (
                  <>
                    {menu}
                    <div style={{ padding: '8px', borderTop: '1px solid var(--cr-border-light)' }}>
                      <Button
                        type="dashed"
                        size="small"
                        icon={<SettingOutlined />}
                        block
                        onClick={() => router.push('/dashboard/roles')}
                      >
                        {t('workManageRoles')}
                      </Button>
                    </div>
                  </>
                )}
              >
                {roles.map((r) => (
                  <Option key={r._id} value={r._id}>
                    {r.name}
                  </Option>
                ))}
                {/* F5 - fallback option so view mode resolves the role NAME
                    even when the viewer lacks `roles.view` (the `roles` list
                    is then empty). The member doc carries the populated
                    `rbacRole`; without this the Select shows the raw id. */}
                {member?.rbacRole?.id && !roles.some((r) => r._id === member.rbacRole?.id) && (
                  <Option key={member.rbacRole.id} value={member.rbacRole.id}>
                    {member.rbacRole.name}
                  </Option>
                )}
              </Select>
            )}
          </Form.Item>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Form.Item
            name="reportsTo"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelReportsTo')}
              </span>
            }
            className="mb-0"
            style={{ gridColumn: '1 / -1', maxInlineSize: '480px' }}
            tooltip={t('workTooltipReportsTo')}
          >
            <Select
              placeholder={t('workPlaceholderReportsTo')}
              allowClear
              showSearch
              optionFilterProp="label"
              className="rounded-lg"
              options={(() => {
                const opts = allMembers
                  .filter((m) => m.id !== member?.id)
                  .map((m) => ({ label: m.name, value: m.id }));
                // F5 - fallback so view mode never shows the raw reports-to
                // ObjectId when the viewer cannot see that member (e.g. a
                // self-scoped member on their own profile). Resolves to the
                // real name whenever the member IS in the visible team.
                const rt = member?.reportsTo;
                if (rt && !opts.some((o) => o.value === rt)) {
                  opts.push({ label: '-', value: rt });
                }
                return opts;
              })()}
            />
          </Form.Item>
        </div>
      </div>

      {/* Compensation & Schedule Section */}
      <div className="mt-4 mb-5 border-b border-gray-100 pb-2.5">
        <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
          {t('workCompensationTitle')}
        </p>
        <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
          {t('workCompensationHelper')}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Form.Item
            name="scheduleType"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelScheduleType')}
              </span>
            }
            className="mb-0 md:w-[260px] md:shrink-0"
            rules={[{ required: true, message: t('workRequiredScheduleType') }]}
          >
            <SegmentedToggle
              disabled={mode === 'view'}
              value={undefined as unknown as string}
              onChange={() => undefined}
              options={[
                { value: 'shift', label: t('workOptionShiftBased') },
                { value: 'custom', label: t('workOptionCustom') },
              ]}
            />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.scheduleType !== cur.scheduleType}>
            {({ getFieldValue }) =>
              getFieldValue('scheduleType') === 'shift' ? (
                <Form.Item
                  name="shiftId"
                  label={
                    <span className="mb-1.5 block text-sm font-medium text-gray-600">
                      {t('workLabelShift')}
                    </span>
                  }
                  className="mb-0"
                  style={{ flex: '1 1 0', minWidth: 0, maxWidth: '28rem', width: '100%' }}
                >
                  {localShifts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 p-3 text-center">
                      <ClockCircleOutlined style={{ fontSize: 20, color: 'var(--cr-text-5)' }} />
                      <p className="m-0 text-sm text-gray-700">{t('workShiftEmptyTitle')}</p>
                      <button
                        type="button"
                        disabled={!editMode}
                        onClick={onOpenCreateShift}
                        className="rounded-md px-3 py-1.5 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <PlusOutlined style={{ marginRight: 4 }} />
                        {t('workShiftEmptyCreate')}
                      </button>
                    </div>
                  ) : (
                    <Select
                      placeholder={t('workPlaceholderShift')}
                      allowClear
                      className="rounded-lg"
                      popupRender={(menu) => (
                        <>
                          {menu}
                          <div
                            style={{
                              padding: '8px',
                              borderTop: '1px solid var(--cr-border-light)',
                            }}
                          >
                            <Button
                              type="dashed"
                              size="small"
                              icon={<PlusOutlined />}
                              block
                              onClick={onOpenCreateShift}
                            >
                              {t('workCreateNewShift')}
                            </Button>
                          </div>
                        </>
                      )}
                    >
                      {(() => {
                        // Render only shifts that actually exist in the current
                        // workspace's listShifts. Dedupe by `id ?? _id` so optimistic
                        // adds (only `_id`) and listShifts rows (both `id` and `_id`)
                        // collide on the same key. Stale assignments to deleted /
                        // cross-workspace shifts are cleared from form.shiftId by a
                        // dedicated effect in the parent - no synthetic fallback row
                        // here so ghost shifts don't appear in the dropdown.
                        const shiftKey = (s: Shift): string => {
                          const raw =
                            (s as unknown as { id?: unknown }).id ??
                            (s as unknown as { _id?: unknown })._id;
                          return raw == null ? '' : String(raw);
                        };
                        const seen = new Set<string>();
                        const options: { id: string; name: string }[] = [];
                        for (const s of localShifts) {
                          const sid = shiftKey(s);
                          if (!sid || seen.has(sid)) continue;
                          seen.add(sid);
                          options.push({ id: sid, name: s.name });
                        }
                        return options.map((o) => (
                          <Option key={o.id} value={o.id}>
                            {o.name}
                          </Option>
                        ));
                      })()}
                    </Select>
                  )}
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </div>

        <Form.Item noStyle shouldUpdate={(prev, cur) => prev.scheduleType !== cur.scheduleType}>
          {({ getFieldValue }) =>
            getFieldValue('scheduleType') === 'custom' ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <Form.Item
                    name="customScheduleStart"
                    label={
                      <span className="mb-1.5 block text-sm font-medium text-gray-600">
                        {t('workLabelStartTime')}
                      </span>
                    }
                    rules={[{ required: true, message: t('workRequiredStartTime') }]}
                  >
                    <TimePicker
                      use12Hours
                      format="hh:mm A"
                      className="w-full rounded-lg"
                      placeholder={t('workPlaceholderStartTime')}
                    />
                  </Form.Item>

                  <Form.Item
                    name="customScheduleEnd"
                    label={
                      <span className="mb-1.5 block text-sm font-medium text-gray-600">
                        {t('workLabelEndTime')}
                      </span>
                    }
                    rules={[{ required: true, message: t('workRequiredEndTime') }]}
                  >
                    <TimePicker
                      use12Hours
                      format="hh:mm A"
                      className="w-full rounded-lg"
                      placeholder={t('workPlaceholderEndTime')}
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  name="weeklyOff"
                  label={
                    <span className="mb-1.5 block text-sm font-medium text-gray-600">
                      {t('workLabelWeeklyOff')}
                    </span>
                  }
                >
                  <WeeklyOffPicker disabled={!editMode} />
                </Form.Item>
              </>
            ) : null
          }
        </Form.Item>

        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Form.Item
            name="salaryType"
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {t('workLabelSalaryType')}
              </span>
            }
            rules={[{ required: true, message: t('workRequiredSalaryType') }]}
            className="mb-0 md:w-[260px] md:shrink-0"
          >
            <SegmentedToggle
              disabled={mode === 'view'}
              value={undefined as unknown as string}
              onChange={() => undefined}
              options={[
                { value: 'monthly', label: t('workOptionMonthly') },
                { value: 'hourly', label: t('workOptionHourly') },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="salaryAmount"
            hidden={!canViewPay}
            label={
              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                {salaryType === 'hourly' ? t('workLabelHourlyRate') : t('workLabelMonthlySalary')}
                {mode === 'add' && <span className="ml-1 text-gray-400">*</span>}
              </span>
            }
            rules={
              mode === 'add'
                ? [
                    {
                      validator: (_, value) => {
                        if (value === undefined || value === null || value === '') {
                          return Promise.reject(t('workRequiredSalary'));
                        }
                        if (Number(value) <= 0) {
                          return Promise.reject(t('workInvalidSalary'));
                        }
                        return Promise.resolve();
                      },
                    },
                  ]
                : undefined
            }
            className="mb-0"
            style={{ flex: '1 1 0', minWidth: 0, maxWidth: '28rem', width: '100%' }}
          >
            <InputNumber
              style={{ width: '100%' }}
              min={0}
              prefix="₹"
              className="rounded-lg tabular-nums"
              formatter={(value) => formatIndianAmountInput(value)}
              parser={parseAmountInput}
            />
          </Form.Item>

          {salaryType === 'hourly' && (
            <Form.Item
              name="dailyHours"
              label={
                <span className="mb-1.5 block text-sm font-medium text-gray-600">
                  {t('workLabelDailyHours')}
                </span>
              }
              className="mb-0 md:w-[160px] md:shrink-0"
            >
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={24}
                suffix="hrs"
                className="rounded-lg tabular-nums"
              />
            </Form.Item>
          )}
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
          <div className="border-b border-gray-200 px-4 py-2">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
              {t('workSalaryCalcTitle')}
            </p>
            <p className="m-0 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
              {t('workSalaryCalcHelper')}
            </p>
          </div>

          <div className="px-4 py-3">
            <Row gutter={[16, 0]}>
              <Col xs={24} md={attendanceFeatureEnabled ? 8 : 12}>
                <Form.Item
                  name="salaryDayBasis"
                  label={
                    <span className="mb-1 block text-sm font-medium text-gray-600">
                      {t('workLabelDayBasis')}
                    </span>
                  }
                  rules={[{ required: true, message: t('workRequiredDayBasis') }]}
                  style={{ marginBottom: 0 }}
                >
                  <Select className="rounded-lg">
                    <Option value="fixed_month_days">{t('workOptionFixedMonth')}</Option>
                    <Option value="calendar_month_days">{t('workOptionCalendar')}</Option>
                  </Select>
                </Form.Item>
              </Col>
              <Col xs={24} md={attendanceFeatureEnabled ? 8 : 12}>
                <Form.Item
                  name="fixedMonthDays"
                  label={
                    <span className="mb-1 block text-sm font-medium text-gray-600">
                      {t('workLabelFixedMonthDays')}
                    </span>
                  }
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
                        throw new Error(t('workInvalidFixedMonthDays'));
                      },
                    },
                  ]}
                  style={{ marginBottom: 0 }}
                >
                  <InputNumber
                    style={{ width: '100%' }}
                    min={1}
                    max={31}
                    disabled={!editMode || salaryDayBasis !== 'fixed_month_days'}
                    placeholder={t('workPlaceholderFixedDays')}
                    className="rounded-lg tabular-nums"
                  />
                </Form.Item>
              </Col>
              {attendanceFeatureEnabled && (
                <Col xs={24} md={8}>
                  <Form.Item
                    name="attendancePayMode"
                    label={
                      <span className="mb-1 block text-sm font-medium text-gray-600">
                        {t('workLabelAttendance')}
                      </span>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Select className="rounded-lg">
                      <Option value="default">
                        {workspaceAttendanceDefault === 'enabled'
                          ? t('workOptionAttendanceDefaultEnabled')
                          : t('workOptionAttendanceDefaultDisabled')}
                      </Option>
                      <Option value="enabled">{t('workOptionAttendanceEnabled')}</Option>
                      <Option value="disabled">{t('workOptionAttendanceDisabled')}</Option>
                    </Select>
                  </Form.Item>
                </Col>
              )}
            </Row>

            {!attendanceFeatureEnabled && (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-start gap-2">
                  <InfoCircleOutlined className="mt-0.5 text-xs text-slate-600" />
                  <p className="m-0 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                    {t('workAttendanceDisabledBanner')}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {salaryType === 'hourly' && (
          <>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div>
                <p className="mb-1 text-xs font-medium text-gray-700">
                  {t('workEstimatedSalaryEyebrow')}
                </p>
                <p className="m-0 text-sm text-gray-600">
                  ₹{salaryAmount || 0}/hr × {dailyHours || 0} hrs × {previewBasisDays} days
                  {salaryDayBasis === 'calendar_month_days'
                    ? t('workEstimatedCurrentMonthSuffix')
                    : ''}
                </p>
              </div>
              <p
                className="m-0 text-2xl font-semibold text-gray-900 tabular-nums"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
              >
                ₹{(estimatedMonthlySalary || 0).toLocaleString('en-IN')}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Form.Item
                name="finalMonthlyOverride"
                label={
                  <span className="mb-1.5 block text-sm font-medium text-gray-600">
                    {t('workLabelOverrideSalary')}
                  </span>
                }
                extra={<span className="text-xs text-gray-700">{t('workOverrideHelper')}</span>}
                style={{ gridColumn: '1 / -1', maxInlineSize: '480px' }}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  prefix="₹"
                  placeholder={t('workPlaceholderOverride')}
                  className="rounded-lg tabular-nums"
                />
              </Form.Item>
            </div>
          </>
        )}

        {salaryType === 'monthly' && (
          <>
            <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
                {t('workMonthlySalaryEyebrow')}
              </p>
              <p
                className="m-0 text-2xl font-semibold text-gray-900 tabular-nums"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.01em' }}
              >
                ₹{(finalSalary || 0).toLocaleString('en-IN')}
              </p>
            </div>

            <LockedOverlay
              module="salary"
              subFeature="salary_components"
              title={t('workCtcOverlayTitle')}
            >
              <Collapse
                ghost
                className="cr-card-collapse"
                expandIconPlacement="end"
                expandIcon={({ isActive }) => (
                  <RightOutlined
                    style={{
                      fontSize: 11,
                      color: 'var(--cr-text-3)',
                      transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                )}
                onChange={(keys) => {
                  const openKeys = Array.isArray(keys) ? keys : [keys];
                  if (openKeys.includes('ctc-breakdown')) {
                    void fetchTemplates(workspaceId);
                    if (!form.getFieldValue('ctcAmount')) {
                      form.setFieldValue('ctcAmount', (salaryAmount || 0) * 12);
                    }
                  } else {
                    setEditingOverride(null);
                  }
                }}
                items={[
                  {
                    key: 'ctc-breakdown',
                    label: (
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--cr-info-50,#eff6ff)] text-[var(--cr-info-700,#1d4ed8)]">
                          <PieChartOutlined style={{ fontSize: 13 }} />
                        </span>
                        <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
                          {t('workCtcTitle')}
                        </span>
                        {ctcAmountWatch ? (
                          <span className="text-xs font-normal text-gray-500 tabular-nums">
                            · ₹{ctcAmountWatch.toLocaleString('en-IN')}
                          </span>
                        ) : null}
                      </div>
                    ),
                    children: (
                      <div className="space-y-4 pt-2">
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="ctcAmount"
                              label={
                                <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                  {t('workLabelAnnualCtc')}
                                </span>
                              }
                              className="mb-0"
                            >
                              <InputNumber
                                style={{ width: '100%' }}
                                prefix="₹"
                                min={0}
                                step={1000}
                                className="rounded-lg tabular-nums"
                              />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="componentTemplateId"
                              label={
                                <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                  {t('workLabelComponentTemplate')}
                                </span>
                              }
                              className="mb-0"
                            >
                              <Select
                                allowClear
                                placeholder={
                                  templatesLoading
                                    ? t('workTemplatesLoading')
                                    : t('workPlaceholderComponentTemplate')
                                }
                                loading={templatesLoading}
                                className="rounded-lg"
                                onChange={(value) => {
                                  setComponentOverrides([]);
                                  if (
                                    value &&
                                    !Number(form.getFieldValue('ctcAmount')) &&
                                    Number(salaryAmount) > 0
                                  ) {
                                    form.setFieldValue('ctcAmount', Number(salaryAmount) * 12);
                                  }
                                }}
                                popupRender={(menu) => (
                                  <>
                                    {menu}
                                    <div
                                      style={{
                                        padding: '8px',
                                        borderTop: '1px solid var(--cr-border-light)',
                                      }}
                                    >
                                      <Button
                                        type="dashed"
                                        size="small"
                                        icon={<SettingOutlined />}
                                        block
                                        onClick={() => router.push('/dashboard/salary/settings')}
                                      >
                                        {t('workManageTemplates')}
                                      </Button>
                                    </div>
                                  </>
                                )}
                              >
                                {templates.map((tpl) => (
                                  <Option key={tpl._id} value={tpl._id}>
                                    {tpl.name}
                                    {tpl.isDefault ? t('workTemplateDefaultSuffix') : ''}
                                  </Option>
                                ))}
                              </Select>
                            </Form.Item>
                          </Col>
                        </Row>

                        {selectedTemplate && !(Number(ctcAmountWatch) > 0) && (
                          <div className="flex items-start justify-between gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5">
                            <div className="flex items-start gap-2">
                              <InfoCircleOutlined className="mt-0.5 text-xs text-gray-500" />
                              <p className="m-0 text-xs text-gray-600">
                                {t('workCtcHelpEnter')}{' '}
                                <span className="font-semibold">{selectedTemplate.name}</span>{' '}
                                {t('workCtcHelpSuffix')}
                              </p>
                            </div>
                            <Button
                              type="link"
                              size="small"
                              className="shrink-0 px-0"
                              onClick={() => router.push('/dashboard/salary/settings')}
                            >
                              {t('workCtcEditTemplate')}
                            </Button>
                          </div>
                        )}

                        {selectedTemplate && Number(ctcAmountWatch) > 0 && ctcBreakdown && (
                          <div className="overflow-x-auto">
                            <table
                              style={{
                                width: '100%',
                                minWidth: 440,
                                borderCollapse: 'collapse',
                                fontSize: 13,
                              }}
                            >
                              <thead>
                                <tr style={{ background: 'var(--cr-bg)' }}>
                                  {[
                                    t('workTableComponent'),
                                    t('workTableMode'),
                                    t('workTableValue'),
                                    t('workTableMonthly'),
                                  ].map((h, i) => (
                                    <th
                                      key={h}
                                      style={{
                                        padding: '6px 8px',
                                        textAlign: i >= 2 ? 'right' : 'left',
                                        fontWeight: 600,
                                        color: 'var(--cr-text-4)',
                                        border: '1px solid var(--cr-border)',
                                        fontSize: 12,
                                      }}
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {ctcBreakdown.breakdown.map((row) => {
                                  const tComp = selectedTemplate.components.find(
                                    (c) => c.id === row.componentId,
                                  );
                                  const ovr = componentOverrides.find(
                                    (o) => o.componentId === row.componentId,
                                  );
                                  const effMode = ovr?.calcMode ?? tComp?.calcMode;
                                  const effValue = ovr?.value ?? tComp?.value;
                                  const isBalancing = tComp?.calcMode === 'balancing';
                                  const isEditing = editingOverride === row.componentId;

                                  return (
                                    <tr
                                      key={row.componentId}
                                      style={{
                                        background: row.isBasicComponent
                                          ? 'var(--cr-info-50)'
                                          : 'white',
                                      }}
                                    >
                                      <td
                                        style={{
                                          padding: '6px 8px',
                                          border: '1px solid var(--cr-border)',
                                          color: 'var(--cr-text)',
                                          fontWeight: row.isBasicComponent ? 600 : 400,
                                        }}
                                      >
                                        {row.name}
                                      </td>
                                      <td
                                        style={{
                                          padding: '6px 8px',
                                          border: '1px solid var(--cr-border)',
                                        }}
                                      >
                                        {isEditing && !isBalancing ? (
                                          <Select
                                            size="small"
                                            value={effMode as string}
                                            style={{ width: 130 }}
                                            options={[
                                              {
                                                label: t('workCalcModePercentCtc'),
                                                value: 'percent_of_ctc',
                                              },
                                              { label: t('workCalcModeFixed'), value: 'fixed' },
                                            ]}
                                            onChange={(v: string) => {
                                              const calcMode = v as
                                                | 'fixed'
                                                | 'percent_of_ctc'
                                                | 'percent_of_component';
                                              setComponentOverrides((prev) => {
                                                const rest = prev.filter(
                                                  (o) => o.componentId !== row.componentId,
                                                );
                                                const existing = prev.find(
                                                  (o) => o.componentId === row.componentId,
                                                ) ?? { componentId: row.componentId };
                                                return [...rest, { ...existing, calcMode }];
                                              });
                                            }}
                                          />
                                        ) : (
                                          <span style={{ color: 'var(--cr-text-4)', fontSize: 12 }}>
                                            {effMode === 'percent_of_ctc'
                                              ? t('workCalcModePercentCtc')
                                              : effMode === 'percent_of_component'
                                                ? t('workCalcModePercentComp')
                                                : effMode === 'fixed'
                                                  ? t('workCalcModeFixed')
                                                  : t('workCalcModeBalancing')}
                                          </span>
                                        )}
                                      </td>
                                      <td
                                        style={{
                                          padding: '6px 8px',
                                          border: '1px solid var(--cr-border)',
                                          textAlign: 'right',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        {isEditing && !isBalancing ? (
                                          <InputNumber
                                            size="small"
                                            value={effValue}
                                            min={0}
                                            style={{ width: 80 }}
                                            autoFocus
                                            onBlur={() => setEditingOverride(null)}
                                            onChange={(v) => {
                                              if (v === null) return;
                                              setComponentOverrides((prev) => {
                                                const rest = prev.filter(
                                                  (o) => o.componentId !== row.componentId,
                                                );
                                                const existing = prev.find(
                                                  (o) => o.componentId === row.componentId,
                                                ) ?? { componentId: row.componentId };
                                                return [...rest, { ...existing, value: v }];
                                              });
                                            }}
                                          />
                                        ) : (
                                          <span
                                            style={{
                                              cursor: isBalancing ? 'default' : 'pointer',
                                              color: isBalancing
                                                ? 'var(--cr-text-4)'
                                                : 'var(--cr-info-700)',
                                              textDecoration: isBalancing ? 'none' : 'underline',
                                              textDecorationStyle: 'dotted',
                                              fontSize: 13,
                                            }}
                                            onClick={() => {
                                              if (!isBalancing) setEditingOverride(row.componentId);
                                            }}
                                          >
                                            {isBalancing
                                              ? '-'
                                              : effMode === 'percent_of_ctc'
                                                ? `${effValue ?? 0}%`
                                                : `₹${(effValue ?? 0).toLocaleString('en-IN')}`}
                                          </span>
                                        )}
                                      </td>
                                      <td
                                        style={{
                                          padding: '6px 8px',
                                          border: '1px solid var(--cr-border)',
                                          textAlign: 'right',
                                          fontWeight: 600,
                                          color: 'var(--cr-text)',
                                          fontVariantNumeric: 'tabular-nums',
                                        }}
                                      >
                                        ₹
                                        {(row.calculatedAmount / 12).toLocaleString('en-IN', {
                                          maximumFractionDigits: 0,
                                        })}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                              <tfoot>
                                <tr style={{ background: 'var(--cr-neutral-100)' }}>
                                  <td
                                    colSpan={3}
                                    style={{
                                      padding: '6px 8px',
                                      border: '1px solid var(--cr-border)',
                                      fontWeight: 600,
                                      color: 'var(--cr-text-3)',
                                    }}
                                  >
                                    {t('workTotalMonthly')}
                                  </td>
                                  <td
                                    style={{
                                      padding: '6px 8px',
                                      border: '1px solid var(--cr-border)',
                                      textAlign: 'right',
                                      fontWeight: 700,
                                      color: 'var(--cr-text)',
                                      fontVariantNumeric: 'tabular-nums',
                                    }}
                                  >
                                    ₹
                                    {(
                                      ctcBreakdown.breakdown
                                        .filter((r) => r.includedInCtc)
                                        .reduce((s, r) => s + r.calculatedAmount, 0) / 12
                                    ).toLocaleString('en-IN', {
                                      maximumFractionDigits: 0,
                                    })}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                            {componentOverrides.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setComponentOverrides([])}
                                className="mt-1.5 text-xs text-faint transition-colors hover:text-gray-600"
                              >
                                {t('workResetOverrides')}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                  },
                ]}
              />
            </LockedOverlay>
          </>
        )}

        {canViewStatutory && (
          <LockedOverlay
            module="salary"
            subFeature="statutory_compliance"
            title={t('workStatutoryOverlayTitle')}
          >
            <Collapse
              ghost
              className="cr-card-collapse"
              expandIconPlacement="end"
              expandIcon={({ isActive }) => (
                <RightOutlined
                  style={{
                    fontSize: 11,
                    color: 'var(--cr-text-3)',
                    transform: isActive ? 'rotate(90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                  }}
                />
              )}
              items={[
                {
                  key: 'statutory-tax',
                  label: (
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--cr-info-50,#eff6ff)] text-[var(--cr-info-700,#1d4ed8)]">
                        <SafetyCertificateOutlined style={{ fontSize: 13 }} />
                      </span>
                      <span className="text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
                        {t('workStatutoryTitle')}
                      </span>
                    </div>
                  ),
                  children: (
                    <div className="pt-2">
                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            label={
                              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                {t('workLabelPan')}
                              </span>
                            }
                            extra={
                              <span className="text-xs text-[var(--cr-text-4)]">
                                {t('workPanExtra')}
                              </span>
                            }
                            className="mb-4"
                          >
                            {editMode ? (
                              <Form.Item
                                name="pan"
                                noStyle
                                normalize={(value) =>
                                  typeof value === 'string' ? value.toUpperCase() : value
                                }
                              >
                                <Input
                                  placeholder={t('workPanPlaceholder')}
                                  maxLength={10}
                                  className="h-10 rounded-lg"
                                />
                              </Form.Item>
                            ) : (
                              <Input
                                value={maskPanNumber(
                                  form.getFieldValue('pan') as string | undefined,
                                )}
                                readOnly
                                disabled
                                placeholder={t('workPanNotProvided')}
                                className="h-10 rounded-lg"
                              />
                            )}
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="uan"
                            label={
                              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                {t('workLabelUan')}
                              </span>
                            }
                            extra={
                              <span className="text-xs text-[var(--cr-text-4)]">
                                {t('workUanExtra')}
                              </span>
                            }
                            className="mb-4"
                          >
                            <Input
                              placeholder={t('workUanPlaceholder')}
                              maxLength={12}
                              className="h-10 rounded-lg tabular-nums"
                            />
                          </Form.Item>
                        </Col>
                      </Row>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <Form.Item
                          name="maritalStatus"
                          label={
                            <span className="mb-1.5 block text-sm font-medium text-gray-600">
                              {t('personalLabelMaritalStatus')}
                            </span>
                          }
                          className="mb-4"
                          style={{ gridColumn: '1 / -1', maxInlineSize: '480px' }}
                        >
                          <Select
                            allowClear
                            placeholder={t('personalPlaceholderMarital')}
                            className="rounded-lg"
                          >
                            {maritalStatusOptions.map((option) => (
                              <Option key={option.value} value={option.value}>
                                {option.label}
                              </Option>
                            ))}
                          </Select>
                        </Form.Item>
                      </div>

                      <Row gutter={16}>
                        <Col xs={24} md={12}>
                          <Form.Item
                            name="taxRegime"
                            label={
                              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                {t('workLabelTaxRegime')}
                              </span>
                            }
                            extra={
                              <span className="text-xs text-gray-700">
                                {t('workTaxRegimeHelp')}
                              </span>
                            }
                            className="mb-4"
                          >
                            <SegmentedToggle
                              disabled={mode === 'view'}
                              value={undefined as unknown as string}
                              onChange={() => undefined}
                              options={[
                                { value: 'new', label: t('workOptionNewRegime') },
                                { value: 'old', label: t('workOptionOldRegime') },
                              ]}
                            />
                          </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                          <Form.Item
                            name="stateOfEmployment"
                            label={
                              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                {t('workLabelStateEmployment')}
                              </span>
                            }
                            className="mb-4"
                          >
                            <Select
                              allowClear
                              showSearch
                              optionFilterProp="children"
                              placeholder={t('workPlaceholderStateEmployment')}
                              className="rounded-lg"
                            >
                              {INDIAN_STATE_AND_UT_OPTIONS.map((state) => (
                                <Option key={state} value={state}>
                                  {state}
                                </Option>
                              ))}
                            </Select>
                          </Form.Item>
                        </Col>
                      </Row>

                      <div className="mb-4 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-gray-600">
                            {t('workLabelPfApplicable')}
                          </span>
                          <Form.Item name="pfApplicable" valuePropName="checked" noStyle>
                            <Switch />
                          </Form.Item>
                        </div>
                        <p className="m-0 text-xs text-gray-500">{t('workPfHelp')}</p>
                        {pfApplicable && Number(salaryAmount ?? 0) > 15000 && (
                          <div className="mt-2 flex items-center justify-between gap-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                            <span className="text-sm font-medium text-gray-600">
                              {t('workLabelPfOptedOut')}
                            </span>
                            <Form.Item name="pfOptedOut" valuePropName="checked" noStyle>
                              <Switch />
                            </Form.Item>
                          </div>
                        )}
                      </div>

                      <div className="mb-4 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-sm font-medium text-gray-600">
                            {t('workLabelEsiApplicable')}
                          </span>
                          <Form.Item name="esiApplicable" valuePropName="checked" noStyle>
                            <Switch />
                          </Form.Item>
                        </div>
                        <p className="m-0 text-xs text-gray-500">{t('workEsiHelp')}</p>
                        {esiApplicable && (
                          <Form.Item
                            name="esiIpNumber"
                            label={
                              <span className="mb-1.5 block text-sm font-medium text-gray-600">
                                {t('workLabelEsiIpNumber')}
                              </span>
                            }
                            className="mt-2 mb-0"
                          >
                            <Input
                              placeholder={t('workPlaceholderEsi')}
                              className="h-10 rounded-lg tabular-nums"
                            />
                          </Form.Item>
                        )}
                      </div>

                      <LockedOverlay
                        module="salary"
                        subFeature="statutory_tds"
                        title={t('workTaxTdsOverlayTitle')}
                      >
                        <div className="mb-4 flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-medium text-gray-600">
                              {t('workLabelNonItr')}
                            </span>
                            <Form.Item name="isNonItrFiler" valuePropName="checked" noStyle>
                              <Switch />
                            </Form.Item>
                          </div>
                          {isNonItrFiler && (
                            <div className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                              <span className="font-semibold">{t('workNonItrWarningPrefix')}</span>{' '}
                              {t('workNonItrWarningBody')}
                            </div>
                          )}
                        </div>
                      </LockedOverlay>

                      {/* Per-worker minimum wage override - same canViewStatutory gate
                          as pan/uan above. HR/Owner only (BE enforces statutory field group). */}
                      <div className="mb-4">
                        <Form.Item
                          name="minimumWageMonthlyOverride"
                          label={
                            <span className="mb-1.5 block text-sm font-medium text-gray-600">
                              {t('workLabelMinWageOverride')}
                            </span>
                          }
                          extra={
                            <span className="text-xs text-[var(--cr-text-4)]">
                              {t('workMinWageOverrideExtra')}
                            </span>
                          }
                          className="mb-0"
                        >
                          <InputNumber
                            style={{ width: '100%' }}
                            min={0}
                            prefix="&#8377;"
                            placeholder={t('workMinWageOverridePlaceholder')}
                            className="h-10 rounded-lg tabular-nums"
                          />
                        </Form.Item>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </LockedOverlay>
        )}
      </div>

      {/*
        TEMPORARILY DISABLED - Karigar capture removed from Add Member wizard
        pending Job-Work module integration maturity + customer demand
        validation. Re-enable by uncommenting this entire block AND deleting the
        two `eslint-disable-next-line @typescript-eslint/no-unused-vars` comments
        attached to `KARIGAR_SKILL_OPTIONS` (import) and `isKarigarWatch`
        (declaration) above.

        Data-wiring (DTO validators, payload builder, defaults seed, hydration,
        STEP_FIELDS entries) is intentionally left intact in the supporting
        files so re-enable is a single-file uncomment. See plan:
        C:\Users\jayes\.claude\plans\image-1-this-is-iterative-blum.md

        // Karigar Profile Section
        <div className="mt-12 mb-5 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-1.5">
            <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-[var(--cr-text-2,#374151)] uppercase">
              Karigar Profile
            </p>
            <Tooltip
              placement="bottomLeft"
              styles={{ root: { maxWidth: 360 } }}
              trigger={['hover', 'click', 'focus']}
              title={
                <div className="space-y-2 text-xs leading-relaxed">
                  <div>
                    <p className="m-0 font-semibold">What is a karigar?</p>
                    <p className="m-0">
                      A piece-work / job-work textile worker (zari, embroidery, print). Distinct
                      from salaried staff.
                    </p>
                  </div>
                  <div>
                    <p className="m-0 font-semibold">What this section does:</p>
                    <p className="m-0">• Marks who appears in the Job-Work challan picker.</p>
                    <p className="m-0">
                      • Captures a daily wage RATE - snapshotted onto each challan at post time
                      for batch cost reports.
                    </p>
                  </div>
                  <div>
                    <p className="m-0 font-semibold">What this section does NOT do:</p>
                    <p className="m-0">
                      • Does not replace or affect monthly salary (use Salary section for actual
                      payroll).
                    </p>
                    <p className="m-0">
                      • Does not impact GST, TDS, or accounting ledger entries.
                    </p>
                    <p className="m-0">
                      • Does not pay the karigar - it is a cost-attribution number only.
                    </p>
                  </div>
                  <div>
                    <p className="m-0 font-semibold">When to use:</p>
                    <p className="m-0">
                      Only if you run a textile job-work shop and want batch-level cost reports.
                    </p>
                  </div>
                </div>
              }
            >
              <InfoCircleOutlined
                className="cursor-help text-xs text-[var(--cr-text-4)]"
                aria-label="What does Karigar Profile mean?"
              />
            </Tooltip>
          </div>
          <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
            Optional. For Job-Work / piece-work workers only - see info tooltip above.
          </p>
        </div>

        <div className="mb-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex items-start justify-between gap-4 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ToolOutlined style={{ fontSize: 14, color: 'var(--cr-text-3)' }} />
                <p className="m-0 text-sm font-semibold text-gray-900">Mark as Karigar</p>
                <span
                  className="inline-flex items-center rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-amber-700 uppercase ring-1 ring-inset ring-amber-200"
                  aria-label="Affects Job-Work module only"
                >
                  Job-Work only
                </span>
              </div>
              <p className="m-0 mt-0.5 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                Skill + daily wage for Job-Work challans.
              </p>
            </div>
            <Form.Item name="isKarigar" valuePropName="checked" noStyle>
              <Switch disabled={!editMode} aria-label="Mark this member as karigar" />
            </Form.Item>
          </div>

          {isKarigarWatch && (
            <div className="animate-fade-down px-4 py-3">
              <Row gutter={[16, 0]}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="karigarSkillType"
                    label={
                      <span className="mb-1 block text-sm font-medium text-gray-600">
                        Skill Type
                      </span>
                    }
                    style={{ marginBottom: 0 }}
                  >
                    <Select
                      allowClear
                      placeholder="Select skill type"
                      disabled={!editMode}
                      className="rounded-lg"
                    >
                      {KARIGAR_SKILL_OPTIONS.map((option) => (
                        <Option key={option.value} value={option.value}>
                          {option.label}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="karigarDailyRateRupees"
                    label={
                      <span className="mb-1 block text-sm font-medium text-gray-600">
                        Daily Wage Rate (₹)
                      </span>
                    }
                    rules={[
                      {
                        validator: async (_, value) => {
                          if (value === undefined || value === null || value === '') return;
                          const numericValue = Number(value);
                          if (Number.isFinite(numericValue) && numericValue >= 0) return;
                          throw new Error('Enter a non-negative amount');
                        },
                      },
                    ]}
                    style={{ marginBottom: 0 }}
                  >
                    <InputNumber
                      style={{ width: '100%' }}
                      min={0}
                      step={1}
                      prefix="₹"
                      placeholder="e.g. 500"
                      disabled={!editMode}
                      className="rounded-lg tabular-nums"
                    />
                  </Form.Item>
                </Col>
              </Row>

              <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
                <InfoCircleOutlined className="mt-0.5 text-xs text-gray-500" />
                <p className="m-0 text-xs text-[var(--cr-muted,var(--cr-text-4))]">
                  Not part of monthly salary. Daily wage snapshots onto each Job-Work challan at
                  post time; past challans unchanged.
                </p>
              </div>
            </div>
          )}
        </div>
      */}

      {/* Shift summary card (view mode) */}
      {shift && !editMode && (
        <div
          className="mt-4 rounded-xl p-3.5"
          style={{
            background: `${shift.color}14`,
            border: `1px solid ${shift.color}30`,
          }}
        >
          <p className="mb-1.5 text-xs font-bold" style={{ color: shift.color }}>
            {shift.name}
          </p>
          <p className="text-text-secondary mb-1.5 text-[13px]">
            {shift.startTime} → {shift.endTime} · {t('workShiftSummaryGracePrefix')}{' '}
            {shift.gracePeriodMinutes}
            {t('workShiftSummaryGraceSuffix')}
          </p>
          <div className="flex gap-1">
            {DAYS_OF_WEEK.map((d, i) => (
              <span
                key={i}
                className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold"
                style={{
                  background: shift.workingDays?.includes(i)
                    ? shift.color
                    : 'var(--cr-border-light)',
                  color: shift.workingDays?.includes(i) ? 'var(--cr-surface)' : 'var(--cr-text-4)',
                }}
              >
                {d[0]}
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
