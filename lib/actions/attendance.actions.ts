'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import { extractErrorMessage } from '@/lib/format/http-errors';
import type {
  AttendanceRecord,
  AttendanceSummary,
  AttendanceQueryParams,
  MarkAttendancePayload,
  BulkMarkAttendancePayload,
  BulkMarkAttendanceResult,
  UpdateAttendancePayload,
  UpcomingLeaveEntry,
  AttendanceEventQuery,
  AttendanceEventListResponse,
  AuditItem,
} from '@/types';

const E = ApiEndpoints.attendance;

export async function listAttendance(wsId: string, params?: AttendanceQueryParams) {
  const http = await serverHttp();
  return http.get(E.list(wsId), { params }).then(unwrapServer<AttendanceRecord[]>);
}

export async function getAttendanceSummary(wsId: string, date?: string) {
  const http = await serverHttp();
  // The backend attaches the optional `memberCap` notice as a SIBLING of `data`
  // on the getSummary envelope ({ success, data: stats, memberCap }), so the
  // generic `unwrapServer` (which returns `data`) would drop it. Read the raw
  // envelope and merge `memberCap` onto the summary so the consumer can read it
  // as `summary.memberCap` -> drives <MemberCapNotice> on the attendance report.
  const res = await http.get(E.summary(wsId), { params: date ? { date } : {} });
  const summary = unwrapServer<AttendanceSummary>(res);
  const memberCap = (res?.data as { memberCap?: AttendanceSummary['memberCap'] })?.memberCap;
  return memberCap ? { ...summary, memberCap } : summary;
}

export async function markAttendance(wsId: string, data: MarkAttendancePayload, token?: string) {
  try {
    const http = await serverHttp(token);
    return await http.post(E.mark(wsId), data).then(unwrapServer<AttendanceRecord>);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not save attendance. Please try again.'));
  }
}

export async function bulkMarkAttendance(
  wsId: string,
  data: BulkMarkAttendancePayload,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http.post(E.bulkMark(wsId), data).then(unwrapServer<BulkMarkAttendanceResult>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, 'Could not save the attendance changes. Please try again.'),
    );
  }
}

export async function voidAttendanceEvent(
  wsId: string,
  eventId: string,
  reason: string,
): Promise<{ message: string; eventId: string }> {
  try {
    const http = await serverHttp();
    const res = await http.delete(E.voidEvent(wsId, eventId), { data: { reason } });
    return unwrapServer<{ message: string; eventId: string }>(res);
  } catch (e) {
    throw new Error(extractErrorMessage(e, 'Could not void this punch event. Please try again.'));
  }
}

export async function updateAttendance(
  wsId: string,
  recordId: string,
  data: UpdateAttendancePayload,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http.patch(E.update(wsId, recordId), data).then(unwrapServer<AttendanceRecord>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, 'Could not update this attendance record. Please try again.'),
    );
  }
}

export async function removeAttendance(
  wsId: string,
  memberId: string,
  date: string,
  token?: string,
) {
  try {
    const http = await serverHttp(token);
    return await http
      .delete(E.delete(wsId, memberId, date))
      .then(unwrapServer<{ message: string }>);
  } catch (e) {
    throw new Error(
      extractErrorMessage(e, "Could not delete this member's attendance. Please try again."),
    );
  }
}

export async function listUpcomingLeaves(wsId: string, from: string, to: string) {
  const http = await serverHttp();
  return http
    .get(E.upcomingLeaves(wsId), { params: { from, to } })
    .then(unwrapServer<UpcomingLeaveEntry[]>);
}

export async function exportAttendance(wsId: string, month: string, year: string) {
  try {
    const http = await serverHttp();
    return await http.get(E.export(wsId), { params: { month, year } }).then(unwrapServer<string>);
  } catch (error) {
    console.error('[exportAttendance] Error:', error);
    return '';
  }
}

export async function listAttendanceEvents(
  wsId: string,
  params?: AttendanceEventQuery,
): Promise<AttendanceEventListResponse> {
  const http = await serverHttp();
  return http.get(E.events(wsId), { params }).then(unwrapServer<AttendanceEventListResponse>);
}

/**
 * Fetches the merged audit timeline for a single attendance record.
 * Returns chronologically-sorted items: events (incl. voided), void markers, statusHistory.
 * D-28, D-29, M-05 Task 4.
 */
export async function getAttendanceOverview(
  wsId: string,
  month: number,
  year: number,
): Promise<{
  kpi: {
    totalDays: number;
    presentDays: number;
    lateDays: number;
    absentDays: number;
    halfDays: number;
    leaveDays: number;
    totalWorkedMinutes: number;
    avgAttendanceRate: number;
    onTimeRate: number;
  };
  daily: Array<{ _id: string; present: number; late: number; absent: number }>;
  members: Array<{
    memberId: string;
    name: string;
    designation: string;
    shiftName: string;
    workingDays: number;
    present: number;
    late: number;
    absent: number;
    halfDay: number;
    onLeave: number;
    totalWorkedMinutes: number;
    rate: number;
  }>;
}> {
  const http = await serverHttp();
  const res = await http.get(E.overview(wsId), { params: { month, year } });
  return unwrapServer(res);
}

export interface StaleSession {
  _id: string;
  memberId: string;
  memberName: string;
  date: string; // 'YYYY-MM-DD'
  checkIn: string; // ISO
}

export async function listStaleSessions(wsId: string): Promise<StaleSession[]> {
  const http = await serverHttp();
  return http.get(E.staleSessions(wsId)).then(unwrapServer<StaleSession[]>);
}

export async function getAttendanceAudit(wsId: string, attendanceId: string): Promise<AuditItem[]> {
  const http = await serverHttp();
  const res = await http.get(E.audit(wsId, attendanceId));
  return unwrapServer<AuditItem[]>(res);
}
