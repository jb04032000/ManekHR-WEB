'use client';

/**
 * MaintenanceLogsTab - operator-facing tab for the machine detail page.
 *
 * Per Plan 24-11 §Task 4 + D-13 §1:
 * - Section 1: Schedules table + Add/Edit/Pause/Delete actions
 * - Section 2: Service Logs table with filters + inline edit (notes/cost within 7d)
 * - Composes <MaintenanceScheduleDrawer> + <ServiceLogDrawer>
 */

import {
  DatePicker,
  Form,
  InputNumber,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Select,
  Tooltip,
  message,
  type TableColumnsType,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';

import { DsButton, DsCard, DsTable, DsTag, DsEmptyState } from '@/components/ui';
import {
  deleteMaintenanceScheduleAction,
  listMaintenanceSchedulesAction,
  listServiceLogsAction,
  pauseMaintenanceScheduleAction,
  updateServiceLogAction,
} from '@/lib/actions/machines.actions';
import { listTeam } from '@/lib/actions';
import type {
  ListServiceLogsParams,
  ListServiceLogsResponse,
  MaintenanceCadenceMode,
  MaintenanceSchedule,
  ServiceLog,
  TeamMember,
} from '@/types';
import { MaintenanceScheduleDrawer } from './MaintenanceScheduleDrawer';
import { ServiceLogDrawer } from './ServiceLogDrawer';

interface MaintenanceLogsTabProps {
  wsId: string;
  machineId: string;
}

interface Filters {
  scheduleId: string | null;
  technicianId: string | null;
  dateRange: [Dayjs, Dayjs] | null;
}

const DEFAULT_PAGE_SIZE = 25;

function cadenceUnitFromMode(mode: MaintenanceCadenceMode, t: (k: string) => string): string {
  switch (mode) {
    case 'daily':
      return t('schedule.cadenceUnitDays');
    case 'weekly':
      return t('schedule.cadenceUnitWeeks');
    case 'monthly':
      return t('schedule.cadenceUnitMonths');
    case 'hours_based':
      return t('schedule.cadenceUnitHours');
    case 'output_based':
      return t('schedule.cadenceUnitUnits');
    default:
      return '';
  }
}

function currencyInr(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return '-';
  const inr = paise / 100;
  return inr.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

export function MaintenanceLogsTab({ wsId, machineId }: MaintenanceLogsTabProps) {
  const t = useTranslations('machines-maintenance');
  const [msgApi, ctx] = message.useMessage();

  const [schedules, setSchedules] = useState<MaintenanceSchedule[]>([]);
  const [serviceLogs, setServiceLogs] = useState<ListServiceLogsResponse>({
    items: [],
    total: 0,
  });
  const [technicians, setTechnicians] = useState<TeamMember[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [loadingServiceLogs, setLoadingServiceLogs] = useState(false);

  const [filters, setFilters] = useState<Filters>({
    scheduleId: null,
    technicianId: null,
    dateRange: null,
  });
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);

  const [scheduleDrawerOpen, setScheduleDrawerOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<MaintenanceSchedule | undefined>();
  const [serviceLogDrawerOpen, setServiceLogDrawerOpen] = useState(false);

  // Inline edit state for ServiceLog (notes + cost, within 7 days)
  const [editingLog, setEditingLog] = useState<ServiceLog | null>(null);
  const [editForm] = Form.useForm<{ notes?: string; costInr?: number }>();
  const [editSaving, setEditSaving] = useState(false);

  // ── Fetchers ───────────────────────────────────────────────────────────
  const refreshSchedules = useCallback(async () => {
    if (!wsId || !machineId) return;
    startTransition(() => {
      setLoadingSchedules(true);
    });
    try {
      const list = await listMaintenanceSchedulesAction(wsId, machineId);
      startTransition(() => {
        setSchedules(list);
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to load schedules');
    } finally {
      setLoadingSchedules(false);
    }
  }, [wsId, machineId, msgApi]);

  const refreshServiceLogs = useCallback(async () => {
    if (!wsId || !machineId) return;
    startTransition(() => {
      setLoadingServiceLogs(true);
    });
    try {
      const params: ListServiceLogsParams = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (filters.scheduleId) params.scheduleId = filters.scheduleId;
      if (filters.technicianId) params.technicianId = filters.technicianId;
      if (filters.dateRange) {
        params.from = filters.dateRange[0].format('YYYY-MM-DD');
        params.to = filters.dateRange[1].format('YYYY-MM-DD');
      }
      const resp = await listServiceLogsAction(wsId, machineId, params);
      startTransition(() => {
        setServiceLogs(resp);
      });
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to load service logs');
    } finally {
      setLoadingServiceLogs(false);
    }
  }, [wsId, machineId, page, pageSize, filters, msgApi]);

  useEffect(() => {
    refreshSchedules();
  }, [refreshSchedules]);

  useEffect(() => {
    refreshServiceLogs();
  }, [refreshServiceLogs]);

  // Technicians for the drawer selects (one-time fetch).
  useEffect(() => {
    if (!wsId) return;
    let cancelled = false;
    (async () => {
      try {
        const r: { members?: TeamMember[] } | TeamMember[] = await listTeam(wsId, { limit: 500 });
        const list: TeamMember[] = Array.isArray(r) ? r : (r.members ?? []);
        if (!cancelled) setTechnicians(list.filter((m) => m.isActive));
      } catch {
        if (!cancelled) setTechnicians([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wsId]);

  // ── Schedule actions ───────────────────────────────────────────────────
  const openCreateSchedule = () => {
    setEditingSchedule(undefined);
    setScheduleDrawerOpen(true);
  };

  const openEditSchedule = (s: MaintenanceSchedule) => {
    setEditingSchedule(s);
    setScheduleDrawerOpen(true);
  };

  const togglePause = async (s: MaintenanceSchedule) => {
    try {
      await pauseMaintenanceScheduleAction(wsId, machineId, s._id, !s.isActive);
      msgApi.success(s.isActive ? t('schedule.pauseAction') : t('schedule.resumeAction'));
      refreshSchedules();
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to update schedule');
    }
  };

  const handleDeleteSchedule = async (s: MaintenanceSchedule) => {
    try {
      await deleteMaintenanceScheduleAction(wsId, machineId, s._id);
      msgApi.success(t('schedule.deleteConfirm'));
      refreshSchedules();
    } catch (e: unknown) {
      const err = e as { message?: string };
      msgApi.error(err?.message ?? 'Failed to delete schedule');
    }
  };

  // ── ServiceLog inline edit ─────────────────────────────────────────────
  const openEditLog = (log: ServiceLog) => {
    setEditingLog(log);
    editForm.setFieldsValue({
      notes: log.notes,
      costInr: log.costPaise / 100,
    });
  };

  const closeEditLog = () => setEditingLog(null);

  const submitEditLog = async () => {
    if (!editingLog) return;
    setEditSaving(true);
    try {
      const vals = await editForm.validateFields();
      const costPaise =
        vals.costInr === undefined || vals.costInr === null
          ? undefined
          : Math.round(Number(vals.costInr) * 100);
      await updateServiceLogAction(wsId, machineId, editingLog._id, {
        notes: vals.notes,
        costPaise,
      });
      msgApi.success(t('serviceLog.editNotice'));
      closeEditLog();
      refreshServiceLogs();
    } catch (e: unknown) {
      const err = e as {
        message?: string;
        response?: { data?: { error?: string; code?: string } };
      };
      const code = err?.response?.data?.error ?? err?.response?.data?.code;
      let msg = err?.message ?? 'Failed to update service log';
      if (code) {
        try {
          const translated = t(`errors.${code}` as never);
          if (translated && translated !== `errors.${code}`) msg = translated;
        } catch {
          // fall through
        }
      }
      msgApi.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const technicianName = (id: string | null | undefined): string => {
    if (!id) return '-';
    const m = technicians.find((tm) => tm.id === id);
    return m?.name ?? id;
  };

  const isWithinEditWindow = (createdAt: string): boolean => {
    return dayjs().diff(dayjs(createdAt), 'day') < 7;
  };

  // ── Schedule columns ───────────────────────────────────────────────────
  const scheduleColumns: TableColumnsType<MaintenanceSchedule> = [
    {
      title: 'Code',
      dataIndex: 'scheduleCode',
      width: 110,
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
    },
    {
      title: t('schedule.name'),
      dataIndex: 'name',
    },
    {
      title: t('schedule.cadenceMode'),
      key: 'cadence',
      render: (_: unknown, row: MaintenanceSchedule) => {
        return `${t(`schedule.cadenceModeOptions.${row.cadenceMode}`)} · ${row.cadenceInterval} ${cadenceUnitFromMode(row.cadenceMode, t)}`;
      },
    },
    {
      title: t('schedule.nextDue'),
      dataIndex: 'nextDueAt',
      width: 140,
      render: (v: string) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
    },
    {
      title: t('schedule.technician'),
      dataIndex: 'technicianId',
      render: (v: string | null) => technicianName(v),
    },
    {
      title: t('schedule.status'),
      dataIndex: 'isActive',
      width: 110,
      render: (v: boolean) => (
        <DsTag>{v ? t('schedule.statusActive') : t('schedule.statusPaused')}</DsTag>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_: unknown, row: MaintenanceSchedule) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Tooltip title={t('schedule.statusActive')}>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<EditOutlined />}
              aria-label={`Edit schedule ${row.scheduleCode}`}
              onClick={() => openEditSchedule(row)}
            />
          </Tooltip>
          <Tooltip title={row.isActive ? t('schedule.pauseAction') : t('schedule.resumeAction')}>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={row.isActive ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
              aria-label={
                row.isActive
                  ? `Pause schedule ${row.scheduleCode}`
                  : `Resume schedule ${row.scheduleCode}`
              }
              onClick={() => togglePause(row)}
            />
          </Tooltip>
          <Popconfirm
            title={t('schedule.deleteConfirm')}
            onConfirm={() => handleDeleteSchedule(row)}
            okButtonProps={{ danger: true }}
          >
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<DeleteOutlined />}
              aria-label={`Delete schedule ${row.scheduleCode}`}
              style={{ color: 'var(--cr-error)' }}
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  // ── ServiceLog columns ─────────────────────────────────────────────────
  const serviceLogColumns: TableColumnsType<ServiceLog> = [
    {
      title: 'Code',
      dataIndex: 'serviceLogCode',
      width: 120,
      render: (v: string) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>,
    },
    {
      title: t('serviceLog.servicedAt'),
      dataIndex: 'servicedAt',
      width: 160,
      render: (v: string) => dayjs(v).format('DD MMM YYYY HH:mm'),
    },
    {
      title: t('serviceLog.duration'),
      dataIndex: 'durationMinutes',
      width: 110,
      align: 'right',
      render: (v: number) => `${v.toLocaleString()} min`,
    },
    {
      title: t('serviceLog.schedule'),
      dataIndex: 'scheduleId',
      render: (v: string | null) => {
        if (!v) return <DsTag>{t('serviceLog.adhoc')}</DsTag>;
        const s = schedules.find((sc) => sc._id === v);
        return s ? `${s.scheduleCode} - ${s.name}` : v;
      },
    },
    {
      title: t('serviceLog.technician'),
      key: 'technician',
      render: (_: unknown, row: ServiceLog) =>
        row.technicianNameSnapshot ?? technicianName(row.technicianId),
    },
    {
      title: t('serviceLog.partsReplaced'),
      dataIndex: 'partsReplaced',
      width: 120,
      align: 'right',
      render: (parts: ServiceLog['partsReplaced']) => `${(parts ?? []).length}`,
    },
    {
      title: t('serviceLog.cost'),
      dataIndex: 'costPaise',
      width: 120,
      align: 'right',
      render: (v: number) => currencyInr(v),
    },
    {
      title: t('serviceLog.linkedDowntime'),
      dataIndex: 'linkedDowntimeId',
      width: 140,
      render: (v: string | null) => {
        if (!v) return '-';
        return (
          <a href={`/dashboard/machines/${machineId}?tab=downtime-logs&highlight=${v}`}>View</a>
        );
      },
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 80,
      align: 'right',
      render: (_: unknown, row: ServiceLog) => {
        if (!isWithinEditWindow(row.createdAt)) return null;
        return (
          <Tooltip title={t('serviceLog.editNotice')}>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<EditOutlined />}
              aria-label={`Edit service log ${row.serviceLogCode}`}
              onClick={() => openEditLog(row)}
            />
          </Tooltip>
        );
      },
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────
  const scheduleOptions = useMemo(
    () =>
      schedules.map((s) => ({
        value: s._id,
        label: `${s.scheduleCode} - ${s.name}`,
      })),
    [schedules],
  );

  const technicianOptions = useMemo(
    () =>
      technicians.map((m) => ({
        value: m.id,
        label: `${m.name}${m.employeeCode ? ` (${m.employeeCode})` : ''}`,
      })),
    [technicians],
  );

  const showSchedulesEmpty = !loadingSchedules && schedules.length === 0;
  const showServiceLogsEmpty = !loadingServiceLogs && serviceLogs.items.length === 0;

  return (
    <>
      {ctx}

      {/* Section 1: Schedules */}
      <DsCard>
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
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--cr-text)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ToolOutlined /> {t('schedule.sectionTitle')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <DsButton dsVariant="primary" icon={<PlusOutlined />} onClick={openCreateSchedule}>
              {t('schedule.addButton')}
            </DsButton>
            <DsButton
              dsVariant="ghost"
              icon={<PlusOutlined />}
              onClick={() => setServiceLogDrawerOpen(true)}
            >
              {t('serviceLog.addButton')}
            </DsButton>
          </div>
        </div>
        {showSchedulesEmpty ? (
          <DsEmptyState
            title={t('schedule.sectionTitle')}
            sub={t('dashboard.empty')}
            action={
              <DsButton dsVariant="primary" icon={<PlusOutlined />} onClick={openCreateSchedule}>
                {t('schedule.addButton')}
              </DsButton>
            }
          />
        ) : (
          <DsTable<MaintenanceSchedule>
            rowKey={(r) => r._id}
            dataSource={schedules}
            columns={scheduleColumns}
            loading={loadingSchedules}
            pagination={false}
          />
        )}
      </DsCard>

      {/* Section 2: Service Logs */}
      <DsCard style={{ marginTop: 16 }}>
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
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--cr-text)',
            }}
          >
            {t('serviceLog.sectionTitle')}
          </div>
        </div>

        {/* Filter bar */}
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
              {t('serviceLog.schedule')}
            </div>
            <Select
              value={filters.scheduleId ?? undefined}
              onChange={(v) => {
                setFilters((f) => ({ ...f, scheduleId: v ?? null }));
                setPage(1);
              }}
              allowClear
              placeholder={t('serviceLog.schedule')}
              options={scheduleOptions}
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
              {t('serviceLog.technician')}
            </div>
            <Select
              value={filters.technicianId ?? undefined}
              onChange={(v) => {
                setFilters((f) => ({ ...f, technicianId: v ?? null }));
                setPage(1);
              }}
              allowClear
              placeholder={t('serviceLog.technician')}
              options={technicianOptions}
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
              {t('serviceLog.servicedAt')}
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
        </div>

        {showServiceLogsEmpty ? (
          <DsEmptyState
            title={t('serviceLog.sectionTitle')}
            sub={t('dashboard.empty')}
            action={
              <DsButton
                dsVariant="primary"
                icon={<PlusOutlined />}
                onClick={() => setServiceLogDrawerOpen(true)}
              >
                {t('serviceLog.addButton')}
              </DsButton>
            }
          />
        ) : (
          <>
            <DsTable<ServiceLog>
              rowKey={(r) => r._id}
              dataSource={serviceLogs.items}
              columns={serviceLogColumns}
              loading={loadingServiceLogs}
              pagination={false}
              expandable={{
                expandedRowRender: (row) => (
                  <div style={{ padding: '4px 16px' }}>
                    {row.notes && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>{t('serviceLog.notes')}:</strong> {row.notes}
                      </div>
                    )}
                    {row.partsReplaced && row.partsReplaced.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <strong>{t('serviceLog.partsReplaced')}:</strong>
                        <ul style={{ margin: '4px 0 0 16px' }}>
                          {row.partsReplaced.map((p, i) => (
                            <li key={i}>
                              {p.itemNameSnapshot ?? p.freeTextName ?? p.itemId} × {p.quantity}
                              {p.unitCostPaise !== null && p.unitCostPaise !== undefined
                                ? ` @ ${currencyInr(p.unitCostPaise)}`
                                : ''}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {row.checklistTicked && row.checklistTicked.length > 0 && (
                      <div>
                        <strong>{t('serviceLog.checklist')}:</strong>
                        <ul style={{ margin: '4px 0 0 16px' }}>
                          {row.checklistTicked.map((c, i) => (
                            <li key={i}>
                              {c.ticked ? '✔' : '✗'} {c.item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ),
              }}
            />
            <div
              style={{
                marginTop: 16,
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <Pagination
                current={page}
                pageSize={pageSize}
                total={serviceLogs.total}
                onChange={(p) => setPage(p)}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </DsCard>

      <MaintenanceScheduleDrawer
        open={scheduleDrawerOpen}
        onClose={() => setScheduleDrawerOpen(false)}
        wsId={wsId}
        machineId={machineId}
        schedule={editingSchedule}
        technicians={technicians}
        onSaved={() => {
          setScheduleDrawerOpen(false);
          refreshSchedules();
        }}
      />

      <ServiceLogDrawer
        open={serviceLogDrawerOpen}
        onClose={() => setServiceLogDrawerOpen(false)}
        wsId={wsId}
        machineId={machineId}
        schedules={schedules}
        technicians={technicians}
        onSaved={() => {
          setServiceLogDrawerOpen(false);
          refreshSchedules();
          refreshServiceLogs();
        }}
      />

      <Modal
        open={!!editingLog}
        onCancel={closeEditLog}
        title={`${t('serviceLog.sectionTitle')} - ${editingLog?.serviceLogCode ?? ''}`}
        confirmLoading={editSaving}
        onOk={submitEditLog}
        destroyOnHidden
      >
        <div
          style={{
            fontSize: 12,
            color: 'var(--cr-text-3, var(--cr-text-5))',
            marginBottom: 12,
          }}
        >
          {t('serviceLog.editNotice')}
        </div>
        <Form form={editForm} layout="vertical">
          <Form.Item name="costInr" label={`${t('serviceLog.cost')} (INR)`}>
            <InputNumber min={0} step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label={t('serviceLog.notes')}>
            <Input.TextArea rows={3} maxLength={2000} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export default MaintenanceLogsTab;
