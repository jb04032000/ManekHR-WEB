'use client';

// Bulk attendance marking across a WHOLE MONTH or a selected set of days -
// the owner/manager "mark in bulk / regularize many days at once" tool.
//
// What it does: pick a status, choose all days or specific days of the month,
// optionally skip each member's weekly-offs and workspace holidays, optionally
// stamp a common check-in/out, then PIN-confirm and write every (member, day)
// record in one call.
//
// Cross-module links:
//   • Write -> lib/actions `bulkMarkAttendance` -> BE attendance bulk endpoint
//     (POST /attendance/bulk), same path the daily bulk-with-times uses.
//   • PIN gate -> components/common/PinConfirmModal (auth/pin-verify).
//   • Mounted by app/dashboard/attendance/mark/page.tsx; entry button lives in
//     AttendanceHeader (gated to owner / attendance.record.mark@all).
//
// Watch: a month × many members can produce thousands of records - we cap the
// request and warn the operator to narrow the scope. Week-off detection mirrors
// the daily table: member.weeklyOff holds short day names (dayjs 'ddd').

import { useCallback, useMemo, useState } from 'react';
import { App, Modal, Select, Button, Tag, Checkbox, TimePicker, Alert, Tooltip } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { bulkMarkAttendance } from '@/lib/actions';
import { ATTENDANCE_STATUSES } from '@/lib/utils';
import PinConfirmModal from '@/components/common/PinConfirmModal';
import type { AttendanceStatus, TeamMember, Holiday, BulkMarkAttendanceResult } from '@/types';

dayjs.extend(utc);

const MAX_RECORDS = 5000;

interface BulkMarkMonthModalProps {
  open: boolean;
  workspaceId: string;
  month: number; // 1-12
  year: number;
  members: TeamMember[];
  holidays: Holiday[];
  onClose: () => void;
  /** Refresh the grid after a successful write. */
  onDone: () => void;
}

