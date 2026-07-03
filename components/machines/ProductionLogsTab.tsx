'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DatePicker, Switch, Tag, Tooltip, message, Skeleton, type TableColumnsType } from 'antd';
import { LockOutlined, PlusOutlined, FileTextOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs, { type Dayjs } from 'dayjs';

import { DsButton, DsCard, DsSelect, DsOption, DsTable, EmptyStateLayout } from '@/components/ui';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { useWorkspaceStore } from '@/lib/store';
import { productionLogsApi } from '@/lib/api/modules/production-logs.api';
import { ProductionLogDrawer } from './ProductionLogDrawer';
import type { Machine, ProductionLog, ListProductionLogsParams } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EditWindowState = 'editable' | 'expired-window' | 'payroll-locked';

interface Filters {
  dateRange: [Dayjs, Dayjs];
  operatorId: string | null;
  shiftId: string | null;
  showDeleted: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive edit-window state from log + today's date in workspace timezone.
 * If log exposes editWindow from backend, use it. Otherwise compute client-side.
 */
function resolveEditWindow(log: ProductionLog): EditWindowState {
  // Backend may expose derived field
  const derived = log.editWindow;
  if (derived === 'payroll_locked') return 'payroll-locked';
  if (derived === 'expired') return 'expired-window';
  if (derived === 'editable') return 'editable';

  // Client-side fallback: editable = date >= today-1 (no payroll lock info client-side)
  const cutoff = dayjs().subtract(1, 'day').startOf('day');
  if (dayjs(log.date).isBefore(cutoff)) return 'expired-window';
  return 'editable';
}

function resolveMetricValue(log: ProductionLog): { value: number | null; unit: string } {
  const metric = log.primaryMetric;
  if (metric === 'stitches') return { value: log.stitchCount, unit: 'stitches' };
  if (metric === 'pieces') return { value: log.pieceCount, unit: 'pcs' };
  return { value: log.hoursLogged, unit: 'hr' };
}

function formatMetricValue(value: number | null, metric: string): string {
  if (value === null || value === undefined) return '-';
  if (metric === 'hours') return value.toFixed(2);
  return value.toLocaleString();
}

function hoursUntilCutoff(log: ProductionLog): number {
  const cutoff = dayjs(log.date).add(1, 'day').startOf('day');
  return cutoff.diff(dayjs(), 'hour');
}

// ---------------------------------------------------------------------------
// Sub-feature gate banner
// ---------------------------------------------------------------------------

function ProductionGateBanner({ t }: { t: ReturnType<typeof useTranslations> }) {
  return (
    <div
      role="alert"
      style={{
        background: 'var(--cr-warning-bg, var(--cr-warning-50))',
        border: '1px solid var(--cr-warning, var(--cr-warning-700))',
        borderRadius: 8,
        padding: '24px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        maxWidth: 600,
        margin: '48px auto',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <WarningOutlined
          style={{ color: 'var(--cr-warning, var(--cr-warning-700))', fontSize: 20 }}
        />
        <span style={{ fontWeight: 700, fontSize: 16 }}>{t('gate.heading')}</span>
      </div>
      <p style={{ margin: 0, color: 'var(--cr-text-2, var(--cr-text-4))', fontSize: 14 }}>
        {t('gate.body')}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/account/subscription">
          <DsButton dsVariant="primary">{t('gate.upgradeCta')}</DsButton>
        </Link>
        <DsButton dsVariant="ghost">{t('gate.learnMore')}</DsButton>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface ProductionLogsTabProps {
  machine: Machine;
}

export function ProductionLogsTab({ machine }: ProductionLogsTabProps) {
  const t = useTranslations('machines-production');
  const { currentWorkspaceId } = useWorkspaceStore();
  const [msgApi, ctx] = message.useMessage();

  // Sub-feature gate
  const { hasAccess, isLoading: gateLoading } = useFeatureAccess('machines', 'machines_production');

  // State
  const [filters, setFilters] = useState<Filters>({
    dateRange: [dayjs().subtract(30, 'day'), dayjs()],
    operatorId: null,
    shiftId: null,
    showDeleted: false,
  });
  const [allLogs, setAllLogs] = useState<ProductionLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'client' | 'server'>('client');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<ProductionLog | undefined>(undefined);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('create');

  const wsId = currentWorkspaceId ?? '';
  const machineId = machine._id ?? machine.id ?? '';

  // ------------------------------------------------------------------
  // Data fetching
  // ------------------------------------------------------------------

  const fetchLogs = useCallback(async () => {
    if (!wsId || !machineId) return;
    setLoading(true);
    try {
      const from = filters.dateRange[0].format('YYYY-MM-DD');
      const to = filters.dateRange[1].format('YYYY-MM-DD');
      const params: Record<string, unknown> = {
        from,
        to,
        limit: 500,
        ...(filters.showDeleted ? { includeDeleted: true } : {}),
        ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
        ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
      };
      const resp = await productionLogsApi.listForMachine(
        wsId,
        machineId,
        params as ListProductionLogsParams,
      );
      const items = resp.items ?? [];
      const fetchedTotal = resp.total ?? items.length;
      if (fetchedTotal <= 200) {
        setMode('client');
        setAllLogs(items);
        setTotal(fetchedTotal);
      } else {
        setMode('server');
        setAllLogs(items);
        setTotal(fetchedTotal);
      }
      setPage(1);
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [wsId, machineId, filters, msgApi]);

  // Initial fetch + debounced re-fetch on filter changes
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchLogs();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchLogs]);

  // ------------------------------------------------------------------
  // Client-side filtering (mode=client)
  // ------------------------------------------------------------------

  const displayedLogs =
    mode === 'client'
      ? allLogs.filter((log) => {
          if (!filters.showDeleted && log.isDeleted) return false;
          const logDate = dayjs(log.date);
          if (logDate.isBefore(filters.dateRange[0], 'day')) return false;
          if (logDate.isAfter(filters.dateRange[1], 'day')) return false;
          if (filters.operatorId && log.teamMemberId !== filters.operatorId) return false;
          if (filters.shiftId && log.shiftId !== filters.shiftId) return false;
          return true;
        })
      : allLogs;

  // Paginate client-side
  const paginatedLogs =
    mode === 'client' ? displayedLogs.slice((page - 1) * pageSize, page * pageSize) : displayedLogs;

  const displayedTotal = mode === 'client' ? displayedLogs.length : total;
  const hasActiveFilters =
    filters.operatorId !== null || filters.shiftId !== null || filters.showDeleted;

  // ------------------------------------------------------------------
  // Primary metric label
  // ------------------------------------------------------------------

  const primaryMetric: 'stitches' | 'pieces' | 'hours' = machine.primaryMetric ?? 'stitches';
  const metricLabel =
    primaryMetric === 'hours'
      ? t('tab.metric.hours')
      : primaryMetric === 'pieces'
        ? t('tab.metric.pieces')
        : t('tab.metric.stitches');

  // ------------------------------------------------------------------
  // Drawer handlers
  // ------------------------------------------------------------------

  const openCreateDrawer = () => {
    setEditingLog(undefined);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const openEditDrawer = (log: ProductionLog) => {
    const ew = resolveEditWindow(log);
    setEditingLog(log);
    setDrawerMode(ew === 'editable' ? 'edit' : 'view');
    setDrawerOpen(true);
  };

  const onDrawerSaved = () => {
    setDrawerOpen(false);
    fetchLogs();
  };

  // ------------------------------------------------------------------
  // Table columns
  // ------------------------------------------------------------------

  const columns: TableColumnsType<ProductionLog> = [
    {
      title: t('tab.col.date'),
      dataIndex: 'date',
      key: 'date',
      width: 140,
      sorter: (a, b) => a.date.localeCompare(b.date),
      defaultSortOrder: 'descend',
      render: (date: string, log: ProductionLog) => {
        const editWindow = resolveEditWindow(log);
        const hrsLeft = hoursUntilCutoff(log);
        const soonPill = editWindow === 'editable' && hrsLeft >= 0 && hrsLeft < 6;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {editWindow === 'expired-window' && (
              <Tooltip title={t('tab.lockTooltip.window')}>
                <LockOutlined
                  aria-label={`Edit window closed for ${date}`}
                  style={{ color: 'var(--cr-text-3, var(--cr-text-5))', fontSize: 12 }}
                />
              </Tooltip>
            )}
            {editWindow === 'payroll-locked' && (
              <Tooltip
                title={t('tab.lockTooltip.payroll', { monthYear: dayjs(date).format('MMM YYYY') })}
              >
                <LockOutlined
                  aria-label={`Payroll locked for ${dayjs(date).format('MMM YYYY')}`}
                  style={{ color: 'var(--cr-error, var(--cr-danger-700))', fontSize: 12 }}
                />
              </Tooltip>
            )}
            <span>{dayjs(date).format('DD MMM YYYY')}</span>
            {soonPill && (
              <Tag
                style={{
                  fontSize: 11,
                  color: 'var(--cr-warning, var(--cr-warning-700))',
                  border: '1px solid var(--cr-warning, var(--cr-warning-700))',
                  background: 'transparent',
                  marginInlineEnd: 0,
                }}
              >
                {t('tab.editClosesSoon', { hours: hrsLeft })}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: t('tab.col.operator'),
      dataIndex: 'teamMemberId',
      key: 'operator',
      ellipsis: true,
      // Backend populates teamMemberId with { _id, name, employeeCode } when
      // available. Fall back to raw id string when populate failed (WR-03).
      render: (v: unknown) => {
        if (!v) return '-';
        if (typeof v === 'object') {
          const o = v as { name?: string; employeeCode?: string; _id?: string };
          if (o.name) return o.employeeCode ? `${o.name} (${o.employeeCode})` : o.name;
          return o._id ?? '-';
        }
        return String(v);
      },
    },
    {
      title: t('tab.col.shift'),
      dataIndex: 'shiftId',
      key: 'shift',
      ellipsis: true,
      render: (v: unknown) => {
        if (!v) return '-';
        if (typeof v === 'object') {
          const o = v as { name?: string; _id?: string };
          return o.name ?? o._id ?? '-';
        }
        return String(v);
      },
    },
    {
      title: t('tab.col.output'),
      key: 'output',
      align: 'right',
      render: (_: unknown, log: ProductionLog) => {
        const { value } = resolveMetricValue(log);
        const metric = log.primaryMetric;
        return (
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>
            {formatMetricValue(value, metric)}{' '}
            <span style={{ color: 'var(--cr-text-3, var(--cr-text-5))', fontSize: 12 }}>
              {metric === 'hours' ? 'hr' : metric === 'pieces' ? 'pcs' : 'stitches'}
            </span>
          </span>
        );
      },
    },
    {
      title: t('tab.col.otherMetrics'),
      key: 'otherMetrics',
      render: (_: unknown, log: ProductionLog) => {
        const parts: string[] = [];
        if (log.primaryMetric !== 'stitches' && log.stitchCount != null)
          parts.push(`${log.stitchCount.toLocaleString()} stitches`);
        if (log.primaryMetric !== 'pieces' && log.pieceCount != null)
          parts.push(`${log.pieceCount.toLocaleString()} pcs`);
        if (log.primaryMetric !== 'hours' && log.hoursLogged != null)
          parts.push(`${log.hoursLogged.toFixed(2)} hr`);
        if (parts.length === 0) return '-';
        return (
          <span style={{ fontSize: 12, color: 'var(--cr-text-2, var(--cr-text-4))' }}>
            {parts.join(' · ')}
          </span>
        );
      },
    },
    {
      title: t('tab.col.notes'),
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v: string) => v || '-',
    },
    {
      title: t('tab.col.code'),
      dataIndex: 'logCode',
      key: 'code',
      width: 110,
      render: (v: string) => (
        <Tag style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{v}</Tag>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 56,
      align: 'right',
      render: (_: unknown, log: ProductionLog) => {
        const editWindow = resolveEditWindow(log);
        if (editWindow === 'editable') {
          return (
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              aria-label={`Edit production log ${log.logCode}`}
              onClick={(e) => {
                e.stopPropagation();
                openEditDrawer(log);
              }}
            >
              Edit
            </DsButton>
          );
        }
        return null;
      },
    },
  ];

  // ------------------------------------------------------------------
  // Row styling for edit-window state
  // ------------------------------------------------------------------

  const rowClassName = (log: ProductionLog) => {
    const ew = resolveEditWindow(log);
    if (log.isDeleted) return 'production-log-row--deleted';
    if (ew === 'payroll-locked') return 'production-log-row--payroll-locked';
    if (ew === 'expired-window') return 'production-log-row--expired';
    return '';
  };

  // ------------------------------------------------------------------
  // Gate loading skeleton
  // ------------------------------------------------------------------

  if (gateLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />;
  }

  // ------------------------------------------------------------------
  // Sub-feature gate
  // ------------------------------------------------------------------

  if (!hasAccess) {
    return <ProductionGateBanner t={t} />;
  }

  // ------------------------------------------------------------------
  // Empty states
  // ------------------------------------------------------------------

  const showEmptyNoFilters = !loading && displayedTotal === 0 && !hasActiveFilters;
  const showEmptyFiltered = !loading && displayedTotal === 0 && hasActiveFilters;

  const clearFilters = () => {
    setFilters({
      dateRange: [dayjs().subtract(30, 'day'), dayjs()],
      operatorId: null,
      shiftId: null,
      showDeleted: false,
    });
  };

  return (
    <>
      {ctx}

      {/* Inline style overrides for row states */}
      <style>{`
        .production-log-row--expired td { color: var(--cr-text-3, var(--cr-text-5)); }
        .production-log-row--payroll-locked td { color: var(--cr-text-3, var(--cr-text-5)); background: rgba(239,68,68,0.08); }
        .production-log-row--deleted td { text-decoration: line-through; background: var(--cr-surface-2, var(--cr-bg)); color: var(--cr-text-3, var(--cr-text-5)); }
      `}</style>

      <DsCard>
        {/* Header bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag
              style={{
                fontWeight: 600,
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {t('tab.primaryMetricLabel', { metric: metricLabel })}
            </Tag>
            <Link
              href={`/dashboard/machines/${machineId}?tab=overview&edit=1`}
              style={{ fontSize: 12, color: 'var(--cr-primary, var(--cr-primary))' }}
            >
              {t('tab.editMetricLink')}
            </Link>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link
              href={`/dashboard/machines/production-logs/bulk?machineId=${machineId}&date=today`}
            >
              <DsButton dsVariant="ghost" dsSize="sm">
                {t('tab.bulkShortcut')}
              </DsButton>
            </Link>
            <DsButton dsVariant="primary" icon={<PlusOutlined />} onClick={openCreateDrawer}>
              {t('tab.addCta')}
            </DsButton>
          </div>
        </div>

        {/* Sub-head */}
        <p
          style={{
            fontSize: 13,
            color: 'var(--cr-text-2, var(--cr-text-4))',
            marginBottom: 16,
            marginTop: 0,
          }}
        >
          {t('tab.subhead')}
        </p>

        {/* Filter row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
                color: 'var(--cr-text-2, var(--cr-text-4))',
              }}
            >
              {t('tab.filters.dateRange')}
            </div>
            <DatePicker.RangePicker
              value={filters.dateRange}
              onChange={(vals) => {
                if (vals?.[0] && vals?.[1]) {
                  setFilters((f) => ({ ...f, dateRange: [vals[0]!, vals[1]!] }));
                }
              }}
              allowClear={false}
              size="small"
              placeholder={[t('tab.filters.dateRangeDefault'), '']}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
                color: 'var(--cr-text-2, var(--cr-text-4))',
              }}
            >
              {t('tab.filters.operator')}
            </div>
            <DsSelect
              value={filters.operatorId ?? undefined}
              onChange={(v) => setFilters((f) => ({ ...f, operatorId: v ?? null }))}
              allowClear
              placeholder={t('tab.filters.operatorAll')}
              style={{ minWidth: 160 }}
              size="small"
            >
              {/* Options would be loaded from team members - left as placeholder for now */}
              <DsOption value="">all</DsOption>
            </DsSelect>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
                color: 'var(--cr-text-2, var(--cr-text-4))',
              }}
            >
              {t('tab.filters.shift')}
            </div>
            <DsSelect
              value={filters.shiftId ?? undefined}
              onChange={(v) => setFilters((f) => ({ ...f, shiftId: v ?? null }))}
              allowClear
              placeholder={t('tab.filters.shiftAll')}
              style={{ minWidth: 140 }}
              size="small"
            >
              <DsOption value="">all</DsOption>
            </DsSelect>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-end',
              paddingBottom: 2,
            }}
          >
            <Switch
              size="small"
              checked={filters.showDeleted}
              onChange={(v) => setFilters((f) => ({ ...f, showDeleted: v }))}
            />
            <span style={{ fontSize: 13 }}>{t('tab.filters.showDeleted')}</span>
          </div>
        </div>

        {/* Pagination summary (info) */}
        {!loading && displayedTotal > 0 && (
          <div
            style={{ fontSize: 12, color: 'var(--cr-info, var(--cr-info-700))', marginBottom: 8 }}
          >
            {t('tab.pagination.summary', {
              from: (page - 1) * pageSize + 1,
              to: Math.min(page * pageSize, displayedTotal),
              total: displayedTotal,
            })}
          </div>
        )}

        {/* Empty states */}
        {showEmptyNoFilters && (
          <EmptyStateLayout
            as="h2"
            icon={<FileTextOutlined style={{ color: 'var(--cr-primary, var(--cr-primary))' }} />}
            title={t('tab.empty.heading')}
            description={t('tab.empty.body')}
            actions={[{ label: t('tab.empty.cta'), onClick: openCreateDrawer, type: 'primary' }]}
          />
        )}

        {showEmptyFiltered && (
          <EmptyStateLayout
            as="h2"
            icon={<FileTextOutlined style={{ color: 'var(--cr-text-3, var(--cr-text-5))' }} />}
            title={t('tab.filteredEmpty.heading')}
            description={t('tab.filteredEmpty.body')}
            actions={[{ label: t('tab.filteredEmpty.cta'), onClick: clearFilters }]}
          />
        )}

        {/* Table */}
        {(loading || displayedTotal > 0) && (
          <DsTable<ProductionLog>
            rowKey={(r) => r._id}
            dataSource={paginatedLogs}
            columns={columns}
            loading={loading}
            rowClassName={rowClassName}
            onRow={(log) => ({
              onClick: () => openEditDrawer(log),
              style: { cursor: 'pointer' },
            })}
            pagination={
              displayedTotal > pageSize
                ? {
                    current: page,
                    pageSize,
                    total: displayedTotal,
                    onChange: (p) => setPage(p),
                    showSizeChanger: false,
                  }
                : false
            }
            locale={{
              emptyText: loading ? ' ' : t('tab.filteredEmpty.heading'),
            }}
          />
        )}
      </DsCard>

      {/* Single-log drawer */}
      <ProductionLogDrawer
        open={drawerOpen}
        mode={drawerMode}
        machine={machine}
        log={editingLog}
        onClose={() => setDrawerOpen(false)}
        onSaved={onDrawerSaved}
      />
    </>
  );
}
