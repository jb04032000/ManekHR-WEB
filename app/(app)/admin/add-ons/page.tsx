'use client';
import { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Table,
  Tag,
  Row,
  Col,
  message,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, AppstoreOutlined } from '@ant-design/icons';
import {
  getAddOnDefinitions,
  createAddOnDefinition,
  updateAddOnDefinition,
  deleteAddOnDefinition,
} from '@/lib/actions';
import type { AddOnDefinition, AddOnType, AddOnBillingCycle } from '@/types';
import { parseApiError } from '@/lib/utils';

const { Option } = Select;

const ADD_ON_TYPE_LABELS: Record<AddOnType, string> = {
  quota: 'Quota (Extra Members/Workspaces)',
  module: 'Module (Unlock Feature)',
  subfeature: 'Sub-Feature (Upgrade Access)',
  credit_pack: 'Credit Pack (SMS / WhatsApp)',
};

export default function AdminAddOnsPage() {
  const [definitions, setDefinitions] = useState<AddOnDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AddOnDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();

  const loadDefinitions = useCallback(async () => {
    try {
      const res = await getAddOnDefinitions();
      startTransition(() => {
        setDefinitions(Array.isArray(res) ? res : []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  }, [msgApi]);

  useEffect(() => {
    loadDefinitions().finally(() =>
      startTransition(() => {
        setLoading(false);
      }),
    );
  }, [loadDefinitions]);

  const handleCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      monthlyPrice: 0,
      yearlyPrice: 0,
      type: 'quota',
      stackable: false,
      maxStack: -1,
    });
    setModalOpen(true);
  };

  const handleEdit = (record: AddOnDefinition) => {
    setEditing(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      slug: record.slug,
      type: record.type,
      monthlyPrice: record.monthlyPrice,
      yearlyPrice: record.yearlyPrice,
      isActive: record.isActive,
      displayOrder: record.displayOrder,
      extraWorkspaces: record.entitlementDelta?.extraWorkspaces,
      extraMembersPerWorkspace: record.entitlementDelta?.extraMembersPerWorkspace,
      extraTotalMembers: record.entitlementDelta?.extraTotalMembers,
      targetModule: record.entitlementDelta?.targetModule,
      stackable: record.stackable ?? false,
      maxStack: record.maxStack ?? -1,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAddOnDefinition(id);
      msgApi.success('Add-on deleted');
      loadDefinitions();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const entitlementDelta: any = {
        extraWorkspaces: 0,
        extraMembersPerWorkspace: 0,
        extraTotalMembers: 0,
        extraSessionsPerPlatform: 0,
        extraSessionsTotal: 0,
      };

      if (values.type === 'quota') {
        entitlementDelta.extraWorkspaces = values.extraWorkspaces || 0;
        entitlementDelta.extraMembersPerWorkspace = values.extraMembersPerWorkspace || 0;
        entitlementDelta.extraTotalMembers = values.extraTotalMembers || 0;
        entitlementDelta.extraSessionsPerPlatform = values.extraSessionsPerPlatform || 0;
        entitlementDelta.extraSessionsTotal = values.extraSessionsTotal || 0;
      } else if (values.type === 'module') {
        entitlementDelta.targetModule = values.targetModule;
      } else if (values.type === 'subfeature') {
        entitlementDelta.targetSubFeatureModule = values.targetSubFeatureModule;
        entitlementDelta.targetSubFeatureKey = values.targetSubFeatureKey;
        entitlementDelta.targetSubFeatureAccess = values.targetSubFeatureAccess;
      }

      const payload: Partial<AddOnDefinition> = {
        name: values.name,
        description: values.description,
        slug: values.slug,
        type: values.type,
        monthlyPrice: values.monthlyPrice || 0,
        yearlyPrice: values.yearlyPrice || 0,
        lifetimePrice: 0,
        isActive: values.isActive,
        displayOrder: values.displayOrder || 0,
        entitlementDelta,
        stackable: values.stackable ?? false,
        maxStack: values.maxStack ?? -1,
        applicableTiers: [],
        defaultBillingCycle: 'monthly' as AddOnBillingCycle,
        allowedBillingCycles: ['monthly'],
        allowProratedBilling: false,
        minDaysBeforeRenewal: 0,
      };

      if (editing) {
        await updateAddOnDefinition(editing._id, payload);
        msgApi.success('Add-on updated');
      } else {
        await createAddOnDefinition(payload);
        msgApi.success('Add-on created');
      }

      setModalOpen(false);
      loadDefinitions();
    } catch (e) {
      if (e instanceof Error) {
        msgApi.error(parseApiError(e));
      }
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: AddOnDefinition) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-xs text-muted">{record.slug}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: AddOnType) => <Tag color="blue">{ADD_ON_TYPE_LABELS[type]}</Tag>,
    },
    {
      title: 'What it gives',
      key: 'entitlement',
      render: (_: any, record: AddOnDefinition) => {
        const delta = record.entitlementDelta;
        if (record.type === 'quota') {
          const parts = [];
          if (delta?.extraWorkspaces) parts.push(`+${delta.extraWorkspaces} workspaces`);
          if (delta?.extraMembersPerWorkspace)
            parts.push(`+${delta.extraMembersPerWorkspace} members/workspace`);
          if (delta?.extraTotalMembers) parts.push(`+${delta.extraTotalMembers} total members`);
          return <span className="text-sm">{parts.join(', ') || 'No quota'}</span>;
        }
        if (record.type === 'module') {
          return <span className="text-sm">Unlock: {delta?.targetModule}</span>;
        }
        return <span className="text-sm">Upgrade: {delta?.targetSubFeatureKey}</span>;
      },
    },
    {
      title: 'Price',
      key: 'price',
      render: (_: any, record: AddOnDefinition) => (
        <div className="text-sm">
          <div>₹{record.monthlyPrice}/month</div>
          <div className="text-muted">₹{record.yearlyPrice}/year</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>{isActive ? 'Active' : 'Inactive'}</Tag>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, record: AddOnDefinition) => (
        <div className="flex gap-2">
          <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record._id)}
          />
        </div>
      ),
    },
  ];

  return (
    <>
      {ctx}
      <div className="mb-4">
        <h2 className="text-xl font-semibold">Add-Ons</h2>
        <p className="text-muted">Manage available add-ons for users with active subscriptions</p>
      </div>

      <Card>
        <div className="mb-4 flex justify-end">
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            Create Add-On
          </Button>
        </div>
        <Table
          columns={columns}
          dataSource={definitions}
          loading={loading}
          rowKey="_id"
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? 'Edit Add-On' : 'Create Add-On'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Extra 10 Team Members" />
          </Form.Item>

          <Form.Item name="slug" label="Slug (unique)" rules={[{ required: true }]}>
            <Input placeholder="e.g. extra-10-members" disabled={!!editing} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="What does this add-on provide to the user?" rows={2} />
          </Form.Item>

          <Form.Item name="type" label="Type" rules={[{ required: true }]}>
            <Select placeholder="Select type">
              <Option value="quota">Quota (Extra Members/Workspaces)</Option>
              <Option value="module">Module (Unlock a Feature)</Option>
              <Option value="subfeature">Sub-Feature (Upgrade Access)</Option>
            </Select>
          </Form.Item>

          <Form.Item noStyle dependencies={['type']}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              if (type === 'quota') {
                return (
                  <>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="extraWorkspaces" label="Extra Workspaces">
                          <InputNumber className="w-full" min={0} placeholder="0" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="extraMembersPerWorkspace" label="Extra Members/Workspace">
                          <InputNumber className="w-full" min={0} placeholder="0" />
                        </Form.Item>
                      </Col>
                    </Row>
                    <Row gutter={16}>
                      <Col span={12}>
                        <Form.Item name="extraTotalMembers" label="Extra Total Members">
                          <InputNumber className="w-full" min={0} placeholder="0" />
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item name="extraSessionsPerPlatform" label="Extra Sessions/Platform">
                          <InputNumber className="w-full" min={0} placeholder="0" />
                        </Form.Item>
                      </Col>
                    </Row>
                  </>
                );
              }
              if (type === 'module') {
                return (
                  <Form.Item name="targetModule" label="Module to Unlock">
                    <Select placeholder="Select module">
                      <Option value="shifts">Shifts</Option>
                      <Option value="bills">Bills</Option>
                      <Option value="reports">Reports</Option>
                      <Option value="api">API Access</Option>
                    </Select>
                  </Form.Item>
                );
              }
              return null;
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="monthlyPrice" label="Monthly Price (₹)">
                <InputNumber className="w-full" min={0} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="yearlyPrice" label="Yearly Price (₹)">
                <InputNumber className="w-full" min={0} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="displayOrder" label="Display Order">
                <InputNumber className="w-full" min={0} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="stackable" label="Allow Multiple Purchases" valuePropName="checked">
                <input type="checkbox" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="maxStack" label="Max Purchases (-1 = unlimited)">
                <InputNumber className="w-full" min={-1} placeholder="-1 for unlimited" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <input type="checkbox" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
