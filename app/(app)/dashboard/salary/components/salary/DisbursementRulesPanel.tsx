'use client';

/**
 * DisbursementRulesPanel - Owner-only settings panel for Phase 26 disbursement + loss rules.
 *
 * What it does: Renders three save-able sections:
 *   1. Disbursement Rules (D-01) - two grouped sub-sections: "Salary payout" (salaryDate,
 *      payoutWindowDays) and "Salary advances" (advanceRequestPolicy window, advancePayoutDay,
 *      and optional eligibility caps). Grouping keeps regular-salary timing visually separate
 *      from advance settings, which otherwise read as one cramped block.
 *   2. Salary-Loss Config (D-03) - regularizationWindowDays + salaryLossEnabled toggle
 *   3. Attendance-Calc Rules (D-03) - holidayCountsAsPresent, weekOffCountsAsPresent, lateMarkAsHalfDay
 *
 * Cross-module links:
 *   - Reads initial values from usePayrollConfigStore (config.disbursementRules / config.salaryLossConfig / config.rules)
 *   - Writes via salary.api.ts: updateDisbursementRules / updateSalaryLossConfig / updateAttendanceRules
 *   - Backend endpoints: PATCH workspaces/:wsId/salary/disbursement-rules|salary-loss-config|attendance-rules
 *   - After save, calls fetchConfig to refresh the store.
 *
 * Watch: owner-only - controls are disabled + Save buttons hidden when isOwner=false.
 * AntD v6 conventions enforced: InputNumber suffix= (not addonAfter=), Alert title= (not message=),
 * no destroyOnClose, no Collapse.Panel children form. Day-of-month inputs carry NO wordy suffix
 * (a long suffix truncates inside the narrow input); the helper line below each conveys the unit.
 */

