'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Button,
  Empty,
  Form,
  Input,
  Table,
  Tag,
  Popconfirm,
  message,
  Skeleton,
  Switch,
  Row,
  Col,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HomeOutlined } from '@ant-design/icons';
import { useWorkspaceStore, useSubscriptionStore } from '@/lib/store';
import { listLocations, createLocation, updateLocation, deleteLocation } from '@/lib/actions';
import type { Location as OperationalLocation, CreateLocationPayload } from '@/types';
import { parseApiError } from '@/lib/utils';
import { DsDrawer } from '@/components/ui';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';
import { useMyPermissions } from '@/hooks/useMyPermissions';

/**
 * Locations — restored standalone (2026-07-04, owner directive) after the
 * Machines module was removed. Operational sites tied to the workforce (used
 * by Team's "Work location" field), managed here under Workspace Settings
 * instead of under a Machines menu. Not the same as the workspace's registered
 * business address.
 */
export default function LocationsSettingsPage() {
  const { currentWorkspaceId } = useWorkspaceStore();
  const { entitlements, isHydrated } = useSubscriptionStore();
  const { loading: permissionsLoading, can: canPermission } = useMyPermissions();
  const [locations, setLocations] = useState<OperationalLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<OperationalLocation | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();

  const locationsAccess = entitlements?.moduleAccess?.find((m) => m.module === 'locations');
  const hasAccess = locationsAccess?.enabled ?? false;
  const canManage =
    hasAccess &&
    locationsAccess?.subFeatures?.find((sf) => sf.key === 'location_manage')?.access !== 'locked';

  const load = useCallback(async () => {
    if (!currentWorkspaceId || !hasAccess) return;
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await listLocations(currentWorkspaceId);
      startTransition(() => {
        setLocations(res);
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

  if (!isHydrated) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!hasAccess) return <ModuleLockedPage module="locations" />;
  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!canPermission('locations', 'view')) {
    return (
      <Card>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="You do not have permission to view locations. Contact your workspace owner to request access."
        />
      </Card>
    );
  }

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, country: 'India' });
    setDrawerOpen(true);
  };

  const openEdit = (loc: OperationalLocation) => {
    setEditing(loc);
    form.setFieldsValue({
      name: loc.name,
      locationCode: loc.locationCode,
      addressLine1: loc.addressLine1,
      addressLine2: loc.addressLine2,
      city: loc.city,
      state: loc.state,
      country: loc.country ?? 'India',
      pincode: loc.pincode,
      timezone: loc.timezone,
      notes: loc.notes,
      isActive: loc.isActive,
    });
    setDrawerOpen(true);
  };

  const onSave = async (vals: CreateLocationPayload) => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    try {
      if (editing) {
        await updateLocation(currentWorkspaceId, editing.id ?? editing._id!, vals);
        msgApi.success('Location updated');
      } else {
        await createLocation(currentWorkspaceId, vals);
        msgApi.success('Location added');
      }
      setDrawerOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (loc: OperationalLocation) => {
    if (!currentWorkspaceId) return;
    try {
      await deleteLocation(currentWorkspaceId, loc.id ?? loc._id!);
      msgApi.success('Location removed');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  return (
    <>
      {ctx}
      <div className="max-w-5xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="m-0 flex items-center gap-2 font-display text-2xl font-bold">
              <HomeOutlined /> Locations
            </h1>
            <p className="m-0 mt-1 text-sm text-secondary">
              Physical work sites your staff are assigned to. <strong>Not the same</strong> as your
              registered business address - that stays in Workspace settings and is used on payslips
              and statutory forms.
            </p>
          </div>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} className="shrink-0">
              Add Location
            </Button>
          )}
        </div>

        <Card>
          <Table
            rowKey={(r) => r.id ?? r._id!}
            loading={loading}
            dataSource={locations}
            pagination={false}
            columns={
              [
                { title: 'Name', dataIndex: 'name' },
                {
                  title: 'Code',
                  dataIndex: 'locationCode',
                  render: (v: string | undefined) => v ?? '-',
                },
                {
                  title: 'Address',
                  key: 'address',
                  render: (_: unknown, row: OperationalLocation) =>
                    [row.addressLine1, row.city, row.state].filter(Boolean).join(', ') || '-',
                },
                {
                  title: 'Status',
                  dataIndex: 'isActive',
                  width: 90,
                  render: (v: boolean) => (v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>),
                },
                canManage
                  ? {
                      title: <span className="sr-only">Actions</span>,
                      key: 'actions',
                      width: 120,
                      render: (_: unknown, row: OperationalLocation) => (
                        <div className="flex justify-end gap-2">
                          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
                          <Popconfirm
                            title="Remove this location?"
                            description="Team members assigned to it will keep their record, but the location link will be cleared."
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
            locale={{ emptyText: 'No locations yet. Add your first.' }}
          />
        </Card>
      </div>

      <DsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? 'Edit Location' : 'Add Location'}
        okText={editing ? 'Save Changes' : 'Add Location'}
        okLoading={saving}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onSave} requiredMark={false}>
          <Row gutter={12}>
            <Col span={16}>
              <Form.Item name="name" label="Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Main Plant, Floor 2" size="large" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="locationCode" label="Code (optional)">
                <Input placeholder="LOC-001" size="large" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="addressLine1" label="Address line 1">
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="addressLine2" label="Address line 2">
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="city" label="City">
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="state" label="State">
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="country" label="Country">
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="pincode" label="Pincode">
                <Input size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="timezone" label="Timezone">
                <Input placeholder="Asia/Kolkata" size="large" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </DsDrawer>
    </>
  );
}
