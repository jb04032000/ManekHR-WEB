'use client';
import { useMemo } from 'react';
import { Tooltip, Skeleton } from 'antd';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsAvatar, STATUS_COLORS } from '@/components/ui';
import type { TeamMember, AttendanceRecord, Holiday, AttendanceStatus } from '@/types';
import { SOURCE_META } from './SourceBadge';

// ── Short-form status characters ──────────────────────────────────────────────

const S_SHORT: Record<string, string> = {
  present: 'P',
  absent: 'A',
  half_day: 'H',
  late: 'L',
  on_leave: 'OL',
  holiday: 'Ho',
  week_off: 'WO',
  unmarked: '-',
};

// ── Tooltip helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  absent: 'Absent',
  half_day: 'Half Day',
  late: 'Late',
  on_leave: 'Leave',
  holiday: 'Holiday',
  week_off: 'Week Off',
};

const NO_PUNCH_STATUSES: AttendanceStatus[] = ['holiday', 'week_off'];

function buildCellTooltip(
  status: AttendanceStatus,
  checkIn?: string,
  checkOut?: string,
  dominantSource?: string | null,
  isLocked?: boolean,
  isOvernight?: boolean,
): string {
  const label = STATUS_LABEL[status] ?? String(status);
  if (NO_PUNCH_STATUSES.includes(status)) return label;
  const segments: string[] = [];
  if (checkIn) segments.push(`IN ${dayjs(checkIn).format('hh:mm A')}`);
  if (checkOut)
    segments.push(`OUT ${dayjs(checkOut).format('hh:mm A')}${isOvernight ? ' (+1)' : ''}`);
  const timeStr = segments.length ? ` - ${segments.join(' / ')}` : '';
  const sourceLabel = dominantSource
    ? SOURCE_META[dominantSource as keyof typeof SOURCE_META]?.label
    : null;
  const sourceSuffix = sourceLabel ? ` · ${sourceLabel}` : '';
  const lockSuffix = isLocked ? ' 🔒 Locked - payroll generated' : '';
  const overnightSuffix = isOvernight ? ' · Overnight shift' : '';
  return `${label}${timeStr}${sourceSuffix}${overnightSuffix}${lockSuffix}`;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface AttendanceMonthlyGridProps {
  members: TeamMember[];
  records: AttendanceRecord[];
  month: number;
  year: number;
  loading: boolean;
  holidays: Holiday[];
  onCellClick: (member: TeamMember, date: string) => void;
  search: string;
  statusFilter: string | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AttendanceMonthlyGrid({
  members,
  records,
  month,
  year,
  loading,
  onCellClick,
  search,
  statusFilter,
}: AttendanceMonthlyGridProps) {
  const t = useTranslations('attendance');

  const daysInMonth = dayjs(`${year}-${month}-01`).daysInMonth();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Memoize the member × day attendance map - avoids O(n*m) recompute every render
  const monthlyMap = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    records.forEach((r) => {
      const mid =
        typeof r.teamMemberId === 'string'
          ? r.teamMemberId
          : (r.teamMemberId as { _id: string })._id;
      const d = r.date?.slice(0, 10);
      if (!mid || !d) return;
      if (!map[mid]) map[mid] = {};
      map[mid][d] = r.status;
    });
    return map;
  }, [records]);

  // Memoize punch times + source + lock per member × day for tooltip display
  const punchMap = useMemo(() => {
    const map: Record<
      string,
      Record<
        string,
        {
          checkIn?: string;
          checkOut?: string;
          dominantSource?: string | null;
          isLocked?: boolean;
          isOvernight?: boolean;
        }
      >
    > = {};
    records.forEach((r) => {
      const mid =
        typeof r.teamMemberId === 'string'
          ? r.teamMemberId
          : (r.teamMemberId as { _id: string })._id;
      const d = r.date?.slice(0, 10);
      if (!mid || !d) return;
      if (!map[mid]) map[mid] = {};
      map[mid][d] = {
        checkIn: r.checkIn ?? undefined,
        checkOut: r.checkOut ?? undefined,
        dominantSource: r.dominantSource ?? null,
        isLocked: r.isLocked,
        isOvernight: !!(r.checkOut && r.checkOut.slice(0, 10) > d),
      };
    });
    return map;
  }, [records]);

  // Filter members by search + status
  const filteredMembers = useMemo(
    () =>
      members.filter((m) => {
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!m.name.toLowerCase().includes(q) && !m.designation?.toLowerCase().includes(q))
            return false;
        }
        if (statusFilter) {
          // For monthly view, filter members who have at least one record matching the status
          const memberRecs = monthlyMap[m.id] ?? {};
          const hasStatus = Object.values(memberRecs).some((s) => s === statusFilter);
          if (!hasStatus) return false;
        }
        return true;
      }),
    [members, search, statusFilter, monthlyMap],
  );

  if (loading) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th
                style={{
                  position: 'sticky',
                  left: 0,
                  background: 'var(--cr-surface-2)',
                  padding: '8px 14px',
                  textAlign: 'left',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--cr-text-3)',
                  borderBottom: '2px solid var(--cr-border)',
                  minWidth: 160,
                  zIndex: 2,
                }}
              >
                {t('employee')}
              </th>
              {allDays.map((d) => (
                <th
                  key={d}
                  style={{
                    padding: '6px 4px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: 'var(--cr-text-3)',
                    borderBottom: '2px solid var(--cr-border)',
                    minWidth: 28,
                    background: 'var(--cr-surface-2)',
                  }}
                >
                  {d}
                </th>
              ))}
              <th
                style={{
                  padding: '8px 10px',
                  textAlign: 'center',
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  color: 'var(--cr-text-3)',
                  borderBottom: '2px solid var(--cr-border)',
                  minWidth: 80,
                  background: 'var(--cr-surface-2)',
                }}
              >
                {t('summary')}
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, ri) => (
              <tr key={ri}>
                <td
                  style={{ padding: '8px 14px', borderBottom: '1px solid var(--cr-border-light)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Skeleton.Avatar active size={26} shape="circle" />
                    <Skeleton.Button active style={{ width: 100, height: 13 }} />
                  </div>
                </td>
                {allDays.map((d) => (
                  <td
                    key={d}
                    style={{
                      padding: '4px 2px',
                      textAlign: 'center',
                      borderBottom: '1px solid var(--cr-border-light)',
                    }}
                  >
                    <Skeleton.Button
                      active
                      style={{ width: 22, height: 22, minWidth: 22, borderRadius: 5 }}
                    />
                  </td>
                ))}
                <td
                  style={{
                    padding: '6px 10px',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--cr-border-light)',
                  }}
                >
                  <Skeleton.Button active style={{ width: 48, height: 13 }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    // Scroll containment (rule 11): only this region scrolls (both axes), the
    // page stays put. Sticky header + sticky first column keep context visible.
    <div style={{ maxHeight: 'calc(100vh - 340px)', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr>
            <th
              style={{
                position: 'sticky',
                left: 0,
                top: 0,
                background: 'var(--cr-surface-2)',
                padding: '8px 14px',
                textAlign: 'left',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--cr-text-3)',
                borderBottom: '2px solid var(--cr-border)',
                minWidth: 160,
                // Corner cell sits above both the sticky header row and the
                // sticky body column, so it needs the highest stack index.
                zIndex: 4,
              }}
            >
              {t('employee')}
            </th>
            {allDays.map((d) => {
              const dow = dayjs(
                `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
              ).day();
              const isWeekend = dow === 0 || dow === 6;
              return (
                <th
                  key={d}
                  style={{
                    position: 'sticky',
                    top: 0,
                    padding: '6px 4px',
                    textAlign: 'center',
                    fontWeight: 700,
                    color: isWeekend ? 'var(--cr-text-4)' : 'var(--cr-text-3)',
                    borderBottom: '2px solid var(--cr-border)',
                    minWidth: 28,
                    background: 'var(--cr-surface-2)',
                    zIndex: 3,
                  }}
                >
                  <div>{d}</div>
                  <div style={{ fontSize: 9, fontWeight: 400, color: 'var(--cr-text-5)' }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'][dow]}
                  </div>
                </th>
              );
            })}
            <th
              style={{
                position: 'sticky',
                top: 0,
                padding: '8px 10px',
                textAlign: 'center',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                color: 'var(--cr-text-3)',
                borderBottom: '2px solid var(--cr-border)',
                minWidth: 80,
                background: 'var(--cr-surface-2)',
                zIndex: 3,
              }}
            >
              {t('summary')}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((m, ri) => {
            const mRecs = monthlyMap[m.id] ?? {};
            const mPunches = punchMap[m.id] ?? {};
            const presentCount = Object.values(mRecs).filter(
              (s) => s === 'present' || s === 'late',
            ).length;
            const absentCount = Object.values(mRecs).filter((s) => s === 'absent').length;
            const rowBg = ri % 2 === 0 ? 'var(--cr-surface)' : 'var(--cr-surface-2)';

            return (
              <tr key={m.id} style={{ background: rowBg }}>
                <td
                  style={{
                    position: 'sticky',
                    left: 0,
                    background: rowBg,
                    padding: '8px 14px',
                    borderBottom: '1px solid var(--cr-border-light)',
                    zIndex: 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <DsAvatar name={m.name} size={26} />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--cr-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.name}
                    </span>
                  </div>
                </td>
                {allDays.map((d) => {
                  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  const rawStatus = mRecs[dateKey];
                  // Week-off fill: a day with no explicit record is shown as WO when
                  // it's a Sunday (always a week-off per product rule) or falls on
                  // one of the member's configured weeklyOff days. An explicit
                  // record always wins (someone who worked a Sunday shows Present).
                  const dow = dayjs(dateKey).day(); // 0 = Sun
                  const abbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow];
                  const isWeekOff = dow === 0 || (m.weeklyOff ?? []).includes(abbr);
                  const status = rawStatus ?? (isWeekOff ? 'week_off' : 'unmarked');
                  const c = STATUS_COLORS[status] ?? STATUS_COLORS.unmarked;
                  const punch = mPunches[dateKey];
                  // Future days can't be marked — the cell is shown dimmed and is
                  // not clickable (backend also rejects future marks).
                  const isFuture = dayjs(dateKey).isAfter(dayjs(), 'day');
                  const cell = (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: c.bg,
                        color: c.text,
                        fontSize: 9,
                        fontWeight: 700,
                        cursor: isFuture ? 'default' : 'pointer',
                        opacity: isFuture ? 0.4 : 1,
                        position: 'relative',
                      }}
                      onClick={() => {
                        if (!isFuture) onCellClick(m, dateKey);
                      }}
                    >
                      {S_SHORT[status] ?? '-'}
                      {punch?.isOvernight && (
                        <sup
                          style={{
                            position: 'absolute',
                            top: -3,
                            right: -4,
                            color: 'var(--cr-indigo-400)',
                            fontWeight: 700,
                            fontSize: '0.6em',
                            lineHeight: 1,
                          }}
                        >
                          +1
                        </sup>
                      )}
                    </span>
                  );
                  return (
                    <td
                      key={d}
                      style={{
                        padding: '4px 2px',
                        textAlign: 'center',
                        borderBottom: '1px solid var(--cr-border-light)',
                      }}
                    >
                      {rawStatus ? (
                        <Tooltip
                          title={buildCellTooltip(
                            rawStatus as AttendanceStatus,
                            punch?.checkIn,
                            punch?.checkOut,
                            punch?.dominantSource,
                            punch?.isLocked,
                            punch?.isOvernight,
                          )}
                        >
                          {cell}
                        </Tooltip>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
                <td
                  style={{
                    padding: '6px 10px',
                    textAlign: 'center',
                    borderBottom: '1px solid var(--cr-border-light)',
                  }}
                >
                  <div style={{ fontSize: 11 }}>
                    <span style={{ color: STATUS_COLORS.present.text, fontWeight: 700 }}>
                      {presentCount}P
                    </span>
                    {' / '}
                    <span style={{ color: STATUS_COLORS.absent.text, fontWeight: 700 }}>
                      {absentCount}A
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          padding: '12px 0 4px',
          marginTop: 8,
          borderTop: '1px solid var(--cr-border-light)',
        }}
      >
        {Object.entries(S_SHORT).map(([status, short]) => {
          const c = STATUS_COLORS[status] ?? STATUS_COLORS.unmarked;
          return (
            <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  background: c.bg,
                  color: c.text,
                  fontSize: 9,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {short}
              </span>
              <span
                style={{ fontSize: 11, color: 'var(--cr-text-3)', textTransform: 'capitalize' }}
              >
                {status.replace(/_/g, ' ')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