import React, { useEffect, useState } from 'react';
import { Alert, Button, Card, InputNumber, Switch, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { usePayrollConfigStore } from '@/features/salary/store/usePayrollConfigStore';
import {
  updateDisbursementRules,
  updateSalaryLossConfig,
  updateAttendanceRules,
} from '@/lib/api/modules/salary.api';
import { parseApiError } from '@/lib/utils';
// Owner advance-window picker (any_day / fixed_day / window range).
// Replaces the legacy single advanceRequestDay input. Links: AdvanceWindowControl.tsx,
// advance-request-window.util.ts (BE), AdvanceRequestDrawer.tsx (worker view).
import { AdvanceWindowControl, AdvanceWindowPolicy } from './AdvanceWindowControl';

interface DisbursementRulesPanelProps {
  /** Current workspace ID - used for all three PATCH endpoints. */
  workspaceId: string;
  /** Whether the current user is the workspace owner. Non-owners see controls disabled + no Save. */
  isOwner: boolean;
}

/** Default values mirror backend payroll-config.schema.ts sub-doc defaults. */
const DISBURSE_DEFAULTS = {
  salaryDate: 1,
  payoutWindowDays: 5,
  advanceRequestDay: 15,
  advancePayoutDay: null as number | null,
  // Phase 3b: advance eligibility caps. All null = OFF by default (clearing the
  // input sends null, which the BE persists + treats as off). These spread into
  // the save payload via { ...disburse }. Mirror BE disbursementRules cap fields.
  advanceMaxPercentOfNet: null as number | null,
  advanceMaxPerYear: null as number | null,
  advanceMinTenureMonths: null as number | null,
};
const ADVANCE_POLICY_DEFAULT: AdvanceWindowPolicy = { mode: 'fixed_day', fixedDay: 15 };

// Salary-payout settings (salaryDate / payoutWindowDays) HIDDEN per owner decision
// 2026-06-22. They only drove the salary disbursement gate (month-complete + payout
// window), now disabled in the backend (salary.service.ts recordPayment) so factories
// can pay salary same-month (25th to month-end) and the owner/manager can record a
// payment any time. Flip to true (and uncomment the BE gate) to re-introduce both.
// Typed boolean (not literal false) so the &&/ternary below are not flagged as dead.
const SHOW_SALARY_PAYOUT_SETTINGS: boolean = false;
const LOSS_DEFAULTS = { regularizationWindowDays: 45, salaryLossEnabled: true };
const ATTENDANCE_DEFAULTS = {
  holidayCountsAsPresent: true,
  weekOffCountsAsPresent: true,
  lateMarkAsHalfDay: false,
};

/** Shared label + helper-line styles so every field in the card reads consistently. */
const FIELD_LABEL = 'mb-1 block text-sm font-medium text-gray-700';
const FIELD_HINT = 'mt-1 text-xs leading-relaxed text-subtle';
const GROUP_TITLE = 'mb-1 text-sm font-semibold text-gray-800';
const GROUP_HINT = 'mb-4 text-xs leading-relaxed text-subtle';

export function DisbursementRulesPanel({ workspaceId, isOwner }: DisbursementRulesPanelProps) {
  const t = useTranslations('salarySettings');
  const [msgApi, contextHolder] = message.useMessage();

  const { config, fetchConfig } = usePayrollConfigStore();

  // --- Section 1: Disbursement Rules (D-01) ---
  // advancePayoutDay (1-28 | null): optional day of month on which approved advances are disbursed.
  // Null = no fixed payout day. Added Plan 2026-06-22 Task 6. Mirrors BE advancePayoutDay field.
  const [disburse, setDisburse] = useState(DISBURSE_DEFAULTS);
  const [isSavingDisburse, setIsSavingDisburse] = useState(false);
  // Structured advance-request window policy (replaces single advanceRequestDay in the UI).
  // Seeded from config.disbursementRules.advanceRequestPolicy; falls back to fixed_day legacy.
  const [policy, setPolicy] = useState<AdvanceWindowPolicy>(ADVANCE_POLICY_DEFAULT);

  // --- Section 2: Salary-Loss Config (D-03) ---
  const [loss, setLoss] = useState(LOSS_DEFAULTS);
  const [isSavingLoss, setIsSavingLoss] = useState(false);

  // --- Section 3: Attendance-Calc Rules (D-03, lives in config.rules) ---
  const [attendance, setAttendance] = useState(ATTENDANCE_DEFAULTS);
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  // Prefill from store whenever config changes
  useEffect(() => {
    if (!config) return;
    if (config.disbursementRules) {
      setDisburse({
        salaryDate: config.disbursementRules.salaryDate ?? DISBURSE_DEFAULTS.salaryDate,
        payoutWindowDays:
          config.disbursementRules.payoutWindowDays ?? DISBURSE_DEFAULTS.payoutWindowDays,
        advanceRequestDay:
          config.disbursementRules.advanceRequestDay ?? DISBURSE_DEFAULTS.advanceRequestDay,
        // Seed advancePayoutDay from saved config (nullable).
        advancePayoutDay: config.disbursementRules.advancePayoutDay ?? null,
        // Seed Phase 3b caps from saved config (nullable; null = off).
        advanceMaxPercentOfNet: config.disbursementRules.advanceMaxPercentOfNet ?? null,
        advanceMaxPerYear: config.disbursementRules.advanceMaxPerYear ?? null,
        advanceMinTenureMonths: config.disbursementRules.advanceMinTenureMonths ?? null,
      });
      // Seed policy from saved advanceRequestPolicy; fall back to legacy fixed_day.
      setPolicy(
        config.disbursementRules.advanceRequestPolicy ?? {
          mode: 'fixed_day',
          fixedDay:
            config.disbursementRules.advanceRequestDay ?? DISBURSE_DEFAULTS.advanceRequestDay,
        },
      );
    }
    if (config.salaryLossConfig) {
      setLoss({
        regularizationWindowDays:
          config.salaryLossConfig.regularizationWindowDays ??
          LOSS_DEFAULTS.regularizationWindowDays,
        salaryLossEnabled:
          config.salaryLossConfig.salaryLossEnabled ?? LOSS_DEFAULTS.salaryLossEnabled,
      });
    }
    if (config.rules) {
      setAttendance({
        holidayCountsAsPresent:
          config.rules.holidayCountsAsPresent ?? ATTENDANCE_DEFAULTS.holidayCountsAsPresent,
        weekOffCountsAsPresent:
          config.rules.weekOffCountsAsPresent ?? ATTENDANCE_DEFAULTS.weekOffCountsAsPresent,
        lateMarkAsHalfDay: config.rules.lateMarkAsHalfDay ?? ATTENDANCE_DEFAULTS.lateMarkAsHalfDay,
      });
    }
  }, [config]);

  // Helper to parse backend error messages for display
  const getErrorMessage = (error: unknown, fallback: string) => {
    const parsed = parseApiError(error);
    return parsed || fallback;
  };

  // --- Handlers ---

  const handleSaveDisburse = async () => {
    if (!workspaceId || !isOwner) return;
    setIsSavingDisburse(true);
    try {
      // Include advanceRequestPolicy alongside the legacy scalar fields.
      // The BE keeps advanceRequestDay in sync when mode=fixed_day.
      await updateDisbursementRules(workspaceId, { ...disburse, advanceRequestPolicy: policy });
      await fetchConfig(workspaceId);
      msgApi.success(t('disbursement.saveSuccess', { defaultValue: 'Disbursement rules saved.' }));
    } catch (error) {
      msgApi.error(
        getErrorMessage(error, t('disbursement.saveError', { defaultValue: 'Failed to save.' })),
      );
    } finally {
      setIsSavingDisburse(false);
    }
  };

  const handleSaveLoss = async () => {
    if (!workspaceId || !isOwner) return;
    setIsSavingLoss(true);
    try {
      await updateSalaryLossConfig(workspaceId, loss);
      await fetchConfig(workspaceId);
      msgApi.success(t('salaryLoss.saveSuccess', { defaultValue: 'Salary-loss config saved.' }));
    } catch (error) {
      msgApi.error(
        getErrorMessage(error, t('salaryLoss.saveError', { defaultValue: 'Failed to save.' })),
      );
    } finally {
      setIsSavingLoss(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!workspaceId || !isOwner) return;
    setIsSavingAttendance(true);
    try {
      await updateAttendanceRules(workspaceId, attendance);
      await fetchConfig(workspaceId);
      msgApi.success(t('attendanceRules.saveSuccess', { defaultValue: 'Attendance rules saved.' }));
    } catch (error) {
      msgApi.error(
        getErrorMessage(error, t('attendanceRules.saveError', { defaultValue: 'Failed to save.' })),
      );
    } finally {
      setIsSavingAttendance(false);
    }
  };

  return (
    // flex+gap (not space-y-*) so the 24px gap between the three cards is reliable:
    // space-y-6's sibling margin was resolving to 0 between these AntD cards here.
    <div className="flex flex-col gap-6">
      {contextHolder}

      {/* Non-owner read-only notice */}
      {!isOwner && (
        <Alert
          type="warning"
          showIcon
          icon={<LockOutlined />}
          title={t('ownerOnlyWarning', {
            defaultValue: 'Only the workspace owner can change these settings.',
          })}
        />
      )}

      {/* Section 1: Disbursement Rules (D-01) */}
      <Card
        variant="outlined"
        title={t('disbursement.cardTitle', { defaultValue: 'Disbursement Rules' })}
        className="border-slate-200 shadow-sm"
      >
        {/* --- Group A: regular salary payout timing. HIDDEN per owner 2026-06-22 (the
            salary disbursement gate it configured is disabled in the BE); flip
            SHOW_SALARY_PAYOUT_SETTINGS to re-show. --- */}
        {SHOW_SALARY_PAYOUT_SETTINGS && (
          <>
            <p className={GROUP_TITLE}>
              {t('disbursement.salaryPayoutGroup', { defaultValue: 'Salary payout' })}
            </p>
            <p className={GROUP_HINT}>
              {t('disbursement.helperText', {
                defaultValue:
                  "When monthly salary can be recorded as paid (e.g. January's pay between 1 and 6 February). Applies to staff you delegate salary to; owners can record a payment any time.",
              })}
            </p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* salaryDate - no inline suffix (a long suffix truncates inside the input). */}
              <div>
                <label className={FIELD_LABEL}>
                  {t('disbursement.salaryDateLabel', { defaultValue: 'Salary Date' })}
                </label>
                <InputNumber
                  className="w-full"
                  min={1}
                  max={28}
                  value={disburse.salaryDate}
                  onChange={(value) =>
                    setDisburse((prev) => ({
                      ...prev,
                      salaryDate: value ?? DISBURSE_DEFAULTS.salaryDate,
                    }))
                  }
                  disabled={!isOwner}
                  aria-label={t('disbursement.salaryDateLabel', { defaultValue: 'Salary Date' })}
                />
                <p className={FIELD_HINT}>
                  {t('disbursement.salaryDateHint', {
                    defaultValue: 'Day of the following month on which salary can be paid (1-28).',
                  })}
                </p>
              </div>

              {/* payoutWindowDays - short "days" suffix fits comfortably. */}
              <div>
                <label className={FIELD_LABEL}>
                  {t('disbursement.payoutWindowLabel', { defaultValue: 'Payout Window' })}
                </label>
                <InputNumber
                  className="w-full"
                  min={0}
                  max={28}
                  value={disburse.payoutWindowDays}
                  suffix={t('disbursement.daysSuffix', { defaultValue: 'days' })}
                  onChange={(value) =>
                    setDisburse((prev) => ({
                      ...prev,
                      payoutWindowDays: value ?? DISBURSE_DEFAULTS.payoutWindowDays,
                    }))
                  }
                  disabled={!isOwner}
                  aria-label={t('disbursement.payoutWindowLabel', {
                    defaultValue: 'Payout Window',
                  })}
                />
                <p className={FIELD_HINT}>
                  {t('disbursement.payoutWindowHint', {
                    defaultValue:
                      'Number of days after salary date during which payment is allowed.',
                  })}
                </p>
              </div>
            </div>
          </>
        )}

        {/* --- Group B: salary advances (request window, payout day, eligibility) ---
            Separated with a divider + its own heading so advance settings do not read
            as one cramped block mixed with regular salary payout. */}
        <div className={SHOW_SALARY_PAYOUT_SETTINGS ? 'mt-6 border-t border-slate-100 pt-5' : ''}>
          <p className={GROUP_TITLE}>
            {t('disbursement.advancesGroup', { defaultValue: 'Salary advances' })}
          </p>
          <p className={GROUP_HINT}>
            {t('disbursement.advancesGroupHint', {
              defaultValue:
                'When employees may request an advance, when it is paid out, and optional limits.',
            })}
          </p>

          {/* advanceRequestPolicy: structured window control (replaces legacy scalar advanceRequestDay). */}
          <div className="mb-5">
            <label className={FIELD_LABEL}>
              {t('disbursement.advanceRequestWindowLabel', {
                defaultValue: 'Advance Request Window',
              })}
            </label>
            <AdvanceWindowControl value={policy} disabled={!isOwner} onChange={setPolicy} />
            <p className={FIELD_HINT}>
              {t('disbursement.advanceRequestWindowHint', {
                defaultValue:
                  'Choose when employees may submit advance salary requests each month.',
              })}
            </p>
          </div>

          {/* advancePayoutDay: optional fixed day approved advances are disbursed. Constrained to a
              third so a single day-of-month field does not stretch the full card width. No long suffix. */}
          <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className={FIELD_LABEL}>
                {t('disbursement.advancePayoutDayLabel', { defaultValue: 'Advance Payout Day' })}
              </label>
              <InputNumber
                className="w-full"
                min={1}
                max={28}
                value={disburse.advancePayoutDay}
                onChange={(value) =>
                  setDisburse((prev) => ({ ...prev, advancePayoutDay: value ?? null }))
                }
                disabled={!isOwner}
                placeholder={t('disbursement.advancePayoutDayPlaceholder', {
                  defaultValue: 'e.g. 25',
                })}
                aria-label={t('disbursement.advancePayoutDayLabel', {
                  defaultValue: 'Advance Payout Day',
                })}
              />
              <p className={FIELD_HINT}>
                {t('disbursement.advancePayoutDayHint', {
                  defaultValue:
                    'Day of month approved advances are disbursed (1-28). Leave blank for no fixed day.',
                })}
              </p>
            </div>
          </div>

          {/* Phase 3b: advance ELIGIBILITY CAPS (owner-configurable, OFF by default).
              Guardrails enforced when a worker submits a request (advance-salary-request.service.ts
              createRequest). Each empty/blank = off; clearing sends null. */}
          <div>
            <label className={FIELD_LABEL}>
              {t('disbursement.eligibilityCapsLabel', {
                defaultValue: 'Advance Eligibility Limits (optional)',
              })}
            </label>
            <p className={GROUP_HINT}>
              {t('disbursement.eligibilityCapsHint', {
                defaultValue:
                  'Optional guardrails checked when an employee requests an advance. Leave a field blank to turn that limit off.',
              })}
            </p>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* advanceMaxPercentOfNet (1-100): single request cap as % of monthly salary. */}
              <div>
                <label className={FIELD_LABEL}>
                  {t('disbursement.maxPercentOfNetLabel', {
                    defaultValue: 'Max % of Monthly Salary',
                  })}
                </label>
                <InputNumber
                  className="w-full"
                  min={1}
                  max={100}
                  value={disburse.advanceMaxPercentOfNet}
                  suffix={t('disbursement.percentSuffix', { defaultValue: '%' })}
                  onChange={(value) =>
                    setDisburse((prev) => ({ ...prev, advanceMaxPercentOfNet: value ?? null }))
                  }
                  disabled={!isOwner}
                  placeholder={t('disbursement.maxPercentOfNetPlaceholder', {
                    defaultValue: 'No limit',
                  })}
                  aria-label={t('disbursement.maxPercentOfNetLabel', {
                    defaultValue: 'Max % of Monthly Salary',
                  })}
                />
                <p className={FIELD_HINT}>
                  {t('disbursement.maxPercentOfNetHint', {
                    defaultValue:
                      'A single advance cannot exceed this percent of the employee monthly salary.',
                  })}
                </p>
              </div>

              {/* advanceMaxPerYear (>=1): max requests per calendar year. Label conveys "per year"
                  so no inline suffix is needed. */}
              <div>
                <label className={FIELD_LABEL}>
                  {t('disbursement.maxPerYearLabel', { defaultValue: 'Max Requests per Year' })}
                </label>
                <InputNumber
                  className="w-full"
                  min={1}
                  value={disburse.advanceMaxPerYear}
                  onChange={(value) =>
                    setDisburse((prev) => ({ ...prev, advanceMaxPerYear: value ?? null }))
                  }
                  disabled={!isOwner}
                  placeholder={t('disbursement.maxPerYearPlaceholder', {
                    defaultValue: 'No limit',
                  })}
                  aria-label={t('disbursement.maxPerYearLabel', {
                    defaultValue: 'Max Requests per Year',
                  })}
                />
                <p className={FIELD_HINT}>
                  {t('disbursement.maxPerYearHint', {
                    defaultValue:
                      'Most advance requests an employee may submit in a calendar year.',
                  })}
                </p>
              </div>

              {/* advanceMinTenureMonths (>=0): minimum tenure from join date. */}
              <div>
                <label className={FIELD_LABEL}>
                  {t('disbursement.minTenureLabel', { defaultValue: 'Minimum Tenure' })}
                </label>
                <InputNumber
                  className="w-full"
                  min={0}
                  value={disburse.advanceMinTenureMonths}
                  suffix={t('disbursement.monthsSuffix', { defaultValue: 'months' })}
                  onChange={(value) =>
                    setDisburse((prev) => ({ ...prev, advanceMinTenureMonths: value ?? null }))
                  }
                  disabled={!isOwner}
                  placeholder={t('disbursement.minTenurePlaceholder', { defaultValue: 'No limit' })}
                  aria-label={t('disbursement.minTenureLabel', { defaultValue: 'Minimum Tenure' })}
                />
                <p className={FIELD_HINT}>
                  {t('disbursement.minTenureHint', {
                    defaultValue:
                      'Months an employee must have worked (from their join date) before they can request.',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="mt-6 flex justify-end">
            <Button type="primary" onClick={handleSaveDisburse} loading={isSavingDisburse}>
              {t('disbursement.saveButton', { defaultValue: 'Save Disbursement Rules' })}
            </Button>
          </div>
        )}
      </Card>

      {/* Section 2: Salary-Loss Config (D-03) */}
      <Card
        variant="outlined"
        title={t('salaryLoss.cardTitle', { defaultValue: 'Salary-Loss Configuration' })}
        className="border-slate-200 shadow-sm"
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* regularizationWindowDays */}
          <div>
            <label className={FIELD_LABEL}>
              {t('salaryLoss.regularizationWindowLabel', {
                defaultValue: 'Regularization Window',
              })}
            </label>
            <InputNumber
              className="w-full"
              min={1}
              max={90}
              value={loss.regularizationWindowDays}
              suffix={t('disbursement.daysSuffix', { defaultValue: 'days' })}
              onChange={(value) =>
                setLoss((prev) => ({
                  ...prev,
                  regularizationWindowDays: value ?? LOSS_DEFAULTS.regularizationWindowDays,
                }))
              }
              disabled={!isOwner}
              aria-label={t('salaryLoss.regularizationWindowLabel', {
                defaultValue: 'Regularization Window',
              })}
            />
            <p className={FIELD_HINT}>
              {t('salaryLoss.regularizationWindowHint', {
                defaultValue:
                  'Days after month-end during which attendance can be regularized before salary-loss is posted (default 45).',
              })}
            </p>
          </div>

          {/* salaryLossEnabled */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="m-0 text-sm font-medium text-gray-700">
                {t('salaryLoss.enabledLabel', { defaultValue: 'Post Salary-Loss Entries' })}
              </p>
              <p className="m-0 mt-1 text-xs text-subtle">
                {t('salaryLoss.enabledHint', {
                  defaultValue:
                    'When enabled, unpaid-leave days post a debit entry to the salary COA ledger after the regularization window closes.',
                })}
              </p>
            </div>
            <Switch
              checked={loss.salaryLossEnabled}
              onChange={(checked) => setLoss((prev) => ({ ...prev, salaryLossEnabled: checked }))}
              disabled={!isOwner}
            />
          </div>
        </div>

        {isOwner && (
          <div className="mt-4 flex justify-end">
            <Button type="primary" onClick={handleSaveLoss} loading={isSavingLoss}>
              {t('salaryLoss.saveButton', { defaultValue: 'Save Salary-Loss Config' })}
            </Button>
          </div>
        )}
      </Card>

      {/* Section 3: Attendance-Calc Rules (D-03, config.rules) */}
      <Card
        variant="outlined"
        title={t('attendanceRules.cardTitle', { defaultValue: 'Attendance Calculation Rules' })}
        className="border-slate-200 shadow-sm"
      >
        <div className="space-y-4">
          {/* holidayCountsAsPresent */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="m-0 text-sm font-medium text-gray-700">
                {t('attendanceRules.holidayLabel', {
                  defaultValue: 'Holiday counts as Present',
                })}
              </p>
              <p className="m-0 mt-1 text-xs text-subtle">
                {t('attendanceRules.holidayHint', {
                  defaultValue:
                    'When enabled, declared holidays are counted as present days for salary calculation.',
                })}
              </p>
            </div>
            <Switch
              checked={attendance.holidayCountsAsPresent}
              onChange={(checked) =>
                setAttendance((prev) => ({ ...prev, holidayCountsAsPresent: checked }))
              }
              disabled={!isOwner}
            />
          </div>

          {/* weekOffCountsAsPresent */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="m-0 text-sm font-medium text-gray-700">
                {t('attendanceRules.weekOffLabel', {
                  defaultValue: 'Week-off counts as Present',
                })}
              </p>
              <p className="m-0 mt-1 text-xs text-subtle">
                {t('attendanceRules.weekOffHint', {
                  defaultValue:
                    'When enabled, weekly off days are counted as present days for salary calculation.',
                })}
              </p>
            </div>
            <Switch
              checked={attendance.weekOffCountsAsPresent}
              onChange={(checked) =>
                setAttendance((prev) => ({ ...prev, weekOffCountsAsPresent: checked }))
              }
              disabled={!isOwner}
            />
          </div>

          {/* lateMarkAsHalfDay */}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
            <div>
              <p className="m-0 text-sm font-medium text-gray-700">
                {t('attendanceRules.lateMarkLabel', {
                  defaultValue: 'Late mark counts as Half-day',
                })}
              </p>
              <p className="m-0 mt-1 text-xs text-subtle">
                {t('attendanceRules.lateMarkHint', {
                  defaultValue:
                    'When enabled, an employee marked as late deducts 0.5 days from their monthly salary calculation.',
                })}
              </p>
            </div>
            <Switch
              checked={attendance.lateMarkAsHalfDay}
              onChange={(checked) =>
                setAttendance((prev) => ({ ...prev, lateMarkAsHalfDay: checked }))
              }
              disabled={!isOwner}
            />
          </div>
        </div>

        {isOwner && (
          <div className="mt-4 flex justify-end">
            <Button type="primary" onClick={handleSaveAttendance} loading={isSavingAttendance}>
              {t('attendanceRules.saveButton', { defaultValue: 'Save Attendance Rules' })}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
