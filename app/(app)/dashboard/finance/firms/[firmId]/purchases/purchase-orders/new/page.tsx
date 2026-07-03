'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Form, DatePicker, Input, Select, Space, Divider, message, Typography } from 'antd';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { createPurchaseOrder, confirmPurchaseOrder } from '@/lib/actions/finance-purchases.actions';
import { listParties } from '@/lib/actions/finance.actions';
import DsButton from '@/components/ui/DsButton';
import PurchaseBillLineItemsTable from '@/components/finance/purchases/PurchaseBillLineItemsTable';
import type { PurchaseOrder, PurchaseLineItem, Party } from '@/types';

function sumPaise(items: PurchaseLineItem[], key: keyof PurchaseLineItem): number {
  return items.reduce((s, item) => s + ((item[key] as number) || 0), 0);
}

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function NewPurchaseOrderPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.editor');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [form] = Form.useForm();
  const [parties, setParties] = useState<Party[]>([]);
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    listParties(wsId, firmId)
      .then((r) => setParties((r as { items?: Party[] })?.items ?? []))
      .catch(() => {});
  }, [wsId, isHydrated, firmId]);

  const grandTotalPaise = sumPaise(lineItems, 'lineTotalPaise');

  async function handleSubmit(values: Record<string, unknown>) {
    if (!wsId) {
      message.error(t('workspaceNotLoaded'));
      return;
    }
    setSubmitting(true);
    try {
      const dto = {
        financialYear: dayjs().format('YYYY-YY'),
        voucherDate: (values.voucherDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        partyId: values.partyId as string,
        expectedDeliveryDate: values.expectedDeliveryDate
          ? (values.expectedDeliveryDate as dayjs.Dayjs).format('YYYY-MM-DD')
          : undefined,
        notes: (values.notes as string) || undefined,
        lineItems,
      };
      const order = await createPurchaseOrder(wsId, firmId, dto);
      message.success(t('order.created'));
      router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-orders/${order._id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('order.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 24, fontSize: 22 }}>
        {t('newOrderTitle')}
      </Typography.Title>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 900 }}
        initialValues={{ voucherDate: dayjs() }}
      >
        <Space wrap size={16}>
          <Form.Item
            label={t('order.date')}
            name="voucherDate"
            rules={[{ required: true }]}
            style={{ minWidth: 180 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('order.vendor')} name="partyId" style={{ minWidth: 240 }}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('order.selectVendor')}
              options={parties.map((p) => ({ value: p._id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item
            label={t('order.expectedDelivery')}
            name="expectedDeliveryDate"
            style={{ minWidth: 180 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('order.notes')} name="notes" style={{ minWidth: 300 }}>
            <Input.TextArea rows={1} placeholder={t('order.notesPlaceholder')} />
          </Form.Item>
        </Space>

        <Divider>{t('lineItems')}</Divider>
        <PurchaseBillLineItemsTable lineItems={lineItems} onChange={setLineItems} />

        <div
          style={{
            textAlign: 'right',
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--cr-surface-2)',
            borderRadius: 8,
          }}
        >
          <div
            style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--cr-text-1)' }}
            aria-label={t('grandTotalAria', { amount: formatPaise(grandTotalPaise) })}
          >
            {t('grandTotal', { amount: formatPaise(grandTotalPaise) })}
          </div>
        </div>

        <Space style={{ marginTop: 24 }}>
          <DsButton
            dsVariant="ghost"
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-orders`)
            }
          >
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
            {t('order.create')}
          </DsButton>
        </Space>
      </Form>
    </div>
  );
}
