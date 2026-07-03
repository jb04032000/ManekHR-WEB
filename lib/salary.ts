import type { TeamMember } from '@/types';

export const DEFAULT_HOURLY_WORKING_DAYS = 26;

type SalaryMemberLike = Partial<
  Pick<
    TeamMember,
    | 'salaryType'
    | 'salaryAmount'
    | 'salaryDayBasis'
    | 'fixedMonthDays'
    | 'dailyHours'
    | 'workingDays'
    | 'finalMonthlyOverride'
  >
> | null | undefined;

export function resolveEffectiveMonthlySalary(
  member: SalaryMemberLike,
  options?: { month?: number; year?: number; defaultWorkingDays?: number },
): number {
  if (!member) return 0;

  if ((member.salaryType || 'monthly') !== 'hourly') {
    return Math.max(0, member.salaryAmount ?? 0);
  }

  if (
    member.finalMonthlyOverride !== undefined &&
    member.finalMonthlyOverride !== null
  ) {
    return Math.max(0, member.finalMonthlyOverride);
  }

  const hourlyRate = Math.max(0, member.salaryAmount ?? 0);
  const dailyHours = Math.max(0, member.dailyHours ?? 0);
  const month = options?.month ?? new Date().getMonth() + 1;
  const year = options?.year ?? new Date().getFullYear();
  const defaultWorkingDays = Math.max(
    1,
    Math.min(31, options?.defaultWorkingDays ?? DEFAULT_HOURLY_WORKING_DAYS),
  );
  const basisDays =
    member.salaryDayBasis === 'calendar_month_days'
      ? new Date(year, month, 0).getDate()
      : Math.max(
          0,
          Number(
            member.fixedMonthDays ??
              member.workingDays ??
              defaultWorkingDays,
          ) || defaultWorkingDays,
        );
  return hourlyRate * dailyHours * basisDays;
}

export function calculateAttendanceNetSalary(params: {
  baseSalary: number;
  totalDays: number;
  presentDays: number;
  additions?: number;
  deductions?: number;
}): number {
  const {
    baseSalary,
    totalDays,
    presentDays,
    additions = 0,
    deductions = 0,
  } = params;
  const baseEarned = totalDays <= 0 ? 0 : (baseSalary / totalDays) * presentDays;
  const calculatedNet = baseEarned + additions - deductions;
  return Math.max(0, Math.round(calculatedNet * 100) / 100);
}
