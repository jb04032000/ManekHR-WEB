'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Segmented,
  Skeleton,
  Table,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { LeftOutlined, ReloadOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { attendanceApi } from '@/lib/api/modules/attendance.api';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { DsAvatar, DsEmptyState, InfoTooltip, StatTile } from '@/components/ui';
import type { OvertimeAnalytics, OvertimeAnalyticsGroup, OvertimeAnalyticsMember } from '@/types';

// Owner-set assumed OT rate (₹/hour) for the cost estimate - persisted per
// browser. OT pay is never auto-applied, so the rate is a what-if input, not
// a wage of record (members span monthly / hourly / piece-rate pay types).
const RATE_KEY = 'cr.otRatePerHour';

function fmtHm(min: number): string {
  if (!min || min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

function toHours(min: number): number {
  return Math.round((min / 60) * 10) / 10;
}

function fmtCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function OvertimePanel() {
  const t = useTranslations('attendance.overtimeAnalytics');
  const { currentWorkspaceId: wsId } = useWorkspaceStore();

  const [month, setMonth] = useState(() => dayjs().month() + 1);
  const [year, setYear] = useState(() => dayjs().year());
  const [data, setData] = useState<OvertimeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'shift' | 'designation'>('shift');
  // Lazy init - the rate input only renders after the client-side fetch
  // resolves, so it is never part of the SSR tree (no hydration mismatch).
  const [rate, setRate] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const v = Number(window.localStorage.getItem(RATE_KEY));
    return Number.isFinite(v) && v > 0 ? v : 0;
  });

  // Fetch effect - setState only inside promise callbacks, so it does not
  // trip react-hooks/set-state-in-effect. `fetching` is flipped on by the
  // month-nav handlers (event handlers) and cleared here.
  useEffect(() => {
    if (!wsId) return;
    attendanceApi
      .overtimeAnalytics(wsId, month, year)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, [wsId, month, year]);

  const retry = useCallback(() => {
    if (!wsId) return;
    setFetching(true);
    attendanceApi
      .overtimeAnalytics(wsId, month, year)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setFetching(false));
  }, [wsId, month, year]);

  const goPrev = () => {
    setFetching(true);
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    setFetching(true);
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const pickMonth = (d: dayjs.Dayjs | null) => {
    if (!d) return;
    setFetching(true);
    setMonth(d.month() + 1);
    setYear(d.year());
  };

  const onRateChange = (v: number | null) => {
    const next = v && v > 0 ? v : 0;
    setRate(next);
    if (typeof window === 'undefined') return;
    if (next > 0) window.localStorage.setItem(RATE_KEY, String(next));
    else window.localStorage.removeItem(RATE_KEY);
  };

  const kpi = data?.kpi;
  const hasOt = (kpi?.totalOtMinutes ?? 0) > 0;

  const trendData = useMemo(
    () =>
      (data?.daily ?? []).map((d) => ({
        day: d.day,
        otHours: toHours(d.otMinutes),
        otMinutes: d.otMinutes,
      })),
    [data],
  );

  const groups: OvertimeAnalyticsGroup[] = useMemo(
    () => (groupBy === 'shift' ? (data?.byShift ?? []) : (data?.byDesignation ?? [])),
    [data, groupBy],
  );

  const groupData = useMemo(
    () =>
      groups.map((g) => ({
        label: g.label,
        otHours: toHours(g.otMinutes),
        otMinutes: g.otMinutes,
        members: g.members,
      })),
    [groups],
  );

  const filteredMembers = useMemo(() => {
    const members = data?.byMember ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.designation.toLowerCase().includes(q),
    );
  }, [data, search]);

  const estTotalCost = rate > 0 && kpi ? (kpi.totalOtMinutes / 60) * rate : 0;

  const columns: ColumnsType<OvertimeAnalyticsMember> = useMemo(
    () => [
      {
        title: t('table.colMember'),
        key: 'member',
        render: (_: unknown, m) => (
          <div className="flex items-center gap-2.5">
            <DsAvatar name={m.name} size={32} />
            <div className="min-w-0">
              <p className="m-0 truncate text-[13px] font-semibold text-gray-900">{m.name}</p>
              {m.designation && (
                <p className="m-0 truncate text-[12px] text-gray-500">{m.designation}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        title: t('table.colShift'),
        dataIndex: 'shiftName',
        key: 'shift',
        render: (s: string) => s || '-',
      },
      {
        title: t('table.colOt'),
        key: 'ot',
        align: 'right',
        defaultSortOrder: 'descend',
        sorter: (a, b) => a.otMinutes - b.otMinutes,
        render: (_: unknown, m) => (
          <span className="font-semibold tabular-nums">{fmtHm(m.otMinutes)}</span>
        ),
      },
      {
        title: t('table.colOtDays'),
        dataIndex: 'otDays',
        key: 'otDays',
        align: 'right',
        sorter: (a, b) => a.otDays - b.otDays,
        render: (v: number) => <span className="tabular-nums">{v}</span>,
      },
      {
        title: t('table.colAvgPerDay'),
        key: 'avg',
        align: 'right',
        render: (_: unknown, m) => (
          <span className="tabular-nums">{fmtHm(m.otDays > 0 ? m.otMinutes / m.otDays : 0)}</span>
        ),
      },
      {
        title: t('table.colPeakDay'),
        dataIndex: 'peakDayMinutes',
        key: 'peak',
        align: 'right',
        render: (v: number) => <span className="tabular-nums">{fmtHm(v)}</span>,
      },
      {
        title: t('table.colEstCost'),
        key: 'cost',
        align: 'right',
        render: (_: unknown, m) => (
          <span className="tabular-nums">
            {rate > 0 ? fmtCurrency((m.otMinutes / 60) * rate) : '-'}
          </span>
        ),
      },
    ],
    [t, rate],
  );

  return (
    <FeatureGate module="attendance" subFeature="overtime_analytics" as="h1">
      <div>
        {/* Toolbar - date navigation controls from DsPageHeader right= */}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button icon={<LeftOutlined />} onClick={goPrev} aria-label={t('prevMonth')} />
          <DatePicker
            picker="month"
            allowClear={false}
            value={dayjs(new Date(year, month - 1, 1))}
            format="MMMM YYYY"
            onChange={pickMonth}
          />
          <Button icon={<RightOutlined />} onClick={goNext} aria-label={t('nextMonth')} />
        </div>

        {loading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : error ? (
          <Card>
            <DsEmptyState
              title={t('loadError')}
              action={
                <Button icon={<ReloadOutlined />} onClick={retry}>
                  {t('retry')}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {/* Margin lives on this wrapper, not the Alert: antd v6's Alert
              root carries a CSS-in-JS `margin:0` reset (injected unlayered),
              which overrides a Tailwind `mb-*` (layered) set on the Alert
              itself. A plain <div> takes the utility reliably. */}
            <div className="mb-4">
              <Alert type="info" showIcon title={t('notExplainer')} />
            </div>

            {!hasOt ? (
              <Card>
                <DsEmptyState
                  title={t('emptyTitle')}
                  sub={t('emptySub')}
                  action={
                    <Link href="/dashboard/attendance/settings/policies">
                      <Button type="primary">{t('openPolicies')}</Button>
                    </Link>
                  }
                />
              </Card>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                  <StatTile
                    label={t('kpi.totalOt')}
                    value={String(toHours(kpi?.totalOtMinutes ?? 0))}
                    valueSuffix="h"
                  />
                  <StatTile
                    label={t('kpi.otDays')}
                    value={String(kpi?.otDays ?? 0)}
                    hint={t('kpi.otDaysHint')}
                  />
                  <StatTile
                    label={t('kpi.membersWithOt')}
                    value={String(kpi?.membersWithOt ?? 0)}
                  />
                  <StatTile
                    label={t('kpi.avgPerMember')}
                    value={String(toHours(kpi?.avgOtMinutesPerMember ?? 0))}
                    valueSuffix="h"
                  />
                  <StatTile
                    label={t('kpi.peakDay')}
                    value={String(toHours(kpi?.peakDayMinutes ?? 0))}
                    valueSuffix="h"
                    hint={t('kpi.peakDayHint')}
                  />
                </div>

                <div className="mb-4">
                  <Card styles={{ body: { padding: 16 } }}>
                    <p className="m-0 mb-3 text-[14px] font-semibold text-gray-900">
                      {t('trendTitle')}
                    </p>
                    <div role="img" aria-label={t('chart.trendAriaLabel')}>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={trendData}
                          margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="var(--cr-border)"
                            vertical={false}
                          />
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 11, fill: 'var(--cr-text-3)' }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                            axisLine={false}
                            tickLine={false}
                            width={40}
                            tickFormatter={(v: number) => `${v}h`}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--cr-surface-2, rgba(0,0,0,0.04))' }}
                            labelFormatter={(label) => t('tip.dayLabel', { day: String(label) })}
                            formatter={(_value, _name, item) => {
                              const entry = item as unknown as { payload?: { otMinutes?: number } };
                              return [fmtHm(entry.payload?.otMinutes ?? 0), t('tip.otHours')];
                            }}
                          />
                          <Bar
                            dataKey="otHours"
                            name={t('tip.otHours')}
                            fill="var(--cr-primary)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={28}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2" styles={{ body: { padding: 16 } }}>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 text-[14px] font-semibold text-gray-900">
                        {t('groupTitle')}
                      </p>
                      <Segmented
                        size="small"
                        value={groupBy}
                        onChange={(v) => setGroupBy(v as 'shift' | 'designation')}
                        options={[
                          { label: t('segShift'), value: 'shift' },
                          { label: t('segDesignation'), value: 'designation' },
                        ]}
                      />
                    </div>
                    {groupData.length === 0 ? (
                      <DsEmptyState title={t('groupEmpty')} />
                    ) : (
                      <div role="img" aria-label={t('chart.groupAriaLabel')}>
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart
                            data={groupData}
                            margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="var(--cr-border)"
                              vertical={false}
                            />
                            <XAxis
                              dataKey="label"
                              tick={{ fontSize: 11, fill: 'var(--cr-text-3)' }}
                              axisLine={false}
                              tickLine={false}
                              interval={0}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                              axisLine={false}
                              tickLine={false}
                              width={40}
                              tickFormatter={(v: number) => `${v}h`}
                            />
                            <Tooltip
                              cursor={{ fill: 'var(--cr-surface-2, rgba(0,0,0,0.04))' }}
                              formatter={(_value, _name, item) => {
                                const entry = item as unknown as {
                                  payload?: { otMinutes?: number };
                                };
                                return [fmtHm(entry.payload?.otMinutes ?? 0), t('tip.otHours')];
                              }}
                            />
                            <Bar
                              dataKey="otHours"
                              name={t('tip.otHours')}
                              fill="var(--cr-info-500)"
                              radius={[4, 4, 0, 0]}
                              maxBarSize={48}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </Card>

                  <Card styles={{ body: { padding: 16 } }}>
                    <div className="mb-3 flex items-center gap-1.5">
                      <p className="m-0 text-[14px] font-semibold text-gray-900">
                        {t('cost.title')}
                      </p>
                      <InfoTooltip
                        variant="popover"
                        text={t('cost.disclaimerTooltipTitle')}
                        body={
                          <p className="m-0 text-[13px] leading-[1.55] text-gray-700">
                            {t('cost.disclaimer')}
                          </p>
                        }
                      />
                    </div>
                    <div className="mb-1 flex items-center gap-1">
                      <label
                        htmlFor="ot-rate-input"
                        className="text-[12px] font-medium text-gray-500"
                      >
                        {t('cost.rateLabel')}
                      </label>
                      <InfoTooltip text={t('cost.rateTooltip')} />
                    </div>
                    <InputNumber
                      id="ot-rate-input"
                      className="w-full"
                      min={0}
                      step={10}
                      value={rate > 0 ? rate : null}
                      onChange={onRateChange}
                      placeholder={t('cost.ratePlaceholder')}
                      prefix="₹"
                    />
                    <div className="mt-4">
                      {rate > 0 ? (
                        <>
                          <p className="m-0 text-[12px] font-medium text-gray-500">
                            {t('cost.totalLabel')}
                          </p>
                          <p className="m-0 text-[26px] font-bold text-gray-900 tabular-nums">
                            {fmtCurrency(estTotalCost)}
                          </p>
                        </>
                      ) : (
                        <p className="m-0 text-[13px] text-gray-500">{t('cost.hint')}</p>
                      )}
                    </div>
                    <p className="m-0 mt-3 text-[12px] leading-[1.45] text-gray-400">
                      {t('cost.disclaimerShort')}
                    </p>
                  </Card>
                </div>

                <Card styles={{ body: { padding: 12 } }}>
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="m-0 px-1 text-[14px] font-semibold text-gray-900">
                      {t('table.title')}
                    </p>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder={t('searchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-xs"
                      data-shortcut="attendance-search"
                    />
                  </div>
                  <Table
                    size="small"
                    rowKey="memberId"
                    loading={fetching}
                    columns={columns}
                    dataSource={filteredMembers}
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 20, hideOnSinglePage: true }}
                    locale={{
                      emptyText: (
                        <DsEmptyState title={t('table.emptyTitle')} sub={t('table.emptySub')} />
                      ),
                    }}
                  />
                </Card>
              </>
            )}
          </>
        )}
      </div>
    </FeatureGate>
  );
}
