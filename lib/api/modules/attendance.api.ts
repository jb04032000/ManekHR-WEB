import http, { unwrap } from '../client';
import { ApiEndpoints } from '../endpoints';
import type {
  AttendanceRecord,
  AttendanceSummary,
  AttendanceQueryParams,
  MarkAttendancePayload,
  BulkMarkAttendancePayload,
  UpdateAttendancePayload,
  AttendanceEventQuery,
  AttendanceEventListResponse,
  AttendanceRecomputePayload,
  LivePresence,
  AttendanceGrid,
  OvertimeAnalytics,
  ComplianceReport,
  AbsencePatterns,
  MeAttendanceDay,
} from '@/types';

const E = ApiEndpoints.attendance;

export const attendanceApi = {
  list: (wsId: string, params?: AttendanceQueryParams) =>
    http.get(E.list(wsId), { params }).then(unwrap<AttendanceRecord[]>),
  summary: (wsId: string, date?: string) =>
    http.get(E.summary(wsId), { params: date ? { date } : {} }).then(unwrap<AttendanceSummary>),
  /** Live "who's in" board - today's presence snapshot for all active members. */
  livePresence: (wsId: string) => http.get(E.livePresence(wsId)).then(unwrap<LivePresence>),
  /** Member × day attendance grid (heatmap / muster) for a month. */
  attendanceGrid: (wsId: string, month: number, year: number) =>
    http.get(E.grid(wsId), { params: { month, year } }).then(unwrap<AttendanceGrid>),
  /** Overtime analytics - OT worked by member / shift / day for a month. */
  overtimeAnalytics: (wsId: string, month: number, year: number) =>
    http.get(E.overtime(wsId), { params: { month, year } }).then(unwrap<OvertimeAnalytics>),
  /** Attendance-compliance report - defaulters + late / absent leaderboards. */
  complianceReport: (wsId: string, month: number, year: number) =>
    http.get(E.compliance(wsId), { params: { month, year } }).then(unwrap<ComplianceReport>),
  /** Absence patterns - Bradford-style score + weekday clustering over a lookback window. */
  absencePatterns: (wsId: string, months: number) =>
    http.get(E.absencePatterns(wsId), { params: { months } }).then(unwrap<AbsencePatterns>),
  mark: (wsId: string, data: MarkAttendancePayload) =>
    http.post(E.mark(wsId), data).then(unwrap<AttendanceRecord>),
  markBulk: (wsId: string, data: BulkMarkAttendancePayload) =>
    http.post(E.bulkMark(wsId), data).then(unwrap<AttendanceRecord[]>),
  update: (wsId: string, recordId: string, data: UpdateAttendancePayload) =>
    http.patch(E.update(wsId, recordId), data).then(unwrap<AttendanceRecord>),
  remove: (wsId: string, memberId: string, date: string) =>
    http.delete(E.delete(wsId, memberId, date)).then(unwrap<{ message: string }>),
  export: (wsId: string, month: string, year: string) =>
    http.get(E.export(wsId), { params: { month, year } }).then(unwrap<string>),
  listEvents: (wsId: string, params?: AttendanceEventQuery) =>
    http.get(E.events(wsId), { params }).then(unwrap<AttendanceEventListResponse>),
  recompute: (wsId: string, payload: AttendanceRecomputePayload) =>
    http.post(E.recompute(wsId), payload).then(unwrap<{ recomputed: number }>),
  /** Self-service punch - records the caller's own check-in / check-out. */
  selfPunch: (wsId: string) =>
    http
      .post(E.selfPunch(wsId))
      .then(unwrap<{ punchType: 'CHECK_IN' | 'CHECK_OUT'; time: string }>),
  /** Self-service single-day view - caller's own status, sessions, punch count, live state. */
  myDay: (wsId: string, date?: string) =>
    http.get(E.myDay(wsId), { params: date ? { date } : {} }).then(unwrap<MeAttendanceDay>),
};

// ── Attendance error-code → i18n mapping (Attendance hardening Pillar 3/4) ──────
//
// The attendance write guards throw structured ForbiddenException / BadRequest
// payloads carrying a stable `code` (MEMBER_OFFBOARDED, ATTENDANCE_SELF_EDIT_
// BLOCKED, SELF_PUNCH_DISABLED via PolicyDeniedException, KIOSK_PERIOD_CLOSED).
// Surfacing the raw BE English string would leave gu/gu-en/hi-en users with an
// untranslated toast, so the FE resolves the `code` to the `attendance.errors.*`
// i18n key first (all four locales), and only falls back to the BE message /
// generic when no code matched. Mirrors getRegularizationErrorMessage but is
// i18n-aware (takes the next-intl translator).
//
// Cross-module: codes are produced by AttendanceWriteGuardService +
// MeAttendanceService + KioskService on the backend. Keep these in sync with
// `attendance.errors.*` in app/messages/*.json.

const ATTENDANCE_ERROR_CODES = new Set([
  'MEMBER_OFFBOARDED',
  'ATTENDANCE_SELF_EDIT_BLOCKED',
  'SELF_PUNCH_DISABLED',
  'KIOSK_PERIOD_CLOSED',
  'PAYROLL_LOCKED',
  'FUTURE_DATE',
]);

/** Best-effort extraction of a structured error `code` from an axios/raw error. */
function extractAttendanceErrorCode(err: unknown): string | null {
  const anyErr = err as {
    response?: { data?: { code?: unknown; error?: { code?: unknown; message?: unknown } } };
    code?: unknown;
  };
  // Direct shapes the NestJS HttpExceptionFilter may emit for { code, message }.
  const candidates: unknown[] = [
    anyErr?.response?.data?.code,
    anyErr?.response?.data?.error?.code,
    anyErr?.code,
  ];
  for (const c of candidates) {
    if (typeof c === 'string' && ATTENDANCE_ERROR_CODES.has(c)) return c;
  }
  // Some filters embed the code as a "CODE: message" prefix on the message.
  const rawMessage = (anyErr?.response?.data?.error?.message as string | undefined) ?? '';
  const msgCode = rawMessage.split(':')[0]?.trim();
  if (msgCode && ATTENDANCE_ERROR_CODES.has(msgCode)) return msgCode;
  return null;
}

/**
 * Resolve an attendance write error to a localized, user-safe message.
 * `t` is the next-intl translator bound to the `attendance` namespace
 * (e.g. `useTranslations('attendance')`). Falls back to the BE message, then a
 * generic localized line, so a user never sees "Request failed with status 403".
 */
export function getAttendanceErrorMessage(err: unknown, t: (key: string) => string): string {
  const code = extractAttendanceErrorCode(err);
  if (code) return t(`errors.${code}`);

  // No recognised code — prefer the BE-provided message if present, else generic.
  const beMessage = (
    err as { response?: { data?: { message?: unknown; error?: { message?: unknown } } } }
  )?.response?.data;
  const msg =
    (typeof beMessage?.message === 'string' && beMessage.message) ||
    (typeof beMessage?.error?.message === 'string' && beMessage.error.message) ||
    '';
  return msg || t('errors.generic');
}
