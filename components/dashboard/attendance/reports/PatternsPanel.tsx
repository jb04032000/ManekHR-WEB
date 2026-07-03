'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Input, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { attendanceApi } from '@/lib/api/modules/attendance.api';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { DsAvatar, DsEmptyState, InfoTooltip, StatTile } from '@/components/ui';
import type { AbsencePatternMember, AbsencePatterns } from '@/types';

type Band = 'low' | 'moderate' | 'high' | 'veryHigh';

const BAND_ORDER: Band[] = ['veryHigh', 'high', 'moderate', 'low'];

// antd Tag colour per Bradford band.
const BAND_COLOR: Record<Band, string> = {
  low: 'green',
  moderate: 'gold',
  high: 'volcano',
  veryHigh: 'red',
};

// Dot colour per band (CSS, for the breakdown card).
const BAND_HEX: Record<Band, string> = {
  low: 'var(--cr-success-500, #52c41a)',
  moderate: 'var(--cr-warning-500, #faad14)',
  high: 'var(--cr-warning-600, #d4380d)',
  veryHigh: 'var(--cr-danger-500, #ff4d4f)',
};

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

const LOOKBACK_OPTIONS = [3, 6, 12];

function bandOf(score: number): Band {
  if (score >= 400) return 'veryHigh';
  if (score >= 125) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}

// Index of the weekday with the most absences; -1 when there are none.
function worstWeekday(weekday: number[]): number {
  let max = 0;
  let idx = -1;
  for (let i = 0; i < 7; i += 1) {
    if (weekday[i] > max) {
      max = weekday[i];
      idx = i;
    }
  }
  return idx;
}