export default function BulkMarkMonthModal({
  open,
  workspaceId,
  month,
  year,
  members,
  holidays,
  onClose,
  onDone,
}: BulkMarkMonthModalProps) {
  const { message: msg } = App.useApp();
  const daysInMonth = useMemo(() => dayjs(`${year}-${month}-01`).daysInMonth(), [year, month]);

  const [status, setStatus] = useState<AttendanceStatus>('present');
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [memberIds, setMemberIds] = useState<string[]>([]); // empty = all
  // Scope filters (#8): narrow the target set shift-wise / location-wise /
  // role-wise BEFORE the member multi-select. Empty array = no constraint.
  const [shiftIds, setShiftIds] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [skipWeekOffs, setSkipWeekOffs] = useState(true);
  const [skipHolidays, setSkipHolidays] = useState(true);
  const [checkIn, setCheckIn] = useState<Dayjs | null>(null);
  const [checkOut, setCheckOut] = useState<Dayjs | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('present');
    setSelectedDays(new Set());
    setMemberIds([]);
    setShiftIds([]);
    setLocations([]);
    setRoles([]);
    setSkipWeekOffs(true);
    setSkipHolidays(true);
    setCheckIn(null);
    setCheckOut(null);
    setPinOpen(false);
    setSubmitting(false);
    setProgress(null);
  }, []);

  const handleClose = useCallback(() => {
    if (submitting) return;
    reset();
    onClose();
  }, [submitting, reset, onClose]);

  const toggleDay = (d: number) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  };

  // A day is "future" when it falls after today — attendance can never be marked
  // ahead of time, so future days are excluded from every quick-select and from
  // manual toggling below (backend also rejects/skips them as a safety net).
  const isFutureDay = useCallback(
    (d: number) => dayjs(`${year}-${month}-${d}`).isAfter(dayjs(), 'day'),
    [year, month],
  );
  const setAllDays = () =>
    setSelectedDays(
      new Set(Array.from({ length: daysInMonth }, (_, i) => i + 1).filter((d) => !isFutureDay(d))),
    );
  const clearDays = () => setSelectedDays(new Set());
  // Weekdays = Mon–Sat (exclude Sundays), and never future days.
  const setWeekdays = () => {
    const next = new Set<number>();
    for (let d = 1; d <= daysInMonth; d++) {
      if (dayjs(`${year}-${month}-${d}`).day() !== 0 && !isFutureDay(d)) next.add(d);
    }
    setSelectedDays(next);
  };

  const holidaySet = useMemo(
    () => new Set(holidays.map((h) => dayjs(h.date).format('YYYY-MM-DD'))),
    [holidays],
  );

  // Distinct shift / location / role options derived from the member roster.
  const shiftOptions = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m) => {
      if (m.shift) map.set(m.shift.id, m.shift.name);
    });
    return Array.from(map, ([value, label]) => ({ value, label }));
  }, [members]);
  const locationOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.location?.trim()) set.add(m.location.trim());
    });
    return Array.from(set, (loc) => ({ value: loc, label: loc }));
  }, [members]);
  const roleOptions = useMemo(() => {
    const set = new Set<string>();
    members.forEach((m) => {
      if (m.designation?.trim()) set.add(m.designation.trim());
    });
    return Array.from(set, (r) => ({ value: r, label: r }));
  }, [members]);

  // Target set = roster narrowed by scope filters (shift/location/role), then by
  // the explicit member multi-select. Each filter is AND-combined; an empty
  // filter imposes no constraint. Drives both the write and the live summary.
  const targetMembers = useMemo(
    () =>
      members.filter((m) => {
        if (shiftIds.length > 0 && (!m.shift || !shiftIds.includes(m.shift.id))) return false;
        if (locations.length > 0 && (!m.location || !locations.includes(m.location.trim())))
          return false;
        if (roles.length > 0 && (!m.designation || !roles.includes(m.designation.trim())))
          return false;
        if (memberIds.length > 0 && !memberIds.includes(m.id)) return false;
        return true;
      }),
    [members, shiftIds, locations, roles, memberIds],
  );

  // Compute the records to write + how many were skipped, given the selection.
  const { records, skippedWeekOff, skippedHoliday } = useMemo(() => {
    const recs: Array<{
      teamMemberId: string;
      date: string;
      status: AttendanceStatus;
      checkIn?: string | null;
      checkOut?: string | null;
    }> = [];
    let woff = 0;
    let hol = 0;
    const days = Array.from(selectedDays).sort((a, b) => a - b);
    for (const day of days) {
      const local = dayjs(
        `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      );
      // Never build a record for a future day, even if one slipped into the
      // selection — attendance is past/present only.
      if (local.isAfter(dayjs(), 'day')) continue;
      const ddd = local.format('ddd');
      const ymd = local.format('YYYY-MM-DD');
      const isHoliday = holidaySet.has(ymd);
      const dateUtc = dayjs.utc(ymd).startOf('day');
      const ci = checkIn
        ? local.hour(checkIn.hour()).minute(checkIn.minute()).second(0).toISOString()
        : undefined;
      const co = checkOut
        ? local.hour(checkOut.hour()).minute(checkOut.minute()).second(0).toISOString()
        : undefined;
      for (const m of targetMembers) {
        if (skipHolidays && isHoliday) {
          hol++;
          continue;
        }
        if (skipWeekOffs && m.weeklyOff?.includes(ddd)) {
          woff++;
          continue;
        }
        recs.push({
          teamMemberId: m.id,
          date: dateUtc.toISOString(),
          status,
          ...(ci ? { checkIn: ci } : {}),
          ...(co ? { checkOut: co } : {}),
        });
      }
    }
    return { records: recs, skippedWeekOff: woff, skippedHoliday: hol };
  }, [
    selectedDays,
    targetMembers,
    skipWeekOffs,
    skipHolidays,
    holidaySet,
    status,
    checkIn,
    checkOut,
    year,
    month,
  ]);

  const overCap = records.length > MAX_RECORDS;
  const timesInvalid = !!checkOut && !checkIn;

  const runSubmit = useCallback(async () => {
    setSubmitting(true);
    setProgress(null);
    // Chunk the write: a single POST of thousands of records blows past the 15s
    // axios timeout. Batch sequentially so each request finishes fast and the
    // user sees progress. -> bulkMarkAttendance (POST /attendance/bulk).
    const CHUNK = 300;
    let marked = 0;
    let skippedLocked = 0;
    let failed = 0;
    try {
      for (let start = 0; start < records.length; start += CHUNK) {
        const slice = records.slice(start, start + CHUNK);
        setProgress(
          `Marking ${Math.min(start + slice.length, records.length)} / ${records.length}…`,
        );
        try {
          const res = (await bulkMarkAttendance(workspaceId, {
            records: slice,
          })) as BulkMarkAttendanceResult;
          marked += res?.marked ?? slice.length;
          skippedLocked += res?.skippedLocked ?? 0;
        } catch {
          failed += slice.length;
        }
      }
      if (failed > 0 && marked === 0) {
        msg.error('Could not mark attendance. Please try again.');
      } else {
        msg.success(
          `Marked ${marked} record${marked === 1 ? '' : 's'}` +
            (skippedLocked ? ` · ${skippedLocked} locked skipped` : '') +
            (failed ? ` · ${failed} failed` : '') +
            '.',
        );
      }
      setPinOpen(false);
      reset();
      onDone();
      onClose();
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }, [workspaceId, records, msg, reset, onDone, onClose]);

  const statusOptions = ATTENDANCE_STATUSES.map((s) => ({
    value: s.value as AttendanceStatus,
    label: s.label,
  }));
  const monthLabel = dayjs(`${year}-${month}-01`).format('MMMM YYYY');

  return (
    <>
      <Modal
        open={open}
        onCancel={handleClose}
        title={`Bulk mark attendance - ${monthLabel}`}
        // Rule 11: action buttons stay fixed in the footer; only the form body
        // scrolls when it overflows — the modal shell / page never scroll.
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={handleClose}>Cancel</Button>
            <Button
              type="primary"
              disabled={records.length === 0 || overCap || timesInvalid}
              onClick={() => setPinOpen(true)}
            >
              Review &amp; mark {records.length || ''}
            </Button>
          </div>
        }
        width={640}
        styles={{ body: { maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' } }}
        destroyOnHidden
        mask={{ closable: !submitting }}
      >
        <div className="space-y-4">
          <Alert
            type="info"
            showIcon
            title="Mark many days at once"
            description="Choose a status and the days to apply it to. Use this to regularize a full month or a handful of days for everyone."
          />

          {/* Status */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <span className="text-sm font-medium text-heading">Status</span>
            <Select<AttendanceStatus>
              value={status}
              options={statusOptions}
              onChange={(v) => setStatus(v)}
              className="w-full max-w-[240px]"
            />
          </div>

          {/* Members (default all) */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <span className="text-sm font-medium text-heading">Members</span>
            <Select
              mode="multiple"
              allowClear
              value={memberIds}
              onChange={setMemberIds}
              placeholder="All members"
              maxTagCount="responsive"
              options={members.map((m) => ({ value: m.id, label: m.name }))}
              className="w-full"
              filterOption={(input, opt) =>
                (opt?.label as string).toLowerCase().includes(input.toLowerCase())
              }
            />
          </div>

          {/* Scope filters (#8): shift / location / role. Each narrows the target
              set; combine freely (AND). Hidden when the roster has no values for
              that dimension so the form stays clean for simple workspaces. */}
          {shiftOptions.length > 0 && (
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <span className="text-sm font-medium text-heading">Shift</span>
              <Select
                mode="multiple"
                allowClear
                value={shiftIds}
                onChange={setShiftIds}
                placeholder="All shifts"
                maxTagCount="responsive"
                options={shiftOptions}
                className="w-full"
              />
            </div>
          )}
          {locationOptions.length > 0 && (
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <span className="text-sm font-medium text-heading">Location</span>
              <Select
                mode="multiple"
                allowClear
                value={locations}
                onChange={setLocations}
                placeholder="All locations"
                maxTagCount="responsive"
                options={locationOptions}
                className="w-full"
              />
            </div>
          )}
          {roleOptions.length > 0 && (
            <div className="grid grid-cols-[120px_1fr] items-center gap-3">
              <span className="text-sm font-medium text-heading">Role</span>
              <Select
                mode="multiple"
                allowClear
                value={roles}
                onChange={setRoles}
                placeholder="All roles"
                maxTagCount="responsive"
                options={roleOptions}
                className="w-full"
              />
            </div>
          )}

          {/* Day picker */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-heading">Days</span>
              <div className="flex gap-1.5">
                <Button size="small" onClick={setAllDays}>
                  Whole month
                </Button>
                <Button size="small" onClick={setWeekdays}>
                  Mon–Sat
                </Button>
                <Button size="small" onClick={clearDays} disabled={selectedDays.size === 0}>
                  Clear
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                const local = dayjs(`${year}-${month}-${d}`);
                const isSunday = local.day() === 0;
                const isFuture = isFutureDay(d);
                const selected = selectedDays.has(d);
                return (
                  <Tooltip
                    key={d}
                    title={
                      isFuture
                        ? `${local.format('ddd, D MMM')} — future date`
                        : local.format('ddd, D MMM')
                    }
                  >
                    <Tag.CheckableTag
                      checked={selected}
                      // Future days are not selectable (no marking ahead of time).
                      onChange={() => {
                        if (!isFuture) toggleDay(d);
                      }}
                      className={`m-0 w-9 text-center tabular-nums ${
                        isFuture
                          ? 'cursor-not-allowed opacity-40'
                          : `cursor-pointer ${isSunday && !selected ? 'text-error' : ''}`
                      }`}
                    >
                      {d}
                    </Tag.CheckableTag>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Skips */}
          <div className="flex flex-wrap gap-4">
            <Checkbox checked={skipWeekOffs} onChange={(e) => setSkipWeekOffs(e.target.checked)}>
              Skip each member&apos;s weekly off
            </Checkbox>
            <Checkbox checked={skipHolidays} onChange={(e) => setSkipHolidays(e.target.checked)}>
              Skip workspace holidays
            </Checkbox>
          </div>

          {/* Optional times */}
          <div className="grid grid-cols-[120px_1fr] items-center gap-3">
            <span className="text-sm font-medium text-heading">Times (optional)</span>
            <div className="flex flex-wrap items-center gap-2">
              <TimePicker
                value={checkIn}
                onChange={setCheckIn}
                use12Hours
                format="hh:mm a"
                minuteStep={5}
                placeholder="Check-in"
              />
              <TimePicker
                value={checkOut}
                onChange={setCheckOut}
                use12Hours
                format="hh:mm a"
                minuteStep={5}
                placeholder="Check-out"
              />
            </div>
          </div>
          {timesInvalid && (
            <p className="m-0 text-sm text-error">Add a check-in time before a check-out time.</p>
          )}

          {/* Summary */}
          <div className="flex flex-wrap gap-2">
            <Tag color="processing">{records.length} records</Tag>
            <Tag>{targetMembers.length} members</Tag>
            <Tag>{selectedDays.size} days</Tag>
            {skippedWeekOff > 0 && <Tag color="default">{skippedWeekOff} week-off skipped</Tag>}
            {skippedHoliday > 0 && <Tag color="default">{skippedHoliday} holiday skipped</Tag>}
          </div>
          {overCap && (
            <Alert
              type="error"
              showIcon
              title={`Too many records (${records.length})`}
              description={`Keep it under ${MAX_RECORDS} per run. Narrow the members or days and try again.`}
            />
          )}
        </div>
      </Modal>

      <PinConfirmModal
        open={pinOpen}
        title="Confirm bulk attendance"
        description={`Enter your PIN to mark ${records.length} attendance record${
          records.length === 1 ? '' : 's'
        } across ${selectedDays.size} day${selectedDays.size === 1 ? '' : 's'}.`}
        confirmLabel={`Mark ${records.length}`}
        submitting={submitting}
        progress={progress ?? undefined}
        onConfirmed={runSubmit}
        onCancel={() => setPinOpen(false)}
      />
    </>
  );
}
