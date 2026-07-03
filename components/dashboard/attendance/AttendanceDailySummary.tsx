'use client';

import { useMemo } from 'react';
import { Tooltip, Skeleton } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { AttendanceSummary, AttendanceRecord } from '@/types';

interface Props {
  summary: AttendanceSummary | null;
  records: AttendanceRecord[];
  loading: boolean;
}

function fmt(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent: string; // tailwind text color class
  bg: string; // tailwind bg color class for icon badge
  tooltip?: string;
}

function StatCard({ icon, label, value, sub, accent, bg, tooltip }: StatCardProps) {
  const card = (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${bg} ${accent} shrink-0 text-base`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="m-0 truncate text-[11px] font-semibold tracking-widest text-slate-600 uppercase">
          {label}
        </p>
        <p className={`text-[20px] font-bold ${accent} m-0 leading-tight`}>{value}</p>
        {sub && <p className="m-0 truncate text-[11px] text-slate-600">{sub}</p>}
      </div>
    </div>
  );
  return tooltip ? <Tooltip title={tooltip}>{card}</Tooltip> : card;
}

export function AttendanceDailySummary({ summary, records, loading }: Props) {
  const t = useTranslations('attendance.dailySummary');
  const stats = useMemo(() => {
    const totalWorkedMinutes = records.reduce((sum, r) => sum + (r.workedMinutes ?? 0), 0);
    const stillActive = records.filter((r) => r.checkIn && !r.checkOut).length;
    const effectiveTotal = summary ? summary.total - summary.week_off - summary.holiday : 0;
    const present = summary?.present ?? 0;
    const late = summary?.late ?? 0;

    return { totalWorkedMinutes, stillActive, effectiveTotal, present, late };
  }, [records, summary]);

  if (loading && !summary) {
    return (
      <div className="mb-4 grid grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton.Button key={i} active block style={{ height: 72, borderRadius: 12 }} />
        ))}
      </div>
    );
  }

  if (!summary) return null;

  const presentRate =
    stats.effectiveTotal > 0 ? Math.round((stats.present / stats.effectiveTotal) * 100) : 0;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard
        icon={<CheckCircleOutlined />}
        label={t('present.label')}
        value={`${stats.present}/${stats.effectiveTotal}`}
        sub={t('present.sub', { rate: presentRate })}
        accent={
          presentRate >= 80
            ? 'text-green-700'
            : presentRate >= 60
              ? 'text-amber-700'
              : 'text-red-700'
        }
        bg={presentRate >= 80 ? 'bg-green-50' : presentRate >= 60 ? 'bg-amber-50' : 'bg-red-50'}
        tooltip={t('present.tooltip')}
      />

      <StatCard
        icon={<FieldTimeOutlined />}
        label={t('hoursWorked.label')}
        value={stats.totalWorkedMinutes > 0 ? fmt(stats.totalWorkedMinutes) : '-'}
        sub={stats.totalWorkedMinutes > 0 ? t('hoursWorked.subActive') : t('hoursWorked.subNoData')}
        accent="text-blue-700"
        bg="bg-blue-50"
        tooltip={t('hoursWorked.tooltip')}
      />

      <StatCard
        icon={<ClockCircleOutlined />}
        label={t('stillClockedIn.label')}
        value={stats.stillActive}
        sub={stats.stillActive > 0 ? t('stillClockedIn.subActive') : t('stillClockedIn.subDone')}
        accent={stats.stillActive > 0 ? 'text-amber-700' : 'text-slate-600'}
        bg={stats.stillActive > 0 ? 'bg-amber-50' : 'bg-slate-50'}
        tooltip={t('stillClockedIn.tooltip')}
      />

      <StatCard
        icon={<ExclamationCircleOutlined />}
        label={t('lateToday.label')}
        value={stats.late}
        sub={stats.late > 0 ? t('lateToday.subActive') : t('lateToday.subDone')}
        accent={stats.late > 0 ? 'text-orange-700' : 'text-slate-600'}
        bg={stats.late > 0 ? 'bg-orange-50' : 'bg-slate-50'}
        tooltip={t('lateToday.tooltip')}
      />
    </div>
  );
}
