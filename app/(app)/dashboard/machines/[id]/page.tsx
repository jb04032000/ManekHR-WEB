'use client';

import { useEffect, useState, useCallback, use, startTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Descriptions,
  Tag,
  Table,
  Popconfirm,
  message,
  Skeleton,
  Form,
  Input,
  DatePicker,
  TimePicker,
  Modal,
  Tooltip,
  Tabs,
  Row,
  Col,
  InputNumber,
  Alert,
  Collapse,
  Dropdown,
  Select,
  Radio,
  Button,
} from 'antd';
import {
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SaveOutlined,
  StopOutlined,
  ToolOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { DsButton, DsCard, DsSelect, DsOption, DsTag, DsPageHeader } from '@/components/ui';
import {
  getMachine,
  updateMachine,
  deleteMachine,
  listMachineAssignments,
  createMachineAssignment,
  updateMachineAssignment,
  deleteMachineAssignment,
  listLocations,
  listShifts,
  listTeam,
} from '@/lib/actions';
import { MachineMaintenanceFields } from '@/components/machines/MachineMaintenanceFields';
import { ProductionLogsTab } from '@/components/machines/ProductionLogsTab';
import { DowntimeLogsTab } from '@/components/machines/DowntimeLogsTab';
import { MaintenanceLogsTab } from '@/components/machines/MaintenanceLogsTab';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { useTranslations } from 'next-intl';
import type {
  Machine,
  MachineShiftAssignment,
  Location as OperationalLocation,
  MachineStatus,
  Shift,
  TeamMember,
} from '@/types';
import { parseApiError } from '@/lib/utils';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import dayjs from 'dayjs';

const STATUS_OPTIONS: { value: MachineStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'idle', label: 'Idle', color: 'gold' },
  { value: 'maintenance', label: 'Maintenance', color: 'orange' },
  { value: 'retired', label: 'Retired', color: 'default' },
];

export default function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: machineId } = use(params);
  return <MachineDetailBody machineId={machineId} />;
}

