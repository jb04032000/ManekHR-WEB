'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, Popconfirm, Skeleton, Tag } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  FormOutlined,
  LeftOutlined,
  LoginOutlined,
  LogoutOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { listAttendance, listHolidays } from '@/lib/actions';
import { attendanceApi, getAttendanceErrorMessage } from '@/lib/api/modules/attendance.api';
import {
  regularizationApi,
  getRegularizationErrorMessage,
} from '@/lib/api/modules/regularization.api';
import { DsPageHeader, StatTile } from '@/components/ui';
import type {
  AttendanceRecord,
  Holiday,
  MeAttendanceDay,
  PaginatedResponse,
  RegularizationRequest,
  RegularizationStatus,
  RequestedAttendanceStatus,
} from '@/types';
import { RaiseRegularizationModal } from './RaiseRegularizationModal';
import { MyDayDetailModal } from './MyDayDetailModal';
import { HolidaysNextPill } from '@/components/dashboard/holidays/HolidaysYearCard';

/**
 * Access Control Initiative §8 - Attendance, self-scoped surface.
 *
 * Rendered by the `/dashboard/attendance` scope-gate for a member whose
 * role grants `attendance.view` at `self` scope only. Shows the caller's
 * OWN monthly attendance - calendar + summary - and nothing org-wide.
 *
 * Scope is enforced server-side: `GET /attendance` self-filters to the
 * caller's `teamMemberId`, so this component simply renders whatever the
 * API returns (option (c) - server enforces the contract, client composes).
 *
 * §8 Part B adds two self-service surfaces, both server-gated:
 *   - a punch clock (`selfServiceConfig.selfPunch` + `attendance.mark self`);
 *   - self-raised attendance corrections (`selfServiceConfig.selfLeaveApply`
 *     + `attendance.manage_regularizations self`) - tap a past day to raise
 *     a correction, and track every request's approval status.
 */

interface StatusMeta {
  /** Dot + text colour token. */
  token: string;
  /** i18n key relative to the `attendance` namespace. */
  labelKey: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  present: { token: 'var(--cr-success-700)', labelKey: 'present' },
  absent: { token: 'var(--cr-danger-700)', labelKey: 'absent' },
  half_day: { token: 'var(--cr-warning-700)', labelKey: 'halfDay' },
  on_leave: { token: 'var(--cr-info-700)', labelKey: 'leave' },
  holiday: { token: 'var(--cr-text-3)', labelKey: 'myAttendance.holiday' },
  week_off: { token: 'var(--cr-text-3)', labelKey: 'weeklyOff' },
};

/** Regularization request status → antd Tag colour + i18n label key. */
const REQUEST_STATUS_META: Record<RegularizationStatus, { color: string; labelKey: string }> = {
  pending: { color: 'gold', labelKey: 'myAttendance.reqStatus.pending' },
  approved: { color: 'green', labelKey: 'myAttendance.reqStatus.approved' },
  rejected: { color: 'red', labelKey: 'myAttendance.reqStatus.rejected' },
  cancelled: { color: 'default', labelKey: 'myAttendance.reqStatus.cancelled' },
};

const cellTint = (token: string) => `color-mix(in srgb, ${token} 14%, var(--cr-surface, #fff))`;

/** Worked-minutes -> compact "8h 15m" / "8h" / "45m" (mirrors AttendanceDailySummary `fmt`). */
const fmtHm = (min: number): string => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const CELL_CLASS =
  'flex min-h-[58px] flex-col justify-between rounded-lg border p-1.5 sm:min-h-[82px]';

