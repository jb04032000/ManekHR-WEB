'use client';

// Muster register view - month × member grid with status codes (P/L/A/½/
// LV/H/WO) and P/A/L summary columns. The printable/read-only complement
// to the Monthly view (which is editable click-to-open-drawer). Rendered
// as a view mode inside the main `/dashboard/attendance` page
// (?view=muster). Was a separate route at `/dashboard/attendance/grid`;
// consolidated here so all four attendance lenses (Daily/Monthly/Live/
// Muster) live under one URL with a single nav tab.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { attendanceApi } from '@/lib/api/modules/attendance.api';
import { DsAvatar, DsEmptyState, DsPageHeader, STATUS_COLORS } from '@/components/ui';
import type { AttendanceGrid, AttendanceGridCell, AttendanceGridMember } from '@/types';

// Status → short muster code. Codes are symbolic (universal in Indian
// musters) - only the tooltip/legend labels are translated.
const CELL_CODE: Record<string, string> = {
  present: 'P',
  late: 'L',
  absent: 'A',
  half_day: '½',
  on_leave: 'LV',
  holiday: 'H',
  week_off: 'WO',
};

const LEGEND = ['present', 'late', 'absent', 'half_day', 'on_leave', 'holiday', 'week_off'];

function fmtWorked(min: number | null): string {
  if (min == null || min <= 0) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export interface AttendanceMusterViewProps {
  /** Initial month (1-12). When omitted, defaults to current month. */
  initialMonth?: number;
  /** Initial year. When omitted, defaults to current year. */
  initialYear?: number;
  /** Notify the parent on month/year change so URL state can stay in sync. */
  onPeriodChange?: (month: number, year: number) => void;
  /**
   * When false, suppress the internal DsPageHeader + month-nav toolbar so
   * the component can be embedded inside another page (e.g. Overview's
   * Member Breakdown register tab) that owns its own period selector and
   * page chrome. Defaults to `true` for standalone use.
   */
  showHeader?: boolean;
  /**
   * When false, locks the period to `initialMonth`/`initialYear` and
   * ignores any internal navigation requests (caller drives the period
   * via parent state). Used in embedded mode where the parent's month
   * picker is the source of truth.
   */
  allowPeriodNav?: boolean;
}

export function AttendanceMusterView({
  initialMonth,
  initialYear,
  onPeriodChange,
  showHeader = true,
  allowPeriodNav = true,
}: AttendanceMusterViewProps = {}) {
  const t = useTranslations('attendance.grid');
  const { currentWorkspaceId: wsId } = useWorkspaceStore();

  const [month, setMonth] = useState(() => initialMonth ?? dayjs().month() + 1);
  const [year, setYear] = useState(() => initialYear ?? dayjs().year());

  // Embedded mode - when the parent drives the period (allowPeriodNav=
  // false), mirror the parent's initialMonth/initialYear into local state
  // any time they change, so the fetch re-runs against the right period.
  useEffect(() => {
    if (allowPeriodNav) return;
    // Embedded mode: the parent drives the period, so mirroring it into
    // local state via setState-in-effect is intentional here.
     
    if (initialMonth && initialMonth !== month) setMonth(initialMonth);
    if (initialYear && initialYear !== year) setYear(initialYear);
     
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to parent-controlled period
  }, [initialMonth, initialYear, allowPeriodNav]);
  const [data, setData] = useState<AttendanceGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!wsId) return;
    attendanceApi
      .attendanceGrid(wsId, month, year)
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

  useEffect(() => {
    onPeriodChange?.(month, year);
  }, [month, year, onPeriodChange]);

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

  const retry = useCallback(() => {
    if (!wsId) return;
    setFetching(true);
    attendanceApi
      .attendanceGrid(wsId, month, year)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setFetching(false));
  }, [wsId, month, year]);

  const filteredMembers = useMemo(() => {
    const members = data?.members ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.designation.toLowerCase().includes(q),
    );
  }, [data, search]);

  const columns = useMemo<ColumnsType<AttendanceGridMember>>(() => {
    if (!data) return [];

    const memberCol: ColumnsType<AttendanceGridMember>[number] = {
      title: t('colMember'),
      key: 'member',
      fixed: 'left',
      width: 210,
      render: (_: unknown, m) => (
        <div className="flex items-center gap-2.5">
          <DsAvatar name={m.name} size={30} />
          <div className="min-w-0">
            <p className="m-0 truncate text-[13px] font-semibold text-gray-900">{m.name}</p>
            {m.designation && (
              <p className="m-0 truncate text-[11px] text-gray-500">{m.designation}</p>
            )}
          </div>
        </div>
      ),
    };

    const dayCols: ColumnsType<AttendanceGridMember> = Array.from(
      { length: data.daysInMonth },
      (_, i) => {
        const day = i + 1;
        const d = dayjs(new Date(data.year, data.month - 1, day));
        const dow = d.day();
        const weekend = dow === 0 || dow === 6;
        return {
          key: `d${day}`,
          width: 42,
          align: 'center' as const,
          onHeaderCell: () => ({
            style: weekend ? { background: 'var(--cr-surface-2, #f5f5f5)' } : {},
          }),
          title: (
            <div className="leading-tight">
              <div className="text-[12px] font-bold tabular-nums">{day}</div>
              <div className="text-[9px] font-medium text-gray-400 uppercase">{d.format('dd')}</div>
            </div>
          ),
          render: (_: unknown, m) => {
            const cell: AttendanceGridCell | undefined = m.days[String(day)];
            if (!cell) return <span className="text-gray-300">·</span>;
            const colors = STATUS_COLORS[cell.status];
            const worked = fmtWorked(cell.workedMinutes);
            const tip = `${t(`status.${cell.status}`)}${worked ? ` · ${worked}` : ''}`;
            return (
              <Tooltip title={tip}>
                <span
                  className="inline-flex h-6 w-7 items-center justify-center rounded text-[10px] font-bold"
                  style={{
                    background: colors?.bg ?? 'var(--cr-bg)',
                    color: colors?.text ?? 'var(--cr-text-3)',
                  }}
                >
                  {CELL_CODE[cell.status] ?? '?'}
                </span>
              </Tooltip>
            );
          },
        };
      },
    );

    // Sticky right edge - a single Summary column that folds the per-status
    // month totals into colored count chips (P/L/A plus ½/LV/H/WO when the
    // member has any). Only non-zero statuses render a chip; chips wrap to
    // a second line when there are more than the column width allows.
    // Pinned right so the totals stay visible while the day grid scrolls
    // between it and the fixed-left Member column.
    //
    // IMPORTANT: do NOT set inline `onCell` / `onHeaderCell` styles on this
    // column. antd v5 applies its own `position: sticky; right: 0` styling
    // per-cell; an inline style merge here clobbers it. The thin left accent
    // is added via the `muster-sum-edge` className (CSS resolved against the
    // parent <style jsx global>).
    const summaryCol: ColumnsType<AttendanceGridMember>[number] = {
      title: t('colSummary'),
      key: 'summary',
      width: 220,
      align: 'left',
      fixed: 'right',
      className: 'muster-sum-edge',
      render: (_: unknown, m) => {
        const present = LEGEND.filter((s) => (m.summary[s] ?? 0) > 0);
        if (present.length === 0) return <span className="text-gray-300">·</span>;
        return (
          <div className="flex flex-wrap items-center gap-1">
            {present.map((s) => {
              const colors = STATUS_COLORS[s];
              return (
                <Tooltip key={s} title={t(`status.${s}`)}>
                  <span
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      background: colors?.bg ?? 'var(--cr-bg)',
                      color: colors?.text ?? 'var(--cr-text-3)',
                    }}
                  >
                    <span>{CELL_CODE[s] ?? '?'}</span>
                    <span>{m.summary[s]}</span>
                  </span>
                </Tooltip>
              );
            })}
          </div>
        );
      },
    };

    return [memberCol, ...dayCols, summaryCol];
  }, [data, t]);

  return (
    <>
      {showHeader && (
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<TableOutlined />}
          right={
            <div className="flex items-center gap-1.5">
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
          }
        />
      )}

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
        <Card styles={{ body: { padding: 16 } }}>
          {/* Toolbar - search on its own row above the legend so the
              long legend doesn't squeeze the input into an icon-only
              stub at embedded widths. Search left, legend right; the
              legend wraps to a second visual row only when there's no
              horizontal room. */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <Input
              allowClear
              prefix={<SearchOutlined style={{ color: 'var(--cr-text-5)' }} />}
              placeholder={t('searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="middle"
              style={{ width: '100%', maxWidth: 280 }}
            />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <CalendarOutlined className="text-gray-400" />
              {LEGEND.map((s) => {
                const colors = STATUS_COLORS[s];
                return (
                  <span key={s} className="flex items-center gap-1 text-[11px] text-gray-600">
                    <span
                      className="inline-flex h-4 w-5 items-center justify-center rounded text-[9px] font-bold"
                      style={{
                        background: colors?.bg ?? 'var(--cr-bg)',
                        color: colors?.text ?? 'var(--cr-text-3)',
                      }}
                    >
                      {CELL_CODE[s]}
                    </span>
                    {t(`status.${s}`)}
                  </span>
                );
              })}
            </div>
          </div>
          <Table
            size="small"
            rowKey="memberId"
            loading={fetching}
            columns={columns}
            dataSource={filteredMembers}
            pagination={false}
            // scroll.x as a concrete number (not 'max-content') is the
            // antd-v6 workaround for the `fixed: 'right'` + `scroll.y`
            // combination: the right-offset only resolves when antd can
            // compute total table width up front. Sum = member (210) +
            // days × 42 + summary col (220).
            scroll={{
              x: 210 + (data?.daysInMonth ?? 31) * 42 + 220,
              y: 560,
            }}
            locale={{
              emptyText: <DsEmptyState title={t('emptyTitle')} sub={t('emptySub')} />,
            }}
          />
        </Card>
      )}

      {/* Thin separator before the sticky P/A/L block so the eye registers
          where the scrolling day grid ends and the pinned totals begin.
          `:global` because antd renders cells outside the styled-jsx
          scope. Box-shadow rather than border-left so it overlays the
          right edge of the last day column without disturbing the
          column's box model (border would shift antd's offset math). */}
      <style jsx global>{`
        .muster-sum-edge {
          box-shadow: inset 1px 0 0 0 var(--cr-border);
        }
      `}</style>
    </>
  );
}

export default AttendanceMusterView;
