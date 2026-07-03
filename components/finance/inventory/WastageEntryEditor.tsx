'use client';
// Finance polish (inventory): user-facing strings localised via finance.inventory.editor
// (shared) + .editor.wastage (screen-specific). Used by the wastage new/[id] pages.
// Reason-code options are built inside the component so labels can use the translator.
// No data/validation logic changed.
import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Form,
  Input,
  DatePicker,
  InputNumber,
  Select,
  Radio,
  Popconfirm,
  message,
  Button,
  Table,
} from 'antd';
import dayjs from 'dayjs';
import dynamic from 'next/dynamic';
import { ScanOutlined } from '@ant-design/icons';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { GodownSelector } from './GodownSelector';
import { LotPicker } from './LotPicker';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ItemAutoComplete } from '../ItemAutoComplete';
import {
  createWastageEntry,
  updateWastageEntry,
  postWastageEntry,
} from '@/lib/actions/inventory.actions';
import type { WastageEntry, WastageEntryLine, WastageReasonCode } from '@/types';

const BarcodeScanModal = dynamic(() => import('./BarcodeScanModal'), {
  ssr: false,
});

interface Line extends WastageEntryLine {
  _key: string;
  itemTrackBatch?: boolean;
}

interface Props {
  workspaceId: string;
  firmId: string;
  initial?: WastageEntry | null;
  defaultItemId?: string;
  viewOnly?: boolean;
}

