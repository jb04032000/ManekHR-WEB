'use client';

/**
 * DowntimeLogsTab - operator-facing tab for the machine detail page.
 *
 * Composes:
 *   - ActiveDowntimeBanner (red, polled, with elapsed timer + Close)
 *   - Filter row (date range + reason + status)
 *   - Paginated DsTable of entries with row actions (Edit / Close / Delete)
 *   - DowntimeDrawer for create + edit
 *
 * Default page size is 25 (D-14 §1).
 */

import { DatePicker, Popconfirm, Select, Tooltip, message, type TableColumnsType } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined, StopOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { startTransition, useCallback, useEffect, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';

import { DsButton, DsCard, DsTable, DsTag, DsEmptyState } from '@/components/ui';
import {
  closeDowntime,
  deleteDowntime,
  getDowntimeReasonCatalogue,
  listDowntimeForMachine,
  peekNextDowntimeCode,
} from '@/lib/actions/machines.actions';
import type {
  DowntimeEntry,
  ListDowntimeParams,
  Machine,
  WorkspaceDowntimeReasonConfig,
} from '@/types';
import ActiveDowntimeBanner from './ActiveDowntimeBanner';
import DowntimeDrawer from './DowntimeDrawer';

interface DowntimeLogsTabProps {
  machine: Machine;
}

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  reasonCodeId: string | null;
  status: 'open' | 'closed' | null;
}

const DEFAULT_PAGE_SIZE = 25;

