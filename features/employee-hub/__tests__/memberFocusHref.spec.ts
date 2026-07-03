import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMemberSalaryHref, buildMemberAttendanceHref } from '../memberFocusHref';

describe('buildMemberSalaryHref', () => {
  it('builds the Run Payroll href focused on the member', () => {
    assert.equal(buildMemberSalaryHref('abc'), '/dashboard/salary/run-payroll?teamMemberId=abc');
  });
});

describe('buildMemberAttendanceHref', () => {
  it('routes manager (canViewAll) to the marking console for the member', () => {
    assert.equal(
      buildMemberAttendanceHref({
        memberId: 'abc',
        month: 6,
        year: 2026,
        canViewAll: true,
        isOwnRecord: false,
      }),
      '/dashboard/attendance/mark?teamMemberId=abc',
    );
  });

  it('routes self-scoped worker to attendance landing', () => {
    assert.equal(
      buildMemberAttendanceHref({
        memberId: 'abc',
        month: 6,
        year: 2026,
        canViewAll: false,
        isOwnRecord: true,
      }),
      '/dashboard/attendance',
    );
  });
});
