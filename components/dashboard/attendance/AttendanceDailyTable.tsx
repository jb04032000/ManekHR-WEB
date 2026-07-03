'use client';
import { useMemo, useState } from 'react';
import {
  Table,
  Button,
  Tooltip,
  Popconfirm,
  Collapse,
  Skeleton,
  Dropdown,
  Modal,
  Select,
  App,
  Popover,
  TimePicker,
  Input,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MenuProps } from 'antd';
import {
  EyeOutlined,
  CloseOutlined,
  WarningOutlined,
  ThunderboltOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  LogoutOutlined,
  CheckOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { DsAvatar, DsTag, STATUS_COLORS } from '@/components/ui';
import { todayISO, ATTENDANCE_STATUSES } from '@/lib/utils';
import type {
  TeamMember,
  AttendanceRecord,
  AttendanceStatus,
  ShiftInfo,
  Holiday,
  AttendanceEvent,
} from '@/types';
import { SetTimesPopover } from './SetTimesPopover';
import { VoidEventModal } from './VoidEventModal';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { SourceBadge, LockBadge } from './SourceBadge';
import { ShiftTimesPopover } from './ShiftTimesPopover';

// ── Helpers ─────────────────────────────────────────────────────────────────

export const to12h = (t?: string) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

export function isShiftCurrentlyActive(startTime: string, endTime: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end;
}

export function hasShiftStarted(startTime: string): boolean {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = startTime.split(':').map(Number);
  return cur >= sh * 60 + sm;
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface AttendanceDailyTableProps {
  members: TeamMember[];
  records: AttendanceRecord[];
  holidays: Holiday[];
  loading: boolean;
  pendingStatus: Record<string, AttendanceStatus>;
  failedIds: Set<string>;
  onMark: (memberId: string, status: AttendanceStatus, note?: string) => void;
  onRowClick: (member: TeamMember) => void;
  onRemove: (memberId: string) => void;
  date: string;
  shifts: ShiftInfo[];
  canEdit: boolean;
  expandedShifts: string[];
  onExpandedShiftsChange: (keys: string[]) => void;
  sortedShiftEntries: [string | null, TeamMember[]][];
  workspaceId: string;
  onReload?: () => void;
  onSetTimes: (
    memberId: string,
    checkInIso: string | null,
    checkOutIso: string | null,
  ) => Promise<void>;
  /** memberId → yesterday's open AttendanceRecord (overnight workers still mid-shift) */
  carryoverMap?: Record<string, AttendanceRecord>;
  onCloseOvernightShift?: (memberId: string, checkOutIso: string) => Promise<void>;
  onBulkMarkShift?: (shiftMembers: TeamMember[], status: AttendanceStatus) => Promise<void>;
  onBulkMarkShiftWithTimes?: (
    shiftMembers: TeamMember[],
    shift: ShiftInfo,
    times?: { checkIn?: string | null; checkOut?: string | null },
  ) => Promise<void>;
  marking?: boolean;
  canBulkMark?: boolean;
}

// ── OvernightCloseButton ─────────────────────────────────────────────────────
// Isolated component so its open/time/loading state doesn't live in the parent
// useMemo closure - fixes the popover appearing only after a memo invalidation.

function OvernightCloseButton({
  memberId,
  date,
  onCloseOvernightShift,
}: {
  memberId: string;
  date: string;
  onCloseOvernightShift: (memberId: string, checkOutIso: string) => Promise<void>;
}) {
  const t = useTranslations('attendance');
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState<ReturnType<typeof dayjs> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = async () => {
    if (!time) return;
    setLoading(true);
    try {
      const iso = dayjs(date)
        .startOf('day')
        .hour(time.hour())
        .minute(time.minute())
        .second(0)
        .toISOString();
      await onCloseOvernightShift(memberId, iso);
      setOpen(false);
      setTime(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setOpen(false);
          setTime(null);
        }
      }}
      trigger="click"
      title={
        <span style={{ color: 'var(--cr-indigo-400)' }}>{t('daily.closeOvernight.title')}</span>
      }
      content={
        <div style={{ width: 220 }}>
          <p className="mb-2 text-xs text-gray-700">{t('daily.closeOvernight.setCheckoutHelp')}</p>
          <TimePicker
            format="hh:mm a"
            use12Hours
            minuteStep={5}
            style={{ width: '100%', marginBottom: 8 }}
            value={time}
            onChange={setTime}
          />
          <Button
            type="primary"
            size="small"
            block
            loading={loading}
            disabled={!time}
            onClick={handleClose}
          >
            {t('daily.closeOvernight.closeShift')}
          </Button>
        </div>
      }
    >
      <Button
        type="text"
        size="small"
        icon={<LogoutOutlined style={{ color: 'var(--cr-indigo-400)' }} />}
        onClick={() => setOpen(true)}
        aria-label={t('daily.closeOvernightAria')}
      />
    </Popover>
  );
}

// ── ShiftBulkActions ─────────────────────────────────────────────────────────
// Isolated component so its loading state doesn't pollute the collapseItems useMemo.

function ShiftBulkActions({
  shift,
  shiftMembers,
  date,
  marking,
  canBulkMark,
  onBulkMarkShift,
  onBulkMarkShiftWithTimes,
}: {
  shift: ShiftInfo | null;
  shiftMembers: TeamMember[];
  date: string;
  marking: boolean;
  canBulkMark: boolean;
  onBulkMarkShift?: (shiftMembers: TeamMember[], status: AttendanceStatus) => Promise<void>;
  onBulkMarkShiftWithTimes?: (
    shiftMembers: TeamMember[],
    shift: ShiftInfo,
    times?: { checkIn?: string | null; checkOut?: string | null },
  ) => Promise<void>;
}) {
  const t = useTranslations('attendance');
  const [loading, setLoading] = useState(false);
  const isFutureDate = date > todayISO();
  const isToday = date === todayISO();
  // Block present only if today's shift clearly hasn't begun AND isn't currently active.
  // For overnight shifts (e.g. 09:00→05:00), isShiftCurrentlyActive returns true during
  // the wraparound tail - allow marking then even though hasShiftStarted is false.
  const shiftNotStarted =
    !!shift &&
    isToday &&
    !hasShiftStarted(shift.startTime) &&
    !isShiftCurrentlyActive(shift.startTime, shift.endTime);

  if (!canBulkMark) return null;

  const disabled = loading || marking || shiftMembers.length === 0;

  const futureAllowed = new Set(['on_leave', 'half_day']);
  // Shift not started yet → block marking present (they haven't shown up).
  // Absent/on_leave/half_day are policy decisions still valid pre-shift.
  const preShiftBlocked = new Set(['present']);
  const statusMenuItems: MenuProps['items'] = ATTENDANCE_STATUSES.filter(
    (s) => !isFutureDate || futureAllowed.has(s.value),
  )
    .filter((s) => !shiftNotStarted || !preShiftBlocked.has(s.value))
    .map((s) => ({
      key: s.value,
      label: s.label,
      onClick: async () => {
        if (!onBulkMarkShift) return;
        setLoading(true);
        try {
          await onBulkMarkShift(shiftMembers, s.value as AttendanceStatus);
        } finally {
          setLoading(false);
        }
      },
    }));

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
      onClick={(e) => e.stopPropagation()}
    >
      {onBulkMarkShift && (
        <Dropdown trigger={['click']} menu={{ items: statusMenuItems }} disabled={disabled}>
          <Button size="small" loading={loading} disabled={disabled} icon={<CheckOutlined />}>
            {t('daily.bulk.markAll')}
          </Button>
        </Dropdown>
      )}
      {shift &&
        onBulkMarkShiftWithTimes &&
        (isFutureDate ? (
          <Tooltip title={t('daily.bulk.cantMarkFuture')}>
            <Button size="small" icon={<ScheduleOutlined />} disabled>
              {t('daily.bulk.shiftTimes')}
            </Button>
          </Tooltip>
        ) : shiftNotStarted ? (
          <Tooltip title={t('daily.bulk.shiftStartsAt', { time: to12h(shift.startTime) })}>
            <Button size="small" icon={<ScheduleOutlined />} disabled>
              {t('daily.bulk.shiftTimes')}
            </Button>
          </Tooltip>
        ) : (
          <ShiftTimesPopover
            shift={shift}
            date={date}
            memberCount={shiftMembers.length}
            disabled={disabled}
            loading={loading}
            onApply={async (times) => {
              setLoading(true);
              try {
                await onBulkMarkShiftWithTimes(shiftMembers, shift, times);
              } finally {
                setLoading(false);
              }
            }}
          />
        ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export function AttendanceDailyTable({
  // members is part of the props API but not used directly - sortedShiftEntries carries the filtered set
  records,
  loading,
  pendingStatus,
  failedIds,
  onMark,
  onRowClick,
  onRemove,
  date,
  shifts,
  canEdit,
  expandedShifts,
  onExpandedShiftsChange,
  sortedShiftEntries,
  workspaceId,
  onReload,
  onSetTimes,
  carryoverMap = {},
  onCloseOvernightShift,
  onBulkMarkShift,
  onBulkMarkShiftWithTimes,
  marking = false,
  canBulkMark = false,
}: AttendanceDailyTableProps) {
  const t = useTranslations('attendance');
  const tCommon = useTranslations('common');
  const { message } = App.useApp();
  // Punch Events delete gate - mirrors the BE @RequirePermission on
  // DELETE /attendance/events/:id. Hides the row-level Void action when the
  // caller lacks attendance.events.delete.
  const { canPath } = useMyPermissions();
  const canVoidEvents = canPath('attendance.events.delete');

  // ── Row-level UI state for action dropdown ───────────────────────────────
  const [setTimesOpenRow, setSetTimesOpenRow] = useState<string | null>(null);
  const [overnightMarkConfirm, setOvernightMarkConfirm] = useState<{
    memberId: string;
    memberName: string;
    status: AttendanceStatus;
  } | null>(null);
  const [overnightCloseTime, setOvernightCloseTime] = useState<ReturnType<typeof dayjs> | null>(
    null,
  );
  const [overnightConfirmLoading, setOvernightConfirmLoading] = useState(false);
  const [notePrompt, setNotePrompt] = useState<{
    memberId: string;
    memberName: string;
    status: AttendanceStatus;
  } | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [voidPickerRow, setVoidPickerRow] = useState<string | null>(null);
  const [voidModal, setVoidModal] = useState<{
    memberId: string;
    eventId: string;
    eventDescription?: string;
  } | null>(null);
  // For multi-event void picker: show a selection modal
  const [multiEventPickerRow, setMultiEventPickerRow] = useState<{
    memberId: string;
    events: AttendanceEvent[];
  } | null>(null);
  const [selectedMultiEventId, setSelectedMultiEventId] = useState<string | undefined>(undefined);

  // Memoize the attendance map - avoids recompute on every render
  const attMap = useMemo(
    () =>
      records.reduce<Record<string, AttendanceRecord>>((acc, r) => {
        const id =
          typeof r.teamMemberId === 'string'
            ? r.teamMemberId
            : (r.teamMemberId as { _id: string })._id;
        if (id) acc[id] = r;
        return acc;
      }, {}),
    [records],
  );

  const getEffectiveStatus = (memberId: string): string =>
    pendingStatus[memberId] ?? attMap[memberId]?.status ?? 'unmarked';

  const TAB_STATUSES = [
    { value: 'present', label: t('present') },
    { value: 'half_day', label: t('halfDay') },
    { value: 'absent', label: t('absent') },
    { value: 'on_leave', label: t('leave') },
  ] as const;

  // ── Void event row handler ───────────────────────────────────────────────
  const handleVoidRowAction = (memberId: string) => {
    const record = attMap[memberId];
    const events = record?.events ?? [];
    if (events.length === 0) {
      message.warning(t('daily.noEventsForRecord'));
      return;
    }
    if (events.length === 1) {
      const ev = events[0];
      setVoidModal({
        memberId,
        eventId: ev._id,
        eventDescription: `${ev.punchType} at ${dayjs(ev.timestamp).format('HH:mm')}`,
      });
    } else {
      setMultiEventPickerRow({ memberId, events });
      setSelectedMultiEventId(undefined);
    }
  };

  // Shared status-chip click logic - used by BOTH the desktop table column and the
  // mobile card (renderMobileCard) so the mark/branch behaviour (overnight confirm,
  // note prompt for leave/half-day, else direct mark) can never drift between the two.
  const handleStatusChipClick = (
    m: TeamMember,
    value: AttendanceStatus,
    isDisabled: boolean,
    isActive: boolean,
  ) => {
    if (isDisabled || isActive) return;
    if (carryoverMap[m.id] && onCloseOvernightShift) {
      setOvernightMarkConfirm({ memberId: m.id, memberName: m.name, status: value });
      setOvernightCloseTime(null);
    } else if (value === 'on_leave' || value === 'half_day') {
      setNotePrompt({ memberId: m.id, memberName: m.name, status: value });
      setNoteInput('');
    } else {
      onMark(m.id, value);
    }
  };

  // Mobile card (<md) - the phone replacement for the horizontal-scroll table row,
  // which is unusable on a narrow screen. Shows avatar + name + state badges, the 4
  // status chips (same marking path as the table via handleStatusChipClick), and a
  // compact clock in/out line. Tapping the card body opens the AttendanceDetailDrawer
  // (onRowClick) for the advanced actions (set times / void / remove / note) - kept
  // off the card to stay compact. Keep the badge + clock display in sync with the
  // Employee / Status / ClockIn / ClockOut columns below.
  const renderMobileCard = (m: TeamMember) => {
    const effectiveStatus = getEffectiveStatus(m.id);
    const isPending = m.id in pendingStatus;
    const isFailed = failedIds.has(m.id);
    const isWeeklyOff = m.weeklyOff?.includes(dayjs(date).format('ddd'));
    const isTodayDate = date === todayISO();
    const isFutureDate = date > todayISO();
    const shiftNotStarted =
      isTodayDate &&
      !!m.shift &&
      !hasShiftStarted(m.shift.startTime) &&
      !isShiftCurrentlyActive(m.shift.startTime, m.shift.endTime);
    const r = attMap[m.id];
    const cr = carryoverMap[m.id];
    const ci = r?.checkIn
      ? dayjs(r.checkIn).format('hh:mm A')
      : cr?.checkIn
        ? `${dayjs(cr.checkIn).format('hh:mm A')} -1d`
        : '-';
    const co = r?.checkOut ? dayjs(r.checkOut).format('hh:mm A') : '-';

    return (
      <div
        key={m.id}
        onClick={() => onRowClick(m)}
        className="cursor-pointer rounded-xl border p-3"
        style={{
          borderColor: 'var(--cr-border-light)',
          background: cr ? 'rgba(99, 102, 241, 0.03)' : 'var(--cr-surface, white)',
        }}
      >
        <div className="flex items-start gap-2.5">
          <DsAvatar name={m.name} size={38} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="m-0 truncate text-[13px] font-semibold text-heading">{m.name}</p>
              {cr && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 2,
                    padding: '1px 5px',
                    borderRadius: 4,
                    background: 'var(--cr-indigo-50)',
                    color: 'var(--cr-indigo-400)',
                    fontSize: 10,
                    fontWeight: 700,
                    border: '1px solid var(--cr-indigo-100)',
                  }}
                >
                  🌙 Overnight
                </span>
              )}
              {isPending && (
                <span
                  className="animate-pulse"
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--cr-neutral-400)',
                    display: 'inline-block',
                  }}
                />
              )}
              {isFailed && (
                <WarningOutlined style={{ fontSize: 11, color: 'var(--cr-danger-500)' }} />
              )}
              {!isPending && !isFailed && r?.autoMarked === true && (
                <ThunderboltOutlined style={{ fontSize: 11, color: 'var(--cr-text-3)' }} />
              )}
              {r?.isLocked && <LockBadge />}
            </div>
            <p className="m-0 text-[11px] text-subtle">{m.designation ?? 'Employee'}</p>
          </div>
          <EyeOutlined style={{ fontSize: 15, color: 'var(--cr-text-3)', flexShrink: 0 }} />
        </div>

        {/* Status chips (or the weekly-off state). stopPropagation so tapping a chip
            marks attendance without also opening the detail drawer. */}
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          {isWeeklyOff ? (
            <div className="flex items-center gap-2">
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {t('weeklyOff').toUpperCase()}
              </span>
              <Button size="small" type="link" onClick={() => onMark(m.id, 'present')}>
                {t('override')}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {TAB_STATUSES.map(({ value, label }) => {
                const isActive = effectiveStatus === value;
                const color = STATUS_COLORS[value];
                const futureLocked = isFutureDate && (value === 'present' || value === 'absent');
                const isDisabled = futureLocked || (shiftNotStarted && value !== 'on_leave');
                return (
                  <button
                    key={value}
                    disabled={isDisabled}
                    onClick={() =>
                      handleStatusChipClick(m, value as AttendanceStatus, isDisabled, isActive)
                    }
                    style={{
                      padding: '7px 4px',
                      borderRadius: 6,
                      border: `1.5px solid ${isActive ? color.text : 'var(--cr-border)'}`,
                      background: isActive ? color.bg : 'transparent',
                      color: isActive ? color.text : 'var(--cr-text-3)',
                      fontSize: 12,
                      fontWeight: isActive ? 700 : 500,
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      opacity: isDisabled ? 0.4 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact clock summary - full times / note / void live in the detail drawer */}
        <div className="mt-2.5 flex items-center gap-4 text-[11px] text-slate-600">
          <span>
            {t('clockIn')}: {ci}
          </span>
          <span>
            {t('clockOut')}: {co}
          </span>
        </div>
      </div>
    );
  };

  // Memoize columns definition - only rebuilds when deps change
  const dailyColumns: ColumnsType<TeamMember> = useMemo(
    () => [
      {
        title: t('employee'),
        dataIndex: 'name',
        key: 'name',
        fixed: 'left' as const,
        width: 220,
        render: (name: string, m: TeamMember) => {
          const cr = carryoverMap[m.id];
          return (
            <div className="flex cursor-pointer items-center gap-2.5" onClick={() => onRowClick(m)}>
              <DsAvatar name={name} size={34} />
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="m-0 text-[13px] font-semibold text-heading">{name}</p>
                  {cr && (
                    <Tooltip
                      title={t('daily.overnightCarryoverTooltip', {
                        time: dayjs(cr.checkIn).format('hh:mm A'),
                        date: dayjs(date).subtract(1, 'day').format('DD MMM'),
                      })}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 2,
                          padding: '1px 5px',
                          borderRadius: 4,
                          lineHeight: '16px',
                          background: 'var(--cr-indigo-50)',
                          color: 'var(--cr-indigo-400)',
                          fontSize: 10,
                          fontWeight: 700,
                          border: '1px solid var(--cr-indigo-100)',
                          cursor: 'default',
                        }}
                      >
                        🌙 Overnight
                      </span>
                    </Tooltip>
                  )}
                </div>
                <p className="m-0 text-[11px] text-subtle">{m.designation ?? 'Employee'}</p>
              </div>
            </div>
          );
        },
      },
      {
        title: t('status'),
        key: 'status',
        render: (_: unknown, m: TeamMember) => {
          const effectiveStatus = getEffectiveStatus(m.id);
          const isPending = m.id in pendingStatus;
          const dayOfWeek = dayjs(date).format('ddd');
          const isWeeklyOff = m.weeklyOff?.includes(dayOfWeek);
          const isToday = date === todayISO();
          const isFutureDate = date > todayISO();
          // Overnight shifts (e.g. 09:00→05:00): during wraparound tail, hasShiftStarted
          // is false but isShiftCurrentlyActive is true - allow marking then.
          const shiftNotStarted =
            isToday &&
            !!m.shift &&
            !hasShiftStarted(m.shift.startTime) &&
            !isShiftCurrentlyActive(m.shift.startTime, m.shift.endTime);

          if (isWeeklyOff) {
            return (
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                  {t('weeklyOff').toUpperCase()}
                </span>
                <Tooltip title={t('overrideWeeklyOff')}>
                  <Button size="small" type="link" onClick={() => onMark(m.id, 'present')}>
                    {t('override')}
                  </Button>
                </Tooltip>
              </div>
            );
          }

          const tabValues = TAB_STATUSES.map((s) => s.value) as string[];
          const isOtherStatus =
            !tabValues.includes(effectiveStatus) && effectiveStatus !== 'unmarked';

          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {TAB_STATUSES.map(({ value, label }) => {
                  const isActive = effectiveStatus === value;
                  const color = STATUS_COLORS[value];
                  const futureLocked = isFutureDate && (value === 'present' || value === 'absent');
                  const isDisabled = futureLocked || (shiftNotStarted && value !== 'on_leave');
                  const tooltipTitle = futureLocked
                    ? 'Cannot mark future attendance'
                    : shiftNotStarted && value !== 'on_leave'
                      ? t('shiftNotStarted', { time: to12h(m.shift?.startTime) })
                      : undefined;
                  return (
                    <Tooltip key={value} title={tooltipTitle}>
                      <button
                        onClick={() =>
                          handleStatusChipClick(m, value as AttendanceStatus, isDisabled, isActive)
                        }
                        style={{
                          flex: 1,
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: `1.5px solid ${isActive ? color.text : 'var(--cr-border, var(--cr-border))'}`,
                          background: isActive ? color.bg : 'transparent',
                          color: isActive ? color.text : 'var(--cr-text-3, var(--cr-text-5))',
                          fontSize: 11,
                          fontWeight: isActive ? 700 : 500,
                          cursor: isDisabled ? 'not-allowed' : 'pointer',
                          opacity: isDisabled ? 0.4 : 1,
                          transition: 'all 0.15s',
                          whiteSpace: 'nowrap',
                          lineHeight: '1.4',
                        }}
                      >
                        {label}
                      </button>
                    </Tooltip>
                  );
                })}
                {isPending && (
                  <Tooltip title={t('daily.savingTooltip')}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--cr-neutral-400)',
                        display: 'inline-block',
                        marginLeft: 4,
                        alignSelf: 'center',
                      }}
                      className="animate-pulse"
                    />
                  </Tooltip>
                )}
                {!isPending && failedIds.has(m.id) && (
                  <Tooltip title={t('daily.saveFailedTooltip')}>
                    <WarningOutlined
                      style={{
                        fontSize: 12,
                        color: 'var(--cr-danger-500)',
                        marginLeft: 4,
                        alignSelf: 'center',
                      }}
                    />
                  </Tooltip>
                )}
                {!isPending && !failedIds.has(m.id) && attMap[m.id]?.autoMarked === true && (
                  <Tooltip title={t('daily.autoMarkedTooltip')}>
                    <ThunderboltOutlined
                      style={{ fontSize: 12, color: 'var(--cr-text-3)', marginLeft: 4 }}
                    />
                  </Tooltip>
                )}
                {/* D-26: source badge - shows icon + tooltip for the dominant event source */}
                {!isPending && attMap[m.id]?.dominantSource && (
                  <SourceBadge source={attMap[m.id]!.dominantSource} />
                )}
                {/* D-27: lock badge - shown when payroll is generated + locked for this period */}
                {attMap[m.id]?.isLocked && <LockBadge />}
                {/* P2b: overnight session warning - nudges admin to close shift before marking */}
                {carryoverMap[m.id] && !attMap[m.id] && (
                  <Tooltip title={t('daily.overnightWarningTooltip')}>
                    <WarningOutlined
                      style={{
                        fontSize: 12,
                        color: 'var(--cr-warning-700)',
                        marginLeft: 2,
                        alignSelf: 'center',
                        flexShrink: 0,
                      }}
                    />
                  </Tooltip>
                )}
              </div>
              {isOtherStatus && (
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: STATUS_COLORS[effectiveStatus]?.bg ?? 'var(--cr-bg)',
                    color: STATUS_COLORS[effectiveStatus]?.text ?? 'var(--cr-text-3)',
                    fontSize: 11,
                    fontWeight: 700,
                    border: `1.5px solid ${STATUS_COLORS[effectiveStatus]?.text ?? 'var(--cr-neutral-400)'}`,
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  {effectiveStatus
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: t('clockIn'),
        key: 'ci',
        width: 100,
        render: (_: unknown, m: TeamMember) => {
          const r = attMap[m.id];
          const cr = carryoverMap[m.id];
          if (r?.checkIn)
            return (
              <span className="text-xs text-slate-700">{dayjs(r.checkIn).format('hh:mm A')}</span>
            );
          // No today check-in but overnight session - show yesterday's check-in dimmed
          if (cr?.checkIn)
            return (
              <Tooltip
                title={t('daily.checkedInDateOvernight', {
                  date: dayjs(date).subtract(1, 'day').format('DD MMM'),
                })}
              >
                <span style={{ color: 'var(--cr-indigo-400)', fontSize: 12 }}>
                  {dayjs(cr.checkIn).format('hh:mm A')}
                  <span style={{ fontSize: 10, marginLeft: 2, opacity: 0.8 }}>-1d</span>
                </span>
              </Tooltip>
            );
          return '-';
        },
      },
      {
        title: t('clockOut'),
        key: 'co',
        width: 110,
        render: (_: unknown, m: TeamMember) => {
          const r = attMap[m.id];
          const cr = carryoverMap[m.id];
          if (r?.checkOut) {
            const isNextDay = dayjs(r.checkOut).format('YYYY-MM-DD') !== date;
            return (
              <span className="text-xs text-slate-700">
                {dayjs(r.checkOut).format('hh:mm A')}
                {isNextDay && (
                  <Tooltip
                    title={t('daily.checkedOutNextDay', {
                      date: dayjs(r.checkOut).format('DD MMM'),
                    })}
                  >
                    <sup
                      style={{
                        color: 'var(--cr-indigo-400)',
                        fontWeight: 700,
                        marginLeft: 2,
                        fontSize: '0.7em',
                      }}
                    >
                      +1
                    </sup>
                  </Tooltip>
                )}
              </span>
            );
          }
          // Today check-in but no check-out yet
          if (r?.checkIn)
            return (
              <Tooltip title={t('daily.checkoutNotRecorded')}>
                <span className="text-xs text-amber-700">-</span>
              </Tooltip>
            );
          // Overnight carry-over - still active from yesterday, no today check-in
          if (cr)
            return (
              <Tooltip title={t('daily.overnightStillActive')}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    color: 'var(--cr-success-700)',
                  }}
                >
                  <span
                    className="animate-pulse"
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: 'var(--cr-success-500)',
                      display: 'inline-block',
                      flexShrink: 0,
                    }}
                  />
                  {t('daily.activeBadge')}
                </span>
              </Tooltip>
            );
          return '-';
        },
      },
      {
        title: t('note'),
        key: 'note',
        render: (_: unknown, m: TeamMember) => (
          <span className="text-xs text-muted">{attMap[m.id]?.note ?? '-'}</span>
        ),
      },
      {
        title: <span className="sr-only">{t('daily.actionsSr')}</span>,
        key: 'actions',
        width: 100,
        fixed: 'right' as const,
        render: (_: unknown, m: TeamMember) => {
          const record = attMap[m.id];
          const hasNonVoidableEvents =
            record?.dominantSource &&
            record.dominantSource !== 'manual' &&
            (record.events?.length ?? 0) > 0;

          // Shared SetTimesPopover props to avoid repetition
          const setTimesPopoverProps = {
            open: setTimesOpenRow === m.id,
            onClose: () => setSetTimesOpenRow(null),
            rowDate: date,
            defaultCheckIn: record?.checkIn,
            defaultCheckOut: record?.checkOut,
            shiftStart: m.shift?.startTime,
            shiftEnd: m.shift?.endTime,
            onSubmit: (ci: string | null, co: string | null) => onSetTimes(m.id, ci, co),
          };

          return (
            <div className="flex items-center gap-0.5">
              <Tooltip title={t('viewDetails')}>
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => onRowClick(m)}
                  aria-label={t('viewDetails')}
                />
              </Tooltip>

              {/* Close overnight shift - only for carryover workers */}
              {carryoverMap[m.id] && canEdit && onCloseOvernightShift && (
                <OvernightCloseButton
                  memberId={m.id}
                  date={date}
                  onCloseOvernightShift={onCloseOvernightShift}
                />
              )}

              {canEdit && hasNonVoidableEvents ? (
                // 3-dot dropdown: shows "Set times" + "Void event" - 2 meaningful actions
                <SetTimesPopover {...setTimesPopoverProps}>
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        {
                          key: 'times',
                          icon: <ClockCircleOutlined />,
                          label: t('daily.actions.setTimesMenu'),
                          onClick: () => {
                            if (carryoverMap[m.id] && !attMap[m.id]) {
                              setOvernightMarkConfirm({
                                memberId: m.id,
                                memberName: m.name,
                                status: 'present',
                              });
                              setOvernightCloseTime(null);
                            } else {
                              setSetTimesOpenRow(m.id);
                            }
                          },
                        },
                        ...(canVoidEvents
                          ? [
                              {
                                key: 'void',
                                icon: <DeleteOutlined />,
                                label: t('daily.actions.voidEventMenu'),
                                danger: true,
                                onClick: () => handleVoidRowAction(m.id),
                              },
                            ]
                          : []),
                      ],
                    }}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      aria-label={t('daily.actionsMenuAria')}
                    />
                  </Dropdown>
                </SetTimesPopover>
              ) : canEdit ? (
                // Direct clock button - 1 click opens Set Times (no void option available)
                <SetTimesPopover {...setTimesPopoverProps}>
                  <Tooltip title={t('daily.actions.setCheckInOutTooltip')}>
                    <Button
                      type="text"
                      size="small"
                      icon={<ClockCircleOutlined />}
                      onClick={() => {
                        if (carryoverMap[m.id] && !attMap[m.id]) {
                          setOvernightMarkConfirm({
                            memberId: m.id,
                            memberName: m.name,
                            status: 'present',
                          });
                          setOvernightCloseTime(null);
                        } else {
                          setSetTimesOpenRow(m.id);
                        }
                      }}
                      aria-label={t('daily.actions.setCheckInOutTooltip')}
                    />
                  </Tooltip>
                </SetTimesPopover>
              ) : null}

              {record && canEdit && (
                <Popconfirm
                  title={t('removeRecord')}
                  onConfirm={() => onRemove(m.id)}
                  okButtonProps={{ danger: true }}
                >
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<CloseOutlined />}
                    aria-label={t('daily.removeRecordAria')}
                  />
                </Popconfirm>
              )}
            </div>
          );
        },
      },
    ],
    [attMap, carryoverMap, pendingStatus, failedIds, date, canEdit, canVoidEvents, setTimesOpenRow],
  );

  // Memoize collapse items - only rebuilds when shift entries or attMap changes
  const collapseItems = useMemo(
    () =>
      sortedShiftEntries.map(([shiftId, shiftMembers]) => {
        const shift = shiftId ? (shifts.find((s) => s.id === shiftId) ?? null) : null;
        const presentCount = shiftMembers.filter((m) => attMap[m.id]?.status === 'present').length;
        const isActive =
          !!shift && date === todayISO() && isShiftCurrentlyActive(shift.startTime, shift.endTime);
        const overnightCount = shiftMembers.filter((m) => !!carryoverMap[m.id]).length;

        const label = (
          <div className="flex items-center gap-3">
            <span className="text-base font-semibold">
              {shift ? shift.name : t('daily.unassignedShift')}
            </span>
            {shift && (
              <span className="text-xs text-gray-700">
                {to12h(shift.startTime)} – {to12h(shift.endTime)}
              </span>
            )}
            {isActive && <DsTag status="active" label={t('daily.activeShiftBadge')} />}
            {overnightCount > 0 && (
              <Tooltip title={t('daily.overnightCountTooltip', { count: overnightCount })}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '1px 7px',
                    borderRadius: 4,
                    lineHeight: '18px',
                    background: 'var(--cr-indigo-50)',
                    color: 'var(--cr-indigo-400)',
                    fontSize: 11,
                    fontWeight: 700,
                    border: '1px solid var(--cr-indigo-100)',
                  }}
                >
                  🌙 {overnightCount}
                </span>
              </Tooltip>
            )}
            <span className="ml-2 text-sm text-gray-700">
              {presentCount}/{shiftMembers.length} {t('present')}
            </span>
          </div>
        );

        const extra = (
          <ShiftBulkActions
            shift={shift}
            shiftMembers={shiftMembers}
            date={date}
            marking={marking}
            canBulkMark={canBulkMark}
            onBulkMarkShift={onBulkMarkShift}
            onBulkMarkShiftWithTimes={onBulkMarkShiftWithTimes}
          />
        );

        return {
          key: shiftId ?? 'unassigned',
          label,
          extra,
          children: (
            <>
              {/* Desktop (md+): the full table. Horizontal scroll keeps the right-side
                  columns reachable on medium widths. */}
              <div className="hidden md:block">
                <Table
                  columns={dailyColumns}
                  dataSource={shiftMembers}
                  rowKey="id"
                  pagination={false}
                  size="small"
                  scroll={{ x: 'max-content' }}
                  onRow={(record: TeamMember) =>
                    carryoverMap[record.id]
                      ? {
                          style: {
                            boxShadow: 'inset 3px 0 0 var(--cr-indigo-400)',
                            background: 'rgba(99, 102, 241, 0.025)',
                          },
                        }
                      : {}
                  }
                />
              </div>
              {/* Mobile (<md): card list - the scroll table is unusable on phones. */}
              <div className="space-y-2 py-1 md:hidden">{shiftMembers.map(renderMobileCard)}</div>
            </>
          ),
        };
      }),
    // renderMobileCard is recreated each render; listing the state it reads
    // (pendingStatus, failedIds) here rebuilds the panels so the cards reflect
    // optimistic mark + failure state, matching how dailyColumns already refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      sortedShiftEntries,
      shifts,
      attMap,
      carryoverMap,
      date,
      dailyColumns,
      pendingStatus,
      failedIds,
      t,
      marking,
      canBulkMark,
      onBulkMarkShift,
      onBulkMarkShiftWithTimes,
    ],
  );

  // Loading skeleton - columns: Employee | Status (4 chips) | Clock In | Clock Out | Note | Actions (3 btns)
  if (loading && Object.keys(pendingStatus).length === 0) {
    return (
      <div className="mt-2 space-y-5 px-1">
        {[0, 1].map((g) => (
          <div key={g}>
            {/* Shift group header: name + time range + present count */}
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <Skeleton.Button active style={{ width: 140, height: 18 }} />
                <Skeleton.Button active style={{ width: 90, height: 14 }} />
              </div>
              <Skeleton.Button active style={{ width: 70, height: 14 }} />
            </div>
            {[0, 1, 2, 3].map((r) => (
              <div key={r} className="flex items-center gap-4 border-b border-gray-100 py-2.5">
                {/* Employee: avatar + name + designation */}
                <Skeleton.Avatar active size={34} shape="circle" />
                <div style={{ flex: '0 0 170px' }}>
                  <Skeleton.Button
                    active
                    style={{ width: 120, height: 13, marginBottom: 4, display: 'block' }}
                  />
                  <Skeleton.Button active style={{ width: 80, height: 11 }} />
                </div>
                {/* Status: 4 chip buttons */}
                <div className="flex gap-1.5" style={{ flex: 1 }}>
                  {[0, 1, 2, 3].map((b) => (
                    <Skeleton.Button key={b} active style={{ flex: 1, height: 26, minWidth: 48 }} />
                  ))}
                </div>
                {/* Clock In */}
                <Skeleton.Button active style={{ width: 62, height: 13 }} />
                {/* Clock Out */}
                <Skeleton.Button active style={{ width: 62, height: 13 }} />
                {/* Note */}
                <Skeleton.Button active style={{ width: 70, height: 13 }} />
                {/* Actions: eye + clock + delete */}
                <div className="flex gap-1">
                  <Skeleton.Button
                    active
                    size="small"
                    style={{ width: 26, height: 26, minWidth: 26 }}
                  />
                  <Skeleton.Button
                    active
                    size="small"
                    style={{ width: 26, height: 26, minWidth: 26 }}
                  />
                  <Skeleton.Button
                    active
                    size="small"
                    style={{ width: 26, height: 26, minWidth: 26 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (sortedShiftEntries.length === 0) {
    return (
      <div className="py-12 text-center text-gray-700">
        <p>{t('noEmployees')}</p>
      </div>
    );
  }

  return (
    <>
      <Collapse
        activeKey={expandedShifts}
        onChange={(keys) => onExpandedShiftsChange(typeof keys === 'string' ? [keys] : keys)}
        items={collapseItems}
        collapsible="icon"
        className="mt-4"
      />

      {/* VoidEventModal - single event or after multi-event selection */}
      {voidModal && (
        <VoidEventModal
          open={!!voidModal}
          onClose={() => setVoidModal(null)}
          wsId={workspaceId}
          eventId={voidModal.eventId}
          eventDescription={voidModal.eventDescription}
          onSuccess={() => {
            setVoidModal(null);
            onReload?.();
          }}
        />
      )}

      {/* Multi-event picker: when a row has multiple events to choose from */}
      {multiEventPickerRow && (
        <Modal
          title={t('daily.voidPicker.title')}
          open={!!multiEventPickerRow}
          onCancel={() => {
            setMultiEventPickerRow(null);
            setSelectedMultiEventId(undefined);
          }}
          onOk={() => {
            if (!selectedMultiEventId) return;
            const ev = multiEventPickerRow.events.find((e) => e._id === selectedMultiEventId);
            setMultiEventPickerRow(null);
            setSelectedMultiEventId(undefined);
            setVoidModal({
              memberId: multiEventPickerRow.memberId,
              eventId: selectedMultiEventId,
              eventDescription: ev
                ? `${ev.punchType} at ${dayjs(ev.timestamp).format('HH:mm')}`
                : undefined,
            });
          }}
          okText={tCommon('next')}
          okButtonProps={{ disabled: !selectedMultiEventId }}
        >
          <Select
            style={{ width: '100%' }}
            placeholder={t('daily.voidPicker.placeholder')}
            value={selectedMultiEventId}
            onChange={setSelectedMultiEventId}
            options={multiEventPickerRow.events
              .filter((ev) => !ev.voidedAt)
              .map((ev) => ({
                value: ev._id,
                label: `${ev.punchType} at ${dayjs(ev.timestamp).format('HH:mm')} (${ev.source})`,
              }))}
          />
        </Modal>
      )}

      {/* Dummy state setter to avoid unused-var lint: voidPickerRow */}
      {voidPickerRow && null}

      {/* Note prompt - quick reason for on_leave / half_day */}
      <Modal
        title={
          notePrompt
            ? notePrompt.status === 'on_leave'
              ? t('daily.notePrompt.leaveTitle')
              : t('daily.notePrompt.halfDayTitle')
            : ''
        }
        open={!!notePrompt}
        onCancel={() => {
          setNotePrompt(null);
          setNoteInput('');
        }}
        onOk={() => {
          if (!notePrompt) return;
          onMark(notePrompt.memberId, notePrompt.status, noteInput.trim() || undefined);
          setNotePrompt(null);
          setNoteInput('');
        }}
        okText={t('daily.notePrompt.confirmMark')}
        width={360}
        destroyOnHidden
      >
        {notePrompt && (
          <div className="space-y-3 pt-1">
            <p className="m-0 text-sm text-gray-700">
              <strong>{notePrompt.memberName}</strong> - {t('daily.notePrompt.optionalReason')}
            </p>
            <Input.TextArea
              autoFocus
              rows={3}
              placeholder={t('daily.notePrompt.placeholder')}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  onMark(notePrompt.memberId, notePrompt.status, noteInput.trim() || undefined);
                  setNotePrompt(null);
                  setNoteInput('');
                }
              }}
            />
            <p className="m-0 text-xs text-faint">{t('daily.notePrompt.helper')}</p>
          </div>
        )}
      </Modal>

      {/* P2a: confirm modal when admin marks status for an overnight/carryover worker */}
      <Modal
        title={
          <span style={{ color: 'var(--cr-indigo-400)' }}>{t('daily.overnightModal.title')}</span>
        }
        open={!!overnightMarkConfirm}
        onCancel={() => {
          setOvernightMarkConfirm(null);
          setOvernightCloseTime(null);
        }}
        footer={null}
        destroyOnHidden
      >
        {overnightMarkConfirm && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{overnightMarkConfirm.memberName}</strong>{' '}
              {t('daily.overnightModal.bodyAfterName')}
            </p>

            {/* Option A: close overnight + mark today */}
            <div className="space-y-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
              <p className="text-xs font-semibold text-indigo-700">
                {t('daily.overnightModal.optionA')}
              </p>
              <div className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-gray-700">
                  {t('daily.overnightModal.checkoutLabel')}
                </span>
                <TimePicker
                  format="hh:mm a"
                  use12Hours
                  minuteStep={5}
                  value={overnightCloseTime}
                  onChange={setOvernightCloseTime}
                  style={{ flex: 1 }}
                  placeholder={t('daily.overnightModal.checkoutPlaceholder')}
                />
              </div>
              <Button
                type="primary"
                block
                size="small"
                loading={overnightConfirmLoading}
                disabled={!overnightCloseTime}
                onClick={async () => {
                  if (!overnightCloseTime || !overnightMarkConfirm || !onCloseOvernightShift)
                    return;
                  setOvernightConfirmLoading(true);
                  try {
                    const iso = dayjs(date)
                      .subtract(1, 'day')
                      .startOf('day')
                      .hour(overnightCloseTime.hour())
                      .minute(overnightCloseTime.minute())
                      .second(0)
                      .toISOString();
                    await onCloseOvernightShift(overnightMarkConfirm.memberId, iso);
                    onMark(overnightMarkConfirm.memberId, overnightMarkConfirm.status);
                    setOvernightMarkConfirm(null);
                    setOvernightCloseTime(null);
                  } finally {
                    setOvernightConfirmLoading(false);
                  }
                }}
              >
                {t('daily.overnightModal.closeAndMark', {
                  status: overnightMarkConfirm.status.replace(/_/g, ' '),
                })}
              </Button>
            </div>

            {/* Option B: mark today only */}
            <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-600">
                {t('daily.overnightModal.optionB')}
              </p>
              <Button
                block
                size="small"
                onClick={() => {
                  if (!overnightMarkConfirm) return;
                  onMark(overnightMarkConfirm.memberId, overnightMarkConfirm.status);
                  setOvernightMarkConfirm(null);
                  setOvernightCloseTime(null);
                }}
              >
                {t('daily.overnightModal.markOnly', {
                  status: overnightMarkConfirm.status.replace(/_/g, ' '),
                })}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
