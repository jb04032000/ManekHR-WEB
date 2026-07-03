'use client';
import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  DatePicker,
  Table,
  Alert,
  Popconfirm,
  Modal,
  message,
} from 'antd';
import dayjs from 'dayjs';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import {
  createManufacturingVoucher,
  updateManufacturingVoucherDraft,
  issueManufacturingVoucher,
  completeManufacturingVoucher,
  cancelManufacturingVoucher,
} from '@/lib/actions/finance/manufacturing.actions';
import type {
  ManufacturingVoucher,
  BomDefinition,
  MvComponentConsumed,
  MvAdditionalCost,
  MvByProduct,
} from '@/types';

interface ItemOption {
  _id: string;
  name: string;
  unit: string;
}

interface GodownOption {
  _id: string;
  name: string;
}

interface AccountOption {
  _id: string;
  code: string;
  name: string;
}

export interface ManufacturingVoucherFormProps {
  workspaceId: string;
  firmId: string;
  initial?: ManufacturingVoucher | null;
  bomList: BomDefinition[];
  itemList: ItemOption[];
  godownList: GodownOption[];
  expenseAccounts: AccountOption[];
  onSaved?: (mv: ManufacturingVoucher) => void;
}

interface ConsumedRow extends Omit<MvComponentConsumed, 'costAtConsumptionPaise'> {
  _key: string;
  plannedQty?: number;
  availableQty?: number;
  costAtConsumptionPaise: number;
}

interface AdditionalCostRow extends MvAdditionalCost {
  _key: string;
}

interface ByProductRow {
  _key: string;
  itemId: string;
  qty: number;
  unit: string;
  godownId: string;
  expectedQty?: number;
}

function paiseToRupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

