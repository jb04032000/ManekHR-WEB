import type { AttendanceRecord } from '@/types';

export interface MemberAttendanceSummary {
  workingDays: number;
  presentDays: number;
  lateDays: number;
  absentDays: number;
  halfDays: number;
  leaveDays: number;
  totalMinutes: number;
  rate: number; // present/working as integer percent
}

/**
 * Pure helper - extracts the per-member attendance summary computation
 * that lives inside MemberReportDrawer's useMemo (lines 147-206).
 *
 * Status-string mapping (matches AttendanceStatus union in @/types):
 *   'present'  -> presentDays++
 *   'late'     -> presentDays++ AND lateDays++
 *   'absent'   -> absentDays++
 *   'half_day' -> halfDays++
 *   'on_leave' -> leaveDays++
 *   'holiday' / 'week_off' -> no counter incremented
 *
 * rate = Math.round((presentDays / workingDays) * 100), 0 when workingDays === 0.
 */
export function computeMemberAttendanceSummary(
  records: AttendanceRecord[],
): MemberAttendanceSummary {
  const workingDays = records.length;
  let presentDays = 0;
  let lateDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let leaveDays = 0;
  let totalMinutes = 0;

  for (const r of records) {
    totalMinutes += r.workedMinutes ?? 0;
    if (r.status === 'present') {
      presentDays++;
    } else if (r.status === 'late') {
      presentDays++;
      lateDays++;
    } else if (r.status === 'half_day') {
      halfDays++;
    } else if (r.status === 'absent') {
      absentDays++;
    } else if (r.status === 'on_leave') {
      leaveDays++;
    }
  }

  const rate = workingDays > 0 ? Math.round((presentDays / workingDays) * 100) : 0;
  return {
    workingDays,
    presentDays,
    lateDays,
    absentDays,
    halfDays,
    leaveDays,
    totalMinutes,
    rate,
  };
}
