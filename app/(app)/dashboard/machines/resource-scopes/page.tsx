'use client';

import { useEffect, useState, useCallback, useMemo, startTransition } from 'react';
import {
  Card,
  Button,
  Empty,
  Form,
  Select,
  Table,
  Tag,
  Popconfirm,
  message,
  Skeleton,
  Switch,
  Row,
  Col,
  Alert,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined } from '@ant-design/icons';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import {
  listResourceScopes,
  createResourceScope,
  updateResourceScope,
  deleteResourceScope,
  listMachines,
  listLocations,
  getWorkspaceMembers,
} from '@/lib/actions';
import type {
  ResourceScope,
  Machine,
  Location as OperationalLocation,
  UpsertResourceScopePayload,
} from '@/types';
import { parseApiError } from '@/lib/utils';
import { DsDrawer } from '@/components/ui';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { useMyPermissions } from '@/hooks/useMyPermissions';

export default function ResourceScopesPage() {
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();
  const { loading: permissionsLoading, can: canPermission } = useMyPermissions();
  const [scopes, setScopes] = useState<ResourceScope[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [locations, setLocations] = useState<OperationalLocation[]>([]);
  const [wsMembers, setWsMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ResourceScope | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();

  const rsAccess = entitlements?.moduleAccess?.find((m) => m.module === 'resource_scopes');
  const hasAccess = rsAccess?.enabled ?? false;
  const canManage =
    hasAccess &&
    rsAccess?.subFeatures?.find((sf) => sf.key === 'resource_scope_manage')?.access !== 'locked';

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !hasAccess) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [s, m, l, w] = await Promise.all([
        listResourceScopes(currentWorkspaceId),
        listMachines(currentWorkspaceId).catch(() => []),
        listLocations(currentWorkspaceId).catch(() => []),
        getWorkspaceMembers(currentWorkspaceId).catch(() => []),
      ]);
      startTransition(() => {
        setScopes(s);
        setMachines(m);
        setLocations(l);
        setWsMembers(Array.isArray(w) ? w : []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId, hasAccess, msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const memberOptions = useMemo(
    () =>
      wsMembers
        .map((m: any) => ({
          value: typeof m.userId === 'string' ? m.userId : (m.userId?._id ?? m._id),
          label: m.user?.name ?? m.userId?.name ?? m.name ?? m.email ?? m.userId?.email ?? 'User',
        }))
        .filter((o) => o.value),
    [wsMembers],
  );

  if (!isHydrated) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!hasAccess) return <ModuleLockedPage module="resource_scopes" />;
  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!canPermission('machines', 'view')) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="You do not have permission to view resource scopes. Contact your workspace owner to request access."
        />
      </Card>
    );
  }

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, machineIds: [], locationIds: [] });
    setDrawerOpen(true);
  };

  const openEdit = (sc: ResourceScope) => {
    setEditing(sc);
    const uid = typeof sc.userId === 'string' ? sc.userId : sc.userId._id;
    form.setFieldsValue({
      userId: uid,
      machineIds: sc.machineIds ?? [],
      locationIds: sc.locationIds ?? [],
      isActive: sc.isActive,
    });
    setDrawerOpen(true);
  };

  const onSave = async (vals: UpsertResourceScopePayload) => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateResourceScope(currentWorkspaceId, editing.id ?? editing._id!, {
          machineIds: vals.machineIds,
          locationIds: vals.locationIds,
          isActive: vals.isActive,
        });
        msgApi.success('Scope updated');
      } else {
        await createResourceScope(currentWorkspaceId, vals);
        msgApi.success('Scope created');
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (sc: ResourceScope) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteResourceScope(currentWorkspaceId, sc.id ?? sc._id!);
      msgApi.success('Scope removed');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const userName = (sc: ResourceScope): string => {
    if (typeof sc.userId === 'object' && sc.userId) {
      return sc.userId.name ?? sc.userId.email ?? sc.userId._id;
    }
    const match = memberOptions.find((o) => o.value === sc.userId);
    return match?.label ?? (sc.userId as string);
  };

  return (
    <>
      {ctx}
      <div className="max-w-5xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="m-0 flex items-center gap-2 font-display text-2xl font-bold">
              <SafetyOutlined /> Resource Scopes
            </h1>
            <p className="m-0 mt-1 text-sm text-secondary">
              Limit which machines and locations a user can see and mutate. Layered on top of their
              RBAC role - the role still controls
              <em> what actions</em> they can do; the scope controls
              <em> which rows</em> they act on. Users without a scope see everything their role
              allows.
            </p>
          </div>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} className="shrink-0">
              New Scope
            </Button>
          )}
        </div>

        {machines.length === 0 && locations.length === 0 && (
          <Alert
            showIcon
            type="info"
            title="Add at least one machine or location before creating scopes."
          />
        )}

        <Card>
          <Table
            rowKey={(r) => r.id ?? r._id!}
            loading={loading}
            dataSource={scopes}
            pagination={false}
            columns={
              [
                {
                  title: 'User',
                  key: 'user',
                  render: (_: unknown, row: ResourceScope) => (
                    <span className="font-semibold">{userName(row)}</span>
                  ),
                },
                {
                  title: 'Machines',
                  dataIndex: 'machineIds',
                  render: (ids: string[]) => (ids?.length ? ids.length : 'All'),
                },
                {
                  title: 'Locations',
                  dataIndex: 'locationIds',
                  render: (ids: string[]) => (ids?.length ? ids.length : 'All'),
                },
                {
                  title: 'Status',
                  dataIndex: 'isActive',
                  width: 100,
                  render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag>Paused</Tag>),
                },
                canManage
                  ? {
                      title: <span className="sr-only">Actions</span>,
                      key: 'actions',
                      width: 120,
                      render: (_: unknown, row: ResourceScope) => (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => openEdit(row)}
                          />
                          <Popconfirm
                            title="Delete this scope?"
                            description="The user will revert to full visibility per their RBAC role."
                            okButtonProps={{ danger: true }}
                            onConfirm={() => onDelete(row)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />} />
                          </Popconfirm>
                        </div>
                      ),
                    }
                  : null,
              ].filter(Boolean) as any
            }
            locale={{ emptyText: 'No scopes yet.' }}
          />
        </Card>
      </div>

      <DsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Scope' : 'New Scope'}
        okText={editing ? 'Save Changes' : 'Create Scope'}
        okLoading={saving}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onSave} requiredMark={false}>
          <Row gutter={12}>
            <Col span={24}>
              <Form.Item
                name="userId"
                label="Workspace user"
                rules={[{ required: true }]}
                tooltip="The platform user whose visibility you want to scope."
              >
                <Select
                  showSearch
                  placeholder="Pick a user"
                  optionFilterProp="label"
                  size="large"
                  disabled={!!editing}
                  options={memberOptions}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="machineIds"
                label="Machines in scope"
                tooltip="Leave empty to allow all machines. Otherwise only these are visible and mutable."
              >
                <Select
                  mode="multiple"
                  placeholder="All machines (empty = unrestricted)"
                  optionFilterProp="label"
                  size="large"
                  options={machines.map((m) => ({
                    value: m.id ?? m._id,
                    label: `${m.name}${m.machineCode ? ` (${m.machineCode})` : ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                name="locationIds"
                label="Locations in scope"
                tooltip="Leave empty to allow all locations."
              >
                <Select
                  mode="multiple"
                  placeholder="All locations (empty = unrestricted)"
                  optionFilterProp="label"
                  size="large"
                  options={locations.map((l) => ({
                    value: l._id ?? l.id,
                    label: l.name,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </DsDrawer>
    </>
  );
}