export function WastageEntryEditor({
  workspaceId,
  firmId,
  initial,
  defaultItemId,
  viewOnly,
}: Props) {
  const router = useRouter();
  const t = useTranslations('finance.inventory.editor');
  const [form] = Form.useForm();
  const [lines, setLines] = useState<Line[]>([]);
  const [scanLineKey, setScanLineKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isPosted = initial?.status === 'posted';
  const readonly = viewOnly || isPosted;

  // Wastage reason-code options (labels localised here so the translator is in scope).
  const REASON_CODE_OPTIONS: { value: WastageReasonCode; label: string }[] = [
    { value: 'manufacturing_damage', label: t('wastage.reasonManufacturingDamage') },
    { value: 'transit_damage', label: t('wastage.reasonTransitDamage') },
    { value: 'quality_rejection', label: t('wastage.reasonQualityRejection') },
    { value: 'theft', label: t('wastage.reasonTheft') },
    { value: 'expiry', label: t('wastage.reasonExpiry') },
    { value: 'processing_loss', label: t('wastage.reasonProcessingLoss') },
    { value: 'colour_bleeding', label: t('wastage.reasonColourBleeding') },
    { value: 'cutting_loss', label: t('wastage.reasonCuttingLoss') },
    { value: 'fire_or_flood', label: t('wastage.reasonFireOrFlood') },
    { value: 'other', label: t('wastage.reasonOther') },
  ];

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        date: dayjs(initial.date),
        godownId: initial.godownId,
        narration: initial.narration,
      });
      startTransition(() => {
        setLines(initial.lines.map((l, i) => ({ ...l, _key: `l${i}` })));
      });
    } else {
      form.setFieldsValue({ date: dayjs() });
      const initialLines: Line[] = defaultItemId
        ? [
            {
              _key: `l${Date.now()}`,
              itemId: defaultItemId,
              qty: 0,
              wastageType: 'own_goods',
              reasonCode: 'other',
              costPaise: 0,
            },
          ]
        : [];
      startTransition(() => {
        setLines(initialLines);
      });
    }
  }, [initial, defaultItemId, form]);

  const addLine = () =>
    setLines([
      ...lines,
      {
        _key: `l${Date.now()}`,
        itemId: '',
        qty: 0,
        wastageType: 'own_goods',
        reasonCode: 'other',
        costPaise: 0,
      },
    ]);

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines(lines.map((l) => (l._key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setLines(lines.filter((l) => l._key !== key));

  const godownId = Form.useWatch('godownId', form);

  const totalCostPaise = lines.reduce((sum, l) => sum + (l.costPaise || 0), 0);
  const totalCostRupees = (totalCostPaise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
  });

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        date: dayjs(values.date).toISOString(),
        godownId: values.godownId,
        lines: lines.map(({ _key, itemTrackBatch, ...l }) => l),
        narration: values.narration,
      };
      if (initial) {
        await updateWastageEntry(workspaceId, firmId, initial._id, payload);
        message.success(t('wastage.updated'));
      } else {
        const created = await createWastageEntry(workspaceId, firmId, payload);
        message.success(t('draftSaved'));
        router.replace(`/dashboard/finance/firms/${firmId}/inventory/wastage/${created._id}`);
      }
    } catch (err: unknown) {
      const e = err as { errorFields?: unknown; message?: string };
      if (!e?.errorFields) message.error(e?.message ?? t('failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handlePost = async () => {
    if (!initial) return;
    try {
      setSaving(true);
      await postWastageEntry(workspaceId, firmId, initial._id);
      message.success(t('postedSuccess', { voucher: initial.voucherNo }));
      router.refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(t('cannotPost', { error: e?.message ?? 'unknown error' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form form={form} layout="vertical">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Form.Item name="date" label={t('date')} rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} disabled={readonly} />
        </Form.Item>
        <Form.Item name="godownId" label={t('godown')} rules={[{ required: true }]}>
          <GodownSelector
            firmId={firmId}
            workspaceId={workspaceId}
            value={form.getFieldValue('godownId')}
            onChange={(v) => form.setFieldsValue({ godownId: v })}
            disabled={readonly}
          />
        </Form.Item>
      </div>

      <DsCard style={{ marginBottom: 16 }}>
        <Table
          dataSource={lines}
          rowKey="_key"
          pagination={false}
          scroll={{ x: 'max-content' }}
          columns={[
            {
              title: <span className="sr-only">{t('scan')}</span>,
              width: 40,
              render: (_: unknown, r: Line) => (
                <Button
                  type="text"
                  size="small"
                  icon={<ScanOutlined />}
                  aria-label={t('scanBarcode')}
                  onClick={() => setScanLineKey(r._key)}
                />
              ),
            },
            {
              title: t('item'),
              dataIndex: 'itemId',
              width: 180,
              render: (v: string, r: Line) => (
                <ItemAutoComplete
                  value={v}
                  disabled={readonly}
                  wsId={workspaceId}
                  firmId={firmId}
                  onChange={(val) => updateLine(r._key, { itemId: val })}
                />
              ),
            },
            {
              title: t('lot'),
              width: 150,
              render: (_: unknown, r: Line) =>
                r.itemTrackBatch ? (
                  <LotPicker
                    workspaceId={workspaceId}
                    firmId={firmId}
                    itemId={r.itemId}
                    godownId={godownId}
                    value={r.lotId}
                    onChange={(v) => updateLine(r._key, { lotId: v })}
                    disabled={readonly}
                  />
                ) : (
                  '-'
                ),
            },
            {
              title: t('qty'),
              width: 100,
              render: (_: unknown, r: Line) => (
                <InputNumber
                  min={0}
                  value={r.qty}
                  disabled={readonly}
                  onChange={(v) => updateLine(r._key, { qty: Number(v) })}
                />
              ),
            },
            {
              title: t('wastage.wastageType'),
              width: 200,
              render: (_: unknown, r: Line) => (
                <Radio.Group
                  value={r.wastageType}
                  disabled={readonly}
                  onChange={(e) => updateLine(r._key, { wastageType: e.target.value })}
                >
                  <Radio value="own_goods">{t('wastage.ownGoods')}</Radio>
                  <Radio value="job_work_material">{t('wastage.jobWork')}</Radio>
                </Radio.Group>
              ),
            },
            {
              title: t('wastage.reasonCode'),
              width: 200,
              render: (_: unknown, r: Line) => (
                <Select
                  value={r.reasonCode}
                  disabled={readonly}
                  style={{ width: '100%' }}
                  onChange={(v) => updateLine(r._key, { reasonCode: v })}
                  options={REASON_CODE_OPTIONS}
                />
              ),
            },
            {
              title: t('wastage.estCost'),
              width: 130,
              render: (_: unknown, r: Line) => (
                <InputNumber
                  min={0}
                  precision={2}
                  value={r.costPaise / 100}
                  disabled={readonly}
                  onChange={(v) => updateLine(r._key, { costPaise: Math.round(Number(v) * 100) })}
                  prefix="₹"
                />
              ),
            },
            {
              title: t('available'),
              width: 180,
              render: (_: unknown, r: Line) =>
                godownId && r.itemId ? (
                  <AvailabilityBadge
                    workspaceId={workspaceId}
                    firmId={firmId}
                    itemId={r.itemId}
                    godownId={godownId}
                    requiredQty={r.qty}
                  />
                ) : null,
            },
            {
              title: t('remarks'),
              width: 150,
              render: (_: unknown, r: Line) => (
                <Input
                  value={r.remarks}
                  disabled={readonly}
                  onChange={(e) => updateLine(r._key, { remarks: e.target.value })}
                  placeholder={t('remarksPlaceholder')}
                />
              ),
            },
            {
              title: <span className="sr-only">{t('deleteCol')}</span>,
              width: 60,
              render: (_: unknown, r: Line) =>
                !readonly && (
                  <Button type="link" danger size="small" onClick={() => removeLine(r._key)}>
                    {t('remove')}
                  </Button>
                ),
            },
          ]}
          footer={() =>
            !readonly && (
              <Button type="dashed" block onClick={addLine}>
                {t('addLine')}
              </Button>
            )
          }
        />
      </DsCard>

      {/* Summary card */}
      <DsCard style={{ marginBottom: 16, maxWidth: 320, marginLeft: 'auto' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: 'var(--cr-text-4)',
            marginBottom: 8,
          }}
        >
          {t('wastage.doubleEntrySummary')}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span style={{ color: 'var(--cr-text-2)', fontSize: 13 }}>
            {t('wastage.drWastageExpense')}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--cr-error)' }}>₹{totalCostRupees}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 4,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--cr-text-4)',
            }}
          >
            {t('wastage.totalWastageCost')}
          </span>
          <span style={{ fontWeight: 600, fontSize: 13 }}>₹{totalCostRupees}</span>
        </div>
      </DsCard>

      <Form.Item name="narration" label={t('narration')}>
        <Input.TextArea rows={2} disabled={readonly} />
      </Form.Item>

      {!readonly && (
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
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="ghost" onClick={handleSaveDraft} loading={saving}>
            {t('saveDraft')}
          </DsButton>
          {initial && (
            <Popconfirm
              title={t('wastage.postConfirmTitle')}
              description={t('wastage.postConfirmDesc')}
              okText={t('postVoucher')}
              cancelText={t('cancel')}
              onConfirm={handlePost}
            >
              <DsButton dsVariant="primary" loading={saving}>
                {t('postVoucher')}
              </DsButton>
            </Popconfirm>
          )}
        </div>
      )}

      {scanLineKey && (
        <BarcodeScanModal
          open={!!scanLineKey}
          onClose={() => setScanLineKey(null)}
          onScan={(value) => {
            updateLine(scanLineKey, { itemId: value });
            setScanLineKey(null);
          }}
        />
      )}
    </Form>
  );
}
