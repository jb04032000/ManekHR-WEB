'use client';
import { useState } from 'react';
import { Popover, Button, Checkbox, TimePicker, Tooltip } from 'antd';
import { ScheduleOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import type { ShiftInfo } from '@/types';

interface Props {
  shift: ShiftInfo;
  date: string; // YYYY-MM-DD (workspace date)
  memberCount: number;
  disabled?: boolean;
  loading?: boolean;
  onApply: (times: { checkIn?: string | null; checkOut?: string | null }) => Promise<void>;
}

/**
 * Popover that lets operator choose whether to set check-in, check-out, or both
 * at custom times (defaults to shift's scheduled start/end). Handles overnight
 * shifts - if end time ≤ start time, check-out ISO is shifted +1 day.
 */
export function ShiftTimesPopover({ shift, date, memberCount, disabled, loading, onApply }: Props) {
  const t = useTranslations('attendance.shiftTimes');
  const [open, setOpen] = useState(false);

  // Parse shift defaults
  const [sH, sM] = shift.startTime.split(':').map(Number);
  const [eH, eM] = shift.endTime.split(':').map(Number);
  const defaultIn = dayjs().hour(sH).minute(sM).second(0);
  const defaultOut = dayjs().hour(eH).minute(eM).second(0);

  const [setIn, setSetIn] = useState(true);
  const [setOut, setSetOut] = useState(false);
  const [timeIn, setTimeIn] = useState<Dayjs | null>(defaultIn);
  const [timeOut, setTimeOut] = useState<Dayjs | null>(defaultOut);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setSetIn(true);
    setSetOut(false);
    setTimeIn(defaultIn);
    setTimeOut(defaultOut);
  };

  const canApply = (setIn && !!timeIn) || (setOut && !!timeOut);

  const handleApply = async () => {
    if (!canApply) return;
    setSubmitting(true);
    try {
      // Use local dayjs (same pattern as row-level SetTimesPopover) - TimePicker
      // values are local times, so dates must also be constructed in local tz
      // before converting to ISO.
      const dateLocal = dayjs(date).startOf('day');
      let checkInIso: string | null = null;
      let checkOutIso: string | null = null;
      if (setIn && timeIn) {
        checkInIso = dateLocal.hour(timeIn.hour()).minute(timeIn.minute()).second(0).toISOString();
      }
      if (setOut && timeOut) {
        // Overnight: if end <= start, check-out falls on the next day
        const isOvernight = shift.endTime <= shift.startTime;
        const base = isOvernight ? dateLocal.add(1, 'day') : dateLocal;
        checkOutIso = base.hour(timeOut.hour()).minute(timeOut.minute()).second(0).toISOString();
      }
      await onApply({ checkIn: checkInIso, checkOut: checkOutIso });
      setOpen(false);
      reset();
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <div style={{ width: 260 }} onClick={(e) => e.stopPropagation()}>
      <p className="mb-2 text-xs text-gray-700">{t('markCount', { count: memberCount })}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox checked={setIn} onChange={(e) => setSetIn(e.target.checked)}>
            {t('checkIn')}
          </Checkbox>
          <TimePicker
            size="small"
            format="hh:mm a"
            use12Hours
            minuteStep={5}
            value={timeIn}
            onChange={setTimeIn}
            disabled={!setIn}
            style={{ flex: 1 }}
            allowClear={false}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Checkbox checked={setOut} onChange={(e) => setSetOut(e.target.checked)}>
            {t('checkOut')}
          </Checkbox>
          <TimePicker
            size="small"
            format="hh:mm a"
            use12Hours
            minuteStep={5}
            value={timeOut}
            onChange={setTimeOut}
            disabled={!setOut}
            style={{ flex: 1 }}
            allowClear={false}
          />
        </div>
        <Button
          type="primary"
          size="small"
          block
          loading={submitting || loading}
          disabled={!canApply}
          onClick={handleApply}
        >
          {t('apply')}
        </Button>
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
      trigger="click"
      placement="bottomRight"
      title={
        <span style={{ color: 'var(--cr-indigo-400)' }}>
          {t('shiftHeading', { name: shift.name })}
        </span>
      }
      content={content}
    >
      <Tooltip
        title={disabled ? undefined : t('buttonTooltip', { count: memberCount, name: shift.name })}
      >
        <Button
          size="small"
          icon={<ScheduleOutlined />}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          {t('buttonLabel')}
        </Button>
      </Tooltip>
    </Popover>
  );
}