export function MyAttendance() {
  const t = useTranslations('attendance');
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();
  const { canPath, data } = useMyPermissions();
  const { message: msgApi } = App.useApp();

  const [anchor, setAnchor] = useState(() => dayjs().startOf('month'));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  // Workspace-global holiday calendar (reference data). Failures are silent +
  // fall back to `[]` so a holidays read error never blocks attendance display.
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [myDay, setMyDay] = useState<MeAttendanceDay | null>(null);
  // Live "now" tick so hours-so-far advances while the member is checked in.
  const [now, setNow] = useState(() => Date.now());

  const [myRequests, setMyRequests] = useState<RegularizationRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [regModal, setRegModal] = useState<{
    date: string;
    currentStatus: string;
    original?: MeAttendanceDay | null;
  } | null>(null);
  const [dayDetail, setDayDetail] = useState<{ date: string; statusText: string } | null>(null);

  const month = anchor.month() + 1;
  const year = anchor.year();
  const isCurrentMonth = anchor.isSame(dayjs(), 'month');

  // ── Scope-gated self-service capabilities ───────────────────────────────
  // Viewing/raising regularizations needs the `self` grant; raising NEW ones
  // additionally needs the workspace policy toggle. Both are re-enforced
  // server-side - these flags only decide what to render.
  const canViewMyRequests = canPath('regularization.request.view', 'self');
  const canRaiseRegularization =
    canPath('regularization.request.apply', 'self') &&
    !!currentWorkspace?.selfServiceConfig?.selfLeaveApply &&
    !!data?.teamMemberId;

  const loadMonth = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const res = await listAttendance(currentWorkspaceId, { month, year, limit: 100 });
      const list = Array.isArray(res)
        ? res
        : ((res as PaginatedResponse<AttendanceRecord>).data ?? []);
      setRecords(list);
    } catch {
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, month, year]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  // Holidays are workspace-global reference data; everyone can view them on
  // their own calendar. Failures are swallowed (set to `[]`, no toast) so a
  // transient holidays fetch error never breaks the attendance grid.
  const loadHolidays = useCallback(async () => {
    if (!currentWorkspaceId) return;
    try {
      const res = await listHolidays(currentWorkspaceId);
      setHolidays(Array.isArray(res) ? res : []);
    } catch {
      setHolidays([]);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    void loadHolidays();
  }, [loadHolidays]);

  const loadMyRequests = useCallback(async () => {
    if (!currentWorkspaceId || !canViewMyRequests) return;
    setLoadingRequests(true);
    try {
      const res = await regularizationApi.listMyRequests(currentWorkspaceId);
      setMyRequests(Array.isArray(res) ? res : []);
    } catch {
      setMyRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [currentWorkspaceId, canViewMyRequests]);

  useEffect(() => {
    void loadMyRequests();
  }, [loadMyRequests]);

  // date (YYYY-MM-DD) → record, for O(1) calendar-cell lookup.
  const recordsByDate = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) {
      const d = r.date?.slice(0, 10);
      if (d) map.set(d, r);
    }
    return map;
  }, [records]);

  // date (YYYY-MM-DD) → Holiday, for O(1) calendar-cell lookup. Recurring
  // holidays are projected into the active anchor's year (mirrors the BE's
  // `findByYear` behaviour) so a Diwali stored against 2024 still surfaces on
  // the 2025/2026/... calendar. Non-recurring holidays use their literal date.
  // We only project for the anchor's year because the visible grid is exactly
  // one month inside that year. Last-write-wins on collisions (literal +
  // recurring on the same date) is benign here, both resolve to "Holiday".
  const holidaysByDate = useMemo(() => {
    const map = new Map<string, Holiday>();
    const anchorYear = anchor.year();
    for (const h of holidays) {
      const stored = dayjs(h.date);
      if (!stored.isValid()) continue;
      const projected = h.isRecurring
        ? stored.year(anchorYear).format('YYYY-MM-DD')
        : stored.format('YYYY-MM-DD');
      map.set(projected, h);
    }
    return map;
  }, [holidays, anchor]);

  // ── Self-service punch (Access Control Initiative §8 Part B) ────────────
  // The clock shows only when the workspace enabled self check-in AND the
  // caller's role grants self-punch. Live state (checked-in, hours so far,
  // punch count, sessions) comes from GET /me/attendance/day, which the
  // server derives authoritatively from the day's punch events.
  const hasSelfPunchGrant = canPath('attendance.selfPunch.create', 'self');
  const selfPunchEnabled = !!currentWorkspace?.selfServiceConfig?.selfPunch;
  const canSelfPunch = hasSelfPunchGrant && selfPunchEnabled;
  // Granted self check-in but the workspace policy is OFF - explain it rather
  // than silently hiding the clock (the grant alone is not sufficient).
  const selfPunchBlockedByPolicy = hasSelfPunchGrant && !selfPunchEnabled;

  const loadMyDay = useCallback(async () => {
    if (!currentWorkspaceId || !canSelfPunch) return;
    try {
      setMyDay(await attendanceApi.myDay(currentWorkspaceId));
    } catch {
      setMyDay(null);
    }
  }, [currentWorkspaceId, canSelfPunch]);

  useEffect(() => {
    void loadMyDay();
  }, [loadMyDay]);

  // Tick the live clock every 30s while checked in, so hours-so-far advances.
  useEffect(() => {
    if (!myDay?.currentlyIn) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [myDay?.currentlyIn]);

  const isCheckedIn = !!myDay?.currentlyIn;
  const hasPunchedToday = (myDay?.punchCount ?? 0) > 0;
  const todaySessions = myDay?.sessions ?? [];
  // Hours worked today: while checked in, the open session counts up to "now"
  // so the figure ticks; once checked out, the projection's worked-minutes
  // (grace / break aware) is authoritative.
  const liveWorkedMin = todaySessions.reduce((sum, s) => {
    const inMs = new Date(s.in).getTime();
    const outMs = s.out ? new Date(s.out).getTime() : now;
    return sum + Math.max(0, (outMs - inMs) / 60000);
  }, 0);
  const workedTodayMin = isCheckedIn ? liveWorkedMin : (myDay?.workedMinutes ?? liveWorkedMin);
  const punchStateLabel = isCheckedIn
    ? t('myAttendance.stateWorking')
    : hasPunchedToday
      ? t('myAttendance.stateDone')
      : t('myAttendance.stateNotIn');
  const punchStateSub = !hasPunchedToday
    ? t('myAttendance.notCheckedIn')
    : isCheckedIn
      ? t('myAttendance.checkedInAt', {
          time: dayjs(myDay?.checkIn ?? todaySessions[0]?.in).format('h:mm A'),
        })
      : t('myAttendance.checkedOutAt', {
          time: dayjs(myDay?.checkOut ?? myDay?.lastPunchAt ?? undefined).format('h:mm A'),
        });

  const handlePunch = async () => {
    if (!currentWorkspaceId) return;
    setPunching(true);
    try {
      const res = await attendanceApi.selfPunch(currentWorkspaceId);
      msgApi.success(
        res.punchType === 'CHECK_IN'
          ? t('myAttendance.punchedInToast')
          : t('myAttendance.punchedOutToast'),
      );
      // Refresh the live clock immediately + the month grid / summary.
      setNow(Date.now());
      await Promise.all([loadMyDay(), loadMonth()]);
    } catch (e) {
      // Attendance hardening: map structured deny codes (SELF_PUNCH_DISABLED,
      // MEMBER_OFFBOARDED, KIOSK_PERIOD_CLOSED, PAYROLL_LOCKED) to localized
      // attendance.errors.* strings across all four locales, instead of leaking
      // the raw BE English message.
      msgApi.error(getAttendanceErrorMessage(e, t));
    } finally {
      setPunching(false);
    }
  };

  const handleCancelRequest = async (id: string) => {
    if (!currentWorkspaceId) return;
    setCancellingId(id);
    try {
      await regularizationApi.cancel(currentWorkspaceId, id, {});
      msgApi.success(t('myAttendance.requestCancelledToast'));
      await Promise.all([loadMyRequests(), loadMonth()]);
    } catch (e) {
      msgApi.error(getRegularizationErrorMessage(e));
    } finally {
      setCancellingId(null);
    }
  };

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, half_day: 0, on_leave: 0, workedMin: 0, workedDays: 0 };
    for (const r of records) {
      if (r.status === 'present') c.present += 1;
      else if (r.status === 'absent') c.absent += 1;
      else if (r.status === 'half_day') c.half_day += 1;
      else if (r.status === 'on_leave') c.on_leave += 1;
      const wm = r.workedMinutes ?? 0;
      if (wm > 0) {
        c.workedMin += wm;
        c.workedDays += 1;
      }
    }
    return c;
  }, [records]);

  const effectiveDays = counts.present + counts.absent + counts.half_day + counts.on_leave;
  const rate = effectiveDays > 0 ? Math.round((counts.present / effectiveDays) * 100) : null;
  const avgWorkedMin = counts.workedDays > 0 ? counts.workedMin / counts.workedDays : 0;

  // Month grid - leading blanks so day 1 lands under its real weekday.
  const cells = useMemo<(dayjs.Dayjs | null)[]>(() => {
    const daysInMonth = anchor.daysInMonth();
    const leading = anchor.day(); // 0 = Sunday
    return [
      ...Array.from({ length: leading }, () => null),
      ...Array.from({ length: daysInMonth }, (_, i) => anchor.add(i, 'day')),
    ];
  }, [anchor]);

  const weekdayLabels = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayjs().day(i).format('dd')),
    [],
  );

  const statusLabel = (status: string) => {
    const meta = STATUS_META[status];
    return meta ? t(meta.labelKey) : status.replace(/_/g, ' ');
  };

  const requestedStatusLabel = (s: RequestedAttendanceStatus) =>
    s === 'PRESENT'
      ? t('present')
      : s === 'HALF_DAY'
        ? t('halfDay')
        : s === 'LEAVE'
          ? t('leave')
          : t('absent');

  return (
    <div className="flex flex-col gap-4">
      <DsPageHeader
        title={t('myAttendance.title')}
        sub={t('myAttendance.subtitle')}
        icon={<CalendarOutlined />}
        right={<HolidaysNextPill />}
      />

      {/* Self-service live clock - state, hours so far, punch count, sessions */}
      {canSelfPunch && !loading && (
        <Card
          style={{
            background: 'var(--cr-surface, white)',
            border: '1px solid var(--cr-border-light)',
          }}
          styles={{ body: { padding: 16 } }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* State + meta */}
            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                style={{
                  background: isCheckedIn
                    ? 'var(--cr-success-50)'
                    : 'var(--cr-surface-2, var(--cr-bg))',
                }}
              >
                <ClockCircleOutlined
                  style={{
                    fontSize: 20,
                    color: isCheckedIn ? 'var(--cr-success-700)' : 'var(--cr-text-3)',
                  }}
                />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="m-0 text-[14px] font-semibold text-heading">
                    {t('myAttendance.clockTitle')}
                  </p>
                  <Tag
                    color={isCheckedIn ? 'green' : hasPunchedToday ? 'blue' : 'default'}
                    className="m-0"
                  >
                    {punchStateLabel}
                  </Tag>
                </div>
                <p className="m-0 text-[12px] text-muted">{punchStateSub}</p>
              </div>
            </div>

            {/* Stats + action */}
            <div className="flex items-center gap-4 sm:gap-5">
              <div className="text-center">
                <p className="m-0 text-[17px] font-bold text-heading tabular-nums">
                  {fmtHm(Math.round(workedTodayMin))}
                </p>
                <p className="m-0 text-[11px] text-muted">{t('myAttendance.hoursToday')}</p>
              </div>
              <div className="text-center">
                <p className="m-0 text-[17px] font-bold text-heading tabular-nums">
                  {myDay?.punchCount ?? 0}
                </p>
                <p className="m-0 text-[11px] text-muted">{t('myAttendance.punches')}</p>
              </div>
              <Button
                type="primary"
                size="large"
                loading={punching}
                icon={isCheckedIn ? <LogoutOutlined /> : <LoginOutlined />}
                onClick={handlePunch}
              >
                {isCheckedIn ? t('myAttendance.punchOut') : t('myAttendance.punchIn')}
              </Button>
            </div>
          </div>

          {/* Today's sessions - every check-in -> check-out pair */}
          {todaySessions.length > 0 && (
            <div
              className="mt-4 flex flex-wrap items-center gap-2 border-0 border-t border-solid pt-3"
              style={{ borderColor: 'var(--cr-border-light)' }}
            >
              {todaySessions.map((s, i) => (
                <span
                  key={`${s.in}-${i}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] tabular-nums"
                  style={{
                    background: 'var(--cr-surface-2, var(--cr-bg))',
                    color: 'var(--cr-text-2)',
                  }}
                >
                  <LoginOutlined style={{ fontSize: 11, color: 'var(--cr-success-700)' }} />
                  {dayjs(s.in).format('h:mm A')}
                  <span className="text-faint">–</span>
                  {s.out ? (
                    <>
                      <LogoutOutlined style={{ fontSize: 11, color: 'var(--cr-text-3)' }} />
                      {dayjs(s.out).format('h:mm A')}
                    </>
                  ) : (
                    <em style={{ color: 'var(--cr-success-700)' }}>
                      {t('myAttendance.sessionOngoing')}
                    </em>
                  )}
                </span>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Self check-in granted but workspace policy off - explain, don't hide silently */}
      {selfPunchBlockedByPolicy && !loading && (
        <Alert
          type="info"
          showIcon
          title={t('myAttendance.selfPunchDisabledNote')}
          style={{ borderRadius: 12 }}
        />
      )}

      {/* Summary - 4 canonical StatTiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {loading ? (
          [0, 1, 2, 3, 4].map((i) => (
            <Skeleton.Button key={i} active block style={{ height: 88, borderRadius: 12 }} />
          ))
        ) : (
          <>
            <StatTile
              label={t('present')}
              value={String(counts.present)}
              hint={rate != null ? t('myAttendance.rateHint', { rate }) : undefined}
            />
            <StatTile label={t('absent')} value={String(counts.absent)} tone="danger" />
            <StatTile label={t('halfDay')} value={String(counts.half_day)} />
            <StatTile label={t('leave')} value={String(counts.on_leave)} />
            <StatTile
              label={t('myAttendance.totalHours')}
              value={counts.workedMin > 0 ? fmtHm(counts.workedMin) : '0h'}
              hint={
                avgWorkedMin > 0
                  ? t('myAttendance.avgPerDay', { dur: fmtHm(avgWorkedMin) })
                  : undefined
              }
            />
          </>
        )}
      </div>

      <Card
        style={{
          background: 'var(--cr-surface, white)',
          border: '1px solid var(--cr-border-light)',
        }}
        styles={{ body: { padding: 20 } }}
      >
        {/* Month navigation */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <Button
            type="text"
            icon={<LeftOutlined />}
            aria-label={t('myAttendance.prevMonth')}
            onClick={() => setAnchor((a) => a.subtract(1, 'month'))}
          />
          <p className="m-0 text-[15px] font-semibold text-heading">{anchor.format('MMMM YYYY')}</p>
          <Button
            type="text"
            icon={<RightOutlined />}
            aria-label={t('myAttendance.nextMonth')}
            disabled={isCurrentMonth}
            onClick={() => setAnchor((a) => a.add(1, 'month'))}
          />
        </div>

        <p className="mb-3 text-[12px] text-muted">
          {canRaiseRegularization
            ? t('myAttendance.tapDayHintRaise')
            : t('myAttendance.tapDayHint')}
        </p>

        {loading ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            {records.length === 0 && (
              <div
                className="mb-3 rounded-lg px-3 py-2 text-[12px]"
                style={{
                  background: 'var(--cr-surface-2, var(--cr-bg))',
                  color: 'var(--cr-text-3)',
                }}
              >
                {t('myAttendance.empty')}
              </div>
            )}

            {/* Weekday header row */}
            <div className="grid grid-cols-7 gap-1.5">
              {weekdayLabels.map((w, i) => (
                <div
                  key={i}
                  className="pb-1 text-center text-[11px] font-semibold tracking-wide text-faint uppercase"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {cells.map((cell, i) => {
                if (!cell) return <div key={`b${i}`} aria-hidden />;
                const iso = cell.format('YYYY-MM-DD');
                const record = recordsByDate.get(iso);
                // Precedence: an actual attendance record (present/absent/half_day/
                // on_leave) ALWAYS wins over a holiday flag. Holidays surface ONLY
                // when there is no record for the day - i.e. the member did not
                // punch on a non-working day, which is the expected case. When
                // someone DOES work on a holiday, their punched record (present /
                // half_day / etc.) is shown as-is so the worked-hours + late badge
                // remain visible and a comp-off claim can later reference that day.
                const holiday = !record ? (holidaysByDate.get(iso) ?? null) : null;
                const effectiveStatus = record?.status ?? (holiday ? 'holiday' : undefined);
                const meta = effectiveStatus ? STATUS_META[effectiveStatus] : undefined;
                const isToday = cell.isSame(dayjs(), 'day');
                const isFuture = cell.isAfter(dayjs(), 'day');
                const interactive = !isFuture; // tap to open the day detail (+ raise correction)
                const statusText = record
                  ? statusLabel(record.status)
                  : holiday
                    ? t('myAttendance.holiday')
                    : t('myAttendance.notMarked');
                const workedMin = record?.workedMinutes ?? 0;
                const lateMin = record?.lateMinutes ?? 0;
                const inTime = record?.checkIn ? dayjs(record.checkIn).format('h:mma') : null;
                // aria-label folds in times + worked hours + late so screen-reader
                // users get the same detail the sighted metrics line shows. For a
                // holiday-only cell, fold in the holiday name so screen-reader users
                // hear "26 January: Holiday, Republic Day".
                const baseLabel = [
                  holiday
                    ? t('myAttendance.holidayCellAria', {
                        date: cell.format('D MMMM'),
                        name: holiday.name,
                      })
                    : `${cell.format('D MMMM')}: ${statusText}`,
                  record?.checkIn
                    ? t('myAttendance.checkedInAt', {
                        time: dayjs(record.checkIn).format('h:mm A'),
                      })
                    : null,
                  record?.checkOut
                    ? t('myAttendance.checkedOutAt', {
                        time: dayjs(record.checkOut).format('h:mm A'),
                      })
                    : null,
                  workedMin > 0 ? fmtHm(workedMin) : null,
                  lateMin > 0 ? t('myAttendance.lateByTitle', { mins: lateMin }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ');
                const cellStyle = {
                  borderColor: isToday ? 'var(--cr-primary)' : 'var(--cr-border-light)',
                  background: meta ? cellTint(meta.token) : 'var(--cr-surface, #fff)',
                  opacity: isFuture ? 0.45 : 1,
                };
                const inner = (
                  <>
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className="text-[12px] font-semibold tabular-nums"
                        style={{ color: isToday ? 'var(--cr-primary)' : 'var(--cr-text-2)' }}
                      >
                        {cell.date()}
                      </span>
                      {lateMin > 0 && (
                        <span
                          aria-hidden
                          className="hidden rounded px-1 text-[9px] font-semibold sm:inline"
                          style={{
                            background: 'var(--cr-danger-50)',
                            color: 'var(--cr-danger-700)',
                          }}
                          title={t('myAttendance.lateByTitle', { mins: lateMin })}
                        >
                          {t('myAttendance.lateBadge')}
                        </span>
                      )}
                    </span>
                    {record && (
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: meta?.token ?? 'var(--cr-text-3)' }}
                          />
                          <span
                            className="hidden truncate text-[10px] font-medium sm:inline"
                            style={{ color: meta?.token ?? 'var(--cr-text-3)' }}
                          >
                            {statusLabel(record.status)}
                          </span>
                        </span>
                        {(inTime || workedMin > 0) && (
                          <span className="hidden truncate text-[10px] leading-tight text-muted tabular-nums sm:block">
                            {inTime ?? ''}
                            {workedMin > 0 ? `${inTime ? ' · ' : ''}${fmtHm(workedMin)}` : ''}
                          </span>
                        )}
                      </span>
                    )}
                    {!record && holiday && (
                      <span className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-1">
                          <span
                            aria-hidden
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: meta?.token ?? 'var(--cr-text-3)' }}
                          />
                          <span
                            className="hidden truncate text-[10px] font-medium sm:inline"
                            style={{ color: meta?.token ?? 'var(--cr-text-3)' }}
                          >
                            {t('myAttendance.holiday')}
                          </span>
                        </span>
                        <span className="hidden truncate text-[10px] leading-tight text-muted sm:block">
                          {holiday.name}
                        </span>
                      </span>
                    )}
                  </>
                );
                if (interactive) {
                  return (
                    <button
                      key={iso}
                      type="button"
                      aria-label={`${baseLabel}, ${t('myAttendance.viewDayAria')}`}
                      onClick={() => setDayDetail({ date: iso, statusText })}
                      className={`${CELL_CLASS} cursor-pointer text-left transition-shadow hover:ring-2 hover:ring-[var(--cr-primary)]`}
                      style={cellStyle}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <div key={iso} aria-label={baseLabel} className={CELL_CLASS} style={cellStyle}>
                    {inner}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
              {(['present', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off'] as const).map(
                (s) => (
                  <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span
                      aria-hidden
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: STATUS_META[s].token }}
                    />
                    {statusLabel(s)}
                  </span>
                ),
              )}
            </div>
          </>
        )}
      </Card>

      {/* My correction requests - own regularization requests + status */}
      {canViewMyRequests && (
        <Card
          style={{
            background: 'var(--cr-surface, white)',
            border: '1px solid var(--cr-border-light)',
          }}
          styles={{ body: { padding: 20 } }}
        >
          <div className="mb-3 flex items-center gap-2">
            <FormOutlined style={{ color: 'var(--cr-text-3)' }} />
            <p className="m-0 text-[14px] font-semibold text-heading">
              {t('myAttendance.myRequestsTitle')}
            </p>
          </div>

          {loadingRequests ? (
            <Skeleton active paragraph={{ rows: 3 }} />
          ) : myRequests.length === 0 ? (
            <div
              className="rounded-lg px-3 py-2 text-[12px]"
              style={{ background: 'var(--cr-surface-2, var(--cr-bg))', color: 'var(--cr-text-3)' }}
            >
              {t('myAttendance.myRequestsEmpty')}
            </div>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-0 p-0">
              {myRequests.map((req) => {
                const tag = REQUEST_STATUS_META[req.status];
                const canCancel = req.status === 'pending' && req.currentLevel === 1;
                return (
                  <li
                    key={req._id}
                    className="flex items-center justify-between gap-3 border-0 border-b border-solid py-2.5 last:border-b-0"
                    style={{ borderColor: 'var(--cr-border-light)' }}
                  >
                    <div className="min-w-0">
                      <p className="m-0 text-[13px] font-medium text-heading">
                        {dayjs(req.date).format('DD MMM YYYY')}
                        <span className="text-muted">
                          {' '}
                          · {requestedStatusLabel(req.requestedStatus)}
                        </span>
                      </p>
                      {req.reason && (
                        <p className="m-0 truncate text-[12px] text-muted">{req.reason}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Tag color={tag.color} className="m-0">
                        {t(tag.labelKey)}
                      </Tag>
                      {canCancel && (
                        <Popconfirm
                          title={t('myAttendance.cancelRequestConfirm')}
                          okText={t('myAttendance.cancelRequest')}
                          cancelText={t('myAttendance.keepRequest')}
                          okButtonProps={{ danger: true, loading: cancellingId === req._id }}
                          onConfirm={() => handleCancelRequest(req._id)}
                        >
                          <Button size="small" danger>
                            {t('myAttendance.cancelRequest')}
                          </Button>
                        </Popconfirm>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {/* Day detail - tap a calendar cell to see that day's own sessions/times */}
      {dayDetail && currentWorkspaceId && (
        <MyDayDetailModal
          open
          wsId={currentWorkspaceId}
          date={dayDetail.date}
          statusText={dayDetail.statusText}
          canRaise={canRaiseRegularization}
          onClose={() => setDayDetail(null)}
          onRaiseCorrection={(day) => {
            setRegModal({
              date: dayDetail.date,
              currentStatus: dayDetail.statusText,
              original: day,
            });
            setDayDetail(null);
          }}
        />
      )}

      {/* Raise-correction modal - opened from the day-detail */}
      {regModal && data?.teamMemberId && (
        <RaiseRegularizationModal
          open
          memberId={data.teamMemberId}
          memberName={t('myAttendance.youLabel')}
          date={regModal.date}
          currentStatus={regModal.currentStatus}
          originalCheckIn={regModal.original?.checkIn ?? null}
          originalCheckOut={regModal.original?.checkOut ?? null}
          originalWorkedMinutes={regModal.original?.workedMinutes ?? null}
          onClose={() => setRegModal(null)}
          onSuccess={() => {
            void loadMonth();
            void loadMyRequests();
            void loadMyDay();
          }}
        />
      )}
    </div>
  );
}
