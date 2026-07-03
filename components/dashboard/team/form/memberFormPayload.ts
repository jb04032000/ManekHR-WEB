import dayjs, { type Dayjs } from 'dayjs';
import type {
  CreateTeamMemberPayload,
  UpdateTeamMemberPayload,
  EmployeeComponentOverride,
} from '@/types';
import { DEFAULT_STATUTORY_FORM_VALUES } from './memberFormDefaults';

export interface BuildMemberPayloadInput {
  vals: Record<string, unknown>;
  mode: 'view' | 'add' | 'edit';
  avatarUrl?: string;
  passbookImageUrl?: string;
  qrCodeUrl?: string;
  componentOverrides: EmployeeComponentOverride[];
}

/**
 * Build the team member payload from raw form values.
 * Used by both add and update flows - the caller decides which action to invoke.
 * File uploads are performed by the caller; pre-uploaded URLs are passed in.
 */
export function buildMemberPayload(
  input: BuildMemberPayloadInput,
): CreateTeamMemberPayload | UpdateTeamMemberPayload {
  const { vals, avatarUrl, passbookImageUrl, qrCodeUrl, componentOverrides } = input;

  const customScheduleStart = dayjs.isDayjs(vals.customScheduleStart)
    ? (vals.customScheduleStart as Dayjs).format('HH:mm')
    : (vals.customScheduleStart as string | undefined);
  const customScheduleEnd = dayjs.isDayjs(vals.customScheduleEnd)
    ? (vals.customScheduleEnd as Dayjs).format('HH:mm')
    : (vals.customScheduleEnd as string | undefined);
  const panValue = typeof vals.pan === 'string' ? vals.pan.trim().toUpperCase() : '';
  const uanValue = typeof vals.uan === 'string' ? vals.uan.trim() : '';
  const stateOfEmploymentValue =
    typeof vals.stateOfEmployment === 'string' ? vals.stateOfEmployment.trim() : '';
  const esiIpNumberValue = typeof vals.esiIpNumber === 'string' ? vals.esiIpNumber.trim() : '';
  const pfApplicableValue = vals.pfApplicable !== false;
  const esiApplicableValue = vals.esiApplicable === true;
  const pfOptOutAllowed = pfApplicableValue && Number(vals.salaryAmount ?? 0) > 15000;

  const mobile = vals.mobile as string | undefined;
  const email = vals.email as string | undefined;
  // Phase 1f (2026-05-21): forward the OTP proof token when present. BE
  // validates the JWT via MobileOtpService.assertProofToken and persists
  // mobileVerifiedAt on the new TeamMember. Absent token = skipped path =
  // mobileVerifiedAt stays null. Trimmed string check guards against an
  // accidental empty Input value (Form.useWatch may surface '' transiently).
  const mobileVerifyTokenRaw = vals.mobileVerifyToken as string | undefined;
  const mobileVerifyToken =
    typeof mobileVerifyTokenRaw === 'string' && mobileVerifyTokenRaw.trim().length > 0
      ? mobileVerifyTokenRaw.trim()
      : undefined;
  const gender = vals.gender as 'male' | 'female' | 'other' | undefined;
  const bloodGroup = vals.bloodGroup as string | undefined;
  const address = vals.address as string | undefined;
  const emergencyContactName = vals.emergencyContactName as string | undefined;
  const emergencyContactNumber = vals.emergencyContactNumber as string | undefined;
  const designation = vals.designation as string | undefined;
  // Location: `locationId` is the master-list reference; `location` is its
  // denormalised name (set by WorkTab when a location is picked) kept for the
  // ID card + legacy displays.
  const locationId = vals.locationId as string | undefined;
  const locationName = vals.location as string | undefined;
  const salaryType = vals.salaryType as 'monthly' | 'hourly' | undefined;
  const salaryAmount = vals.salaryAmount as number | undefined;
  const dailyHours = vals.dailyHours as number | undefined;
  const maritalStatus = vals.maritalStatus as
    | 'single'
    | 'married'
    | 'divorced'
    | 'widowed'
    | undefined;
  const scheduleType = vals.scheduleType as 'shift' | 'custom' | undefined;
  const shiftId = vals.shiftId as string | undefined;
  const weeklyOff = vals.weeklyOff as string[] | undefined;
  const rbacRoleId = vals.rbacRoleId as string | undefined;
  const accountNumber = vals.accountNumber as string | undefined;
  const upiId = vals.upiId as string | undefined;
  const preferredMethod = vals.preferredMethod as 'BANK' | 'UPI' | 'CASH' | undefined;
  const ctcAmount = vals.ctcAmount as number | undefined;
  const componentTemplateId = vals.componentTemplateId as string | undefined;
  const reportsTo = (vals.reportsTo as string | null | undefined) ?? null;
  // Phase 1 compliance - per-member minimum wage override.
  // null means "clear override, use workspace default". undefined means "not submitted".
  // We always include the key when the form field is present (even as null) so an
  // explicit clear reaches the backend.
  const minimumWageMonthlyOverrideRaw = vals.minimumWageMonthlyOverride;
  const minimumWageMonthlyOverride: number | null | undefined =
    minimumWageMonthlyOverrideRaw === undefined
      ? undefined
      : minimumWageMonthlyOverrideRaw === null || minimumWageMonthlyOverrideRaw === ''
        ? null
        : Number(minimumWageMonthlyOverrideRaw);
  const salaryDayBasis = vals.salaryDayBasis as
    | 'fixed_month_days'
    | 'calendar_month_days'
    | undefined;
  const fixedMonthDaysRaw = vals.fixedMonthDays;
  const fixedMonthDays =
    fixedMonthDaysRaw === undefined || fixedMonthDaysRaw === null || fixedMonthDaysRaw === ''
      ? undefined
      : Number(fixedMonthDaysRaw);
  const attendancePayMode = vals.attendancePayMode as
    | 'default'
    | 'enabled'
    | 'disabled'
    | undefined;
  /* PAUSED 2026-05-14 - Karigar feature paused on web. Payload no longer
     emits isKarigar / karigarSkillType / karigarDailyRatePaise so the web
     edit form does not clobber values written by mobile. Revive by
     uncommenting this block + matching payload spread below + matching
     blocks in page.tsx, KarigarTab.tsx, reports page. Mobile + BE live. */
  // const isKarigarValue = vals.isKarigar === true;
  // const karigarSkillType = vals.karigarSkillType as
  //   | 'zari'
  //   | 'embroidery'
  //   | 'print'
  //   | 'dyeing'
  //   | 'cutting'
  //   | 'finishing'
  //   | 'other'
  //   | undefined;
  // const karigarDailyRateRupeesRaw = vals.karigarDailyRateRupees;
  // const karigarDailyRatePaise =
  //   isKarigarValue &&
  //   karigarDailyRateRupeesRaw !== undefined &&
  //   karigarDailyRateRupeesRaw !== null &&
  //   karigarDailyRateRupeesRaw !== ''
  //     ? Math.round(Number(karigarDailyRateRupeesRaw) * 100)
  //     : undefined;

  const payload = {
    name: vals.name as string,
    ...(avatarUrl ? { avatar: avatarUrl } : {}),
    ...(mobile ? { mobile } : {}),
    ...(mobileVerifyToken ? { mobileVerifyToken } : {}),
    ...(email ? { email } : {}),
    ...(gender ? { gender } : {}),
    ...(dayjs.isDayjs(vals.dateOfBirth)
      ? { dateOfBirth: (vals.dateOfBirth as Dayjs).format('YYYY-MM-DD') }
      : {}),
    ...(bloodGroup ? { bloodGroup } : {}),
    ...(address ? { address } : {}),
    ...(emergencyContactName ? { emergencyContactName } : {}),
    ...(emergencyContactNumber ? { emergencyContactNumber } : {}),
    ...(designation ? { designation } : {}),
    ...(locationId ? { locationId } : {}),
    ...(locationName ? { location: locationName } : {}),
    ...(dayjs.isDayjs(vals.dateOfJoining)
      ? { dateOfJoining: (vals.dateOfJoining as Dayjs).format('YYYY-MM-DD') }
      : {}),
    ...(salaryType ? { salaryType } : {}),
    ...(salaryAmount !== undefined ? { salaryAmount } : {}),
    ...(salaryType === 'hourly' && dailyHours !== undefined ? { dailyHours } : {}),
    ...(salaryDayBasis ? { salaryDayBasis } : {}),
    ...(salaryDayBasis === 'fixed_month_days' && fixedMonthDays !== undefined
      ? { fixedMonthDays }
      : {}),
    ...(attendancePayMode ? { attendancePayMode } : {}),
    /* PAUSED 2026-05-14 - Karigar payload fields suppressed. Revive by uncommenting. */
    // ...(isKarigarValue ? { isKarigar: true } : {}),
    // ...(isKarigarValue && karigarSkillType ? { karigarSkillType } : {}),
    // ...(karigarDailyRatePaise !== undefined ? { karigarDailyRatePaise } : {}),
    finalMonthlyOverride:
      salaryType === 'hourly' ? ((vals.finalMonthlyOverride as number | undefined) ?? null) : null,
    ...(panValue ? { pan: panValue } : {}),
    ...(uanValue ? { uan: uanValue } : {}),
    taxRegime:
      (vals.taxRegime as 'old' | 'new' | undefined) ?? DEFAULT_STATUTORY_FORM_VALUES.taxRegime,
    ...(stateOfEmploymentValue ? { stateOfEmployment: stateOfEmploymentValue } : {}),
    employmentType:
      (vals.employmentType as
        | 'full_time'
        | 'part_time'
        | 'contract'
        | 'intern'
        | 'consultant'
        | undefined) ?? DEFAULT_STATUTORY_FORM_VALUES.employmentType,
    pfApplicable: pfApplicableValue,
    pfOptedOut: pfOptOutAllowed ? vals.pfOptedOut === true : false,
    esiApplicable: esiApplicableValue,
    ...(esiApplicableValue && esiIpNumberValue ? { esiIpNumber: esiIpNumberValue } : {}),
    isNonItrFiler: vals.isNonItrFiler === true,
    ...(maritalStatus ? { maritalStatus } : {}),
    ...(scheduleType ? { scheduleType } : {}),
    ...(scheduleType === 'shift' && shiftId ? { shiftId } : {}),
    ...(scheduleType === 'custom' && weeklyOff ? { weeklyOff } : {}),
    ...(scheduleType === 'custom' && customScheduleStart
      ? {
          customSchedule: {
            startTime: customScheduleStart,
            endTime: customScheduleEnd as string,
          },
        }
      : {}),
    ...(rbacRoleId ? { rbacRoleId } : {}),
    isActive: vals.isActive !== false,
    ...(accountNumber
      ? {
          bankDetails: {
            bankName: (vals.bankName as string) || '',
            accountHolderName: (vals.accountHolderName as string) || '',
            accountNumber,
            ifscCode: (vals.ifscCode as string) || '',
            ...(passbookImageUrl ? { passbookImageUrl } : {}),
          },
        }
      : {}),
    ...(upiId
      ? {
          upiDetails: {
            upiId,
            ...(qrCodeUrl ? { qrCodeUrl } : {}),
          },
        }
      : {}),
    ...(preferredMethod ? { preferredMethod } : {}),
    ...(ctcAmount ? { ctcAmount } : {}),
    ...(componentTemplateId ? { componentTemplateId } : {}),
    ...(componentOverrides.length > 0 ? { componentOverrides } : {}),
    reportsTo: reportsTo ?? null,
    // Include minimumWageMonthlyOverride only when the field was touched (not undefined).
    // null is sent explicitly so an intentional clear reaches the backend guard.
    ...(minimumWageMonthlyOverride !== undefined ? { minimumWageMonthlyOverride } : {}),
  };

  return payload as CreateTeamMemberPayload | UpdateTeamMemberPayload;
}
