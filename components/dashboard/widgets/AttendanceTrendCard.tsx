'use client';
/**
 * AttendanceTrendCard — daily present/late/absent over the current month, as a
 * recharts area+line chart, on the workforce dashboard (app/dashboard/page.tsx).
 * Self-fetches getAttendanceOverview (the same endpoint the Attendance Overview
 * page uses) and shows the month's avg attendance + on-time rate above the chart.
 *
 * Cross-module: reads attendance.actions.getAttendanceOverview (BE attendance
 * service). Gated by canSee('attendance') in page.tsx. Watch: `daily[]._id` is a
 * 'YYYY-MM-DD' string; keep the label mapping in sync if that shape changes.
 */
import { startTransition, useEffect, useState } from 'react';
import { Skeleton, Empty } from 'antd';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { getAttendanceOverview } from '@/lib/actions/attendance.actions';
import { WidgetCard } from './WidgetCard';

type Overview = Awaited<ReturnType<typeof getAttendanceOverview>>;

interface Props {
  wsId: string;
}

export function AttendanceTrendCard({ wsId }: Props) {
  const t = useTranslations('dashboard');
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    const now = dayjs();
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    getAttendanceOverview(wsId, now.month() + 1, now.year())
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  const daily = data?.daily ?? [];
  const series = daily.map((d) => ({
    day: dayjs(d._id).format('D'),
    present: d.present,
    late: d.late,
    absent: d.absent,
  }));
  const hasData = series.some((s) => s.present + s.late + s.absent > 0);

  return (
    <WidgetCard
      title={t('attendanceTrend.title')}
      iconColor="var(--cr-primary)"
      viewAllHref="/dashboard/attendance/overview"
      viewAllLabel={t('viewAll')}
    >
      {loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : error ? (
        <p className="m-0 text-xs" style={{ color: 'var(--cr-danger-700)' }}>
          {t('loadError')}
        </p>
      ) : !hasData ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('attendanceTrend.empty')} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-6">
            <Stat
              label={t('attendanceTrend.avgRate')}
              value={`${Math.round(data?.kpi.avgAttendanceRate ?? 0)}%`}
              color="var(--cr-success-700)"
            />
            <Stat
              label={t('attendanceTrend.onTimeRate')}
              value={`${Math.round(data?.kpi.onTimeRate ?? 0)}%`}
              color="var(--cr-info-700)"
            />
          </div>
          <div
            className="mb-2 flex flex-wrap gap-4 text-[11px]"
            style={{ color: 'var(--cr-text-3)' }}
          >
            <Legend color="var(--cr-success-500)" label={t('attendanceTrend.present')} />
            <Legend color="var(--cr-warning-500)" label={t('attendanceTrend.late')} />
            <Legend color="var(--cr-danger-500)" label={t('attendanceTrend.absent')} />
          </div>
          <div
            style={{ width: '100%', height: 220 }}
            role="img"
            aria-label={t('attendanceTrend.ariaLabel', {
              rate: Math.round(data?.kpi.avgAttendanceRate ?? 0),
            })}
          >
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cr-success-500)" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="var(--cr-success-500)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--cr-border)" vertical={false} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={14}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                  axisLine={false}
                  tickLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid var(--cr-border)',
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => `${t('attendanceTrend.dayLabel')} ${d}`}
                />
                <Area
                  type="monotone"
                  dataKey="present"
                  name={t('attendanceTrend.present')}
                  stroke="var(--cr-success-500)"
                  strokeWidth={2}
                  fill="url(#presentFill)"
                />
                <Line
                  type="monotone"
                  dataKey="late"
                  name={t('attendanceTrend.late')}
                  stroke="var(--cr-warning-500)"
                  strokeWidth={1.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="absent"
                  name={t('attendanceTrend.absent')}
                  stroke="var(--cr-danger-500)"
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </WidgetCard>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <p className="m-0 text-[11px] font-semibold tracking-wide text-faint uppercase">{label}</p>
      <p className="m-0 text-2xl font-bold tabular-nums" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export default AttendanceTrendCard;