export default function ManufacturingVoucherForm({
  workspaceId,
  firmId,
  initial,
  bomList,
  itemList,
  godownList,
  expenseAccounts,
  onSaved,
}: ManufacturingVoucherFormProps) {
  const router = useRouter();
  const [form] = Form.useForm();
  const [consumedRows, setConsumedRows] = useState<ConsumedRow[]>([]);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCostRow[]>([]);
  const [byProductRows, setByProductRows] = useState<ByProductRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const status = initial?.status;
  const isReadonly = status === 'completed' || status === 'cancelled';

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        bomId: initial.bomId,
        voucherDate: dayjs(initial.voucherDate),
        finishedQty: initial.finishedQty,
        finishedGodownId: initial.finishedGodownId,
        batchNo: initial.batchNo,
        costMethod: initial.costMethod === 'standard',
      });
      // For draft, use componentsPlanned + lotSuggestions to build consumed rows
      if (initial.status === 'draft') {
        const suggestions = initial.lotSuggestions ?? [];
        startTransition(() => {
          setConsumedRows(
            initial.componentsPlanned.map((cp, i) => {
              const sug = suggestions.find((s) => s.itemId === cp.itemId);
              const firstSug = sug?.suggestions?.[0];
              return {
                _key: `cr${i}`,
                itemId: cp.itemId,
                qty: cp.plannedQty,
                unit: cp.unit,
                godownId: '',
                lotId: firstSug?.lotId,
                costAtConsumptionPaise: 0,
                plannedQty: cp.plannedQty,
                availableQty: firstSug?.qty,
              };
            }),
          );
        });
      } else if (initial.componentsConsumed.length > 0) {
        startTransition(() => {
          setConsumedRows(
            initial.componentsConsumed.map((cc, i) => ({
              _key: `cr${i}`,
              ...cc,
              plannedQty: initial.componentsPlanned[i]?.plannedQty,
            })),
          );
        });
      }
      startTransition(() => {
        setAdditionalCosts(
          (initial.additionalCosts ?? []).map((ac, i) => ({
            ...ac,
            _key: `ac${i}`,
          })),
        );
      });
      // For in_progress, pre-fill by-products from BoM
      if (initial.status === 'in_progress') {
        const bom = bomList.find((b) => b._id === initial.bomId);
        const existing = initial.byProductsProduced ?? [];
        if (bom && bom.byProducts.length > 0) {
          startTransition(() => {
            setByProductRows(
              bom.byProducts.map((bp, i) => {
                const ex = existing[i];
                return {
                  _key: `bp${i}`,
                  itemId: bp.itemId,
                  qty: ex?.qty ?? bp.qty,
                  unit: bp.unit,
                  godownId: ex?.godownId ?? '',
                  expectedQty: bp.qty,
                };
              }),
            );
          });
        } else {
          startTransition(() => {
            setByProductRows([]);
          });
        }
      }
    } else {
      form.setFieldsValue({
        voucherDate: dayjs(),
        costMethod: false,
      });
    }
  }, [initial, bomList, form]);

  const handleBomChange = (bomId: string) => {
    const bom = bomList.find((b) => b._id === bomId);
    if (bom) {
      form.setFieldsValue({
        finishedQty: bom.outputQty,
      });
    }
  };

  const handleUseSuggestedLots = () => {
    if (!initial?.lotSuggestions) return;
    setConsumedRows((prev) =>
      prev.map((row) => {
        const sug = initial.lotSuggestions?.find((s) => s.itemId === row.itemId);
        const first = sug?.suggestions?.[0];
        return first
          ? {
              ...row,
              lotId: first.lotId,
              qty: row.plannedQty ?? row.qty,
            }
          : row;
      }),
    );
    message.success('Lot suggestions applied');
  };

  const updateConsumed = (key: string, patch: Partial<ConsumedRow>) =>
    setConsumedRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const addAdditionalCost = () =>
    setAdditionalCosts((prev) => [
      ...prev,
      { _key: `ac${Date.now()}`, accountId: '', amountPaise: 0, narration: '' },
    ]);

  const updateAdditionalCost = (key: string, patch: Partial<AdditionalCostRow>) =>
    setAdditionalCosts((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const removeAdditionalCost = (key: string) =>
    setAdditionalCosts((prev) => prev.filter((r) => r._key !== key));

  const updateByProduct = (key: string, patch: Partial<ByProductRow>) =>
    setByProductRows((prev) => prev.map((r) => (r._key === key ? { ...r, ...patch } : r)));

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        bomId: values.bomId,
        voucherDate: dayjs(values.voucherDate).toISOString(),
        finishedQty: values.finishedQty,
        finishedGodownId: values.finishedGodownId,
        batchNo: values.batchNo,
        costMethod: values.costMethod ? ('standard' as const) : ('actual' as const),
        additionalCosts: additionalCosts.map(({ _key, ...ac }) => ac),
        narration: values.narration,
      };
      let saved: ManufacturingVoucher;
      if (initial?.status === 'draft') {
        saved = await updateManufacturingVoucherDraft(workspaceId, firmId, initial._id, payload);
        message.success('Draft updated');
      } else {
        saved = await createManufacturingVoucher(workspaceId, firmId, payload);
        message.success('Draft saved');
        router.replace(`/dashboard/finance/firms/${firmId}/manufacturing/vouchers/${saved._id}`);
      }
      onSaved?.(saved);
    } catch (err: unknown) {
      const e = err as { errorFields?: unknown; message?: string };
      if (!e?.errorFields) {
        message.error(e?.message ?? 'Failed to save draft');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleIssue = () => {
    Modal.confirm({
      title: 'Issue Materials',
      content: 'This will deduct raw material stock and move this MV to In Progress. Continue?',
      okText: 'Issue Materials',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setSaving(true);
          const saved = await issueManufacturingVoucher(workspaceId, firmId, initial!._id, {
            componentsConsumed: consumedRows.map(({ _key, plannedQty, availableQty, ...cc }) => ({
              itemId: cc.itemId,
              qty: cc.qty,
              unit: cc.unit,
              godownId: cc.godownId,
              lotId: cc.lotId,
              batchId: cc.batchId,
              serialNos: cc.serialNos,
            })),
          });
          message.success('Materials issued - MV is now In Progress');
          onSaved?.(saved);
          router.refresh();
        } catch (err: unknown) {
          const e = err as { message?: string };
          message.error(e?.message ?? 'Issue failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleComplete = () => {
    Modal.confirm({
      title: 'Complete Production',
      content: 'Confirm actual finished qty and by-products below.',
      okText: 'Complete Production',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          setSaving(true);
          const actualQty = form.getFieldValue('actualFinishedQty') as number | undefined;
          if (actualQty === undefined || actualQty === null) {
            message.warning(
              'Please enter the actual finished quantity before completing production.',
            );
            setSaving(false);
            return;
          }
          const saved = await completeManufacturingVoucher(workspaceId, firmId, initial!._id, {
            actualFinishedQty: actualQty,
            byProductsProduced: byProductRows.map(({ _key, expectedQty, ...bp }) => ({
              itemId: bp.itemId,
              qty: bp.qty,
              unit: bp.unit,
              godownId: bp.godownId,
            })),
          });
          const varianceDisplay = paiseToRupees(Math.abs(saved.variancePaise));
          const varianceSign = saved.variancePaise > 0 ? 'Adverse' : 'Favorable';
          message.success(`Production completed. Variance: ₹${varianceDisplay} (${varianceSign})`);
          onSaved?.(saved);
          router.refresh();
        } catch (err: unknown) {
          const e = err as { message?: string };
          message.error(e?.message ?? 'Complete failed');
        } finally {
          setSaving(false);
        }
      },
    });
  };

  const handleCancel = async (reason?: string) => {
    try {
      setSaving(true);
      const saved = await cancelManufacturingVoucher(workspaceId, firmId, initial!._id);
      message.success('Manufacturing voucher cancelled');
      onSaved?.(saved);
      router.refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(e?.message ?? 'Cancel failed');
    } finally {
      setSaving(false);
    }
  };

  const renderActions = () => {
    if (!initial) {
      return (
        <DsButton dsVariant="primary" onClick={handleSaveDraft} loading={saving}>
          Save Draft
        </DsButton>
      );
    }
    switch (initial.status) {
      case 'draft':
        return (
          <>
            <DsButton dsVariant="ghost" onClick={handleSaveDraft} loading={saving}>
              Save Draft
            </DsButton>
            <DsButton dsVariant="primary" onClick={handleIssue} loading={saving}>
              Issue Materials
            </DsButton>
            <Popconfirm
              title="Cancel this manufacturing voucher?"
              description="Enter a reason (optional):"
              onConfirm={() => handleCancel(cancelReason)}
              okText="Confirm Cancel"
              cancelText="No"
            >
              <DsButton dsVariant="danger" loading={saving}>
                Cancel
              </DsButton>
            </Popconfirm>
          </>
        );
      case 'in_progress':
        return (
          <>
            <DsButton dsVariant="primary" onClick={handleComplete} loading={saving}>
              Complete Production
            </DsButton>
            <Popconfirm
              title="Cancel this manufacturing voucher?"
              description="Stock movements will be reversed."
              onConfirm={() => handleCancel(cancelReason)}
              okText="Confirm Cancel"
              cancelText="No"
            >
              <DsButton dsVariant="danger" loading={saving}>
                Cancel
              </DsButton>
            </Popconfirm>
          </>
        );
      case 'completed':
      case 'cancelled':
        return null;
    }
  };

  const itemName = (id: string) => itemList.find((i) => i._id === id)?.name ?? id;
  const godownName = (id: string) => godownList.find((g) => g._id === id)?.name ?? id;

  const bomOptions = bomList.map((b) => {
    const item = itemList.find((i) => i._id === b.finishedItemId);
    return {
      value: b._id,
      label: item ? `${item.name} (BoM v${b.versionNo})` : b._id,
    };
  });

  const godownOptions = godownList.map((g) => ({ value: g._id, label: g.name }));
  const accountOptions = expenseAccounts.map((a) => ({
    value: a._id,
    label: `${a.code} - ${a.name}`,
  }));

  return (
    <Form form={form} layout="vertical">
      {/* Section 1 - Header */}
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
          Manufacturing Voucher Header
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 16,
          }}
        >
          {initial?.voucherNumber && (
            <Form.Item label="Voucher Number">
              <Input value={initial.voucherNumber} readOnly />
            </Form.Item>
          )}
          <Form.Item
            name="bomId"
            label="Bill of Materials"
            rules={[{ required: true, message: 'Select a BoM' }]}
          >
            <Select
              showSearch
              options={bomOptions}
              filterOption={(input, opt) =>
                (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
              onChange={handleBomChange}
              disabled={!!initial}
              placeholder="Select BoM..."
            />
          </Form.Item>
          <Form.Item name="voucherDate" label="Voucher Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} disabled={isReadonly} />
          </Form.Item>
          <Form.Item name="finishedQty" label="Planned Qty" rules={[{ required: true }]}>
            <InputNumber
              min={0.001}
              style={{ width: '100%' }}
              disabled={status === 'in_progress' || isReadonly}
            />
          </Form.Item>
          <Form.Item
            name="finishedGodownId"
            label="Finished Goods Godown"
            rules={[{ required: true, message: 'Select a godown' }]}
          >
            <Select
              options={godownOptions}
              disabled={status === 'in_progress' || isReadonly}
              placeholder="Select godown..."
            />
          </Form.Item>
          <Form.Item name="batchNo" label="Batch No">
            <Input placeholder="Auto-generated" disabled={status === 'in_progress' || isReadonly} />
          </Form.Item>
          <Form.Item
            name="costMethod"
            label="Standard Cost Mode"
            valuePropName="checked"
            tooltip="ON = standard cost; OFF = actual cost (default)"
          >
            <Switch disabled={!!initial} />
          </Form.Item>
        </div>
        <Form.Item name="narration" label="Narration">
          <Input.TextArea rows={2} disabled={isReadonly} />
        </Form.Item>
      </DsCard>

      {/* WIP balance indicator (in_progress only) */}
      {status === 'in_progress' && initial && (
        <Alert
          style={{ marginBottom: 16 }}
          title={`₹${paiseToRupees(initial.totalInputCostPaise)} tied up in WIP for this batch`}
          type="info"
          showIcon
        />
      )}

      {/* Section 2 - Components to Consume (draft or in_progress) */}
      {(status === 'draft' || status === 'in_progress' || !initial) && (
        <DsCard style={{ marginBottom: 16 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                color: 'var(--cr-text-4)',
              }}
            >
              Components to Consume
            </span>
            {status === 'draft' && initial?.lotSuggestions && (
              <DsButton dsVariant="ghost" dsSize="sm" onClick={handleUseSuggestedLots}>
                Use Suggested Lots
              </DsButton>
            )}
          </div>
          <Table
            dataSource={consumedRows}
            rowKey="_key"
            pagination={false}
            scroll={{ x: 'max-content' }}
            size="small"
            columns={[
              {
                title: 'Item',
                width: 160,
                render: (_: unknown, r: ConsumedRow) => itemName(r.itemId),
              },
              {
                title: 'Planned Qty',
                width: 110,
                render: (_: unknown, r: ConsumedRow) =>
                  r.plannedQty !== undefined ? r.plannedQty : '-',
              },
              {
                title: 'Lot',
                width: 160,
                render: (_: unknown, r: ConsumedRow) => (
                  <Input
                    value={r.lotId ?? ''}
                    disabled={status === 'in_progress' || isReadonly}
                    placeholder="Lot ID"
                    onChange={(e) => updateConsumed(r._key, { lotId: e.target.value || undefined })}
                  />
                ),
              },
              {
                title: 'Available Qty',
                width: 110,
                render: (_: unknown, r: ConsumedRow) =>
                  r.availableQty !== undefined ? r.availableQty : '-',
              },
              {
                title: 'Consumed Qty',
                width: 130,
                render: (_: unknown, r: ConsumedRow) => (
                  <InputNumber
                    min={0}
                    value={r.qty}
                    style={{ width: '100%' }}
                    disabled={status === 'in_progress' || isReadonly}
                    onChange={(v) => updateConsumed(r._key, { qty: Number(v) })}
                  />
                ),
              },
              {
                title: 'Godown',
                width: 140,
                render: (_: unknown, r: ConsumedRow) => (
                  <Select
                    style={{ width: '100%' }}
                    options={godownOptions}
                    value={r.godownId || undefined}
                    disabled={status === 'in_progress' || isReadonly}
                    onChange={(v) => updateConsumed(r._key, { godownId: v })}
                    placeholder="Godown"
                  />
                ),
              },
            ]}
          />
        </DsCard>
      )}

      {/* Read-only consumed components for completed/cancelled */}
      {isReadonly && initial && initial.componentsConsumed.length > 0 && (
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
            Components Consumed
          </div>
          <Table
            dataSource={initial.componentsConsumed}
            rowKey={(r, i) => `${r.itemId}-${i}`}
            pagination={false}
            size="small"
            columns={[
              { title: 'Item', dataIndex: 'itemId', render: (v: string) => itemName(v) },
              { title: 'Qty', dataIndex: 'qty' },
              { title: 'Unit', dataIndex: 'unit' },
              {
                title: 'Godown',
                dataIndex: 'godownId',
                render: (v: string) => godownName(v),
              },
              {
                title: 'Cost (₹)',
                dataIndex: 'costAtConsumptionPaise',
                render: (v: number) => `₹${paiseToRupees(v)}`,
              },
            ]}
          />
        </DsCard>
      )}

      {/* Section 3 - Additional Costs */}
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
          Additional Manufacturing Costs
        </div>
        <Table
          dataSource={additionalCosts}
          rowKey="_key"
          pagination={false}
          size="small"
          columns={[
            {
              title: 'Account',
              width: 200,
              render: (_: unknown, r: AdditionalCostRow) => (
                <Select
                  style={{ width: '100%' }}
                  options={accountOptions}
                  value={r.accountId || undefined}
                  disabled={isReadonly}
                  onChange={(v) => updateAdditionalCost(r._key, { accountId: v })}
                  placeholder="Select account"
                  showSearch
                  filterOption={(input, opt) =>
                    (opt?.label as string)?.toLowerCase().includes(input.toLowerCase())
                  }
                />
              ),
            },
            {
              title: 'Amount (₹)',
              width: 130,
              render: (_: unknown, r: AdditionalCostRow) => (
                <InputNumber
                  min={0}
                  precision={2}
                  value={r.amountPaise / 100}
                  style={{ width: '100%' }}
                  prefix="₹"
                  disabled={isReadonly}
                  onChange={(v) =>
                    updateAdditionalCost(r._key, {
                      amountPaise: Math.round(Number(v) * 100),
                    })
                  }
                />
              ),
            },
            {
              title: 'Narration',
              width: 160,
              render: (_: unknown, r: AdditionalCostRow) => (
                <Input
                  value={r.narration ?? ''}
                  disabled={isReadonly}
                  onChange={(e) => updateAdditionalCost(r._key, { narration: e.target.value })}
                  placeholder="Optional"
                />
              ),
            },
            {
              title: <span className="sr-only">Actions</span>,
              width: 60,
              render: (_: unknown, r: AdditionalCostRow) =>
                !isReadonly && (
                  <DsButton
                    dsVariant="ghost"
                    dsSize="sm"
                    danger
                    onClick={() => removeAdditionalCost(r._key)}
                  >
                    Remove
                  </DsButton>
                ),
            },
          ]}
          footer={() =>
            !isReadonly && (
              <DsButton dsVariant="ghost" onClick={addAdditionalCost}>
                + Add Cost
              </DsButton>
            )
          }
        />
      </DsCard>

      {/* Section 4 - By-Products (in_progress only) */}
      {status === 'in_progress' && byProductRows.length > 0 && (
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
            By-Products to Receive
          </div>
          <Form.Item name="actualFinishedQty" label="Actual Finished Qty">
            <InputNumber
              min={0}
              style={{ width: 200 }}
              placeholder={`Planned: ${initial?.finishedQty}`}
            />
          </Form.Item>
          <Table
            dataSource={byProductRows}
            rowKey="_key"
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Item',
                dataIndex: 'itemId',
                render: (v: string) => itemName(v),
              },
              {
                title: 'Expected Qty',
                dataIndex: 'expectedQty',
                render: (v: number | undefined) => v ?? '-',
              },
              {
                title: 'Actual Qty',
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
                title: 'Godown',
                width: 160,
                render: (_: unknown, r: ByProductRow) => (
                  <Select
                    style={{ width: '100%' }}
                    options={godownOptions}
                    value={r.godownId || undefined}
                    onChange={(v) => updateByProduct(r._key, { godownId: v })}
                    placeholder="Select godown"
                  />
                ),
              },
            ]}
          />
        </DsCard>
      )}

      {/* Actual Finished Qty (when no by-products but in_progress) */}
      {status === 'in_progress' && byProductRows.length === 0 && (
        <DsCard style={{ marginBottom: 16 }}>
          <Form.Item
            name="actualFinishedQty"
            label="Actual Finished Qty"
            tooltip="Leave blank to use planned qty"
          >
            <InputNumber
              min={0}
              style={{ width: 200 }}
              placeholder={`Planned: ${initial?.finishedQty}`}
            />
          </Form.Item>
        </DsCard>
      )}

      {/* Section 5 - Status-Aware Actions */}
      {!isReadonly && (
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
          <DsButton dsVariant="ghost" onClick={() => router.back()}>
            Back
          </DsButton>
          {renderActions()}
        </div>
      )}
    </Form>
  );
}