function MachineDetailBody({ machineId }: { machineId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentWorkspaceId } = useWorkspaceStore();
  const tProd = useTranslations('machines-production');
  const tDowntime = useTranslations('machines-downtime');
  const tMaint = useTranslations('machines-maintenance');
  const { entitlements, isHydrated } = useSubscriptionStore();
  const [msgApi, ctx] = message.useMessage();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [locations, setLocations] = useState<OperationalLocation[]>([]);
  const [assignments, setAssignments] = useState<MachineShiftAssignment[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(searchParams?.get('edit') === '1');
  const [saving, setSaving] = useState(false);
  const [assignForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [assignSaving, setAssignSaving] = useState(false);
  const [shiftsError, setShiftsError] = useState<string | null>(null);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [showEnded, setShowEnded] = useState(false);
  const [endingRowId, setEndingRowId] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<dayjs.Dayjs | null>(dayjs());
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>(
    searchParams?.get('tab') === 'assignments' ? 'assignments' : 'overview',
  );

  const machinesModuleAccess = entitlements?.moduleAccess?.find((m) => m.module === 'machines');
  const hasMachinesAccess = machinesModuleAccess?.enabled ?? false;
  const canEdit =
    hasMachinesAccess &&
    machinesModuleAccess?.subFeatures?.find((sf) => sf.key === 'machines_basic')?.access !==
      'locked';
  const canAssign =
    (machinesModuleAccess?.enabled ?? false) &&
    machinesModuleAccess?.subFeatures?.find((sf) => sf.key === 'machines_assignments')?.access !==
      'locked';

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !machineId || !hasMachinesAccess) return;
    // Do NOT flip `loading` back to true on refresh - Skeleton would
    // unmount the Tabs and reset activeKey to the default. `loading`
    // starts true and flips to false exactly once after first fetch.
    startTransition(() => {
      setShiftsError(null);
    });
    try {
      // Core machine fetch - must succeed or we have nothing to show.
      const m = await getMachine(currentWorkspaceId, machineId);
      startTransition(() => {
        setMachine(m);
      });
      editForm.setFieldsValue({
        name: m.name,
        locationId: m.locationId,
        status: m.status,
        floorTag: m.floorTag,
        type: m.type,
        manufacturer: m.manufacturer,
        model: m.model,
        serialNumber: m.serialNumber,
        installedOn: m.installedOn ? dayjs(m.installedOn) : null,
        notes: m.notes,
        attributes: m.attributes,
        lastMaintenanceDate: (m as any).lastMaintenanceDate
          ? dayjs((m as any).lastMaintenanceDate)
          : null,
        maintenanceIntervalDays: (m as any).maintenanceIntervalDays ?? null,
      });

      // Supporting fetches - isolated: a 403 on any one shouldn't blank
      // the whole page. Typical cause: RBAC role without VIEW on team
      // or shifts.
      const [locs, a, s, team] = await Promise.all([
        listLocations(currentWorkspaceId).catch(() => [] as OperationalLocation[]),
        listMachineAssignments(currentWorkspaceId, machineId).catch(
          () => [] as MachineShiftAssignment[],
        ),
        listShifts(currentWorkspaceId).catch((e) => {
          const detail =
            e?.response?.data?.message ||
            (e instanceof Error ? e.message : null) ||
            'Unknown error';
          setShiftsError(String(detail));
          console.warn('[MachineDetail] listShifts failed:', e);
          return [] as Shift[];
        }),
        listTeam(currentWorkspaceId, { limit: 500 })
          .then((r: any) => (Array.isArray(r) ? r : (r.members ?? [])))
          .catch(() => [] as TeamMember[]),
      ]);
      startTransition(() => {
        setLocations(locs);
        setAssignments(a);
        setShifts(s);
        setMembers(team);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, machineId, editForm, msgApi, hasMachinesAccess]);

  useEffect(() => {
    if (!hasMachinesAccess) return;
    load();
  }, [load, hasMachinesAccess]);

  const onSaveEdit = async (vals: any) => {
    if (!currentWorkspaceId || !machineId) return;
    setSaving(true);
    try {
      const updated = await updateMachine(currentWorkspaceId, machineId, {
        name: vals.name,
        locationId: vals.locationId,
        status: vals.status,
        floorTag: vals.floorTag,
        type: vals.type,
        manufacturer: vals.manufacturer,
        model: vals.model,
        serialNumber: vals.serialNumber,
        installedOn: vals.installedOn ? dayjs(vals.installedOn).format('YYYY-MM-DD') : undefined,
        notes: vals.notes,
        attributes: vals.attributes,
        lastMaintenanceDate: vals.lastMaintenanceDate
          ? dayjs(vals.lastMaintenanceDate).format('YYYY-MM-DD')
          : undefined,
        maintenanceIntervalDays: vals.maintenanceIntervalDays ?? undefined,
      } as any);
      setMachine(updated);
      setEditing(false);
      msgApi.success('Machine updated');
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!currentWorkspaceId || !machineId) return;
    try {
      await deleteMachine(currentWorkspaceId, machineId);
      msgApi.success('Machine retired');
      router.push('/dashboard/machines');
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const onCreateAssignment = async (vals: any) => {
    if (!currentWorkspaceId || !machineId) return;

    // effectiveFrom defaults to today when the user hasn't opened the
    // "advanced dates" panel - 80% case is an open-ended assignment
    // starting now.
    const from = vals.effectiveFrom ? dayjs(vals.effectiveFrom) : dayjs();
    const to = vals.effectiveTo ? dayjs(vals.effectiveTo) : null;
    const targetShift = vals.shiftId || null;

    // Frontend duplicate guard: if an active assignment on this machine
    // already covers the same (worker, shift) for an overlapping window,
    // block locally with a clear message instead of round-tripping to 409.
    const overlaps = assignments.filter((a) => {
      if (a.isDeleted) return false;
      const aMemberId =
        typeof a.teamMemberId === 'string' ? a.teamMemberId : (a.teamMemberId as any)?._id;
      if (aMemberId !== vals.teamMemberId) return false;
      const aShift = typeof a.shiftId === 'string' ? a.shiftId : ((a.shiftId as any)?._id ?? null);
      if ((aShift || null) !== (targetShift || null)) return false;
      const aFrom = dayjs(a.effectiveFrom);
      const aTo = a.effectiveTo ? dayjs(a.effectiveTo) : null;
      const endsBeforeNew = aTo && aTo.isBefore(from);
      const startsAfterNew = to && aFrom.isAfter(to);
      return !endsBeforeNew && !startsAfterNew;
    });
    if (overlaps.length > 0) {
      msgApi.error(
        targetShift
          ? 'This worker is already assigned to this machine on this shift for an overlapping period.'
          : 'This worker is already assigned to this machine for an overlapping period.',
      );
      return;
    }

    setAssignSaving(true);
    try {
      const startTime = vals.startTime ? dayjs(vals.startTime).format('HH:mm') : undefined;
      const endTime = vals.endTime ? dayjs(vals.endTime).format('HH:mm') : undefined;
      if ((startTime && !endTime) || (!startTime && endTime)) {
        msgApi.error('Provide both start and end time, or leave both empty.');
        return;
      }
      await createMachineAssignment(currentWorkspaceId, machineId, {
        shiftId: vals.shiftId || undefined,
        teamMemberId: vals.teamMemberId,
        effectiveFrom: from.toISOString(),
        effectiveTo: vals.effectiveTo ? dayjs(vals.effectiveTo).toISOString() : undefined,
        isPrimary: vals.isPrimary ?? true,
        startTime: vals.shiftId ? undefined : startTime,
        endTime: vals.shiftId ? undefined : endTime,
        notes: vals.notes,
      });
      msgApi.success('Assignment created');
      assignForm.resetFields();
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setAssignSaving(false);
    }
  };

  const onDeleteAssignment = async (id: string) => {
    if (!currentWorkspaceId || !machineId) return;
    try {
      await deleteMachineAssignment(currentWorkspaceId, machineId, id);
      msgApi.success('Assignment removed');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  /**
   * End an assignment.
   *   immediate=true  → effectiveTo = now (row becomes "Ended" right away).
   *   immediate=false → effectiveTo = end-of-day on the chosen date
   *                     (assignment stays active through that whole day).
   */
  const onEndAssignment = async (id: string, when: dayjs.Dayjs, immediate = false) => {
    if (!currentWorkspaceId || !machineId) return;
    try {
      const effectiveTo = immediate ? when : when.endOf('day');
      await updateMachineAssignment(currentWorkspaceId, machineId, id, {
        effectiveTo: effectiveTo.toISOString(),
      });
      msgApi.success(
        immediate ? 'Assignment ended' : `Assignment ends on ${when.format('DD MMM YYYY')}`,
      );
      setEndingRowId(null);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  if (!isHydrated) {
    return <Skeleton active paragraph={{ rows: 10 }} />;
  }
  if (!hasMachinesAccess) {
    return <ModuleLockedPage module="machines" />;
  }
  if (loading || !machine) {
    // Keep Form instances paired with hidden <Form> elements so the
    // useForm() hooks above don't warn. Real forms in the tabs mount
    // below once machine data arrives.
    return (
      <>
        <div style={{ display: 'none' }}>
          <Form form={editForm} />
          <Form form={assignForm} />
        </div>
        <Skeleton active paragraph={{ rows: 10 }} />
      </>
    );
  }

  const locationName =
    locations.find((l) => (l._id ?? l.id) === (machine.locationId as unknown as string))?.name ??
    '-';
  const statusOpt = STATUS_OPTIONS.find((o) => o.value === machine.status);

  const memberName = (id: string) => members.find((m) => m.id === id)?.name ?? id;
  const shiftName = (s: string | { _id: string; name: string }) =>
    typeof s === 'string' ? (shifts.find((sh) => sh.id === s)?.name ?? '-') : (s?.name ?? '-');

  return (
    <>
      {ctx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <DsPageHeader
          title={machine.name}
          sub={`${machine.machineCode ?? 'No code'} · ${locationName}${machine.floorTag ? ` · ${machine.floorTag}` : ''}`}
          icon={<ToolOutlined />}
          right={
            <>
              <DsTag status={machine.status} label={statusOpt?.label ?? machine.status} />
              {canEdit && !editing && (
                <DsButton
                  dsVariant="ghost"
                  icon={<EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </DsButton>
              )}
              {canEdit && machine.status !== 'retired' && (
                <Dropdown
                  trigger={['click']}
                  menu={{
                    items: [
                      {
                        key: 'retire',
                        danger: true,
                        icon: <StopOutlined />,
                        label: (
                          <Popconfirm
                            title="Retire this machine?"
                            description="It will no longer appear on active lists."
                            onConfirm={onDelete}
                            okButtonProps={{ danger: true }}
                          >
                            <span style={{ display: 'inline-block', width: '100%' }}>
                              Retire machine
                            </span>
                          </Popconfirm>
                        ),
                      },
                    ],
                  }}
                >
                  <DsButton dsVariant="ghost" icon={<MoreOutlined />} aria-label="More actions" />
                </Dropdown>
              )}
            </>
          }
        />

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'overview',
              label: 'Overview',
              forceRender: true,
              children: (
                <DsCard>
                  <Form form={editForm} layout="vertical" onFinish={onSaveEdit}>
                    {editing ? (
                      <>
                        {/* Primary fields - always visible */}
                        <Row gutter={16}>
                          <Col xs={24} md={12}>
                            <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                              <Input size="large" />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item
                              name="locationId"
                              label="Location"
                              rules={[{ required: true }]}
                            >
                              {/* Radio group from the Locations master list — same
                                  picker style as the employee form. */}
                              <Radio.Group className="flex flex-col gap-2">
                                {locations.map((l) => (
                                  <Radio key={l._id ?? l.id} value={l._id ?? l.id}>
                                    {l.name}
                                  </Radio>
                                ))}
                              </Radio.Group>
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item name="status" label="Status" rules={[{ required: true }]}>
                              <Select size="large" options={STATUS_OPTIONS} />
                            </Form.Item>
                          </Col>
                          <Col xs={24} md={12}>
                            <Form.Item name="floorTag" label="Floor tag">
                              <Input size="large" />
                            </Form.Item>
                          </Col>
                        </Row>

                        {/* Advanced - collapsed by default */}
                        <Collapse
                          ghost
                          expandIcon={({ isActive }) => (
                            <DownOutlined rotate={isActive ? 180 : 0} />
                          )}
                          items={[
                            {
                              key: 'advanced',
                              label: (
                                <span className="text-sm font-medium">
                                  Advanced details (type, attributes, manufacturer, notes)
                                </span>
                              ),
                              children: (
                                <Row gutter={16}>
                                  <Col xs={24} md={8}>
                                    <Form.Item name="type" label="Type">
                                      <Select
                                        size="large"
                                        options={[
                                          {
                                            value: 'embroidery',
                                            label: 'Embroidery',
                                          },
                                          {
                                            value: 'cutting',
                                            label: 'Cutting',
                                          },
                                          {
                                            value: 'printing',
                                            label: 'Printing',
                                          },
                                          { value: 'other', label: 'Other' },
                                        ]}
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <Form.Item name="manufacturer" label="Manufacturer">
                                      <Input size="large" />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={8}>
                                    <Form.Item name="model" label="Model">
                                      <Input size="large" />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={6}>
                                    <Form.Item name={['attributes', 'needles']} label="Needles">
                                      <InputNumber
                                        min={1}
                                        max={99}
                                        className="w-full"
                                        size="large"
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={6}>
                                    <Form.Item name={['attributes', 'heads']} label="Heads">
                                      <InputNumber
                                        min={1}
                                        max={99}
                                        className="w-full"
                                        size="large"
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={6}>
                                    <Form.Item
                                      name={['attributes', 'hoopSizeMm']}
                                      label="Hoop size (mm)"
                                    >
                                      <InputNumber
                                        min={50}
                                        max={2000}
                                        className="w-full"
                                        size="large"
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={6}>
                                    <Form.Item name={['attributes', 'maxRpm']} label="Max RPM">
                                      <InputNumber
                                        min={100}
                                        max={5000}
                                        className="w-full"
                                        size="large"
                                      />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={12}>
                                    <Form.Item name="serialNumber" label="Serial number">
                                      <Input size="large" />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24} md={12}>
                                    <Form.Item name="installedOn" label="Installed on">
                                      <DatePicker className="w-full" size="large" />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24}>
                                    <Form.Item name="notes" label="Notes">
                                      <Input.TextArea rows={2} />
                                    </Form.Item>
                                  </Col>
                                  <Col xs={24}>
                                    <MachineMaintenanceFields />
                                  </Col>
                                </Row>
                              ),
                            },
                          ]}
                        />

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            gap: 8,
                            marginTop: 16,
                            paddingTop: 16,
                            borderTop: '1px solid var(--cr-border)',
                          }}
                        >
                          <DsButton dsVariant="ghost" onClick={() => setEditing(false)}>
                            Cancel
                          </DsButton>
                          <DsButton
                            dsVariant="primary"
                            htmlType="submit"
                            icon={<SaveOutlined />}
                            loading={saving}
                          >
                            Save
                          </DsButton>
                        </div>
                      </>
                    ) : (
                      (() => {
                        const rows: { label: string; value: React.ReactNode; span?: number }[] = [];
                        const push = (label: string, v: unknown, span?: number) => {
                          if (v === null || v === undefined || v === '') return;
                          rows.push({ label, value: v as React.ReactNode, span });
                        };
                        push('Code', machine.machineCode);
                        push(
                          'Type',
                          machine.type
                            ? machine.type.charAt(0).toUpperCase() + machine.type.slice(1)
                            : null,
                        );
                        push('Location', locationName !== '-' ? locationName : null);
                        push('Floor', machine.floorTag);
                        push('Manufacturer', machine.manufacturer);
                        push('Model', machine.model);
                        push('Serial', machine.serialNumber);
                        push(
                          'Installed',
                          machine.installedOn
                            ? dayjs(machine.installedOn).format('DD MMM YYYY')
                            : null,
                        );
                        push('Needles', machine.attributes?.needles);
                        push('Heads', machine.attributes?.heads);
                        push('Hoop size (mm)', machine.attributes?.hoopSizeMm);
                        push('Max RPM', machine.attributes?.maxRpm);
                        if (machine.notes) push('Notes', machine.notes, 2);

                        if (rows.length === 0) {
                          return (
                            <div
                              style={{
                                padding: '32px 16px',
                                textAlign: 'center',
                                color: 'var(--cr-text-3)',
                                fontSize: 13,
                              }}
                            >
                              No details yet. Hit <strong>Edit</strong> to add specs.
                            </div>
                          );
                        }

                        return (
                          <Descriptions
                            column={{ xs: 1, sm: 2, lg: 3 }}
                            bordered
                            size="small"
                            styles={{
                              label: {
                                width: 140,
                                color: 'var(--cr-text-3)',
                                fontWeight: 600,
                                background: 'var(--cr-surface-subtle, var(--cr-neutral-100))',
                              },
                              content: { color: 'var(--cr-text)' },
                            }}
                          >
                            {rows.map((r) => (
                              <Descriptions.Item key={r.label} label={r.label} span={r.span}>
                                {r.value}
                              </Descriptions.Item>
                            ))}
                          </Descriptions>
                        );
                      })()
                    )}
                  </Form>
                </DsCard>
              ),
            },
            {
              key: 'assignments',
              forceRender: true,
              label: (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <UserOutlined style={{ fontSize: 14 }} />
                  Assigned workers
                  <DsTag style={{ marginInlineEnd: 0, fontSize: 11 }}>{assignments.length}</DsTag>
                </span>
              ),
              children: (() => {
                // Active, non-offboarded members only.
                const activeMembers = members.filter((m) => m.isActive && !m.isDeleted);
                // Strict filter rules:
                //   shift selected → only shift-type members whose default shift matches.
                //                    Custom-schedule members are excluded (their own hours govern).
                //                    Members with a different default shift are excluded.
                //   no shift      → all active members (any schedule type).
                //   Show all     → bypass filter (override for edge cases).
                const filteredMembers =
                  showAllMembers || !selectedShiftId
                    ? activeMembers
                    : activeMembers.filter(
                        (m) => m.scheduleType === 'shift' && m.shift?.id === selectedShiftId,
                      );

                const isRetired = machine.status === 'retired';

                // Resolve the selected worker's effective daily hours for
                // the no-shift flow. Priority: their customSchedule → their
                // default shift's times → nothing (admin must supply).
                const selectedMember = selectedMemberId
                  ? activeMembers.find((m) => m.id === selectedMemberId)
                  : null;
                const memberHours = selectedMember
                  ? selectedMember.scheduleType === 'custom' &&
                    selectedMember.customSchedule?.startTime &&
                    selectedMember.customSchedule?.endTime
                    ? {
                        startTime: selectedMember.customSchedule.startTime,
                        endTime: selectedMember.customSchedule.endTime,
                        source: 'custom schedule' as const,
                      }
                    : selectedMember.scheduleType === 'shift' &&
                        selectedMember.shift?.startTime &&
                        selectedMember.shift?.endTime
                      ? {
                          startTime: selectedMember.shift.startTime,
                          endTime: selectedMember.shift.endTime,
                          source: `default shift (${selectedMember.shift.name})` as const,
                        }
                      : null
                  : null;

                const isOvernight = memberHours && memberHours.startTime >= memberHours.endTime;

                const needsManualHours = !selectedShiftId && selectedMember && !memberHours;

                return (
                  <DsCard>
                    {isRetired && (
                      <Alert
                        type="warning"
                        showIcon
                        title="This machine is retired."
                        description="New worker assignments cannot be created. Reactivate the machine (Edit → Status) to assign operators."
                        className="mb-4"
                      />
                    )}

                    {!isRetired && shiftsError && (
                      <Alert
                        type="warning"
                        showIcon
                        title="Couldn't load shifts"
                        description={
                          <div>
                            <div className="mb-1">{shiftsError}</div>
                            <div className="text-xs text-secondary">
                              Common causes: your plan doesn&apos;t include the Shifts module, or
                              your RBAC role is missing Shifts view permission. You can still assign
                              without a shift.
                            </div>
                          </div>
                        }
                        className="mb-4"
                      />
                    )}

                    {!isRetired && canAssign && activeMembers.length === 0 && (
                      <Alert
                        type="info"
                        showIcon
                        title="No active team members."
                        description="Add a team member (or restore an offboarded one) before assigning operators."
                        className="mb-4"
                      />
                    )}

                    {!isRetired && canAssign && activeMembers.length > 0 && (
                      <div className="mb-4">
                        <Form
                          form={assignForm}
                          layout="inline"
                          onFinish={onCreateAssignment}
                          onValuesChange={(changed) => {
                            if ('shiftId' in changed) {
                              setSelectedShiftId(changed.shiftId ?? null);
                              // Clear manual hours when a shift is picked -
                              // shift owns hours.
                              if (changed.shiftId) {
                                assignForm.setFieldsValue({
                                  startTime: null,
                                  endTime: null,
                                });
                              }
                            }
                            if ('teamMemberId' in changed) {
                              setSelectedMemberId(changed.teamMemberId ?? null);
                              // Clear stale manual hours when worker changes.
                              // Hours will either be inferred from the
                              // worker's schedule (banner) or re-entered.
                              assignForm.setFieldsValue({
                                startTime: null,
                                endTime: null,
                              });
                            }
                          }}
                          className="flex-wrap gap-y-2"
                        >
                          <Form.Item
                            name="shiftId"
                            tooltip="Pick a shift if you run multiple shifts; leave empty for single-shift shops."
                          >
                            <Select
                              placeholder={
                                shiftsError
                                  ? 'Shifts unavailable - leave empty'
                                  : shifts.length === 0
                                    ? 'No shifts - leave empty'
                                    : 'Shift (optional)'
                              }
                              allowClear
                              style={{ minWidth: 180 }}
                              options={shifts.map((s) => ({
                                value: s.id,
                                label: s.name,
                              }))}
                              notFoundContent={
                                shiftsError
                                  ? 'Shifts unavailable - leave empty to assign without a shift'
                                  : 'No shifts configured - leave empty'
                              }
                            />
                          </Form.Item>
                          <Form.Item
                            name="teamMemberId"
                            rules={[{ required: true, message: 'Pick worker' }]}
                          >
                            <Select
                              showSearch
                              allowClear
                              placeholder={
                                filteredMembers.length === 0
                                  ? 'No workers match this shift'
                                  : 'Worker'
                              }
                              style={{ minWidth: 220 }}
                              optionFilterProp="label"
                              options={filteredMembers.map((m) => ({
                                value: m.id,
                                label: `${m.name}${m.employeeCode ? ` (${m.employeeCode})` : ''}`,
                              }))}
                              notFoundContent={
                                selectedShiftId && !showAllMembers ? (
                                  <div className="p-2 text-center">
                                    <div className="mb-2 text-xs text-secondary">
                                      No members match this shift.
                                    </div>
                                    <Button size="small" onClick={() => setShowAllMembers(true)}>
                                      Show all workers
                                    </Button>
                                  </div>
                                ) : (
                                  'No workers'
                                )
                              }
                            />
                          </Form.Item>
                          {needsManualHours && (
                            <Form.Item
                              name="startTime"
                              tooltip="Required for this worker - they have no default schedule."
                              rules={[
                                {
                                  required: true,
                                  message: 'Pick start time',
                                },
                              ]}
                            >
                              <TimePicker format="HH:mm" minuteStep={5} placeholder="From" />
                            </Form.Item>
                          )}
                          {needsManualHours && (
                            <Form.Item
                              name="endTime"
                              rules={[
                                {
                                  required: true,
                                  message: 'Pick end time',
                                },
                              ]}
                            >
                              <TimePicker format="HH:mm" minuteStep={5} placeholder="To" />
                            </Form.Item>
                          )}
                          <Form.Item>
                            <DsButton
                              dsVariant="primary"
                              htmlType="submit"
                              icon={<PlusOutlined />}
                              loading={assignSaving}
                            >
                              Assign
                            </DsButton>
                          </Form.Item>
                        </Form>

                        {!selectedShiftId && selectedMember && memberHours && (
                          <Alert
                            type="info"
                            showIcon
                            className="mt-2"
                            title={
                              <>
                                <strong>{selectedMember.name}</strong>&apos;s hours:{' '}
                                <strong>
                                  {memberHours.startTime}-{memberHours.endTime}
                                </strong>{' '}
                                ({memberHours.source})
                                {isOvernight && (
                                  <Tag color="volcano" className="ml-2" style={{ fontSize: 10 }}>
                                    Overnight - spans 2 days
                                  </Tag>
                                )}
                                .
                              </>
                            }
                            description={`The machine will be occupied during these hours every day this assignment is active.${
                              isOvernight
                                ? ' Because the shift crosses midnight, each calendar day covers the late-evening portion plus the early-morning portion of the next.'
                                : ''
                            }`}
                          />
                        )}

                        {needsManualHours && (
                          <Alert
                            type="warning"
                            showIcon
                            className="mt-2"
                            title={`${selectedMember?.name ?? 'This worker'} has no default working hours.`}
                            description="Please specify the hours this machine will be occupied (From / To above). For overnight shifts, set From later than To (e.g. 20:00 → 08:00)."
                          />
                        )}

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          {selectedShiftId && (
                            <Button
                              type="link"
                              size="small"
                              className="px-0"
                              onClick={() => setShowAllMembers((v) => !v)}
                            >
                              {showAllMembers
                                ? 'Filter by shift'
                                : 'Show all workers (ignore shift filter)'}
                            </Button>
                          )}
                        </div>

                        <details className="mt-3 text-xs text-secondary">
                          <summary className="cursor-pointer select-none">
                            How assignments work
                          </summary>
                          <ul className="mt-2 ml-4 list-disc space-y-1">
                            <li>
                              Pick a <strong>shift</strong> to tie this assignment to that
                              shift&apos;s hours (e.g. Day 8AM-8PM, Night 8PM-4AM). Leave empty for
                              single-shift shops.
                            </li>
                            <li>
                              When a shift is selected, only workers whose default shift matches are
                              shown. Workers with custom daily schedules are excluded from
                              shift-based assignments.
                            </li>
                            <li>
                              Assign different workers on the same machine for different shifts -
                              the machine can have a day-shift operator and a night-shift operator
                              simultaneously.
                            </li>
                            <li>
                              Overnight shifts (e.g. 8PM -&gt; 4AM next day) are handled by the
                              shift definition itself; no extra setup here.
                            </li>
                            <li>
                              Use &quot;Show all workers&quot; to override filtering when an admin
                              wants to temporarily cover a shift with a non-shift worker.
                            </li>
                            <li>
                              Without a shift, two workers <em>can</em> share the same machine on
                              overlapping dates if their custom daily hours don&apos;t overlap (e.g.
                              Worker A 9AM-6PM + Worker B 6PM-2AM). Workers without any daily hours
                              are treated as full-day and cannot coexist on a machine.
                            </li>
                            <li>
                              Assignments start today and are open-ended by default. To stop an
                              assignment on a specific date (leaver, temp cover, handover), use
                              <strong> End</strong> on the row -<strong> Delete</strong> removes the
                              record entirely without keeping history.
                            </li>
                          </ul>
                        </details>
                      </div>
                    )}

                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold">
                        {
                          assignments.filter((a) => {
                            if (!a.effectiveTo) return true;
                            return dayjs(a.effectiveTo).isAfter(dayjs());
                          }).length
                        }{' '}
                        active
                      </span>
                      <Button
                        type="link"
                        size="small"
                        className="px-0"
                        onClick={() => setShowEnded((v) => !v)}
                      >
                        {showEnded ? 'Hide ended history' : 'Show ended history'}
                      </Button>
                    </div>
                    <Table
                      rowKey={(r) => (r.id ?? r._id)!}
                      dataSource={[...assignments]
                        .filter((a) => {
                          if (showEnded) return true;
                          if (!a.effectiveTo) return true;
                          return dayjs(a.effectiveTo).isAfter(dayjs());
                        })
                        .sort((a, b) => {
                          // Sort by shift name (empty shift last), then by
                          // effectiveFrom descending (newest first).
                          const aShift = shiftName(a.shiftId) || '~';
                          const bShift = shiftName(b.shiftId) || '~';
                          const byShift = aShift.localeCompare(bShift, undefined, {
                            numeric: true,
                          });
                          if (byShift !== 0) return byShift;
                          return (
                            new Date(b.effectiveFrom).getTime() -
                            new Date(a.effectiveFrom).getTime()
                          );
                        })}
                      pagination={false}
                      columns={
                        [
                          {
                            title: 'Worker',
                            dataIndex: 'teamMemberId',
                            render: (v: any) => {
                              const id = typeof v === 'string' ? v : v?._id;
                              const member = members.find((m) => m.id === id);
                              const name =
                                member?.name ??
                                (typeof v === 'string' ? memberName(v) : (v?.name ?? '-'));
                              const resigns = member?.dateOfResignation;
                              return (
                                <div className="flex flex-col">
                                  <span>{name}</span>
                                  {resigns && (
                                    <Tooltip
                                      title={`Worker is offboarding. You should end this assignment on or before their last working day to avoid orphan records.`}
                                    >
                                      <Tag
                                        color="orange"
                                        style={{
                                          fontSize: 10,
                                          marginTop: 2,
                                          alignSelf: 'flex-start',
                                        }}
                                      >
                                        Resigns {dayjs(resigns).format('DD MMM YYYY')}
                                      </Tag>
                                    </Tooltip>
                                  )}
                                </div>
                              );
                            },
                          },
                          {
                            title: 'When',
                            key: 'when',
                            render: (_: unknown, row: MachineShiftAssignment) => {
                              if (row.shiftId) {
                                const s = shiftName(row.shiftId);
                                return s !== '-' ? <Tag color="blue">{s}</Tag> : '-';
                              }
                              // No shift - priority: assignment's own hours,
                              // then worker's custom schedule, then full-day.
                              if (row.startTime && row.endTime) {
                                return (
                                  <Tag color="cyan">
                                    {row.startTime}-{row.endTime}
                                  </Tag>
                                );
                              }
                              const memberId =
                                typeof row.teamMemberId === 'string'
                                  ? row.teamMemberId
                                  : (row.teamMemberId as any)?._id;
                              const member = members.find((m) => m.id === memberId);
                              if (
                                member?.scheduleType === 'custom' &&
                                member.customSchedule?.startTime &&
                                member.customSchedule?.endTime
                              ) {
                                return (
                                  <Tag color="purple">
                                    {member.customSchedule.startTime}-
                                    {member.customSchedule.endTime}
                                  </Tag>
                                );
                              }
                              return <Tag>Full-day</Tag>;
                            },
                          },
                          {
                            title: 'From',
                            dataIndex: 'effectiveFrom',
                            render: (v: string) => (v ? dayjs(v).format('DD MMM YYYY') : '-'),
                          },
                          {
                            title: 'To',
                            dataIndex: 'effectiveTo',
                            render: (v: string | undefined) =>
                              v ? dayjs(v).format('DD MMM YYYY') : 'Ongoing',
                          },
                          {
                            title: 'Primary',
                            dataIndex: 'isPrimary',
                            render: (v: boolean) => (v ? <Tag color="green">Primary</Tag> : '-'),
                          },
                          {
                            title: 'Status',
                            key: 'endStatus',
                            width: 180,
                            render: (_: unknown, row: MachineShiftAssignment) => {
                              if (!row.effectiveTo) return <Tag color="green">Active</Tag>;
                              const isPast = dayjs(row.effectiveTo).isBefore(dayjs());
                              return isPast ? (
                                <Tag color="red">
                                  Ended {dayjs(row.effectiveTo).format('DD MMM YYYY')}
                                </Tag>
                              ) : (
                                <Tag color="orange">
                                  Ends {dayjs(row.effectiveTo).format('DD MMM YYYY')}
                                </Tag>
                              );
                            },
                          },
                          canAssign
                            ? {
                                title: <span className="sr-only">Actions</span>,
                                key: 'actions',
                                width: 140,
                                render: (_: unknown, row: MachineShiftAssignment) => {
                                  const rowId = (row.id ?? row._id) as string;
                                  const isEnded =
                                    row.effectiveTo && dayjs(row.effectiveTo).isBefore(dayjs());
                                  return (
                                    <div
                                      style={{
                                        display: 'flex',
                                        gap: 6,
                                        justifyContent: 'flex-end',
                                      }}
                                    >
                                      {!isEnded && (
                                        <Tooltip title="End this assignment - immediately with today's date, or on a specific future date.">
                                          <DsButton
                                            dsVariant="ghost"
                                            dsSize="sm"
                                            onClick={() => {
                                              setEndingRowId(rowId);
                                              setEndDate(dayjs());
                                            }}
                                          >
                                            End
                                          </DsButton>
                                        </Tooltip>
                                      )}
                                      <Tooltip title="Permanently remove this assignment record. Use End instead if you want to keep it in history.">
                                        <Popconfirm
                                          title="Delete this assignment?"
                                          description="Removes the record entirely. Use 'End' if you want history preserved."
                                          onConfirm={() => onDeleteAssignment(rowId)}
                                          okButtonProps={{ danger: true }}
                                        >
                                          <DsButton
                                            dsVariant="ghost"
                                            dsSize="sm"
                                            icon={<DeleteOutlined />}
                                            aria-label="Delete assignment"
                                            style={{ color: 'var(--cr-error)' }}
                                          />
                                        </Popconfirm>
                                      </Tooltip>
                                    </div>
                                  );
                                },
                              }
                            : null,
                        ].filter(Boolean) as any
                      }
                      locale={{ emptyText: 'No assignments yet' }}
                    />
                  </DsCard>
                );
              })(),
            },
            {
              key: 'production-logs',
              label: tProd('tab.title'),
              children: <ProductionLogsTab machine={machine} />,
            },
            {
              key: 'downtime-logs',
              label: tDowntime('tab.title'),
              children: <DowntimeLogsTab machine={machine} />,
            },
            {
              key: 'maintenance-logs',
              label: tMaint('tabTitle'),
              children: (
                <MaintenanceLogsTab
                  wsId={machine.workspaceId}
                  machineId={(machine._id ?? machine.id) as string}
                />
              ),
            },
          ]}
        />
      </div>

      <Modal
        open={!!endingRowId}
        title="End assignment"
        onCancel={() => setEndingRowId(null)}
        destroyOnHidden
        footer={[
          <DsButton key="cancel" dsVariant="ghost" onClick={() => setEndingRowId(null)}>
            Cancel
          </DsButton>,
          <DsButton
            key="immediate"
            dsVariant="danger"
            onClick={() => endingRowId && onEndAssignment(endingRowId, dayjs(), true)}
          >
            End immediately
          </DsButton>,
          <DsButton
            key="scheduled"
            dsVariant="primary"
            disabled={!endDate || endDate.isSame(dayjs(), 'day')}
            onClick={() => endingRowId && onEndAssignment(endingRowId, endDate ?? dayjs())}
          >
            End on{' '}
            {endDate && !endDate.isSame(dayjs(), 'day')
              ? endDate.format('DD MMM YYYY')
              : 'chosen date'}
          </DsButton>,
        ]}
      >
        <div className="space-y-3">
          <div className="text-sm text-secondary">
            This stops the worker&apos;s assignment on this machine. The record is kept for audit /
            history - use <strong>Delete</strong> if you want to remove it entirely.
          </div>
          <div>
            <div className="mb-1 text-xs font-medium">Pick a future end date (optional)</div>
            <DatePicker
              value={endDate}
              onChange={(d) => setEndDate(d)}
              disabledDate={(d) => d && d.isBefore(dayjs().startOf('day'))}
              allowClear={false}
              style={{ width: '100%' }}
            />
            <div className="mt-1 text-xs text-secondary">
              Today is the default. Pick a later date for scheduled handovers, or just hit{' '}
              <strong>End immediately</strong>.
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
