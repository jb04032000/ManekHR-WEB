'use client';
import { useMemberFormOptions } from './useMemberFormOptions';

interface WeeklyOffPickerProps {
  value?: string[];
  onChange?: (v: string[]) => void;
  disabled?: boolean;
}

export default function WeeklyOffPicker({ value = [], onChange, disabled }: WeeklyOffPickerProps) {
  const { weekDays } = useMemberFormOptions();
  const toggle = (d: string) => {
    if (disabled) return;
    const next = value.includes(d) ? value.filter((x) => x !== d) : [...value, d];
    onChange?.(next);
  };

  return (
    <div className="flex gap-2">
      {weekDays.map((day) => {
        const isOff = value.includes(day.value);
        return (
          <button
            key={day.value}
            type="button"
            onClick={() => toggle(day.value)}
            title={day.name}
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              border: `1.5px solid ${isOff ? 'var(--cr-danger-500)' : 'var(--cr-border, var(--cr-border))'}`,
              background: isOff ? 'var(--cr-danger-50)' : 'var(--cr-surface, #fff)',
              color: isOff ? 'var(--cr-danger-500)' : 'var(--cr-text-4, var(--cr-text-5))',
              fontWeight: 700,
              fontSize: 12,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
          >
            {day.label}
          </button>
        );
      })}
    </div>
  );
}
