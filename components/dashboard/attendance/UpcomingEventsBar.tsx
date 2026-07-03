'use client';

import { useMemo } from 'react';
import { Tooltip } from 'antd';
import { CalendarOutlined, GiftOutlined, ArrowRightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import Link from 'next/link';
import type { TeamMember, AttendanceRecord, UpcomingLeaveEntry } from '@/types';
import { DsAvatar } from '@/components/ui';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Holiday {
  _id: string;
  name: string;
  date: string;
  type: string; // 'national' | 'festival' | 'company' | 'other'
}

interface Props {
  holidays: Holiday[];
  members: TeamMember[];
  records: AttendanceRecord[];
  /**
   * Upcoming leave entries for a 7-day window from today, fetched from the backend.
   * When provided, these replace the records-derived on-leave chips and show
   * multi-day / future leave context. Falls back to records-derived data when absent.
   */
  upcomingLeaves?: UpcomingLeaveEntry[];
  /** Selected date in YYYY-MM-DD format */
  date: string;
  /** Called when user clicks an on-leave chip - parent can set status filter */
  onLeaveClick?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const HOLIDAY_COLORS: Record<string, string> = {
  national: 'var(--cr-info-700)',
  festival: 'var(--cr-warning-500)',
  company: 'var(--cr-success-500)',
  other: 'var(--cr-text-4)',
};

/** Max individual on-leave chips before collapsing into "+N more" */
const MAX_LEAVE_VISIBLE = 4;

/** How many days ahead to look for birthdays (from today, not selected date) */
const BIRTHDAY_LOOKAHEAD_DAYS = 7;

/** How many days ahead to look for holidays (from selected date) */
const HOLIDAY_LOOKAHEAD_DAYS = 30;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function UpcomingEventsBar({
  holidays,
  members,
  records,
  upcomingLeaves,
  date,
  onLeaveClick,
}: Props) {
  const today = useMemo(() => dayjs().startOf('day'), []);
  const selectedDate = useMemo(() => dayjs(date).startOf('day'), [date]);

  // ── On Leave ─────────────────────────────────────────────────────────────────
  // Prefer `upcomingLeaves` from the API (7-day window, multi-day context).
  // Fall back to deriving from `records` (today's on_leave only) while the
  // API response hasn't arrived yet.
  const leaveChips = useMemo(() => {
    if (upcomingLeaves && upcomingLeaves.length > 0) {
      // Sort: today's leave first, then by firstDate ascending
      return [...upcomingLeaves].sort(
        (a, b) => dayjs(a.firstDate).valueOf() - dayjs(b.firstDate).valueOf(),
      );
    }
    // Fallback: build minimal entries from today's attendance records
    const leaveIds = new Set(
      records
        .filter((r) => r.status === 'on_leave')
        .map((r) => (typeof r.teamMemberId === 'string' ? r.teamMemberId : r.teamMemberId._id)),
    );
    return members
      .filter((m) => leaveIds.has(m.id))
      .map((m) => ({
        memberId: m.id,
        memberName: m.name,
        firstDate: date,
        lastDate: date,
        totalDays: 1,
      }));
  }, [upcomingLeaves, records, members, date]);

  // ── Upcoming Holidays - from selected date, within lookahead window, top 5 ──
  const upcomingHolidays = useMemo(
    () =>
      holidays
        .map((h) => ({ ...h, d: dayjs(h.date).startOf('day') }))
        .filter(
          (h) =>
            (h.d.isSame(selectedDate, 'day') || h.d.isAfter(selectedDate, 'day')) &&
            h.d.diff(selectedDate, 'day') <= HOLIDAY_LOOKAHEAD_DAYS,
        )
        .sort((a, b) => a.d.valueOf() - b.d.valueOf())
        .slice(0, 5),
    [holidays, selectedDate],
  );

  // ── Birthdays - active members with birthday in today → today+7 ────────────
  // Birthdays are always relative to TODAY, not the selected date, because
  // they're real-world events regardless of which attendance date you're viewing.
  const upcomingBirthdays = useMemo(() => {
    return members
      .filter((m) => m.dateOfBirth && m.isActive && !m.isDeleted)
      .map((m) => {
        const dob = dayjs(m.dateOfBirth);
        let bday = dob.year(today.year()).startOf('day');
        // If this year's birthday already passed, roll to next year
        if (bday.isBefore(today, 'day')) bday = bday.add(1, 'year');
        return { member: m, bday, daysUntil: bday.diff(today, 'day') };
      })
      .filter((b) => b.daysUntil >= 0 && b.daysUntil <= BIRTHDAY_LOOKAHEAD_DAYS)
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [members, today]);

  const hasEvents =
    upcomingHolidays.length > 0 || upcomingBirthdays.length > 0 || leaveChips.length > 0;

  if (!hasEvents) return null;

  const visibleLeave = leaveChips.slice(0, MAX_LEAVE_VISIBLE);
  const overflowCount = leaveChips.length - MAX_LEAVE_VISIBLE;

  return (
    <div className="mb-3">
      <div
        className="overflow-x-auto"
        style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--cr-border) transparent' }}
      >
        <div className="flex items-center gap-2 pb-0.5" style={{ minWidth: 'max-content' }}>
          {/* ── Section label ─────────────────────────────────────────────── */}
          <span className="mr-0.5 shrink-0 text-[10px] font-bold tracking-widest text-faint uppercase select-none">
            Upcoming
          </span>

          {/* ── Holidays ──────────────────────────────────────────────────── */}
          {upcomingHolidays.map((h) => {
            const daysUntil = h.d.diff(today, 'day');
            const isHToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;
            const color = HOLIDAY_COLORS[h.type] ?? HOLIDAY_COLORS.other;
            const badge = isHToday ? 'Today' : isTomorrow ? 'Tomorrow' : `in ${daysUntil}d`;

            return (
              <Tooltip
                key={h._id}
                title={`${h.type.charAt(0).toUpperCase() + h.type.slice(1)} Holiday`}
                placement="bottom"
              >
                <div
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs select-none"
                  style={{
                    background: `${color}12`,
                    border: `1px solid ${color}28`,
                    borderLeft: `3px solid ${color}`,
                  }}
                >
                  <CalendarOutlined style={{ fontSize: 11, color, flexShrink: 0 }} />
                  <span className="font-semibold" style={{ color }}>
                    {h.name}
                  </span>
                  <span style={{ color: 'var(--cr-neutral-300)' }}>·</span>
                  <span style={{ color: 'var(--cr-text-5)', fontSize: 11 }}>
                    {h.d.format('MMM D')}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: isHToday ? color : `${color}20`,
                      color: isHToday ? '#fff' : color,
                    }}
                  >
                    {badge}
                  </span>
                </div>
              </Tooltip>
            );
          })}

          {/* ── Birthdays ─────────────────────────────────────────────────── */}
          {upcomingBirthdays.map(({ member, bday, daysUntil }) => {
            const isBToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;
            const badge = isBToday ? '🎂 Today!' : isTomorrow ? 'Tomorrow' : `in ${daysUntil}d`;

            return (
              <Tooltip
                key={member.id}
                title={`${member.name}'s birthday · ${bday.format('MMMM D')}`}
                placement="bottom"
              >
                <div
                  className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs select-none"
                  style={{
                    background: 'var(--cr-indigo-50)',
                    border: '1px solid var(--cr-indigo-50)',
                    borderLeft: '3px solid var(--cr-indigo-400)',
                  }}
                >
                  <GiftOutlined
                    style={{ fontSize: 11, color: 'var(--cr-indigo-400)', flexShrink: 0 }}
                  />
                  <DsAvatar name={member.name} size={18} />
                  <span className="font-semibold" style={{ color: 'var(--cr-primary-hover)' }}>
                    {member.name.split(' ')[0]}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: isBToday ? 'var(--cr-indigo-400)' : 'var(--cr-indigo-50)',
                      color: isBToday ? '#fff' : 'var(--cr-indigo-400)',
                    }}
                  >
                    {badge}
                  </span>
                </div>
              </Tooltip>
            );
          })}

          {/* ── On Leave ──────────────────────────────────────────────────── */}
          {visibleLeave.map((entry) => {
            const first = dayjs(entry.firstDate);
            const last = dayjs(entry.lastDate);
            const daysUntil = first.diff(today, 'day');
            const isLToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;
            const isMultiDay = entry.totalDays > 1;
            const badge = isLToday ? 'Today' : isTomorrow ? 'Tomorrow' : first.format('MMM D');
            const tooltipText = isMultiDay
              ? `${entry.memberName} · On Leave · ${first.format('MMM D')} – ${last.format('MMM D')} (${entry.totalDays}d)`
              : `${entry.memberName} · On Leave · ${first.format('MMM D')}`;

            return (
              <Tooltip key={entry.memberId} title={tooltipText} placement="bottom">
                <div
                  className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-opacity hover:opacity-75"
                  style={{
                    background: 'var(--cr-indigo-50)',
                    border: '1px solid var(--cr-indigo-50)',
                    borderLeft: '3px solid var(--cr-indigo-400)',
                  }}
                  onClick={onLeaveClick}
                >
                  <DsAvatar name={entry.memberName} size={18} />
                  <span className="font-semibold" style={{ color: 'var(--cr-primary-hover)' }}>
                    {entry.memberName.split(' ')[0]}
                  </span>
                  <span
                    className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                    style={{
                      background: isLToday ? 'var(--cr-indigo-400)' : 'var(--cr-indigo-50)',
                      color: isLToday ? '#fff' : 'var(--cr-indigo-400)',
                    }}
                  >
                    {badge}
                  </span>
                  {isMultiDay && (
                    <span style={{ color: 'var(--cr-indigo-400)', fontSize: 10 }}>
                      ×{entry.totalDays}d
                    </span>
                  )}
                </div>
              </Tooltip>
            );
          })}

          {overflowCount > 0 && (
            <button
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-opacity hover:opacity-75"
              style={{
                background: 'var(--cr-indigo-50)',
                border: '1px solid var(--cr-indigo-50)',
                borderLeft: '3px solid var(--cr-indigo-400)',
                color: 'var(--cr-indigo-400)',
              }}
              onClick={onLeaveClick}
            >
              +{overflowCount} more on leave
            </button>
          )}

          {/* ── Manage Holidays link ───────────────────────────────────────── */}
          {upcomingHolidays.length > 0 && (
            <Link
              href="/dashboard/holidays"
              className="ml-1 flex shrink-0 items-center gap-1 text-xs whitespace-nowrap transition-colors hover:opacity-75"
              style={{ color: 'var(--cr-info-500)' }}
            >
              Manage <ArrowRightOutlined style={{ fontSize: 9 }} />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
