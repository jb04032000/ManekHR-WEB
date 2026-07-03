// Opens the Run Payroll page focused on this employee. RunPayrollPage reads
// ?teamMemberId (focusedTeamMemberId) and centres that employee's payroll row.
// No drawer is opened.
export function buildMemberSalaryHref(teamMemberId: string): string {
  const p = new URLSearchParams({ teamMemberId });
  return `/dashboard/salary/run-payroll?${p.toString()}`;
}

export function buildMemberAttendanceHref(opts: {
  memberId: string;
  month: number;
  year: number;
  canViewAll: boolean;
  isOwnRecord: boolean;
}): string {
  if (opts.canViewAll) {
    // Managers open the marking console's Attendance Details for this employee
    // (defaults to today; the mark page always lists the member, so it is robust).
    const p = new URLSearchParams({ teamMemberId: opts.memberId });
    return `/dashboard/attendance/mark?${p.toString()}`;
  }
  // Self-scoped workers cannot use the marking console; send them to their own surface.
  return '/dashboard/attendance';
}
