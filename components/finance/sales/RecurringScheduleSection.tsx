'use client';
/**
 * RecurringScheduleSection - schedule editor for recurring invoice templates (D-08).
 * Renders frequency radios (Monthly/Quarterly/Yearly/EveryNDays), day-of-month / every-N-days
 * inputs, start date picker, Next-3-runs preview chips, Auto-Post switch, and Notify checkboxes.
 */
import { useMemo } from 'react';
import { Radio, InputNumber, Switch, Checkbox, DatePicker } from 'antd';
import dayjs from 'dayjs';

export type ScheduleMode = 'monthly' | 'quarterly' | 'yearly' | 'every_n_days';

export interface RecurringSchedule {
  mode: ScheduleMode;
  dayOfMonth?: number;
  everyNDays?: number;
  startDate: string; // ISO string
  endDate?: string;
}

export interface NotifyChannels {
  email: boolean;
  whatsapp: boolean;
  sms: boolean;
}

interface Props {
  schedule: RecurringSchedule;
  onChange: (s: RecurringSchedule) => void;
  autoPostOnGenerate: boolean;
  onAutoPostChange: (v: boolean) => void;
  notifyOnGenerate: NotifyChannels;
  onNotifyChange: (n: NotifyChannels) => void;
}

// ── Date arithmetic helpers ──────────────────────────────────────────────────

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function clampToMonth(d: Date, targetDay: number): Date {
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const x = new Date(d);
  x.setDate(Math.min(targetDay, lastDay));
  return x;
}

function computeNext(s: RecurringSchedule, base: Date): Date {
  const day = s.dayOfMonth ?? base.getDate();
  switch (s.mode) {
    case 'monthly':
      return clampToMonth(addMonths(base, 1), day);
    case 'quarterly':
      return clampToMonth(addMonths(base, 3), day);
    case 'yearly':
      return clampToMonth(addMonths(base, 12), day);
    case 'every_n_days':
      return new Date(base.getTime() + (s.everyNDays ?? 7) * 86_400_000);
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export function RecurringScheduleSection({
  schedule,
  onChange,
  autoPostOnGenerate,
  onAutoPostChange,
  notifyOnGenerate,
  onNotifyChange,
}: Props) {
  // Compute Next 3 scheduled runs preview
  const next3 = useMemo(() => {
    const start = new Date(schedule.startDate);
    const r1 = computeNext(schedule, start);
    const r2 = computeNext(schedule, r1);
    const r3 = computeNext(schedule, r2);
    return [r1, r2, r3];
  }, [schedule]);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div
      style={{
        background: 'var(--cr-surface)',
        border: '1px solid var(--cr-border)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginTop: 24,
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 700,
          margin: 0,
          color: 'var(--cr-text)',
        }}
      >
        Schedule
      </h3>

      {/* Frequency */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Frequency</div>
        <Radio.Group
          value={schedule.mode}
          onChange={(e) => onChange({ ...schedule, mode: e.target.value as ScheduleMode })}
        >
          <Radio value="monthly">Monthly</Radio>
          <Radio value="quarterly">Quarterly</Radio>
          <Radio value="yearly">Yearly</Radio>
          <Radio value="every_n_days">Every N days</Radio>
        </Radio.Group>
      </div>

      {/* Day of month (monthly / quarterly / yearly) */}
      {(schedule.mode === 'monthly' ||
        schedule.mode === 'quarterly' ||
        schedule.mode === 'yearly') && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Day of month</div>
          <InputNumber
            min={1}
            max={31}
            value={schedule.dayOfMonth ?? 1}
            onChange={(v) => onChange({ ...schedule, dayOfMonth: v ?? 1 })}
            style={{ width: 100 }}
          />
          <span style={{ fontSize: 11, color: 'var(--cr-text-3)', marginLeft: 8 }}>
            (clamped to last day if month is shorter)
          </span>
        </div>
      )}

      {/* Every N days */}
      {schedule.mode === 'every_n_days' && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Every N days</div>
          <InputNumber
            min={1}
            max={365}
            value={schedule.everyNDays ?? 7}
            onChange={(v) => onChange({ ...schedule, everyNDays: v ?? 7 })}
            style={{ width: 100 }}
          />
        </div>
      )}

      {/* Start date */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>Start date</div>
        <DatePicker
          value={dayjs(schedule.startDate)}
          onChange={(d) => d && onChange({ ...schedule, startDate: d.toISOString() })}
          allowClear={false}
        />
      </div>

      {/* Next 3 scheduled runs preview */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Next 3 scheduled runs</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {next3.map((d, i) => (
            <span
              key={i}
              style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 12,
                background: 'var(--cr-primary-light, var(--cr-primary-light))',
                color: 'var(--cr-primary, var(--cr-primary))',
                fontWeight: 500,
              }}
            >
              {fmtDate(d)}
            </span>
          ))}
        </div>
      </div>

      {/* Auto-post toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Switch checked={autoPostOnGenerate} onChange={onAutoPostChange} />
        <span style={{ fontSize: 13 }}>
          Auto-post generated invoice{' '}
          <span style={{ color: 'var(--cr-text-3)', fontSize: 12 }}>
            (otherwise saves as draft for review)
          </span>
        </span>
      </div>

      {/* Notify on generate */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Notify on generate</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <Checkbox
            checked={notifyOnGenerate.email}
            onChange={(e) => onNotifyChange({ ...notifyOnGenerate, email: e.target.checked })}
          >
            Email
          </Checkbox>
          <Checkbox
            checked={notifyOnGenerate.whatsapp}
            onChange={(e) => onNotifyChange({ ...notifyOnGenerate, whatsapp: e.target.checked })}
          >
            WhatsApp
          </Checkbox>
          <Checkbox
            checked={notifyOnGenerate.sms}
            onChange={(e) => onNotifyChange({ ...notifyOnGenerate, sms: e.target.checked })}
          >
            SMS
          </Checkbox>
        </div>
      </div>
    </div>
  );
}
