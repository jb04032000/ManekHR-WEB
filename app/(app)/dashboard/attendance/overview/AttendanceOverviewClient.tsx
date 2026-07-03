'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Select, Table, Skeleton, Input } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined,
  RightOutlined,
  CalendarOutlined,
  StarFilled,
  AlertOutlined,
  AppstoreOutlined,
  TableOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { AttendanceMusterView } from '@/components/dashboard/attendance/AttendanceMusterView';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';

dayjs.extend(relativeTime);
import { useWorkspaceStore } from '@/lib/store';
import { getAttendanceOverview } from '@/lib/actions/attendance.actions';
import { anomaliesApi } from '@/lib/api';
import { teamApi } from '@/lib/api/modules/team.api';
import { monthOptions } from '@/lib/utils';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import {
  STATUS_COLORS,
  DsPageHeader,
  DsAvatar,
  DsMemberRow,
  DsTag,
  StatTile,
  InfoTooltip,
} from '@/components/ui';
import type { Anomaly, AnomalyRuleType } from '@/types';
import { MemberReportDrawer } from './MemberReportDrawer';

// ApexCharts is ~570KB minified; load it lazily so it stays out of this route's initial
// chunk. Both usages below already render behind the `mounted` guard, so ssr:false does
// not change what the server sends.
const ReactApexChart = dynamic(() => import('react-apexcharts'), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

type OverviewResponse = Awaited<ReturnType<typeof getAttendanceOverview>>;
type MemberRow = OverviewResponse['members'][number];
type DayRow = OverviewResponse['daily'][number];

// ── Helpers ────────────────────────────────────────────────────────────────────

const MONTHS = monthOptions(24);

function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AttendanceOverviewClient() {
  const t = useTranslations('attendance');
  const { currentWorkspaceId } = useWorkspaceStore();
  const now = dayjs();
  const searchParams = useSearchParams();

  const [mounted, setMounted] = useState(false);
  const [month, setMonth] = useState<number>(() => {
    const raw = searchParams.get('month');
    const parsed = raw !== null ? parseInt(raw, 10) : NaN;
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 12 ? parsed : now.month() + 1;
  });
  const [year, setYear] = useState<number>(() => {
    const raw = searchParams.get('year');
    const parsed = raw !== null ? parseInt(raw, 10) : NaN;
    return Number.isInteger(parsed) && parsed >= 2000 ? parsed : now.year();
  });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [prevData, setPrevData] = useState<OverviewResponse | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [shiftFilter, setShiftFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberRow | null>(null);
  // Tracks the last teamMemberId we auto-opened so the drawer does not
  // reopen after the user closes it (fires only once per focusId).
  const autoOpenedRef = useRef<string | null>(null);

  // Member Breakdown presentation toggle. "Summary" is the existing
  // counts table (rate %, present/late/absent totals, hours). "Register"
  // is the day × member status grid - the same data Muster used to show,
  // now folded in here so /grid doesn't need its own route. State is
  // ephemeral on purpose - the next visit reverts to Summary, which is
  // the lower-cost view to render.
  const [breakdownView, setBreakdownView] = useState<'summary' | 'register'>('summary');

  // Defer mounted flip out of the synchronous effect body to avoid the
  // setState-in-effect cascading-render warning. queueMicrotask schedules
  // the update on the next microtask, after the effect commit.
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      // Current-month + prev-month parallel fetch - prev powers delta chips.
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      try {
        const [res, prevRes] = await Promise.all([
          getAttendanceOverview(currentWorkspaceId, month, year),
          getAttendanceOverview(currentWorkspaceId, prevMonth, prevYear).catch(() => null),
        ]);
        if (!cancelled) {
          setData(res);
          setPrevData(prevRes);
        }
      } catch {
        if (!cancelled) {
          setData(null);
          setPrevData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, month, year]);

  // Anomalies feed - last 7 days · top 5
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await anomaliesApi.list(currentWorkspaceId, {
          unacknowledgedOnly: false,
          page: 1,
          limit: 5,
        });
        if (!cancelled) setAnomalies(res.items ?? []);
      } catch {
        if (!cancelled) setAnomalies([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentWorkspaceId, month, year]);

  // ── Deep-link auto-open: ?teamMemberId=<id> opens that member's drawer ───────
  // Fires once per focusId value; does NOT reopen if the user closes the drawer.

  useEffect(() => {
    const focusId = searchParams.get('teamMemberId');
    if (!focusId || autoOpenedRef.current === focusId) return;
    const list = data?.members ?? [];
    const match = list.find((m) => m.memberId === focusId);
    if (match) {
      autoOpenedRef.current = focusId;
      // queueMicrotask defers the setState out of the synchronous effect body
      // to avoid the cascading-render lint rule (same pattern as setMounted).
      queueMicrotask(() => setSelectedMember(match));
      return;
    }
    // The member has no records this period, so they are absent from the overview
    // aggregation. Wait for the list to load, then fetch the member directly so a
    // deep-link still opens their report drawer (the drawer self-fetches records).
    if (!data || !currentWorkspaceId) return;
    autoOpenedRef.current = focusId;
    void teamApi
      .get(currentWorkspaceId, focusId)
      .then((member) => {
        const row = {
          memberId: focusId,
          name: member.name,
          designation: member.designation ?? '',
          shiftName: member.shift?.name ?? '',
        } as unknown as MemberRow;
        queueMicrotask(() => setSelectedMember(row));
      })
      .catch(() => {
        /* member not fetchable - leave the overview as-is */
      });
  }, [searchParams, data, currentWorkspaceId]);

  // ── Shift options from members ────────────────────────────────────────────────

  const shiftOptions = useMemo(() => {
    const allShiftsLabel = t('overview.allShifts');
    if (!data) return [{ value: 'all', label: allShiftsLabel }];
    const map = new Map<string, string>();
    data.members.forEach((m) => {
      if (m.shiftName) map.set(m.shiftName, m.shiftName);
    });
    return [
      { value: 'all', label: allShiftsLabel },
      ...Array.from(map.keys()).map((s) => ({ value: s, label: s })),
    ];
  }, [data, t]);

  // ── Filtered members ──────────────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    if (!data) return [];
    return data.members.filter((m) => {
      const matchesShift = shiftFilter === 'all' || m.shiftName === shiftFilter;
      const matchesSearch =
        !search.trim() ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.designation?.toLowerCase().includes(search.toLowerCase());
      return matchesShift && matchesSearch;
    });
  }, [data, shiftFilter, search]);

  // ── Daily trend - fill ALL days of the month with zeros ───────────────────────

  const trendSeries = useMemo(() => {
    const daysInMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).daysInMonth();
    const dayIndex = new Map<string, DayRow>();
    (data?.daily ?? []).forEach((d) => dayIndex.set(d._id, d));

    const categories: string[] = [];
    const present: number[] = [];
    const late: number[] = [];
    const absent: number[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dp = dayIndex.get(key);
      categories.push(String(d));
      present.push(dp?.present ?? 0);
      late.push(dp?.late ?? 0);
      absent.push(dp?.absent ?? 0);
    }
    return { categories, present, late, absent };
  }, [data, month, year]);

  // ── Donut data ────────────────────────────────────────────────────────────────

  const donutData = useMemo(() => {
    if (!data) return { series: [], labels: [], colors: [] };
    const kpi = data.kpi;
    const raw = [
      {
        key: 'present',
        label: t('overview.chartLegend.onTime'),
        value: kpi.presentDays - kpi.lateDays,
      },
      { key: 'late', label: t('overview.chartLegend.late'), value: kpi.lateDays },
      { key: 'half_day', label: t('overview.chartLegend.halfDay'), value: kpi.halfDays },
      { key: 'absent', label: t('overview.chartLegend.absent'), value: kpi.absentDays },
      { key: 'on_leave', label: t('overview.chartLegend.onLeave'), value: kpi.leaveDays },
    ].filter((d) => d.value > 0);
    return {
      series: raw.map((d) => d.value),
      labels: raw.map((d) => d.label),
      colors: raw.map((d) => STATUS_COLORS[d.key]?.dot ?? 'var(--cr-neutral-400)'),
    };
  }, [data, t]);

  // ── ApexCharts options ────────────────────────────────────────────────────────

  const areaOptions: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'area',
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
        animations: { speed: 400, enabled: true },
      },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.02 } },
      dataLabels: { enabled: false },
      colors: [STATUS_COLORS.present.dot, STATUS_COLORS.late.dot, STATUS_COLORS.absent.dot],
      xaxis: {
        categories: trendSeries.categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: {
          style: { fontSize: '11px', colors: 'var(--cr-neutral-400)' },
          formatter: (val: string, i?: number) =>
            i !== undefined && (i % 4 === 0 || i === trendSeries.categories.length - 1) ? val : '',
        },
      },
      yaxis: {
        labels: {
          style: { fontSize: '11px', colors: 'var(--cr-neutral-400)' },
          formatter: (v: number) => Math.round(v).toString(),
        },
        min: 0,
        forceNiceScale: true,
      },
      grid: {
        borderColor: 'var(--cr-border-light)',
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
      },
      legend: {
        show: true,
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '12px',
        labels: { colors: 'var(--cr-text-5)' },
        markers: { size: 6 },
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (v: number) => t('overview.chartTooltip.members', { v }) },
      },
    }),
    [trendSeries.categories, t],
  );

  const donutOptions: ApexCharts.ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'donut',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { speed: 400, enabled: true },
      },
      colors: donutData.colors,
      labels: donutData.labels,
      plotOptions: {
        pie: {
          donut: {
            size: '60%',
            labels: {
              show: true,
              name: { show: true, fontSize: '12px', color: 'var(--cr-neutral-400)', offsetY: -4 },
              value: {
                show: true,
                fontSize: '24px',
                fontWeight: 700,
                color: 'var(--cr-text-2)',
                offsetY: 4,
              },
              total: {
                show: true,
                label: t('overview.donutCenterLabel'),
                color: 'var(--cr-neutral-400)',
                fontSize: '12px',
                formatter: (w: { globals: { seriesTotals: number[] } }) =>
                  String(w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0)),
              },
            },
          },
        },
      },
      dataLabels: { enabled: false },
      legend: {
        show: true,
        position: 'bottom',
        fontSize: '12px',
        labels: { colors: 'var(--cr-text-5)' },
        markers: { size: 6 },
        itemMargin: { horizontal: 8, vertical: 4 },
      },
      stroke: { width: 0 },
      tooltip: { y: { formatter: (v: number) => t('overview.chartTooltip.days', { v }) } },
    }),
    [donutData.colors, donutData.labels, t],
  );

  // ── Table columns ─────────────────────────────────────────────────────────────

  const columns: ColumnsType<MemberRow> = [
    {
      title: t('overview.member'),
      key: 'name',
      fixed: 'left',
      width: 240,
      render: (_, r) => (
        <DsMemberRow name={r.name} sub={r.designation || r.shiftName || '-'} size={32} />
      ),
    },
    {
      title: t('overview.shift'),
      dataIndex: 'shiftName',
      key: 'shift',
      width: 120,
      render: (v: string) =>
        v ? (
          <DsTag label={v} style={{ background: 'var(--cr-bg)', color: 'var(--cr-text-3)' }} />
        ) : (
          <span className="text-slate-200">-</span>
        ),
    },
    {
      title: (
        <span className="inline-flex items-center gap-1">
          {t('overview.rate')}
          <InfoTooltip
            text={t('overview.rateColumnTooltipText')}
            body={t('overview.rateColumnTooltipBody')}
          />
        </span>
      ),
      key: 'rate',
      sorter: (a, b) => a.rate - b.rate,
      defaultSortOrder: 'descend',
      width: 180,
      render: (_, r) => {
        const statusKey = r.rate >= 80 ? 'present' : r.rate >= 60 ? 'late' : 'absent';
        const color = STATUS_COLORS[statusKey].dot;
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full"
              style={{ background: 'var(--cr-border-light)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${r.rate}%`, background: color, transition: 'width 0.3s' }}
              />
            </div>
            <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color }}>
              {r.rate}%
            </span>
          </div>
        );
      },
    },
    {
      title: t('present'),
      dataIndex: 'present',
      key: 'present',
      sorter: (a, b) => a.present - b.present,
      width: 90,
      align: 'right',
      render: (v: number) => (
        <span
          className="text-[13px] font-semibold tabular-nums"
          style={{ color: 'var(--cr-success-700)' }}
        >
          {v}
        </span>
      ),
    },
    {
      title: t('overview.late'),
      dataIndex: 'late',
      key: 'late',
      sorter: (a, b) => a.late - b.late,
      width: 80,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <DsTag status="late" label={String(v)} />
        ) : (
          <span className="text-slate-200">-</span>
        ),
    },
    {
      title: t('absent'),
      dataIndex: 'absent',
      key: 'absent',
      sorter: (a, b) => a.absent - b.absent,
      width: 80,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <DsTag status="absent" label={String(v)} />
        ) : (
          <span className="text-slate-200">-</span>
        ),
    },
    {
      title: t('halfDay'),
      dataIndex: 'halfDay',
      key: 'halfDay',
      width: 90,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <DsTag status="half_day" label={String(v)} />
        ) : (
          <span className="text-slate-200">-</span>
        ),
    },
    {
      title: t('leave'),
      dataIndex: 'onLeave',
      key: 'onLeave',
      width: 80,
      align: 'right',
      render: (v: number) =>
        v > 0 ? (
          <DsTag status="on_leave" label={String(v)} />
        ) : (
          <span className="text-slate-200">-</span>
        ),
    },
    {
      title: t('overview.hoursWorked'),
      key: 'hours',
      sorter: (a, b) => a.totalWorkedMinutes - b.totalWorkedMinutes,
      width: 110,
      align: 'right',
      render: (_, r) => (
        <span
          className="text-[13px] font-medium tabular-nums"
          style={{ color: 'var(--cr-text-2)' }}
        >
          {r.totalWorkedMinutes > 0 ? (
            fmtHours(r.totalWorkedMinutes)
          ) : (
            <span className="text-slate-200">-</span>
          )}
        </span>
      ),
    },
    {
      key: 'drill',
      width: 36,
      align: 'center',
      render: () => <RightOutlined style={{ color: 'var(--cr-text-5)', fontSize: 11 }} />,
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  const kpi = data?.kpi;
  const noData = !loading && (!data || data.kpi.totalDays === 0);

  const headerMeta = data
    ? t('overview.headerMeta', {
        members: data.members.length,
        workingDays: data.kpi.totalDays,
      })
    : t('overview.subtitle');

  // ── Delta chips (current vs prev month) ────────────────────────────────────
  const fmtDelta = (
    cur: number,
    prev: number,
    unit = '',
  ): { value: string; positive?: boolean } | undefined => {
    if (!prev && prev !== 0) return undefined;
    const diff = cur - prev;
    if (diff === 0) return undefined;
    const sign = diff > 0 ? '+' : '';
    return {
      value: `${sign}${diff.toFixed(diff % 1 === 0 ? 0 : 1)}${unit}`,
      positive: diff > 0,
    };
  };
  const deltaAvg =
    prevData && kpi
      ? fmtDelta(kpi.avgAttendanceRate, prevData.kpi.avgAttendanceRate, '%')
      : undefined;
  const deltaHours =
    prevData && kpi
      ? fmtDelta(
          Math.round(kpi.totalWorkedMinutes / 60),
          Math.round(prevData.kpi.totalWorkedMinutes / 60),
          'h',
        )
      : undefined;
  const deltaOnTime =
    prevData && kpi ? fmtDelta(kpi.onTimeRate, prevData.kpi.onTimeRate, '%') : undefined;
  // Absent days - fewer is better, so invert positivity
  const absentRaw = prevData && kpi ? fmtDelta(kpi.absentDays, prevData.kpi.absentDays) : undefined;
  const deltaAbsent = absentRaw
    ? { value: absentRaw.value, positive: !absentRaw.positive }
    : undefined;

  // ── Chart series - derived from daily[] (no extra BE call) ────────────────
  const sparkPresent = trendSeries.present;
  // On-time daily: present - late
  const sparkOnTime = trendSeries.present.map((p, i) =>
    Math.max(0, p - (trendSeries.late[i] ?? 0)),
  );
  // Hours bars - proxy: members-present per day (no daily-hours field from BE)
  const hoursBars = trendSeries.present;
  // Absent spikes - red where >0, neutral track where 0
  const absentSpikes = trendSeries.absent.map((v) => ({
    value: v,
    color: v > 0 ? STATUS_COLORS.absent.dot : undefined,
  }));

  // ── Premium gate: charts on KPI tiles ──────────────────────────────────────
  const { hasAccess: chartsUnlocked } = useFeatureAccess('attendance', 'analytics_charts');

  // ── Premium gate: Register (Muster) view in Member Breakdown ─────────────
  const { isLocked: musterLocked } = useFeatureAccess('attendance', 'attendance_muster');

  // ── Value-suffix split - always peel "%" (and decimal) into the smaller
  //     subtle suffix so the big glyph stays compact. 93.4% → "93" + ".4%";
  //     100% → "100" + "%". Keeps proportions consistent across whole/fractional.
  const splitPercent = (n: number): { main: string; suffix?: string } => {
    if (n % 1 === 0) return { main: String(n), suffix: '%' };
    const whole = Math.trunc(n);
    const dec = Math.round((n - whole) * 10);
    return { main: String(whole), suffix: `.${dec}%` };
  };
  const avgParts = kpi ? splitPercent(kpi.avgAttendanceRate) : { main: '-' };
  const onTimeParts = kpi ? splitPercent(kpi.onTimeRate) : { main: '-' };
  const hoursInt = kpi ? Math.floor(kpi.totalWorkedMinutes / 60) : 0;
  const hoursPerMember =
    kpi && data && data.members.length > 0 ? (hoursInt / data.members.length).toFixed(1) : '0';

  // Absent trend direction (vs prev month) for footer label
  const absentDirection: 'stable' | 'up' | 'down' = (() => {
    if (!prevData || !kpi) return 'stable';
    if (kpi.absentDays === prevData.kpi.absentDays) return 'stable';
    return kpi.absentDays > prevData.kpi.absentDays ? 'up' : 'down';
  })();
  const unplannedAbsent = kpi ? Math.max(0, kpi.absentDays - kpi.leaveDays) : 0;

  // ── Top performer - highest rate, ties broken by most present days ─────────
  const topPerformer = useMemo(() => {
    if (!data || data.members.length === 0) return null;
    return [...data.members]
      .filter((m) => m.workingDays > 0)
      .sort((a, b) => {
        if (b.rate !== a.rate) return b.rate - a.rate;
        return b.present - a.present;
      })[0];
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Header - info icon INLINE w/ title (titleAside), filters on the right */}
      <DsPageHeader
        title={t('overview.title')}
        sub={headerMeta}
        icon={<CalendarOutlined />}
        titleAside={
          <InfoTooltip
            text={t('overview.headerExplainer')}
            body={t('overview.headerExplainerBody')}
          />
        }
        right={
          <>
            <Select
              value={shiftFilter}
              onChange={setShiftFilter}
              className="w-36"
              options={shiftOptions}
              aria-label={t('overview.filterByShift')}
            />
            <Select
              value={`${month}-${year}`}
              onChange={(v) => {
                const [m, y] = v.split('-');
                setMonth(Number(m));
                setYear(Number(y));
              }}
              className="w-36"
              options={MONTHS.map((m) => ({ value: `${m.month}-${m.year}`, label: m.label }))}
              aria-label={t('overview.selectMonth')}
            />
          </>
        }
      />

      {/* KPI tiles - auto-rows-fr keeps all 4 tiles same height regardless of hint length */}
      <div className="grid auto-rows-fr grid-cols-2 gap-4 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => (
            <Skeleton.Button key={i} active block style={{ height: 96, borderRadius: 12 }} />
          ))
        ) : (
          <>
            <StatTile
              label={t('overview.avgAttendance')}
              value={avgParts.main}
              valueSuffix={avgParts.suffix}
              emphasis
              trend={deltaAvg}
              chart={
                chartsUnlocked && sparkPresent.length > 1
                  ? { type: 'area', data: sparkPresent, color: STATUS_COLORS.present.dot }
                  : undefined
              }
              footerLeft={t('overview.tiles.avgFooterTarget', { target: 95 })}
              footerRight={t('overview.tiles.avgFooterTrend')}
            />
            <StatTile
              label={t('overview.totalHours')}
              value={kpi && kpi.totalWorkedMinutes > 0 ? String(hoursInt) : '-'}
              trend={deltaHours}
              chart={
                chartsUnlocked && hoursBars.length > 0
                  ? {
                      type: 'bars',
                      data: hoursBars,
                      color: 'var(--cr-primary-500,var(--cr-text-3))',
                    }
                  : undefined
              }
              footerLeft={t('overview.tiles.hoursFooterPerMember', { hours: hoursPerMember })}
              footerRight={t('overview.tiles.hoursFooterDays', {
                days: trendSeries.categories.length,
              })}
            />
            <StatTile
              label={t('overview.onTimeRate')}
              value={onTimeParts.main}
              valueSuffix={onTimeParts.suffix}
              trend={deltaOnTime}
              chart={
                chartsUnlocked && sparkOnTime.length > 1
                  ? { type: 'line', data: sparkOnTime, color: STATUS_COLORS.late.dot }
                  : undefined
              }
              footerLeft={
                kpi && kpi.lateDays > 0
                  ? t('overview.tiles.onTimeFooterLate', { count: kpi.lateDays })
                  : t('overview.tiles.onTimeFooterAllGood')
              }
              footerRight={
                kpi && kpi.lateDays > 0 ? t('overview.tiles.onTimeFooterAction') : undefined
              }
            />
            <StatTile
              label={t('overview.absentDays')}
              value={kpi ? String(kpi.absentDays) : '-'}
              tone={kpi && kpi.absentDays > 0 ? 'danger' : 'neutral'}
              trend={deltaAbsent}
              chart={
                chartsUnlocked && absentSpikes.length > 0
                  ? { type: 'spikes', data: absentSpikes }
                  : undefined
              }
              footerLeft={
                kpi
                  ? t('overview.tiles.absentFooterBreakdown', {
                      unplanned: unplannedAbsent,
                      leave: kpi.leaveDays,
                    })
                  : undefined
              }
              footerRight={t(
                `overview.tiles.absentFooter${absentDirection === 'stable' ? 'Stable' : absentDirection === 'up' ? 'Up' : 'Down'}` as
                  | 'overview.tiles.absentFooterStable'
                  | 'overview.tiles.absentFooterUp'
                  | 'overview.tiles.absentFooterDown',
              )}
            />
          </>
        )}
      </div>

      {/* Charts */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton active className="lg:col-span-2" paragraph={{ rows: 6 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : noData ? (
        <div
          className="rounded-xl border bg-surface py-16 text-center"
          style={{ borderColor: 'var(--cr-border-light)', color: 'var(--cr-text-3)' }}
        >
          {t('overview.noPeriodData')}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div
            className="rounded-xl border bg-surface p-5 lg:col-span-2"
            style={{ borderColor: 'var(--cr-border-light)' }}
          >
            <p
              className="m-0 mb-1 font-display text-[15px] font-semibold"
              style={{ color: 'var(--cr-text-1)' }}
            >
              {t('overview.dailyTrend')}
            </p>
            <p className="m-0 mb-3 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
              {t('overview.dailyTrendSub', {
                month: dayjs(`${year}-${month}-01`).format('MMMM YYYY'),
              })}
            </p>
            {mounted && (
              <ReactApexChart
                type="area"
                height={240}
                options={areaOptions}
                series={[
                  { name: t('present'), data: trendSeries.present },
                  { name: t('overview.late'), data: trendSeries.late },
                  { name: t('absent'), data: trendSeries.absent },
                ]}
              />
            )}
          </div>

          <div
            className="flex flex-col rounded-xl border bg-surface p-5"
            style={{ borderColor: 'var(--cr-border-light)' }}
          >
            <p
              className="m-0 mb-1 font-display text-[15px] font-semibold"
              style={{ color: 'var(--cr-text-1)' }}
            >
              {t('overview.statusDistribution')}
            </p>
            <p className="m-0 mb-2 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
              {t('overview.statusDistributionSub')}
            </p>
            {mounted && donutData.series.length > 0 ? (
              <div className="flex-1">
                <ReactApexChart
                  type="donut"
                  width="100%"
                  height={260}
                  options={donutOptions}
                  series={donutData.series}
                />
              </div>
            ) : (
              <div
                className="flex flex-1 items-center justify-center text-sm"
                style={{ color: 'var(--cr-text-5)' }}
              >
                {t('overview.noData')}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top performer + Anomalies feed row */}
      {!loading && !noData && (topPerformer || anomalies.length > 0) && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Top performer card - single gold-accented highlight */}
          {topPerformer && (
            <div
              className="rounded-xl border p-5"
              style={{
                background: 'var(--cr-wash-gold, var(--cr-gold-100))',
                borderColor: 'var(--cr-gold-400)',
              }}
            >
              <p
                className="m-0 mb-3 flex items-center gap-1.5 text-[11px] font-bold tracking-widest uppercase"
                style={{ color: 'var(--cr-gold-700)' }}
              >
                <StarFilled style={{ fontSize: 11 }} />
                {t('overview.topPerformer.eyebrow')}
              </p>
              <div className="flex items-center gap-3">
                <DsAvatar name={topPerformer.name} size={44} />
                <div className="min-w-0">
                  <p
                    className="m-0 truncate font-display text-[16px] font-bold"
                    style={{ color: 'var(--cr-text-1)' }}
                  >
                    {topPerformer.name}
                  </p>
                  <p className="m-0 truncate text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                    {topPerformer.designation || topPerformer.shiftName || '-'}
                  </p>
                </div>
              </div>
              <p
                className="m-0 mt-4 font-display text-[28px] leading-none font-bold tabular-nums"
                style={{ color: 'var(--cr-gold-700)' }}
              >
                {topPerformer.rate}%
              </p>
              <p className="m-0 mt-1.5 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                {t('overview.topPerformer.subFormat', {
                  present: topPerformer.present,
                  total: topPerformer.workingDays,
                })}
              </p>
            </div>
          )}

          {/* Anomalies feed - last 5 incidents */}
          <div
            className={`rounded-xl border bg-surface p-5 ${topPerformer ? 'lg:col-span-2' : 'lg:col-span-3'}`}
            style={{ borderColor: 'var(--cr-border-light)' }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p
                  className="m-0 flex items-center gap-1.5 font-display text-[15px] font-semibold"
                  style={{ color: 'var(--cr-text-1)' }}
                >
                  <AlertOutlined style={{ color: 'var(--cr-warning-700)' }} />
                  {t('overview.anomaliesFeed.title')}
                  <InfoTooltip
                    text={t('overview.anomaliesFeedTooltipText')}
                    body={t('overview.anomaliesFeedTooltipBody')}
                  />
                </p>
                <p className="m-0 mt-0.5 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                  {t('overview.anomaliesFeed.subtitle')}
                </p>
              </div>
              <Link
                href="/dashboard/attendance/anomalies"
                className="text-[13px] underline-offset-2 hover:underline"
                style={{ color: 'var(--cr-text-2)' }}
              >
                {t('overview.anomaliesFeed.viewAll')}
              </Link>
            </div>
            {anomalies.length === 0 ? (
              <p className="m-0 py-6 text-center text-[13px]" style={{ color: 'var(--cr-text-4)' }}>
                {t('overview.anomaliesFeed.empty')}
              </p>
            ) : (
              <ul className="m-0 list-none space-y-3 p-0">
                {anomalies.map((a) => {
                  // Backend `list()` populates teamMemberId → { _id, name }.
                  // Fall back to the overview member list for a raw-string id,
                  // then to the generic label for device-level anomalies.
                  const tm = a.teamMemberId;
                  const memberName =
                    (typeof tm === 'object' && tm?.name) ||
                    (typeof tm === 'string'
                      ? data?.members.find((m) => m.memberId === tm)?.name
                      : undefined) ||
                    t('overview.anomaliesFeed.unknownMember');
                  return (
                    <li key={a._id} className="flex items-start gap-3">
                      <DsAvatar name={memberName} size={32} />
                      <div className="min-w-0 flex-1">
                        <p
                          className="m-0 text-[13px] leading-snug"
                          style={{ color: 'var(--cr-text-1)' }}
                        >
                          <span className="font-semibold">{memberName}</span>
                          <span className="ml-1" style={{ color: 'var(--cr-text-3)' }}>
                            {t(
                              `overview.anomaliesFeed.rule.${a.ruleType}` as `overview.anomaliesFeed.rule.${AnomalyRuleType}`,
                            )}
                          </span>
                        </p>
                        <p className="m-0 text-[11px]" style={{ color: 'var(--cr-text-4)' }}>
                          {dayjs(a.createdAt).fromNow()}
                        </p>
                      </div>
                      {!a.acknowledged && (
                        <DsTag status="warning" label={t('overview.anomaliesFeed.unack')} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Member breakdown - Summary (counts) or Register (day × member
          status grid). Register is the Muster view folded in here so we
          don't need a separate route; mounts AttendanceMusterView with
          headers off and the period locked to the parent's month/year. */}
      {!loading && (data?.members.length ?? 0) > 0 && (
        <div
          className="overflow-hidden rounded-xl border bg-surface"
          style={{ borderColor: 'var(--cr-border-light)' }}
        >
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4"
            style={{ borderColor: 'var(--cr-border-light)' }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <div className="min-w-0">
                <p
                  className="m-0 font-display text-[16px] font-semibold"
                  style={{ color: 'var(--cr-text-1)' }}
                >
                  {t('overview.memberBreakdown')}
                </p>
                <p className="m-0 mt-0.5 text-[12px]" style={{ color: 'var(--cr-text-3)' }}>
                  {breakdownView === 'summary'
                    ? t('overview.membersSorted', {
                        filtered: filteredMembers.length,
                        total: data?.members.length ?? 0,
                      })
                    : t('overview.registerSub')}
                </p>
              </div>

              {/* Summary / Register toggle - same pill style as the
                  Patterns lookback group and the AttendanceWorkspaceNav
                  tabs, so the language of "this is a view switcher" is
                  consistent across the module. */}
              <div
                role="tablist"
                aria-label={t('overview.breakdownViewAria')}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border p-1"
                style={{
                  borderColor: 'var(--cr-border)',
                  background: 'var(--cr-surface-2,var(--cr-bg))',
                }}
              >
                {(
                  [
                    {
                      value: 'summary',
                      label: t('overview.breakdownViewSummary'),
                      icon: <AppstoreOutlined />,
                    },
                    {
                      value: 'register',
                      label: t('overview.breakdownViewRegister'),
                      icon: <TableOutlined />,
                    },
                  ] as const
                ).map((opt) => {
                  const active = breakdownView === opt.value;
                  const isRegisterLocked = opt.value === 'register' && musterLocked;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      disabled={isRegisterLocked}
                      title={isRegisterLocked ? t('overview.registerLockedHint') : undefined}
                      onClick={() => {
                        if (isRegisterLocked) return;
                        setBreakdownView(opt.value);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border-0 px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-[var(--cr-primary)]/40 focus-visible:outline-none"
                      style={{
                        background: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
                        color: active
                          ? 'var(--cr-surface)'
                          : isRegisterLocked
                            ? 'var(--cr-text-5)'
                            : 'var(--cr-text-2,var(--cr-text-4))',
                        boxShadow: active ? '0 4px 10px rgba(22,119,255,0.18)' : 'none',
                        opacity: isRegisterLocked ? 0.5 : 1,
                        cursor: isRegisterLocked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <span className="text-[12px] leading-none">{opt.icon}</span>
                      <span>{opt.label}</span>
                      {isRegisterLocked && <LockOutlined style={{ fontSize: 10, marginLeft: 1 }} />}
                    </button>
                  );
                })}
              </div>
            </div>

            {breakdownView === 'summary' && (
              <Input
                prefix={<SearchOutlined style={{ color: 'var(--cr-text-5)' }} />}
                placeholder={t('overview.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ width: 220 }}
                size="middle"
              />
            )}
          </div>

          {breakdownView === 'summary' ? (
            <>
              <Table<MemberRow>
                dataSource={filteredMembers}
                columns={columns}
                rowKey="memberId"
                size="middle"
                // BUGFIX (#3): pageSize was a *controlled* prop fixed at 20 with no
                // onShowSizeChange, so picking "100 / page" had no effect. Use an
                // uncontrolled defaultPageSize + an explicit size changer so AntD
                // manages the page size and the selector actually applies.
                pagination={
                  filteredMembers.length > 20
                    ? {
                        defaultPageSize: 20,
                        size: 'small',
                        showSizeChanger: true,
                        pageSizeOptions: ['20', '50', '100', '200'],
                        showTotal: (total) => t('overview.memberCount', { count: total }),
                      }
                    : false
                }
                // Scroll containment (rule 11/#7): scroll.y bounds the body and
                // keeps the header fixed within it, so the table scrolls in place
                // instead of growing the page. (No page-level `sticky` — it would
                // fight scroll.y's own fixed header.)
                scroll={{ x: 980, y: 'calc(100vh - 360px)' }}
                onRow={(r) => ({
                  onClick: () => setSelectedMember(r),
                  onKeyDown: (e: React.KeyboardEvent<HTMLTableRowElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedMember(r);
                    }
                  },
                  tabIndex: 0,
                  role: 'button',
                  className:
                    'cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-[var(--cr-primary)]/40 focus-visible:outline-none',
                  style: { transition: 'background 0.15s' },
                })}
              />
              {filteredMembers.length <= 20 && filteredMembers.length > 0 && (
                <div
                  className="border-t px-5 py-3 text-[12px]"
                  style={{
                    borderColor: 'var(--cr-border-light)',
                    color: 'var(--cr-text-3)',
                  }}
                >
                  {t('overview.showingOf', {
                    filtered: filteredMembers.length,
                    total: data?.members.length ?? 0,
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="p-4">
              {musterLocked ? (
                <FeatureGate module="attendance" subFeature="attendance_muster" />
              ) : (
                <AttendanceMusterView
                  initialMonth={month}
                  initialYear={year}
                  showHeader={false}
                  allowPeriodNav={false}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Member detail drawer */}
      {selectedMember && currentWorkspaceId && (
        <MemberReportDrawer
          open={!!selectedMember}
          onClose={() => setSelectedMember(null)}
          wsId={currentWorkspaceId}
          memberId={selectedMember.memberId}
          memberName={selectedMember.name}
          designation={selectedMember.designation}
          shiftName={selectedMember.shiftName}
          initialMonth={month}
          initialYear={year}
        />
      )}
    </div>
  );
}
