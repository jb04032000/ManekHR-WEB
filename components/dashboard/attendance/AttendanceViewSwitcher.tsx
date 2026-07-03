'use client';

// 4-way view switcher for the main `/dashboard/attendance` page. Replaces
// the old daily/monthly Segmented inside AttendanceHeader and the
// standalone Live + Muster nav tabs - all four attendance lenses are now
// reachable from one URL via the `view` query param.
//
// Styling mirrors AttendanceWorkspaceNav's active-link aesthetic (rounded
// pill with primary-tinted active state) so the switcher feels like a
// natural extension of the top-level nav rather than a separate widget.

import type { ReactNode } from 'react';
import {
  CalendarOutlined,
  TableOutlined,
  ThunderboltOutlined,
  ScheduleOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export type AttendanceViewMode = 'daily' | 'monthly' | 'live' | 'muster';

interface ViewOption {
  value: AttendanceViewMode;
  labelKey: string;
  icon: ReactNode;
}

const VIEW_OPTIONS: ViewOption[] = [
  { value: 'daily', labelKey: 'viewSwitcher.daily', icon: <CalendarOutlined /> },
  { value: 'monthly', labelKey: 'viewSwitcher.monthly', icon: <ScheduleOutlined /> },
  { value: 'live', labelKey: 'viewSwitcher.live', icon: <ThunderboltOutlined /> },
  { value: 'muster', labelKey: 'viewSwitcher.muster', icon: <TableOutlined /> },
];

export interface AttendanceViewSwitcherProps {
  value: AttendanceViewMode;
  onChange: (next: AttendanceViewMode) => void;
}

export function AttendanceViewSwitcher({ value, onChange }: AttendanceViewSwitcherProps) {
  const t = useTranslations('attendance');

  return (
    <div
      role="tablist"
      aria-label={t('viewSwitcher.aria')}
      className="mb-4 inline-flex items-center gap-1 rounded-full border p-1"
      style={{
        borderColor: 'var(--cr-border)',
        background: 'var(--cr-surface-2,var(--cr-bg))',
      }}
    >
      {VIEW_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border-0 px-4 py-1.5 text-[13px] font-semibold transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-[var(--cr-primary)]/40 focus-visible:outline-none"
            style={{
              background: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
              color: active ? 'var(--cr-surface)' : 'var(--cr-text-2,var(--cr-text-4))',
              boxShadow: active ? '0 6px 14px rgba(22,119,255,0.18)' : 'none',
            }}
          >
            <span className="text-[13px] leading-none">{opt.icon}</span>
            <span>{t(opt.labelKey)}</span>
          </button>
        );
      })}
    </div>
  );
}

export default AttendanceViewSwitcher;
