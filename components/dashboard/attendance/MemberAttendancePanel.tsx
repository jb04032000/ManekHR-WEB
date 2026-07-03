'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  LoginOutlined,
  LogoutOutlined,
  MinusOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsTag, STATUS_COLORS } from '@/components/ui';
import { attendanceApi } from '@/lib/api';
import { SOURCE_META } from '@/components/dashboard/attendance/SourceBadge';
import { computeMemberAttendanceSummary } from '@/components/dashboard/attendance/memberSummary';
import type {
  AttendanceRecord,
  AttendanceStatus,
  OvertimeAnalytics,
  PaginatedResponse,
  AttendanceEventSource,
} from '@/types';

// ── Props ──────────────────────────────────────────────────────────────────────

export interface MemberAttendancePanelProps {
  wsId: string;
  memberId: string;
  month: number;
  year: number;
  /**
   * 'full'    = summary tiles + status row + calendar + expanded stats + daily table.
   * 'compact' = summary tiles + status row only (for the Overview snapshot).
   * Default: 'full'.
   */
  variant?: 'full' | 'compact';
  /**
   * When provided, each day row in the full-variant table becomes clickable
   * and calls this handler with the record (or null if unmarked) and the
   * date ISO string (YYYY-MM-DD). When absent the table is read-only.
   */
  onDayClick?: (record: AttendanceRecord | null, dateIso: string) => void;
}

// ── Local helpers ─────────────────────────────────────────────────────────────

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  return dayjs(iso).format('hh:mm A');
}

