import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeMemberAttendanceSummary } from '../memberSummary';
import type { AttendanceRecord } from '@/types';

const rec = (status: string, workedMinutes = 480): AttendanceRecord =>
  ({ status, workedMinutes }) as unknown as AttendanceRecord;

describe('computeMemberAttendanceSummary', () => {
  it('counts statuses and computes rate (late counts toward present)', () => {
    const out = computeMemberAttendanceSummary([
      rec('present'),
      rec('late'),
      rec('absent', 0),
      rec('half_day', 240),
      rec('on_leave', 0),
    ]);
    assert.equal(out.presentDays, 2); // present + late
    assert.equal(out.lateDays, 1);
    assert.equal(out.absentDays, 1);
    assert.equal(out.halfDays, 1);
    assert.equal(out.leaveDays, 1);
    assert.equal(out.workingDays, 5);
    assert.equal(out.totalMinutes, 1200);
    assert.equal(out.rate, 40); // present(2)/working(5) = 40%
  });

  it('handles empty input without dividing by zero', () => {
    const out = computeMemberAttendanceSummary([]);
    assert.equal(out.workingDays, 0);
    assert.equal(out.rate, 0);
  });
});
