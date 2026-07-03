'use client';

import { useEffect, useState, useCallback, useMemo, startTransition } from 'react';
import Link from 'next/link';
import { Input, Segmented, Table, Popconfirm, message, Skeleton, Row, Col } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  SearchOutlined,
  ToolOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import {
  DsButton,
  DsCard,
  DsStatCard,
  DsSelect,
  DsOption,
  DsTag,
  DsPageHeader,
  DsEmptyState,
  DsTable,
} from '@/components/ui';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { listMachines, listLocations, getMachineStatusCounts, deleteMachine } from '@/lib/actions';
import { listMaintenanceDueAction } from '@/lib/actions/machines.actions';
import { MaintenanceDueBadge } from '@/components/machines/MaintenanceDueBadge';
import type {
  Machine,
  Location as OperationalLocation,
  MachineStatus,
  MachineStatusCounts,
} from '@/types';
import { parseApiError } from '@/lib/utils';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { useMyPermissions } from '@/hooks/useMyPermissions';

const STATUS_OPTIONS: { value: MachineStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'idle', label: 'Idle' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'retired', label: 'Retired' },
];

const STATUS_LABEL: Record<MachineStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  maintenance: 'Maintenance',
  retired: 'Retired',
};

export default function MachinesPage() {
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();
  const { loading: permissionsLoading, can: canPermission } = useMyPermissions();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [locations, setLocations] = useState<OperationalLocation[]>([]);
  const [counts, setCounts] = useState<MachineStatusCounts | null>(null);
  const [dueCountByMachine, setDueCountByMachine] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MachineStatus | 'all'>('all');
  const [locationFilter, setLocationFilter] = useState<string | 'all'>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'floor' | 'location'>('none');
  const [msgApi, ctx] = message.useMessage();

  const machinesModuleAccess = entitlements?.moduleAccess?.find((m) => m.module === 'machines');
  const hasAccess = machinesModuleAccess?.enabled ?? false;
  const canCreate =
    hasAccess &&
    machinesModuleAccess?.subFeatures?.find((sf) => sf.key === 'machines_basic')?.access !==
      'locked';
  const canDelete = canCreate;

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !hasAccess) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [m, l, c] = await Promise.all([
        listMachines(currentWorkspaceId),
        listLocations(currentWorkspaceId),
        getMachineStatusCounts(currentWorkspaceId),
      ]);
      startTransition(() => {
        setMachines(m);
        setLocations(l);
        setCounts(c);
      });
      // Maintenance-due counts per machine - sub-feature gated, fail-soft.
      const maintenanceSubFeature = entitlements?.moduleAccess
        ?.find((mod) => mod.module === 'machines')
        ?.subFeatures?.find((sf) => sf.key === 'machines_maintenance');
      const hasMaintenance = !maintenanceSubFeature || maintenanceSubFeature.access !== 'locked';
      if (hasMaintenance) {
        try {
          const due = await listMaintenanceDueAction(currentWorkspaceId, {
            limit: 500,
            offset: 0,
          });
          const map = new Map<string, number>();
          for (const row of due.items ?? []) {
            map.set(row.machineId, (map.get(row.machineId) ?? 0) + 1);
          }
          startTransition(() => {
            setDueCountByMachine(map);
          });
        } catch {
          startTransition(() => {
            setDueCountByMachine(new Map());
          });
        }
      } else {
        startTransition(() => {
          setDueCountByMachine(new Map());
        });
      }
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, hasAccess, msgApi, entitlements]);

  useEffect(() => {
    if (!hasAccess) return;
    load();
  }, [load, hasAccess]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return machines.filter((m) => {
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (locationFilter !== 'all' && m.locationId !== locationFilter) return false;
      if (!s) return true;
      return (
        m.name.toLowerCase().includes(s) ||
        m.machineCode?.toLowerCase().includes(s) ||
        m.serialNumber?.toLowerCase().includes(s)
      );
    });
  }, [machines, search, statusFilter, locationFilter]);

  const locationName = useCallback(
    (id: string) => locations.find((l) => l._id === id || l.id === id)?.name ?? '-',
    [locations],
  );

  const NO_FLOOR_KEY = 'no-floor';
  const UNKNOWN_LOCATION_KEY = 'unknown-location';

  const grouped = useMemo<
    { key: string; label: string; rows: Machine[]; isFallback: boolean }[]
  >(() => {
    if (groupBy === 'none') return [];
    const buckets = new Map<string, { label: string; rows: Machine[]; isFallback: boolean }>();

    for (const m of filtered) {
      let key: string;
      let label: string;
      let isFallback = false;

      if (groupBy === 'floor') {
        const raw = m.floorTag?.trim().replace(/\s+/g, ' ');
        if (!raw) {
          key = NO_FLOOR_KEY;
          label = 'No floor tag';
          isFallback = true;
        } else {
          key = raw.toLowerCase();
          label = raw;
        }
      } else {
        const resolved = locationName(m.locationId);
        if (!resolved || resolved === '-') {
          key = UNKNOWN_LOCATION_KEY;
          label = 'Unknown location';
          isFallback = true;
        } else {
          key = m.locationId;
          label = resolved;
        }
      }

      const bucket = buckets.get(key);
      if (bucket) {
        bucket.rows.push(m);
      } else {
        buckets.set(key, { label, rows: [m], isFallback });
      }
    }

    return Array.from(buckets.entries())
      .map(([key, v]) => ({
        key,
        label: v.label,
        rows: v.rows,
        isFallback: v.isFallback,
      }))
      .sort((a, b) => {
        if (a.isFallback !== b.isFallback) return a.isFallback ? 1 : -1;
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
  }, [filtered, groupBy, locationName, NO_FLOOR_KEY, UNKNOWN_LOCATION_KEY]);

  const handleDelete = async (id: string) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteMachine(currentWorkspaceId, id);
      msgApi.success('Machine retired');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  if (!isHydrated) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }
  if (!hasAccess) {
    return <ModuleLockedPage module="machines" />;
  }
  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }
  if (!canPermission('machines', 'view')) {
    return (
      <DsCard>
        <DsEmptyState
          title="Access Denied"
          sub="You do not have permission to view machines. Contact your workspace owner to request access."
        />
      </DsCard>
    );
  }

  const em = '-';
  const renderEmpty = (v?: string | null) => (v && v.trim() ? v : em);

  const columns = [
    {
      title: 'Code',
      dataIndex: 'machineCode',
      key: 'machineCode',
      width: 110,
      render: (v: string | undefined) => (
        <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--cr-text-2)' }}>
          {renderEmpty(v)}
        </span>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, row: Machine) => {
        const machineId = row.id ?? row._id ?? '';
        const dueCount = dueCountByMachine.get(machineId) ?? 0;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Link
              href={`/dashboard/machines/${machineId}`}
              style={{ fontWeight: 600, color: 'var(--cr-primary)' }}
            >
              {name}
            </Link>
            {currentWorkspaceId && dueCount > 0 && (
              <MaintenanceDueBadge
                count={dueCount}
                wsId={currentWorkspaceId}
                machineId={machineId}
              />
            )}
          </div>
        );
      },
    },
    {
      title: 'Location',
      dataIndex: 'locationId',
      key: 'locationId',
      render: (id: string) => locationName(id),
    },
    {
      title: 'Floor',
      dataIndex: 'floorTag',
      key: 'floorTag',
      render: (v: string | undefined) => renderEmpty(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: MachineStatus) => <DsTag status={status} label={STATUS_LABEL[status]} />,
    },
    {
      title: 'Attributes',
      key: 'attr',
      render: (_: unknown, row: Machine) => {
        const a = row.attributes || {};
        const bits = [
          a.needles ? `${a.needles}N` : null,
          a.heads ? `${a.heads}H` : null,
          a.hoopSizeMm ? `${a.hoopSizeMm}mm` : null,
        ].filter(Boolean);
        return bits.length ? (
          <span style={{ color: 'var(--cr-text-2)', fontVariantNumeric: 'tabular-nums' }}>
            {bits.join(' · ')}
          </span>
        ) : (
          em
        );
      },
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'actions',
      width: 140,
      align: 'right' as const,
      render: (_: unknown, row: Machine) => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <Link href={`/dashboard/machines/${row.id ?? row._id}`} aria-label="View machine">
            <DsButton dsVariant="ghost" dsSize="sm" icon={<EyeOutlined />} />
          </Link>
          {canCreate && (
            <Link
              href={`/dashboard/machines/${row.id ?? row._id}?edit=1`}
              aria-label="Edit machine"
            >
              <DsButton dsVariant="ghost" dsSize="sm" icon={<EditOutlined />} />
            </Link>
          )}
          {canDelete && row.status !== 'retired' && (
            <Popconfirm
              title="Retire this machine?"
              description="It will no longer appear on active lists."
              onConfirm={() => handleDelete(row.id ?? row._id!)}
              okButtonProps={{ danger: true }}
            >
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<DeleteOutlined />}
                aria-label="Retire machine"
                style={{ color: 'var(--cr-error)' }}
              />
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <DsPageHeader
          title="Machines"
          sub="Operational machine inventory across your locations."
          icon={<ToolOutlined />}
          right={
            canCreate ? (
              <Link href="/dashboard/machines/new">
                <DsButton dsVariant="primary" icon={<PlusOutlined />}>
                  Add Machine
                </DsButton>
              </Link>
            ) : null
          }
        />

        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}>
            <DsStatCard
              label="Total"
              value={counts?.total ?? 0}
              icon={<ToolOutlined />}
              sub="machines"
            />
          </Col>
          <Col xs={12} md={6}>
            <DsStatCard
              label="Active"
              value={counts?.active ?? 0}
              icon={<CheckCircleOutlined />}
              sub="in use"
            />
          </Col>
          <Col xs={12} md={6}>
            <DsStatCard
              label="Idle"
              value={counts?.idle ?? 0}
              icon={<ClockCircleOutlined />}
              sub="ready"
            />
          </Col>
          <Col xs={12} md={6}>
            <DsStatCard
              label="Maintenance"
              value={counts?.maintenance ?? 0}
              icon={<WarningOutlined />}
              sub="under service"
            />
          </Col>
        </Row>

        <DsCard noPad>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderBottom: '1px solid var(--cr-border)',
            }}
          >
            <Input
              aria-label="Search name, code, or serial"
              prefix={<SearchOutlined style={{ color: 'var(--cr-text-4)' }} />}
              placeholder="Search name, code, or serial"
              allowClear
              style={{ width: 280, flexShrink: 0 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <DsSelect
              aria-label="Filter by machine status"
              style={{ width: 170, flexShrink: 0 }}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as MachineStatus | 'all')}
            >
              <DsOption value="all">All statuses</DsOption>
              {STATUS_OPTIONS.map((o) => (
                <DsOption key={o.value} value={o.value}>
                  {o.label}
                </DsOption>
              ))}
            </DsSelect>
            <DsSelect
              aria-label="Filter by location"
              style={{ width: 200, flexShrink: 0 }}
              value={locationFilter}
              onChange={(v) => setLocationFilter(v as string | 'all')}
            >
              <DsOption value="all">All locations</DsOption>
              {locations.map((l) => (
                <DsOption key={l._id ?? l.id} value={l._id ?? l.id}>
                  {l.name}
                </DsOption>
              ))}
            </DsSelect>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 'auto',
              }}
            >
              <span style={{ fontSize: 12, color: 'var(--cr-text-3)', fontWeight: 600 }}>
                Group by
              </span>
              <Segmented
                value={groupBy}
                onChange={(v) => setGroupBy(v as 'none' | 'floor' | 'location')}
                options={[
                  { label: 'None', value: 'none' },
                  { label: 'Floor', value: 'floor' },
                  { label: 'Location', value: 'location' },
                ]}
              />
            </div>
          </div>

          {groupBy === 'none' ? (
            <DsTable
              rowKey={(r) => r.id ?? r._id!}
              loading={loading}
              dataSource={filtered}
              columns={columns}
              pagination={{ pageSize: 25 }}
              locale={{
                emptyText: (
                  <DsEmptyState
                    title={locations.length === 0 ? 'No locations yet' : 'No machines match'}
                    sub={
                      locations.length === 0
                        ? 'Add a location in Settings before adding machines.'
                        : 'Try clearing filters or changing your search.'
                    }
                  />
                ),
              }}
            />
          ) : (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {loading && <Skeleton active paragraph={{ rows: 6 }} />}
              {!loading && grouped.length === 0 && (
                <DsEmptyState
                  title="No machines match"
                  sub="Try clearing filters or changing your search."
                />
              )}
              {!loading &&
                grouped.map((g) => {
                  const groupedColumns = columns.filter((c: { key?: string }) => {
                    if (groupBy === 'floor' && c.key === 'floorTag') return false;
                    if (groupBy === 'location' && c.key === 'locationId') return false;
                    return true;
                  });
                  return (
                    <div key={g.key}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          marginBottom: 10,
                          paddingBottom: 8,
                          borderBottom: '1px solid var(--cr-border)',
                        }}
                      >
                        <span
                          style={{
                            fontFamily: 'var(--font-display)',
                            fontWeight: 700,
                            fontSize: 14,
                            color: g.isFallback ? 'var(--cr-text-3)' : 'var(--cr-text)',
                            fontStyle: g.isFallback ? 'italic' : 'normal',
                          }}
                        >
                          {g.label}
                        </span>
                        <DsTag>{g.rows.length}</DsTag>
                      </div>
                      <Table
                        rowKey={(r) => r.id ?? r._id!}
                        dataSource={g.rows}
                        columns={groupedColumns}
                        pagination={false}
                        size="small"
                      />
                    </div>
                  );
                })}
            </div>
          )}
        </DsCard>
      </div>
    </>
  );
}