export function DowntimeLogsTab({ machine }: DowntimeLogsTabProps) {
  const t = useTranslations('machines-downtime');
  const [msgApi, ctx] = message.useMessage();

  const wsId = machine.workspaceId;
  const machineId = machine._id ?? machine.id;

  // ─── State ──────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<DowntimeEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  const [filters, setFilters] = useState<Filters>({
    dateRange: [dayjs().subtract(30, 'day'), dayjs()],
    reasonCodeId: null,
    status: null,
  });

  const [catalogue, setCatalogue] = useState<WorkspaceDowntimeReasonConfig | null>(null);
  const [nextCodePeek, setNextCodePeek] = useState<string | undefined>(undefined);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingEntry, setEditingEntry] = useState<DowntimeEntry | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    if (!wsId || !machineId) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const params: ListDowntimeParams = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (filters.dateRange) {
        params.from = filters.dateRange[0].format('YYYY-MM-DD');
        params.to = filters.dateRange[1].format('YYYY-MM-DD');
      }
      if (filters.reasonCodeId) params.reasonCodeId = filters.reasonCodeId;
      if (filters.status) params.status = filters.status;

      const resp = await listDowntimeForMachine(wsId, machineId, params);
      startTransition(() => {
        setEntries(resp.items ?? []);
        setTotal(resp.total ?? 0);
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to load downtime');
    } finally {
      setLoading(false);
    }
  }, [wsId, machineId, filters, page, pageSize, msgApi]);

  // Initial: catalogue + next-code peek
  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    (async () => {
      try {
        const [cat, peek] = await Promise.all([
          getDowntimeReasonCatalogue(wsId),
          peekNextDowntimeCode(wsId).catch(() => ({ nextCode: '' })),
        ]);
        if (!cancelled) {
          setCatalogue(cat);
          setNextCodePeek(peek?.nextCode || undefined);
        }
      } catch (e: unknown) {
        const err = e as { message?: string };
        if (!cancelled) msgApi.error(err?.message ?? 'Failed to load reason catalogue');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId, msgApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // ─── Handlers ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setDrawerMode('create');
    setEditingEntry(null);
    setDrawerOpen(true);
  };

  const openEdit = (row: DowntimeEntry) => {
    setDrawerMode('edit');
    setEditingEntry(row);
    setDrawerOpen(true);
  };

  const handleClose = async (row: DowntimeEntry) => {
    if (!wsId || !machineId) return;
    setClosingId(row._id);
    try {
      await closeDowntime(wsId, machineId, row._id, {});
      msgApi.success(t('drawer.actions.close'));
      refresh();
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to close downtime');
    } finally {
      setClosingId(null);
    }
  };

  const handleDelete = async (row: DowntimeEntry) => {
    if (!wsId || !machineId) return;
    try {
      await deleteDowntime(wsId, machineId, row._id);
      msgApi.success(t('drawer.actions.delete'));
      refresh();
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to delete downtime');
    }
  };

  // ─── Table columns ──────────────────────────────────────────────────────
  const columns: TableColumnsType<DowntimeEntry> = [
    {
      title: t('tab.col.code'),
      dataIndex: 'downtimeCode',
      key: 'code',
      width: 110,
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
    },
    {
      title: t('tab.col.startAt'),
      dataIndex: 'startAt',
      key: 'startAt',
      width: 160,
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
    {
      title: t('tab.col.endAt'),
      dataIndex: 'endAt',
      key: 'endAt',
      width: 160,
      render: (v: string | null) =>
        v ? dayjs(v).format('DD MMM YYYY HH:mm') : <DsTag>{t('tab.open')}</DsTag>,
    },
    {
      title: t('tab.col.duration'),
      dataIndex: 'durationMinutes',
      key: 'duration',
      width: 110,
      align: 'right',
      render: (v: number | null) => (v == null ? '-' : `${v.toLocaleString()} min`),
    },
    {
      title: t('tab.col.reason'),
      key: 'reason',
      render: (_: unknown, row: DowntimeEntry) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{row.reasonLabelSnapshot}</span>
          <DsTag>
            {row.reasonCategory === 'mechanical'
              ? t('reasons.category.mechanical')
              : t('reasons.category.operational')}
          </DsTag>
        </div>
      ),
    },
    {
      title: t('tab.col.notes'),
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true,
      render: (v?: string) => v || '-',
    },
    {
      title: t('tab.col.loggedBy'),
      dataIndex: 'loggedByUserId',
      key: 'loggedBy',
      width: 140,
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
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 140,
      align: 'right',
      render: (_: unknown, row: DowntimeEntry) => {
        const isOpen = row.endAt === null;
        return (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Tooltip title={t('drawer.editTitle')}>
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<EditOutlined />}
                aria-label={`Edit downtime ${row.downtimeCode}`}
                onClick={() => openEdit(row)}
              />
            </Tooltip>
            {isOpen && (
              <Tooltip title={t('drawer.actions.close')}>
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  icon={<StopOutlined />}
                  loading={closingId === row._id}
                  aria-label={`Close downtime ${row.downtimeCode}`}
                  onClick={() => handleClose(row)}
                />
              </Tooltip>
            )}
            <Popconfirm
              title={t('drawer.actions.delete')}
              onConfirm={() => handleDelete(row)}
              okButtonProps={{ danger: true }}
            >
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<DeleteOutlined />}
                aria-label={`Delete downtime ${row.downtimeCode}`}
                style={{ color: 'var(--cr-error)' }}
              />
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────
  const showEmpty = !loading && entries.length === 0;

  // Build reason filter options from catalogue (if loaded). Disabled codes
  // are still shown - operators may need to filter historical entries that
  // referenced a since-disabled reason.
  const reasonOptions = (catalogue?.codes ?? []).map((c) => ({
    value: c._id,
    label: c.label,
  }));

  return (
    <>
      {ctx}

      {/* Active downtime banner - only renders when an open entry exists */}
      {wsId && machineId && (
        <ActiveDowntimeBanner wsId={wsId} machineId={machineId} onClosed={refresh} />
      )}

      <DsCard>
        {/* Header: title + Add CTA */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--cr-text-2, var(--cr-text-4))' }}>
            {total > 0 ? `${total.toLocaleString()} ${total === 1 ? 'entry' : 'entries'}` : ''}
          </div>
          <DsButton
            dsVariant="primary"
            icon={<PlusOutlined />}
            onClick={openCreate}
            disabled={!catalogue}
          >
            {t('tab.addCta')}
          </DsButton>
        </div>

        {/* Filter row */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
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
                  setFilters((f) => ({
                    ...f,
                    dateRange: [vals[0]!, vals[1]!],
                  }));
                  setPage(1);
                } else {
                  setFilters((f) => ({ ...f, dateRange: null }));
                  setPage(1);
                }
              }}
              size="small"
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
              {t('tab.filters.reason')}
            </div>
            <Select
              value={filters.reasonCodeId ?? undefined}
              onChange={(v) => {
                setFilters((f) => ({ ...f, reasonCodeId: v ?? null }));
                setPage(1);
              }}
              allowClear
              placeholder={t('tab.filters.reasonAll')}
              options={reasonOptions}
              style={{ minWidth: 200 }}
              size="small"
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
              {t('tab.filters.status')}
            </div>
            <Select<'open' | 'closed' | null>
              value={filters.status ?? undefined}
              onChange={(v) => {
                setFilters((f) => ({ ...f, status: v ?? null }));
                setPage(1);
              }}
              allowClear
              placeholder={t('tab.filters.statusAll')}
              options={[
                { value: 'open', label: t('tab.filters.statusOpen') },
                { value: 'closed', label: t('tab.filters.statusClosed') },
              ]}
              style={{ minWidth: 140 }}
              size="small"
            />
          </div>
        </div>

        {showEmpty ? (
          <DsEmptyState
            title={t('tab.empty.heading')}
            sub={t('tab.empty.body')}
            action={
              <DsButton
                dsVariant="primary"
                icon={<PlusOutlined />}
                onClick={openCreate}
                disabled={!catalogue}
              >
                {t('tab.empty.cta')}
              </DsButton>
            }
          />
        ) : (
          <DsTable<DowntimeEntry>
            rowKey={(r) => r._id}
            dataSource={entries}
            columns={columns}
            loading={loading}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: (p) => setPage(p),
              showSizeChanger: false,
            }}
          />
        )}
      </DsCard>

      {catalogue && wsId && machineId && (
        <DowntimeDrawer
          open={drawerOpen}
          mode={drawerMode}
          wsId={wsId}
          machineId={machineId}
          entry={editingEntry ?? undefined}
          catalogue={catalogue}
          nextCodePeek={nextCodePeek}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => {
            setDrawerOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

export default DowntimeLogsTab;