function fmtHours(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return '-';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Converts total minutes-of-day (e.g. 9*60+30 = 570) to "09:30 AM". */
function toHHmm(mins: number | null): string {
  if (mins === null) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

// ── Stat mini-card ────────────────────────────────────────────────────────────

function StatMini({
  icon,
  label,
  value,
  colorStyle,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorStyle: CSSProperties;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-start justify-between">
        <div className="text-base" style={colorStyle}>
          {icon}
        </div>
        {badge}
      </div>
      <p className="m-0 text-[10px] font-semibold tracking-widest text-slate-600 uppercase">
        {label}
      </p>
      <p className="m-0 text-[20px] leading-tight font-bold" style={colorStyle}>
        {value}
      </p>
    </div>
  );
}

// ── Compact info row item ─────────────────────────────────────────────────────

function InfoItem({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-sm" style={{ color: 'var(--cr-text-4)' }}>
        {icon}
      </span>
      <span className="text-[11px] font-medium" style={{ color: 'var(--cr-text-3)' }}>
        {label}
      </span>
      <span
        className="ml-auto text-[12px] font-semibold"
        style={{ color: valueColor ?? 'var(--cr-text-1)' }}
      >
        {value}
      </span>
    </div>
  );
}

// ── Single-member month calendar ──────────────────────────────────────────────

// Short-form status characters (mirrors AttendanceMonthlyGrid's S_SHORT)
const S_SHORT: Partial<Record<AttendanceStatus, string>> = {
  present: 'P',
  absent: 'A',
  half_day: 'H',
  late: 'L',
  on_leave: 'OL',
  holiday: 'Ho',
  week_off: 'WO',
};

function MemberMonthCalendar({
  records,
  month,
  year,
}: {
  records: AttendanceRecord[];
  month: number;
  year: number;
}) {
  // Build a date->record map for O(1) lookup
  const recMap = useMemo(() => {
    const m: Record<string, AttendanceRecord> = {};
    for (const r of records) {
      m[r.date.slice(0, 10)] = r;
    }
    return m;
  }, [records]);

  const firstOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const daysInMonth = firstOfMonth.daysInMonth();
  // 0=Sun, startDow is the day-of-week for the 1st (0-6)
  const startDow = firstOfMonth.day();

  // Build calendar rows (weeks)
  const cells: Array<number | null> = [
    ...Array.from<null>({ length: startDow }).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: Array<Array<number | null>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7) as Array<number | null>);
  }

  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3" style={{ overflowX: 'auto' }}>
      {/* Day-of-week header */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 2,
          marginBottom: 4,
        }}
      >
        {DOW_LABELS.map((d, i) => (
          <div
            key={d}
            style={{
              textAlign: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: i === 0 || i === 6 ? 'var(--cr-text-4)' : 'var(--cr-text-3)',
              padding: '2px 0',
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {weeks.map((week, wi) => (
        <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {week.map((day, di) => {
            if (!day) {
              return <div key={di} style={{ height: 40 }} />;
            }
            const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const rec = recMap[dateKey];
            const status = rec?.status;
            const c = status ? (STATUS_COLORS[status] ?? STATUS_COLORS.unmarked) : null;
            const isWeekend = di === 0 || di === 6;
            const isToday = dateKey === dayjs().format('YYYY-MM-DD');

            const cell = (
              <div
                style={{
                  height: 40,
                  borderRadius: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: c ? c.bg : isWeekend ? 'var(--cr-surface-2)' : 'transparent',
                  border: isToday
                    ? '2px solid var(--cr-primary, #4f46e5)'
                    : '1px solid transparent',
                  cursor: rec ? 'pointer' : 'default',
                  gap: 1,
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: isToday ? 800 : 600,
                    color: c ? c.text : isWeekend ? 'var(--cr-text-4)' : 'var(--cr-text-2)',
                  }}
                >
                  {day}
                </span>
                {status && (
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 700,
                      color: c ? c.text : 'var(--cr-text-4)',
                      lineHeight: 1,
                    }}
                  >
                    {S_SHORT[status] ?? '?'}
                  </span>
                )}
              </div>
            );

            if (rec) {
              const tipParts: string[] = [status ? (STATUS_LABELS[status] ?? status) : ''];
              if (rec.checkIn) tipParts.push(`In: ${fmtTime(rec.checkIn)}`);
              if (rec.checkOut) tipParts.push(`Out: ${fmtTime(rec.checkOut)}`);
              if (rec.lateMinutes && rec.lateMinutes > 0)
                tipParts.push(`Late: +${Math.round(rec.lateMinutes)}m`);
              if (rec.earlyMinutes && rec.earlyMinutes > 0)
                tipParts.push(`Early out: -${Math.round(rec.earlyMinutes)}m`);
              return (
                <Tooltip key={dateKey} title={tipParts.filter(Boolean).join(' | ')}>
                  {cell}
                </Tooltip>
              );
            }
            return <div key={dateKey}>{cell}</div>;
          })}
        </div>
      ))}

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginTop: 10,
          paddingTop: 8,
          borderTop: '1px solid var(--cr-border-light)',
        }}
      >
        {(Object.entries(S_SHORT) as Array<[AttendanceStatus, string]>).map(([st, short]) => {
          const c = STATUS_COLORS[st] ?? STATUS_COLORS.unmarked;
          return (
            <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: c.bg,
                  color: c.text,
                  fontSize: 8,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {short}
              </span>
              <span style={{ fontSize: 10, color: 'var(--cr-text-3)' }}>{STATUS_LABELS[st]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  late: 'Late',
  on_leave: 'On Leave',
  holiday: 'Holiday',
  week_off: 'Week Off',
};

// ── Component ──────────────────────────────────────────────────────────────────

export function MemberAttendancePanel({
  wsId,
  memberId,
  month,
  year,
  variant = 'full',
  onDayClick,
}: MemberAttendancePanelProps) {
  const t = useTranslations('attendance.memberReport');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Full-variant-only state
  const [otMinutes, setOtMinutes] = useState<number | null>(null);
  const [prevRate, setPrevRate] = useState<number | null>(null);

  // Inline-async-IIFE w/ cancel flag - identical pattern to MemberReportDrawer.
  useEffect(() => {
    if (!wsId || !memberId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await attendanceApi.list(wsId, {
          filters: JSON.stringify({ memberId }),
          month,
          year,
          limit: 100,
        });
        if (cancelled) return;
        const arr = Array.isArray(res)
          ? res
          : ((res as PaginatedResponse<AttendanceRecord>).data ?? []);
        setRecords(arr);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, memberId, month, year]);

  // Full variant: fetch overtime analytics (non-blocking)
  useEffect(() => {
    if (variant !== 'full' || !wsId || !memberId) return;
    let cancelled = false;
    void (async () => {
      try {
        const ot: OvertimeAnalytics = await attendanceApi.overtimeAnalytics(wsId, month, year);
        if (cancelled) return;
        const memberEntry = ot.byMember.find((m) => m.memberId === memberId);
        setOtMinutes(memberEntry?.otMinutes ?? null);
      } catch {
        // non-blocking - leave as null (will show dash)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant, wsId, memberId, month, year]);

  // Full variant: fetch previous month records for vs-last-month comparison (non-blocking)
  useEffect(() => {
    if (variant !== 'full' || !wsId || !memberId) return;
    let cancelled = false;
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    void (async () => {
      try {
        const res = await attendanceApi.list(wsId, {
          filters: JSON.stringify({ memberId }),
          month: prevMonth,
          year: prevYear,
          limit: 100,
        });
        if (cancelled) return;
        const arr = Array.isArray(res)
          ? res
          : ((res as PaginatedResponse<AttendanceRecord>).data ?? []);
        const prevSummary = computeMemberAttendanceSummary(arr);
        setPrevRate(prevSummary.rate);
      } catch {
        // non-blocking - leave as null (chip just won't appear)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [variant, wsId, memberId, month, year]);

  // ── Summary stats ─────────────────────────────────────────────────────────────

  const summary = useMemo(() => {
    const base = computeMemberAttendanceSummary(records);

    const checkIns: number[] = [];
    const checkOuts: number[] = [];
    let lateCount = 0;
    let lateTotalMinutes = 0;
    let earlyCount = 0;
    let earlyTotalMinutes = 0;
    let weekOffDays = 0;
    let holidayDays = 0;

    for (const r of records) {
      if (r.checkIn) {
        checkIns.push(dayjs(r.checkIn).hour() * 60 + dayjs(r.checkIn).minute());
      }
      if (r.checkOut) {
        checkOuts.push(dayjs(r.checkOut).hour() * 60 + dayjs(r.checkOut).minute());
      }
      if (r.lateMinutes && r.lateMinutes > 0) {
        lateCount++;
        lateTotalMinutes += r.lateMinutes;
      }
      if (r.earlyMinutes && r.earlyMinutes > 0) {
        earlyCount++;
        earlyTotalMinutes += r.earlyMinutes;
      }
      if (r.status === 'week_off') weekOffDays++;
      if (r.status === 'holiday') holidayDays++;
    }

    const avgCheckInMinutes =
      checkIns.length > 0
        ? Math.round(checkIns.reduce((a, b) => a + b, 0) / checkIns.length)
        : null;

    const avgCheckOutMinutes =
      checkOuts.length > 0
        ? Math.round(checkOuts.reduce((a, b) => a + b, 0) / checkOuts.length)
        : null;

    return {
      ...base,
      avgCheckIn: toHHmm(avgCheckInMinutes),
      avgCheckOut: toHHmm(avgCheckOutMinutes),
      lateCount,
      lateTotalMinutes: Math.round(lateTotalMinutes),
      earlyCount,
      earlyTotalMinutes: Math.round(earlyTotalMinutes),
      weekOffDays,
      holidayDays,
    };
  }, [records]);

  // ── Sorted records for daily table ────────────────────────────────────────────

  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [records],
  );

  // ── vs last month delta chip ──────────────────────────────────────────────────

  const vsLastMonthChip = useMemo(() => {
    if (prevRate === null) return null;
    const delta = summary.rate - prevRate;
    if (delta > 0) {
      return (
        <span
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold"
          style={{ background: STATUS_COLORS.present.bg, color: STATUS_COLORS.present.text }}
        >
          <ArrowUpOutlined style={{ fontSize: 8 }} />+{delta}%
        </span>
      );
    }
    if (delta < 0) {
      return (
        <span
          className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold"
          style={{ background: STATUS_COLORS.absent.bg, color: STATUS_COLORS.absent.text }}
        >
          <ArrowDownOutlined style={{ fontSize: 8 }} />
          {delta}%
        </span>
      );
    }
    return (
      <span
        className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold"
        style={{ background: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' }}
      >
        <MinusOutlined style={{ fontSize: 8 }} />
        0%
      </span>
    );
  }, [prevRate, summary.rate]);

  // ── Daily table columns ──────────────────────────────────────────────────────

  const columns: ColumnsType<AttendanceRecord> = [
    {
      title: t('colDate'),
      key: 'date',
      width: onDayClick ? 150 : 110,
      render: (_, r) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="m-0 text-[13px] font-semibold" style={{ color: 'var(--cr-text-1)' }}>
              {dayjs(r.date).format('DD MMM YYYY')}
            </p>
            <p className="m-0 text-[11px]" style={{ color: 'var(--cr-text-3)' }}>
              {dayjs(r.date).format('ddd')}
            </p>
          </div>
          {onDayClick && (
            <span
              className="ml-auto text-[11px] text-blue-500 hover:text-blue-700"
              style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
              onClick={(e) => {
                e.stopPropagation();
                onDayClick(r, r.date.slice(0, 10));
              }}
            >
              Edit
            </span>
          )}
        </div>
      ),
    },
    {
      title: t('colStatus'),
      key: 'status',
      width: 100,
      render: (_, r) => (
        <DsTag
          status={r.status}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          label={t(`statusLabel.${r.status}` as any)}
          className="text-[11px]"
        />
      ),
    },
    {
      title: t('colCheckIn'),
      key: 'ci',
      width: 90,
      render: (_, r) => (
        <span
          className="text-[12px]"
          style={
            r.lateMinutes && r.lateMinutes > 0
              ? { fontWeight: 600, color: STATUS_COLORS.late.text }
              : { color: 'var(--cr-text-3)' }
          }
        >
          {fmtTime(r.checkIn)}
          {r.lateMinutes && r.lateMinutes > 0 ? (
            <span className="ml-1 text-[10px]" style={{ color: STATUS_COLORS.late.text }}>
              (+{Math.round(r.lateMinutes)}m)
            </span>
          ) : null}
        </span>
      ),
    },
    {
      title: t('colCheckOut'),
      key: 'co',
      width: 90,
      render: (_, r) => (
        <span className="text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
          {fmtTime(r.checkOut)}
        </span>
      ),
    },
    {
      title: t('colHours'),
      key: 'hrs',
      width: 75,
      render: (_, r) => (
        <span className="text-[12px] font-medium" style={{ color: 'var(--cr-text-1)' }}>
          {fmtHours(r.workedMinutes)}
        </span>
      ),
    },
    {
      title: t('colSource'),
      key: 'src',
      width: 110,
      render: (_, r) => {
        const src = r.dominantSource as AttendanceEventSource | undefined;
        const meta = src ? SOURCE_META[src] : null;
        if (!meta)
          return (
            <span className="text-[11px]" style={{ color: 'var(--cr-text-5)' }}>
              -
            </span>
          );
        return (
          <Tooltip title={meta.label}>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: 'var(--cr-text-3)' }}>
                {meta.icon}
              </span>
              <span className="text-[11px]" style={{ color: 'var(--cr-text-3)' }}>
                {meta.label}
              </span>
            </div>
          </Tooltip>
        );
      },
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton active paragraph={{ rows: 2 }} />
        {variant === 'full' && <Skeleton active paragraph={{ rows: 8 }} />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary stat cards - 2-up on phones (4 cards at ~85px each were cramped), 4-up from sm. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatMini
          icon={<CheckCircleOutlined />}
          label={t('attendance')}
          value={`${summary.rate}%`}
          colorStyle={{
            color:
              summary.rate >= 80
                ? STATUS_COLORS.present.text
                : summary.rate >= 60
                  ? STATUS_COLORS.late.text
                  : STATUS_COLORS.absent.text,
          }}
          badge={variant === 'full' ? vsLastMonthChip : undefined}
        />
        <StatMini
          icon={<FieldTimeOutlined />}
          label={t('hoursWorked')}
          value={fmtHours(summary.totalMinutes)}
          colorStyle={{ color: 'var(--cr-info-700, var(--cr-info-500))' }}
        />
        <StatMini
          icon={<ClockCircleOutlined />}
          label={t('avgCheckIn')}
          value={summary.avgCheckIn}
          colorStyle={{ color: 'var(--cr-text-2)' }}
        />
        <StatMini
          icon={<ExclamationCircleOutlined />}
          label={t('lateDays')}
          value={String(summary.lateDays)}
          colorStyle={{
            color: summary.lateDays > 0 ? STATUS_COLORS.late.text : 'var(--cr-text-3)',
          }}
        />
      </div>

      {/* Status breakdown row */}
      <div className="flex flex-wrap gap-3">
        {(
          [
            { key: 'present', label: t('breakdown.present'), value: summary.presentDays },
            { key: 'absent', label: t('breakdown.absent'), value: summary.absentDays },
            { key: 'half_day', label: t('breakdown.halfDay'), value: summary.halfDays },
            { key: 'on_leave', label: t('breakdown.onLeave'), value: summary.leaveDays },
          ] as const
        ).map((s) => (
          <div
            key={s.key}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5"
            style={{
              background: STATUS_COLORS[s.key].bg,
              color: STATUS_COLORS[s.key].text,
            }}
          >
            <span className="text-[18px] font-bold">{s.value}</span>
            <span className="text-[11px] font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Full variant - expanded stats + calendar + daily table */}
      {variant === 'full' && (
        <>
          {/* Expanded secondary stats */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <InfoItem
              icon={<LoginOutlined />}
              label={t('avgCheckOut')}
              value={summary.avgCheckOut}
            />
            <InfoItem
              icon={<LogoutOutlined />}
              label={t('lateArrivals')}
              value={
                summary.lateCount > 0 ? `${summary.lateCount} (+${summary.lateTotalMinutes}m)` : '0'
              }
              valueColor={summary.lateCount > 0 ? STATUS_COLORS.late.text : 'var(--cr-text-3)'}
            />
            <InfoItem
              icon={<ClockCircleOutlined />}
              label={t('earlyDepartures')}
              value={
                summary.earlyCount > 0
                  ? `${summary.earlyCount} (-${summary.earlyTotalMinutes}m)`
                  : '0'
              }
              valueColor={summary.earlyCount > 0 ? STATUS_COLORS.late.text : 'var(--cr-text-3)'}
            />
            <InfoItem
              icon={<ThunderboltOutlined />}
              label={t('overtime')}
              value={otMinutes !== null && otMinutes > 0 ? fmtHours(otMinutes) : '-'}
              valueColor={
                otMinutes !== null && otMinutes > 0
                  ? 'var(--cr-info-700, var(--cr-info-500))'
                  : 'var(--cr-text-3)'
              }
            />
            {summary.weekOffDays > 0 && (
              <InfoItem
                icon={<MinusOutlined />}
                label={t('weekOff')}
                value={String(summary.weekOffDays)}
                valueColor={STATUS_COLORS.week_off?.text ?? 'var(--cr-text-3)'}
              />
            )}
            {summary.holidayDays > 0 && (
              <InfoItem
                icon={<CheckCircleOutlined />}
                label={t('holidays')}
                value={String(summary.holidayDays)}
                valueColor={STATUS_COLORS.holiday?.text ?? 'var(--cr-text-3)'}
              />
            )}
          </div>

          {/* Month calendar */}
          <MemberMonthCalendar records={records} month={month} year={year} />

          {/* Day-by-day table */}
          {sortedRecords.length === 0 ? (
            <div className="py-10 text-center text-slate-300">{t('noRecords')}</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-100">
              <Table<AttendanceRecord>
                dataSource={sortedRecords}
                columns={columns}
                rowKey="_id"
                size="small"
                pagination={false}
                scroll={{ x: 550 }}
                onRow={
                  onDayClick
                    ? (r) => ({
                        style: { cursor: 'pointer' },
                        onClick: () => onDayClick(r, r.date.slice(0, 10)),
                      })
                    : undefined
                }
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
