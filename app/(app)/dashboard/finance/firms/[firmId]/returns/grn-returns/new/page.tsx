'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Form,
  Button,
  DatePicker,
  InputNumber,
  Input,
  Skeleton,
  message,
  Divider,
  Space,
  Typography,
} from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { getGrn, getPurchaseBill } from '@/lib/actions/finance-purchases.actions';
import { createGrnReturn } from '@/lib/actions/finance-returns.actions';
import type { PurchaseLineItem, GoodsReceiptNote } from '@/types';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

interface LineFormItem {
  itemId?: string;
  itemName?: string;
  originalQty?: number;
  qtyReturned?: number;
  unit?: string;
  ratePaise?: number;
  reason?: string;
  batchNumber?: string;
  notes?: string;
}

export default function NewGrnReturnPage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.purchases.returns.grEditor');
  const searchParams = useSearchParams();
  const sourceGrnId = searchParams.get('sourceGrnId');
  const sourceBillId = searchParams.get('sourceBillId');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lineItems, setLineItems] = useState<LineFormItem[]>([]);
  const [voucherDate, setVoucherDate] = useState<Dayjs>(dayjs());
  const [sourceLabel, setSourceLabel] = useState<string>('');

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId) return;
    if (!sourceGrnId && !sourceBillId) return;
    startTransition(() => {
      setLoading(true);
    });
    const fetchSource = sourceGrnId
      ? getGrn(workspaceId, firmId, sourceGrnId)
      : getPurchaseBill(workspaceId, firmId, sourceBillId!);

    fetchSource
      .then((source) => {
        const vNum = (source as { voucherNumber?: string }).voucherNumber ?? 'Draft';
        const isGrn = (source as GoodsReceiptNote).voucherType === 'grn';
        setSourceLabel(
          isGrn ? t('sourceGrn', { number: vNum }) : t('sourceBill', { number: vNum }),
        );
        // Pre-fill line items - handle GRN (qtyReceived) vs bill (qty)
        if (isGrn) {
          const grnSource = source as GoodsReceiptNote;
          setLineItems(
            (grnSource.lineItems ?? []).map((l) => ({
              itemId: l.itemId,
              itemName: l.itemName ?? '-',
              originalQty: l.qtyReceived ?? 0,
              qtyReturned: l.qtyReceived ?? 0,
              unit: l.unit,
              ratePaise: l.ratePaise ?? 0,
              reason: '',
              batchNumber: l.batchNumber ?? '',
              notes: l.notes ?? '',
            })),
          );
        } else {
          const billSource = source as { lineItems?: PurchaseLineItem[] };
          setLineItems(
            (billSource.lineItems ?? []).map((l: PurchaseLineItem) => ({
              itemId: l.itemId,
              itemName: l.itemName,
              originalQty: l.qty,
              qtyReturned: l.qty,
              unit: l.unit,
              ratePaise: l.ratePaise,
              reason: '',
              batchNumber: '',
              notes: '',
            })),
          );
        }
      })
      .catch((e: unknown) =>
        message.error((e as { message?: string })?.message ?? t('loadSourceFailed')),
      )
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, sourceGrnId, sourceBillId]);

  const handleSubmit = useCallback(async () => {
    if (!workspaceId || !firmId) return;
    setSubmitting(true);
    try {
      const values = form.getFieldsValue();
      const gr = await createGrnReturn(workspaceId, firmId, {
        voucherDate: voucherDate.toISOString(),
        sourceGrnId: sourceGrnId ?? undefined,
        sourceBillId: sourceBillId ?? undefined,
        vendorRmaNumber: values.vendorRmaNumber,
        transport: {
          carrier: values.carrier,
          lrNumber: values.lrNumber,
          dispatchDate: values.dispatchDate?.toISOString(),
        },
        lineItems: lineItems.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          qtyReturned: l.qtyReturned,
          unit: l.unit,
          ratePaise: l.ratePaise,
          reason: l.reason,
          batchNumber: l.batchNumber,
          notes: l.notes,
        })),
        notes: values.notes,
      });
      message.success(t('created'));
      router.push(`/dashboard/finance/firms/${firmId}/returns/grn-returns/${gr._id}`);
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('createFailed'));
    } finally {
      setSubmitting(false);
    }
  }, [workspaceId, firmId, form, voucherDate, sourceGrnId, sourceBillId, lineItems, router]);

  if (loading) return <Skeleton active style={{ padding: 24 }} />;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginBottom: 24 }}>{t('title')}</h2>

      {sourceLabel && (
        <div
          style={{
            marginBottom: 16,
            padding: '8px 12px',
            background: 'var(--cr-info-50)',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <Text type="secondary">{t('sourceLabel')}</Text>
          <Text strong>{sourceLabel}</Text>
        </div>
      )}

      <Form form={form} layout="vertical">
        <Form.Item label={t('returnDate')} required>
          <DatePicker
            value={voucherDate}
            onChange={(d) => d && setVoucherDate(d)}
            disabledDate={(d) => d.isAfter(dayjs())}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={t('vendorRma')} name="vendorRmaNumber">
          <Input placeholder={t('vendorRmaPlaceholder')} />
        </Form.Item>

        {/* Line Items */}
        <Divider>{t('itemsToReturn')}</Divider>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--cr-neutral-100)' }}>
              <tr>
                {[
                  t('col.item'),
                  t('col.origQty'),
                  t('col.qtyReturned'),
                  t('col.reason'),
                  t('col.batchNo'),
                  t('col.notes'),
                ].map((h) => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((line, i) => (
                <tr key={i} style={{ borderTop: '1px solid var(--cr-border-light)' }}>
                  <td style={{ padding: '6px 10px' }}>{line.itemName ?? '-'}</td>
                  <td style={{ padding: '6px 10px' }}>{line.originalQty ?? 0}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <InputNumber
                      min={0}
                      max={line.originalQty}
                      value={line.qtyReturned}
                      onChange={(v) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], qtyReturned: v ?? 0 };
                        setLineItems(updated);
                      }}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <Input
                      value={line.reason}
                      placeholder={t('reasonPlaceholder')}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], reason: e.target.value };
                        setLineItems(updated);
                      }}
                      style={{ width: 140 }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <Input
                      value={line.batchNumber}
                      placeholder={t('batchPlaceholder')}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], batchNumber: e.target.value };
                        setLineItems(updated);
                      }}
                      style={{ width: 100 }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>
                    <Input
                      value={line.notes}
                      placeholder={t('notesPlaceholder')}
                      onChange={(e) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], notes: e.target.value };
                        setLineItems(updated);
                      }}
                      style={{ width: 120 }}
                    />
                  </td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{ padding: 16, color: 'var(--cr-text-3)', textAlign: 'center' }}
                  >
                    {t('noLineItems')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Transport Details */}
        <Divider>{t('transportDetails')}</Divider>
        <Space style={{ width: '100%' }} direction="vertical">
          <Space>
            <Form.Item label={t('carrier')} name="carrier" style={{ marginBottom: 0 }}>
              <Input placeholder={t('carrierPlaceholder')} style={{ width: 200 }} />
            </Form.Item>
            <Form.Item label={t('lrNumber')} name="lrNumber" style={{ marginBottom: 0 }}>
              <Input placeholder={t('lrNumberPlaceholder')} style={{ width: 160 }} />
            </Form.Item>
            <Form.Item label={t('dispatchDate')} name="dispatchDate" style={{ marginBottom: 0 }}>
              <DatePicker style={{ width: 150 }} />
            </Form.Item>
          </Space>
        </Space>

        <Form.Item label={t('notes')} name="notes" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} placeholder={t('notesFieldPlaceholder')} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" onClick={handleSubmit} loading={submitting}>
              {t('createDraft')}
            </Button>
            <Button onClick={() => router.back()} disabled={submitting}>
              {t('cancel')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
