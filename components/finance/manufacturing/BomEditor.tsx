'use client';
import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Input, InputNumber, Select, Switch, Table, Descriptions, message } from 'antd';
import dayjs from 'dayjs';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { DsModal } from '@/components/ui/DsModal';
import BomExplosionPreview from './BomExplosionPreview';
import {
  createBom,
  updateBom,
  getBomStandardCost,
} from '@/lib/actions/finance/manufacturing.actions';
import type { BomDefinition, BomComponent, BomByProduct, BomStandardCostResult } from '@/types';

interface ItemOption {
  _id: string;
  name: string;
  unit: string;
  movingAvgCostPaise?: number;
}

interface BomListOption {
  _id: string;
  finishedItemId: string;
  outputQty: number;
  outputUnit: string;
}

export interface BomEditorProps {
  workspaceId: string;
  firmId: string;
  initial?: BomDefinition | null;
  itemList: ItemOption[];
  bomList: BomListOption[];
  onSaved?: (bom: BomDefinition) => void;
}

interface ComponentRow extends BomComponent {
  _key: string;
}

interface ByProductRow extends BomByProduct {
  _key: string;
}

function paiseToRupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function BomEditor({
  workspaceId,
  firmId,
  initial,
  itemList,
  bomList,
  onSaved,
}: BomEditorProps) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [components, setComponents] = useState<ComponentRow[]>([]);
  const [byProducts, setByProducts] = useState<ByProductRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [explosionOpen, setExplosionOpen] = useState(false);
  const [stdCostResult, setStdCostResult] = useState<BomStandardCostResult | null>(null);
  const [stdCostOpen, setStdCostOpen] = useState(false);
  const [stdCostLoading, setStdCostLoading] = useState(false);

  const isEdit = !!initial?._id;

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        finishedItemId: initial.finishedItemId,
        outputQty: initial.outputQty,
        outputUnit: initial.outputUnit,
        yieldPct: initial.yieldPct,
        isDefault: initial.isDefault,
        narration: initial.narration,
      });
      startTransition(() => {
        setComponents(initial.components.map((c, i) => ({ ...c, _key: `c${i}` })));
        setByProducts(initial.byProducts.map((b, i) => ({ ...b, _key: `b${i}` })));
      });
    } else {
      form.setFieldsValue({ yieldPct: 100, isDefault: false });
    }
  }, [initial, form]);

  const addComponent = () =>
    setComponents((prev) => [
      ...prev,
      {
        _key: `c${Date.now()}`,
        itemId: '',
        qty: 1,
        unit: '',
        wastageAllowedPct: 0,
        isSubAssembly: false,
        sortOrder: prev.length,
      },
    ]);

  const updateComponent = (key: string, patch: Partial<ComponentRow>) =>
    setComponents((prev) => prev.map((c) => (c._key === key ? { ...c, ...patch } : c)));

  const removeComponent = (key: string) =>
    setComponents((prev) => prev.filter((c) => c._key !== key));

  const addByProduct = () =>
    setByProducts((prev) => [
      ...prev,
      {
        _key: `b${Date.now()}`,
        itemId: '',
        qty: 1,
        unit: '',
        nrvPaisePerUnit: 0,
      },
    ]);

  const updateByProduct = (key: string, patch: Partial<ByProductRow>) =>
    setByProducts((prev) => prev.map((b) => (b._key === key ? { ...b, ...patch } : b)));

  const removeByProduct = (key: string) =>
    setByProducts((prev) => prev.filter((b) => b._key !== key));

  const handleFinishedItemChange = (itemId: string) => {
    const item = itemList.find((i) => i._id === itemId);
    if (item) {
      form.setFieldsValue({ outputUnit: item.unit });
    }
  };

  const handleComponentItemChange = (key: string, itemId: string) => {
    const item = itemList.find((i) => i._id === itemId);
    updateComponent(key, { itemId, unit: item?.unit ?? '' });
  };

  const handleByProductItemChange = (key: string, itemId: string) => {
    const item = itemList.find((i) => i._id === itemId);
    updateByProduct(key, { itemId, unit: item?.unit ?? '' });
  };

  const handleComputeStdCost = async () => {
    if (!initial?._id) {
      message.warning('Save the BoM first before computing standard cost.');
      return;
    }
    try {
      setStdCostLoading(true);
      const result = await getBomStandardCost(workspaceId, firmId, initial._id, true);
      setStdCostResult(result);
      setStdCostOpen(true);
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(e?.message ?? 'Failed to compute standard cost');
    } finally {
      setStdCostLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      if (components.length === 0) {
        message.warning('Add at least one component');
        return;
      }
      setSaving(true);
      const payload = {
        finishedItemId: values.finishedItemId,
        outputQty: values.outputQty,
        outputUnit: values.outputUnit,
        yieldPct: values.yieldPct ?? 100,
        isDefault: values.isDefault ?? false,
        narration: values.narration,
        components: components.map(({ _key, ...c }) => c),
        byProducts: byProducts.map(({ _key, ...b }) => b),
      };
      let saved: BomDefinition;
      if (isEdit) {
        saved = await updateBom(workspaceId, firmId, initial!._id, payload);
        message.success('BoM updated');
      } else {
        saved = await createBom(workspaceId, firmId, payload);
        message.success('BoM created');
        router.replace(`/dashboard/finance/firms/${firmId}/manufacturing/bom/${saved._id}`);
      }
      onSaved?.(saved);
    } catch (err: unknown) {
      const e = err as { errorFields?: unknown; message?: string };
      if (!e?.errorFields) {
        message.error(e?.message ?? 'Failed to save BoM');
      }
    } finally {
      setSaving(false);
    }
  };

  const itemOptions = itemList.map((i) => ({ value: i._id, label: i.name }));

  const getBomOptionsForItem = (itemId: string) =>
    bomList
      .filter((b) => b.finishedItemId === itemId)
      .map((b) => ({
        value: b._id,
        label: `BoM #${b._id.slice(-6)} (${b.outputQty} ${b.outputUnit})`,
      }));

  const finishedItemId = Form.useWatch('finishedItemId', form);
  const explosionBomId = isEdit ? initial!._id : undefined;

  return (
    <Form form={form} layout="vertical">
      {/* Header Panel */}
      <DsCard style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
          }}
        >
          <Form.Item
            name="finishedItemId"
            label="Finished Item"
            rules={[{ required: true, message: 'Select finished item' }]}
          >
            <Select
              showSearch
              options={itemOptions}
              filterOption={(input, opt) =>
                (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={handleFinishedItemChange}
              placeholder="Search item..."
            />
          </Form.Item>
          <Form.Item name="outputQty" label="Output Qty" rules={[{ required: true }]}>
            <InputNumber min={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="outputUnit" label="Output Unit">
            <Input readOnly placeholder="Auto-filled from item" />
          </Form.Item>
          <Form.Item name="yieldPct" label="Yield %" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="isDefault" label="Is Default BoM" valuePropName="checked">
            <Switch />
          </Form.Item>
        </div>
        <Form.Item name="narration" label="Narration">
          <Input.TextArea rows={2} />
        </Form.Item>
      </DsCard>

      {/* Components Section */}
      <DsCard style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
            marginBottom: 12,
          }}
        >
          Components
        </div>
        <Table
          dataSource={components}
          rowKey="_key"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Item',
              width: 200,
              render: (_: unknown, r: ComponentRow) => (
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  value={r.itemId || undefined}
                  options={itemOptions}
                  filterOption={(input, opt) =>
                    (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(v) => handleComponentItemChange(r._key, v)}
                  placeholder="Select item"
                />
              ),
            },
            {
              title: 'Qty',
              width: 100,
              render: (_: unknown, r: ComponentRow) => (
                <InputNumber
                  min={0.001}
                  value={r.qty}
                  style={{ width: '100%' }}
                  onChange={(v) => updateComponent(r._key, { qty: Number(v) })}
                />
              ),
            },
            {
              title: 'Unit',
              width: 80,
              render: (_: unknown, r: ComponentRow) => (
                <Input value={r.unit} readOnly placeholder="Auto" />
              ),
            },
            {
              title: 'Wastage %',
              width: 110,
              render: (_: unknown, r: ComponentRow) => (
                <InputNumber
                  min={0}
                  max={100}
                  precision={2}
                  value={r.wastageAllowedPct}
                  style={{ width: '100%' }}
                  onChange={(v) => updateComponent(r._key, { wastageAllowedPct: Number(v) })}
                />
              ),
            },
            {
              title: 'Sub-Assembly',
              width: 120,
              render: (_: unknown, r: ComponentRow) => (
                <Switch
                  checked={r.isSubAssembly}
                  onChange={(v) =>
                    updateComponent(r._key, {
                      isSubAssembly: v,
                      subBomId: v ? r.subBomId : undefined,
                    })
                  }
                />
              ),
            },
            {
              title: 'Sub-BoM',
              width: 180,
              render: (_: unknown, r: ComponentRow) => (
                <Select
                  style={{ width: '100%' }}
                  disabled={!r.isSubAssembly}
                  value={r.subBomId || undefined}
                  options={getBomOptionsForItem(r.itemId)}
                  onChange={(v) => updateComponent(r._key, { subBomId: v })}
                  placeholder="Select sub-BoM"
                  allowClear
                />
              ),
            },
            {
              title: <span className="sr-only">Delete</span>,
              width: 60,
              render: (_: unknown, r: ComponentRow) => (
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  danger
                  onClick={() => removeComponent(r._key)}
                >
                  Remove
                </DsButton>
              ),
            },
          ]}
          footer={() => (
            <DsButton dsVariant="ghost" onClick={addComponent}>
              + Add Component
            </DsButton>
          )}
        />
      </DsCard>

      {/* By-Products Section */}
      <DsCard style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
            marginBottom: 12,
          }}
        >
          By-Products (Optional)
        </div>
        <Table
          dataSource={byProducts}
          rowKey="_key"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: 'Item',
              width: 200,
              render: (_: unknown, r: ByProductRow) => (
                <Select
                  showSearch
                  style={{ width: '100%' }}
                  value={r.itemId || undefined}
                  options={itemOptions}
                  filterOption={(input, opt) =>
                    (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                  onChange={(v) => handleByProductItemChange(r._key, v)}
                  placeholder="Select item"
                />
              ),
            },
            {
              title: 'Expected Qty',
              width: 120,
              render: (_: unknown, r: ByProductRow) => (
                <InputNumber
                  min={0}
                  value={r.qty}
                  style={{ width: '100%' }}
                  onChange={(v) => updateByProduct(r._key, { qty: Number(v) })}
                />
              ),
            },
            {
              title: 'Unit',
              width: 80,
              render: (_: unknown, r: ByProductRow) => (
                <Input value={r.unit} readOnly placeholder="Auto" />
              ),
            },
            {
              title: 'NRV/Unit (₹)',
              width: 130,
              render: (_: unknown, r: ByProductRow) => (
                <InputNumber
                  min={0}
                  precision={2}
                  value={r.nrvPaisePerUnit / 100}
                  style={{ width: '100%' }}
                  prefix="₹"
                  onChange={(v) =>
                    updateByProduct(r._key, {
                      nrvPaisePerUnit: Math.round(Number(v) * 100),
                    })
                  }
                />
              ),
            },
            {
              title: <span className="sr-only">Delete</span>,
              width: 60,
              render: (_: unknown, r: ByProductRow) => (
                <DsButton
                  dsVariant="ghost"
                  dsSize="sm"
                  danger
                  onClick={() => removeByProduct(r._key)}
                >
                  Remove
                </DsButton>
              ),
            },
          ]}
          footer={() => (
            <DsButton dsVariant="ghost" onClick={addByProduct}>
              + Add By-Product
            </DsButton>
          )}
        />
      </DsCard>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0,
          background: 'var(--cr-surface)',
          padding: 16,
          borderTop: '1px solid var(--cr-border)',
        }}
      >
        {isEdit && explosionBomId && (
          <DsButton
            dsVariant="ghost"
            onClick={() => setExplosionOpen(true)}
            disabled={!finishedItemId}
          >
            Preview Explosion
          </DsButton>
        )}
        {isEdit && (
          <DsButton dsVariant="ghost" onClick={handleComputeStdCost} loading={stdCostLoading}>
            Compute Standard Cost
          </DsButton>
        )}
        <DsButton dsVariant="primary" onClick={handleSave} loading={saving}>
          {isEdit ? 'Update BoM' : 'Create BoM'}
        </DsButton>
      </div>

      {/* Explosion Preview Modal */}
      {isEdit && explosionBomId && (
        <BomExplosionPreview
          open={explosionOpen}
          onClose={() => setExplosionOpen(false)}
          workspaceId={workspaceId}
          firmId={firmId}
          bomId={explosionBomId}
          defaultRequestedQty={initial?.outputQty ?? 1}
        />
      )}

      {/* Standard Cost Modal */}
      <DsModal
        open={stdCostOpen}
        onCancel={() => setStdCostOpen(false)}
        title="BoM Standard Cost Breakdown"
        footer={
          <DsButton dsVariant="ghost" onClick={() => setStdCostOpen(false)}>
            Close
          </DsButton>
        }
        width={600}
      >
        {stdCostResult && (
          <>
            <Descriptions column={1} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Total Standard Cost (₹)">
                <strong>₹{paiseToRupees(stdCostResult.standardCostPaise)}</strong>
              </Descriptions.Item>
            </Descriptions>
            <Table
              dataSource={stdCostResult.breakdown}
              rowKey="itemId"
              pagination={false}
              size="small"
              columns={[
                {
                  title: 'Item ID',
                  dataIndex: 'itemId',
                  render: (v: string) => {
                    const item = itemList.find((i) => i._id === v);
                    return item?.name ?? v;
                  },
                },
                { title: 'Qty', dataIndex: 'qty' },
                {
                  title: 'Unit Cost (₹)',
                  dataIndex: 'unitCostPaise',
                  render: (v: number) => `₹${paiseToRupees(v)}`,
                },
                {
                  title: 'Line Cost (₹)',
                  dataIndex: 'lineCostPaise',
                  render: (v: number) => `₹${paiseToRupees(v)}`,
                },
              ]}
            />
          </>
        )}
      </DsModal>
    </Form>
  );
}
