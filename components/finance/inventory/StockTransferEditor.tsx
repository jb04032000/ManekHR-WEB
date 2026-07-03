'use client';
// Finance polish (inventory): user-facing strings localised via finance.inventory.editor
// (shared) + .editor.transfer (screen-specific). Used by the transfers new/[id] pages.
// No data/validation logic changed.
import { useEffect, useState, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Form,
  Input,
  DatePicker,
  InputNumber,
  Popconfirm,
  message,
  Alert,
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
import { ItemAutoComplete } from '../ItemAutoComplete';
import { AvailabilityBadge } from './AvailabilityBadge';
import {
  createStockTransfer,
  updateStockTransfer,
  postStockTransfer,
} from '@/lib/actions/inventory.actions';
import type { StockTransfer, StockTransferLine } from '@/types';

const BarcodeScanModal = dynamic(() => import('./BarcodeScanModal'), {
  ssr: false,
});

interface Line extends StockTransferLine {
  _key: string;
  itemTrackBatch?: boolean;
}

interface Props {
  workspaceId: string;
  firmId: string;
  initial?: StockTransfer | null;
  defaultFromGodownId?: string;
  viewOnly?: boolean;
}

export function StockTransferEditor({
  workspaceId,
  firmId,
  initial,
  defaultFromGodownId,
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

  useEffect(() => {
    if (initial) {
      form.setFieldsValue({
        date: dayjs(initial.date),
        fromGodownId: initial.fromGodownId,
        toGodownId: initial.toGodownId,
        narration: initial.narration,
      });
      startTransition(() => {
        setLines(initial.lines.map((l, i) => ({ ...l, _key: `l${i}` })));
      });
    } else {
      form.setFieldsValue({ date: dayjs(), fromGodownId: defaultFromGodownId });
      startTransition(() => {
        setLines([]);
      });
    }
  }, [initial, defaultFromGodownId, form]);

  const addLine = () =>
    setLines([...lines, { _key: `l${Date.now()}`, itemId: '', qty: 0, serialNos: [] }]);

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines(lines.map((l) => (l._key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: string) => setLines(lines.filter((l) => l._key !== key));

  const fromGodownId = Form.useWatch('fromGodownId', form);
  const toGodownId = Form.useWatch('toGodownId', form);

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      if (values.fromGodownId === values.toGodownId) {
        message.error(t('transfer.godownsDiffer'));
        return;
      }
      setSaving(true);
      const payload = {
        date: dayjs(values.date).toISOString(),
        fromGodownId: values.fromGodownId,
        toGodownId: values.toGodownId,
        lines: lines.map(({ _key, itemTrackBatch, ...l }) => l),
        narration: values.narration,
      };
      if (initial) {
        await updateStockTransfer(workspaceId, firmId, initial._id, payload);
        message.success(t('transfer.updated'));
      } else {
        const created = await createStockTransfer(workspaceId, firmId, payload);
        message.success(t('draftSaved'));
        router.replace(`/dashboard/finance/firms/${firmId}/inventory/transfers/${created._id}`);
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
      await postStockTransfer(workspaceId, firmId, initial._id);
      message.success(t('postedSuccess', { voucher: initial.voucherNo }));
      router.refresh();
    } catch (err: unknown) {
      const e = err as { message?: string };
      message.error(t('cannotPost', { error: e?.message ?? 'unknown error' }));
    } finally {
      setSaving(false);
    }
  };

  const samGodown = fromGodownId && toGodownId && fromGodownId === toGodownId;

  return (
    <Form form={form} layout="vertical">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }}
      >
        <Form.Item name="date" label={t('date')} rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} disabled={readonly} />
        </Form.Item>
        <Form.Item name="fromGodownId" label={t('fromGodown')} rules={[{ required: true }]}>
          <GodownSelector
            firmId={firmId}
            workspaceId={workspaceId}
            value={form.getFieldValue('fromGodownId')}
            onChange={(v) => form.setFieldsValue({ fromGodownId: v })}
            disabled={readonly}
            defaultToFirmDefault={false}
          />
        </Form.Item>
        <Form.Item name="toGodownId" label={t('toGodown')} rules={[{ required: true }]}>
          <GodownSelector
            firmId={firmId}
            workspaceId={workspaceId}
            value={form.getFieldValue('toGodownId')}
            onChange={(v) => form.setFieldsValue({ toGodownId: v })}
            disabled={readonly}
            defaultToFirmDefault={false}
          />
        </Form.Item>
      </div>

      <DsCard style={{ marginBottom: 16 }}>
        <Table
          dataSource={lines}
          rowKey="_key"
          pagination={false}
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
              render: (_: unknown, r: Line) =>
                r.itemTrackBatch ? (
                  <LotPicker
                    workspaceId={workspaceId}
                    firmId={firmId}
                    itemId={r.itemId}
                    godownId={fromGodownId}
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
              title: t('available'),
              width: 200,
              render: (_: unknown, r: Line) =>
                fromGodownId && r.itemId ? (
                  <AvailabilityBadge
                    workspaceId={workspaceId}
                    firmId={firmId}
                    itemId={r.itemId}
                    godownId={fromGodownId}
                    requiredQty={r.qty}
                  />
                ) : null,
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

      <Form.Item name="narration" label={t('narration')}>
        <Input.TextArea rows={2} disabled={readonly} />
      </Form.Item>

      {samGodown && (
        <Alert type="error" title={t('transfer.godownsDifferAlert')} style={{ marginBottom: 16 }} />
      )}

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
              title={t('transfer.postConfirmTitle')}
              description={t('transfer.postConfirmDesc')}
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
