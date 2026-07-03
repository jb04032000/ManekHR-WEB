'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Input, Skeleton, Table, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CalendarOutlined,
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useLocale, useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { leaveApi } from '@/lib/api/modules/leave.api';
import { teamApi } from '@/lib/api/modules/team.api';
import { LIST_ALL_LIMIT } from '@/lib/constants';
import { listHolidaysByYear } from '@/lib/actions/holidays.actions';
import { DsEmptyState, DsPageHeader, InfoTooltip, StatTile } from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { Holiday, LeaveRequest, LeaveType, LeaveTypeLocale, TeamMember } from '@/types';

// A holiday is informational, not an error - tint with the info palette.
const HOLIDAY_TINT = 'var(--cr-info-50, #eff6ff)';
const WEEKEND_TINT = 'var(--cr-surface-2, #f8fafc)';

interface CalendarRow {
  memberId: string;
  name: string;
}
interface DayCell {
  typeId: string;
  qty: number;
}

function typeLabel(lt: LeaveType | undefined, locale: string): string {
  if (!lt) return '-';
  return lt.labels[locale as LeaveTypeLocale] || lt.labels.en;
}

/** Build a CSV blob and trigger a browser download. */
function downloadCsv(filename: string, rows: string[][]) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LeaveCalendarPage() {
  const t = useTranslations('leave.calendar');
  const locale = useLocale();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { loading: permissionsLoading, canPath } = useMyPermissions();

  const [monthCursor, setMonthCursor] = useState<Dayjs>(() => dayjs().startOf('month'));
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [types, setTypes] = useState<Map<string, LeaveType>>(new Map());
  // `firstLoad` drives the full-card skeleton on first mount only; `loading`
  // drives the in-table spinner for month-filter refetches so the grid stays
  // on screen rather than blanking behind a skeleton.
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!wsId) return;
    const from = monthCursor.startOf('month').format('YYYY-MM-DD');
    const to = monthCursor.endOf('month').format('YYYY-MM-DD');
    try {
      const [reqs, hols] = await Promise.all([
        leaveApi.listCalendar(wsId, from, to),
        listHolidaysByYear(wsId, monthCursor.year()),
      ]);
      setRequests(reqs);
      setHolidays(hols);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [wsId, monthCursor]);

  // Mount + month-change fetch - single shared fetch path via `load`.
  // `loading` is already true on mount and is re-armed by the month
  // DatePicker's onChange; the `load` call is deferred through a microtask so
  // it sits outside the synchronous effect body (set-state-in-effect rule).
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!wsId) return;
    teamApi
      .list(wsId, { limit: LIST_ALL_LIMIT })
      .then((res) => {
        const list: TeamMember[] = Array.isArray(res)
          ? res
          : ((res as { members?: TeamMember[] }).members ?? []);
        setMembers(new Map(list.map((m) => [m.id, m.name])));
      })
      .catch(() => setMembers(new Map()));
    leaveApi
      .listTypes(wsId, true)
      .then((list) => setTypes(new Map(list.map((lt) => [lt._id, lt]))))
      .catch(() => setTypes(new Map()));
  }, [wsId]);

  const daysInMonth = monthCursor.daysInMonth();

  // member → (day-of-month → leave cell)
  const cells = useMemo(() => {
    const map = new Map<string, Map<number, DayCell>>();
    const mo = monthCursor.month();
    const yr = monthCursor.year();
    for (const req of requests) {
      for (const seg of req.dayBreakdown) {
        const d = dayjs(seg.date);
        if (d.month() !== mo || d.year() !== yr) continue;
        const day = d.date();
        let row = map.get(req.teamMemberId);
        if (!row) {
          row = new Map();
          map.set(req.teamMemberId, row);
        }
        const prev = row.get(day);
        row.set(day, {
          typeId: seg.leaveTypeId,
          qty: (prev?.qty ?? 0) + seg.quantity,
        });
      }
    }
    return map;
  }, [requests, monthCursor]);

  // day-of-month → holiday name
  const monthHolidays = useMemo(() => {
    const map = new Map<number, string>();
    const mo = monthCursor.month();
    const yr = monthCursor.year();
    for (const h of holidays) {
      const d = dayjs(h.date);
      const inMonth = h.isRecurring ? d.month() === mo : d.month() === mo && d.year() === yr;
      if (inMonth) map.set(d.date(), h.name);
    }
    return map;
  }, [holidays, monthCursor]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: CalendarRow[] = [];
    for (const memberId of cells.keys()) {
      const name = members.get(memberId) ?? memberId;
      if (!q || name.toLowerCase().includes(q)) list.push({ memberId, name });
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [cells, members, search]);

  const totalLeaveDays = useMemo(() => {
    let sum = 0;
    for (const row of cells.values()) {
      for (const cell of row.values()) sum += cell.qty;
    }
    return sum;
  }, [cells]);

  const legendTypes = useMemo(() => {
    const ids = new Set<string>();
    for (const row of cells.values()) {
      for (const cell of row.values()) ids.add(cell.typeId);
    }
    return [...ids].map((id) => types.get(id)).filter((lt): lt is LeaveType => lt != null);
  }, [cells, types]);

  const exportCsv = () => {
    const header = [
      t('csv.member'),
      t('csv.type'),
      t('csv.from'),
      t('csv.to'),
      t('csv.total'),
      t('csv.paid'),
      t('csv.lwp'),
    ];
    const body = requests.map((req) => [
      members.get(req.teamMemberId) ?? req.teamMemberId,
      typeLabel(types.get(req.primaryLeaveTypeId), locale),
      dayjs(req.fromDate).format('YYYY-MM-DD'),
      dayjs(req.toDate).format('YYYY-MM-DD'),
      String(req.totalDays),
      String(req.paidDays),
      String(req.lwpDays),
    ]);
    downloadCsv(`leave-${monthCursor.format('YYYY-MM')}.csv`, [header, ...body]);
  };

  const columns: ColumnsType<CalendarRow> = useMemo(() => {
    const memberCol: ColumnsType<CalendarRow>[number] = {
      title: t('col.member'),
      key: 'member',
      fixed: 'left',
      width: 170,
      render: (_: unknown, r) => <span className="font-medium">{r.name}</span>,
    };
    const dayCols: ColumnsType<CalendarRow> = Array.from(
      { length: daysInMonth },
      (_, i) => i + 1,
    ).map((day) => {
      const date = monthCursor.date(day);
      const weekend = date.day() === 0 || date.day() === 6;
      const holidayName = monthHolidays.get(day);
      return {
        key: `d${day}`,
        width: 42,
        align: 'center',
        onHeaderCell: () => ({
          style: {
            background: holidayName ? HOLIDAY_TINT : weekend ? WEEKEND_TINT : undefined,
            padding: '6px 2px',
          },
        }),
        title: (
          <Tooltip title={holidayName || date.format('dddd, DD MMM')}>
            <div
              className="rounded leading-tight focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
              tabIndex={0}
              aria-label={
                holidayName
                  ? t('aria.dayHeaderHoliday', {
                      date: date.format('dddd, DD MMM'),
                      holiday: holidayName,
                    })
                  : date.format('dddd, DD MMM')
              }
            >
              <div className="text-[12px] font-semibold">{day}</div>
              <div className="text-[10px] text-muted">{date.format('dd')}</div>
            </div>
          </Tooltip>
        ),
        onCell: () => ({
          style: { background: holidayName ? HOLIDAY_TINT : weekend ? WEEKEND_TINT : undefined },
        }),
        render: (_: unknown, r) => {
          const cell = cells.get(r.memberId)?.get(day);
          if (!cell) return null;
          const lt = types.get(cell.typeId);
          const half = cell.qty < 1;
          return (
            <Tooltip title={`${typeLabel(lt, locale)} · ${half ? t('halfDay') : t('fullDay')}`}>
              <span
                className="inline-block h-5 w-5 rounded focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
                tabIndex={0}
                aria-label={t('aria.leaveCell', {
                  member: r.name,
                  date: date.format('DD MMM'),
                  type: typeLabel(lt, locale),
                  duration: half ? t('halfDay') : t('fullDay'),
                })}
                style={{
                  background: lt?.color ?? 'var(--cr-neutral-400)',
                  opacity: half ? 0.5 : 1,
                }}
              />
            </Tooltip>
          );
        },
      };
    });
    return [memberCol, ...dayCols];
  }, [t, locale, daysInMonth, monthCursor, monthHolidays, cells, types]);

  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }
  if (!canPath('leave.request.view', 'all')) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <DsEmptyState title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate module="leave" subFeature="view_balance" as="h1">
      <div className="mx-auto max-w-6xl p-6">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<CalendarOutlined />}
          right={
            <div className="flex gap-2">
              <Button
                icon={<DownloadOutlined />}
                disabled={requests.length === 0}
                onClick={exportCsv}
              >
                {t('export')}
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                {t('refresh')}
              </Button>
            </div>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <DatePicker
            picker="month"
            allowClear={false}
            value={monthCursor}
            onChange={(v) => {
              if (!v) return;
              setMonthCursor(v.startOf('month'));
              setLoading(true);
            }}
          />
          <Input
            prefix={<SearchOutlined />}
            allowClear
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 260 }}
          />
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <StatTile label={t('statMembers')} value={String(cells.size)} />
          <StatTile label={t('statDays')} value={String(totalLeaveDays)} />
        </div>

        {legendTypes.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-body">
              {t('legendLabel')}
              <InfoTooltip text={t('infoTip.legend.title')} body={t('infoTip.legend.body')} />
            </span>
            {legendTypes.map((lt) => (
              <span
                key={lt._id}
                className="inline-flex items-center gap-1.5 text-[12px] text-muted"
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded"
                  style={{ background: lt.color }}
                />
                {typeLabel(lt, locale)}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[12px] text-muted">
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded border border-solid"
                style={{ background: HOLIDAY_TINT, borderColor: 'var(--cr-border)' }}
              />
              {t('legendHoliday')}
            </span>
          </div>
        )}

        {firstLoad ? (
          <Card>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        ) : loadError ? (
          <Card>
            <DsEmptyState
              title={t('loadError')}
              action={
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => {
                    setLoading(true);
                    load();
                  }}
                >
                  {t('retry')}
                </Button>
              }
            />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <DsEmptyState title={t('emptyTitle')} sub={t('emptySub')} />
          </Card>
        ) : (
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="memberId"
              size="small"
              loading={loading}
              columns={columns}
              dataSource={rows}
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 50, hideOnSinglePage: true }}
            />
          </Card>
        )}
      </div>
    </FeatureGate>
  );
}
