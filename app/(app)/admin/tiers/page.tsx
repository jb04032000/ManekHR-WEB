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
  Switch,
  Space,
  Popconfirm,
  message,
  Tag,
  Row,
  Col,
  Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getTiers, createTier, updateTier, deleteTier } from '@/lib/actions';
import type { Tier, ModuleAccessEntry, CreateTierPayload } from '@/types';
import { parseApiError } from '@/lib/utils';
import { ModuleAccessEditor } from '@/components/admin/module-access-editor';
import { DsCardTitle } from '@/components/ui';
import {
  TIER_COLORS,
  getDefaultModuleAccessEntries,
  formatEntitlementValue,
} from '@/lib/utils/subscription.utils';
import { EntitlementsFormFields } from '@/components/admin/entitlements-form-fields';
import { EntitlementsDisplay } from '@/components/admin/entitlements-display';

const { Option } = Select;

function generateKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function AdminTiersPage() {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tier | null>(null);
  const [saving, setSaving] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();
  const [moduleAccess, setModuleAccess] = useState<ModuleAccessEntry[]>([]);

  const load = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await getTiers();
      startTransition(() => {
        setTiers(Array.isArray(res) ? res : []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({
      isActive: true,
      product: 'erp',
      displayOrder: tiers.length,
      color: 'default',
    });
    setModuleAccess(getDefaultModuleAccessEntries('full'));
    setModalOpen(true);
  };

  const openEdit = (t: Tier) => {
    setEditing(t);
    form.setFieldsValue({
      name: t.name,
      product: t.product || 'erp',
      displayOrder: t.displayOrder,
      color: t.color,
      description: t.description,
      isActive: t.isActive,
      defaultEntitlements: t.defaultEntitlements || {
        maxWorkspaces: 1,
        maxMembersPerWorkspace: 5,
        maxTotalMembers: 5,
      },
    });
    if (t.defaultModuleAccess && t.defaultModuleAccess.length > 0) {
      setModuleAccess(t.defaultModuleAccess);
    } else {
      setModuleAccess(getDefaultModuleAccessEntries('full'));
    }
    setModalOpen(true);
  };

  const handleSave = async (vals: {
    name: string;
    product?: CreateTierPayload['product'];
    displayOrder: number;
    color: string;
    description?: string;
    isActive: boolean;
    defaultEntitlements?: {
      maxWorkspaces?: number;
      maxMembersPerWorkspace?: number;
      maxTotalMembers?: number;
    };
    key?: string;
  }) => {
    setSaving(true);
    const payload = {
      name: vals.name,
      product: vals.product ?? 'erp',
      displayOrder: vals.displayOrder,
      color: vals.color,
      description: vals.description,
      isActive: vals.isActive,
      defaultEntitlements: vals.defaultEntitlements
        ? {
            maxWorkspaces: vals.defaultEntitlements.maxWorkspaces ?? 1,
            maxMembersPerWorkspace: vals.defaultEntitlements.maxMembersPerWorkspace ?? 5,
            maxTotalMembers: vals.defaultEntitlements.maxTotalMembers ?? 5,
          }
        : undefined,
      defaultModuleAccess: moduleAccess,
    };

    try {
      if (editing) {
        await updateTier(editing._id, payload);
        msgApi.success('Tier updated');
      } else {
        await createTier({
          ...payload,
          key: generateKey(vals.name),
        });
        msgApi.success('Tier created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTier(id);
      msgApi.success('Tier deleted');
      load();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  return (
    <>
      {ctx}
      <Card
        title={<DsCardTitle>Subscription Tiers</DsCardTitle>}
        loading={loading}
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            Create Tier
          </Button>
        }
      >
        <Row gutter={[16, 16]}>
          {tiers.map((tier) => (
            <Col xs={24} sm={12} lg={6} key={tier._id}>
              <div className="rounded-[18px] border-[1.5px] border-border bg-surface p-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Tag color={tier.color} className="font-bold capitalize">
                      {tier.name}
                    </Tag>
                    {tier.product && tier.product !== 'erp' && (
                      <Tag color={tier.product === 'bundle' ? 'gold' : 'geekblue'}>
                        {tier.product === 'bundle' ? 'Bundle' : 'Connect'}
                      </Tag>
                    )}
                  </div>
                  {!tier.isActive && <Tag color="error">Inactive</Tag>}
                </div>
                <div className="mb-2 flex items-center gap-2 text-xs text-secondary">
                  <span>Order: {tier.displayOrder}</span>
                  <span className="text-muted">•</span>
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{tier.key}</span>
                </div>
                {tier.description && (
                  <p className="mb-3 text-xs text-secondary">{tier.description}</p>
                )}
                {tier.defaultEntitlements && (
                  <EntitlementsDisplay
                    entitlements={tier.defaultEntitlements}
                    product={tier.product}
                  />
                )}
                <div className="mt-4 flex justify-end">
                  <Space>
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={() => openEdit(tier)}
                    />
                    <Popconfirm
                      title="Delete tier?"
                      description="This will remove the tier. Plans using this tier will need to be updated."
                      onConfirm={() => handleDelete(tier._id)}
                      okButtonProps={{ danger: true }}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </div>
            </Col>
          ))}
          {tiers.length === 0 && !loading && (
            <Col span={24}>
              <p className="py-8 text-center text-subtle">
                No tiers configured. Create your first tier.
              </p>
            </Col>
          )}
        </Row>
      </Card>

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={
          <span className="font-display font-bold">{editing ? 'Edit Tier' : 'Create Tier'}</span>
        }
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={780}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          requiredMark={false}
          className="mt-4"
        >
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Please enter tier name' }]}
              >
                <Input
                  size="large"
                  placeholder="e.g. Pro"
                  onChange={(e) => {
                    if (!editing) {
                      const key = generateKey(e.target.value);
                      form.setFieldValue('key', key);
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="key" label="Key (Slug)">
                <Input size="large" placeholder="e.g. pro" disabled={!!editing} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="product" label="Product Line" rules={[{ required: true }]}>
            <Select size="large">
              <Option value="erp">ERP (workspace tier)</Option>
              <Option value="connect">Connect (person-centric)</Option>
              <Option value="bundle">Bundle (ERP + Connect)</Option>
            </Select>
          </Form.Item>

          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="displayOrder" label="Display Order" rules={[{ required: true }]}>
                <InputNumber className="w-full" min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="color" label="Color" rules={[{ required: true }]}>
                <Select size="large" placeholder="Select color">
                  {TIER_COLORS.map((c) => (
                    <Option key={c.value} value={c.value}>
                      <Tag color={c.value}>{c.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description (Optional)">
            <Input.TextArea rows={2} placeholder="Brief description of this tier" />
          </Form.Item>

          <Divider className="my-3 text-xs">Default Entitlements</Divider>
          <EntitlementsFormFields namePrefix={['defaultEntitlements']} min={-1} />

          <Divider className="my-3 text-xs">Default Module Access</Divider>
          <ModuleAccessEditor moduleAccess={moduleAccess} onChange={setModuleAccess} />

          <Form.Item name="isActive" label="Active" valuePropName="checked" className="mt-4">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