export function PatternsPanel() {
  const t = useTranslations('attendance.absencePatterns');
  const { currentWorkspaceId: wsId } = useWorkspaceStore();

  const [months, setMonths] = useState(6);
  const [data, setData] = useState<AbsencePatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  // Fetch effect - setState only inside promise callbacks (does not trip
  // react-hooks/set-state-in-effect). `fetching` is flipped on by the
  // lookback selector and cleared here.
  useEffect(() => {
    if (!wsId) return;
    attendanceApi
      .absencePatterns(wsId, months)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, [wsId, months]);

  const retry = useCallback(() => {
    if (!wsId) return;
    setFetching(true);
    attendanceApi
      .absencePatterns(wsId, months)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setFetching(false));
  }, [wsId, months]);

  const onLookbackChange = (v: number) => {
    setFetching(true);
    setMonths(v);
  };

  const summary = data?.summary;
  const members = useMemo(() => data?.members ?? [], [data]);
  const hasData = members.length > 0;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.designation.toLowerCase().includes(q),
    );
  }, [members, search]);

  const weekdayData = useMemo(
    () =>
      WEEKDAY_KEYS.map((key, i) => ({
        day: t(`weekdays.${key}`),
        count: summary?.weekday[i] ?? 0,
      })),
    [summary, t],
  );

  const bandCounts = useMemo(() => {
    const counts: Record<Band, number> = { low: 0, moderate: 0, high: 0, veryHigh: 0 };
    for (const m of members) counts[bandOf(m.bradfordScore)] += 1;
    return counts;
  }, [members]);

  const worstDayLabel = useMemo(() => {
    const idx = worstWeekday(summary?.weekday ?? []);
    return idx >= 0 ? t(`weekdays.${WEEKDAY_KEYS[idx]}`) : '-';
  }, [summary, t]);

  const columns: ColumnsType<AbsencePatternMember> = useMemo(
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
        title: t('table.colAbsentDays'),
        dataIndex: 'absentDays',
        key: 'absentDays',
        align: 'right',
        sorter: (a, b) => a.absentDays - b.absentDays,
        render: (v: number) => <span className="tabular-nums">{v}</span>,
      },
      {
        title: (
          <span className="inline-flex items-center gap-1">
            {t('table.colSpells')}
            <InfoTooltip text={t('table.colSpellsTooltip')} />
          </span>
        ),
        dataIndex: 'spells',
        key: 'spells',
        align: 'right',
        sorter: (a, b) => a.spells - b.spells,
        render: (v: number) => <span className="tabular-nums">{v}</span>,
      },
      {
        title: t('table.colLongestSpell'),
        dataIndex: 'longestSpell',
        key: 'longestSpell',
        align: 'right',
        render: (v: number) => <span className="tabular-nums">{t('unitDays', { count: v })}</span>,
      },
      {
        title: t('table.colWorstDay'),
        key: 'worstDay',
        align: 'center',
        render: (_: unknown, m) => {
          const idx = worstWeekday(m.weekday);
          return idx >= 0 ? t(`weekdays.${WEEKDAY_KEYS[idx]}`) : '-';
        },
      },
      {
        title: (
          <span className="inline-flex items-center gap-1">
            {t('table.colBradford')}
            <InfoTooltip
              variant="popover"
              text={t('table.colBradfordTooltipTitle')}
              body={
                <div className="space-y-2 text-[13px] leading-[1.55] text-gray-700">
                  <p className="m-0">{t('table.colBradfordTooltipBody1')}</p>
                  <p className="m-0">{t('table.colBradfordTooltipBody2')}</p>
                  <p className="m-0">{t('table.colBradfordTooltipBody3')}</p>
                </div>
              }
            />
          </span>
        ),
        key: 'bradford',
        align: 'right',
        defaultSortOrder: 'descend',
        sorter: (a, b) => a.bradfordScore - b.bradfordScore,
        render: (_: unknown, m) => {
          const band = bandOf(m.bradfordScore);
          return (
            <Tag color={BAND_COLOR[band]} className="m-0 tabular-nums">
              {m.bradfordScore} · {t(`bands.${band}`)}
            </Tag>
          );
        },
      },
    ],
    [t],
  );

  return (
    <FeatureGate module="attendance" subFeature="absence_patterns" as="h1">
      <div>
        {/* Toolbar - lookback pill buttons from DsPageHeader right= */}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <div
            role="group"
            aria-label={t('lookbackAria')}
            className="inline-flex items-center gap-1 rounded-full border p-1"
            style={{
              borderColor: 'var(--cr-border)',
              background: 'var(--cr-surface-2,var(--cr-bg))',
            }}
          >
            {LOOKBACK_OPTIONS.map((m) => {
              const active = months === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onLookbackChange(m)}
                  aria-pressed={active}
                  className="cursor-pointer rounded-full border-0 px-3.5 py-1.5 text-[13px] font-semibold transition-all duration-200 select-none focus-visible:ring-2 focus-visible:ring-[var(--cr-primary)]/40 focus-visible:outline-none"
                  style={{
                    background: active ? 'var(--cr-primary,var(--cr-info-500))' : 'transparent',
                    color: active ? 'var(--cr-surface)' : 'var(--cr-text-2,var(--cr-text-4))',
                    boxShadow: active ? '0 6px 14px rgba(22,119,255,0.18)' : 'none',
                  }}
                >
                  {t('lookback', { months: m })}
                </button>
              );
            })}
          </div>
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
              <Alert type="info" showIcon title={t('advisoryNote')} />
            </div>

            {!hasData ? (
              <Card>
                <DsEmptyState title={t('emptyTitle')} sub={t('emptySub')} />
              </Card>
            ) : (
              <>
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatTile
                    label={t('kpi.avgBradford')}
                    value={String(summary?.avgBradford ?? 0)}
                  />
                  <StatTile
                    label={t('kpi.flagged')}
                    value={String(summary?.flaggedCount ?? 0)}
                    tone={(summary?.flaggedCount ?? 0) > 0 ? 'danger' : 'neutral'}
                    hint={t('kpi.flaggedHint')}
                  />
                  <StatTile
                    label={t('kpi.totalSpells')}
                    value={String(summary?.totalSpells ?? 0)}
                  />
                  <StatTile label={t('kpi.worstDay')} value={worstDayLabel} />
                </div>

                <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2" styles={{ body: { padding: 16 } }}>
                    <p className="m-0 mb-3 text-[14px] font-semibold text-gray-900">
                      {t('weekdayTitle')}
                    </p>
                    <div role="img" aria-label={t('chart.weekdayAriaLabel')}>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart
                          data={weekdayData}
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
                            allowDecimals={false}
                            tick={{ fontSize: 11, fill: 'var(--cr-text-4)' }}
                            axisLine={false}
                            tickLine={false}
                            width={32}
                          />
                          <Tooltip
                            cursor={{ fill: 'var(--cr-surface-2, rgba(0,0,0,0.04))' }}
                            formatter={(value) => [String(value), t('tipAbsences')]}
                          />
                          <Bar
                            dataKey="count"
                            name={t('tipAbsences')}
                            fill="var(--cr-primary)"
                            radius={[4, 4, 0, 0]}
                            maxBarSize={56}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card styles={{ body: { padding: 16 } }}>
                    <div className="mb-1 flex items-center gap-1.5">
                      <p className="m-0 text-[14px] font-semibold text-gray-900">
                        {t('bands.title')}
                      </p>
                      <InfoTooltip
                        variant="popover"
                        text={t('bands.tooltipTitle')}
                        body={
                          <div className="space-y-2 text-[13px] leading-[1.55] text-gray-700">
                            <p className="m-0">{t('bands.tooltipBody1')}</p>
                            <p className="m-0">{t('bands.tooltipBody2')}</p>
                          </div>
                        }
                      />
                    </div>
                    <p className="m-0 mb-3 text-[12px] text-gray-500">{t('bands.hint')}</p>
                    <div className="flex flex-col gap-2.5">
                      {BAND_ORDER.map((band) => (
                        <div key={band} className="flex items-center gap-2.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ background: BAND_HEX[band] }}
                          />
                          <span className="flex-1 text-[13px] text-gray-700">
                            {t(`bands.${band}`)}
                          </span>
                          <span className="text-[14px] font-bold text-gray-900 tabular-nums">
                            {bandCounts[band]}
                          </span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>

                <Card styles={{ body: { padding: 16 } }}>
                  <div
                    className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b pb-3"
                    style={{ borderColor: 'var(--cr-border-light,var(--cr-border))' }}
                  >
                    <p className="m-0 shrink-0 text-[14px] font-semibold text-gray-900">
                      {t('table.title')}
                    </p>
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder={t('searchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full sm:w-72"
                      style={{ maxWidth: 320 }}
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
                    pagination={{ pageSize: 15, hideOnSinglePage: true }}
                    locale={{
                      emptyText: (
                        <DsEmptyState
                          title={t('table.searchEmptyTitle')}
                          sub={t('table.searchEmptySub')}
                        />
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
