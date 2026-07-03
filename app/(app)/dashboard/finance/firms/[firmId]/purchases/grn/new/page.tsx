'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Form, DatePicker, Input, Select, Space, Divider, message, Typography, Alert } from 'antd';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { createGrn, confirmGrn, getPurchaseOrder } from '@/lib/actions/finance-purchases.actions';
import { listParties } from '@/lib/actions/finance.actions';
import DsButton from '@/components/ui/DsButton';
import type { GoodsReceiptNote, Party, PurchaseOrder } from '@/types';

export default function NewGrnPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.editor');
  const searchParams = useSearchParams();
  const sourcePoId = searchParams.get('sourcePoId');

  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [form] = Form.useForm();
  const [parties, setParties] = useState<Party[]>([]);
  const [sourcePo, setSourcePo] = useState<PurchaseOrder | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    listParties(wsId, firmId)
      .then((r) => setParties((r as { items?: Party[] })?.items ?? []))
      .catch(() => {});
    if (sourcePoId) {
      getPurchaseOrder(wsId, firmId, sourcePoId)
        .then((po) => {
          setSourcePo(po);
          form.setFieldValue('partyId', po.partyId);
        })
        .catch(() => {});
    }
  }, [wsId, isHydrated, firmId, sourcePoId, form]);

  async function handleSubmit(values: Record<string, unknown>) {
    if (!wsId) {
      message.error(t('workspaceNotLoaded'));
      return;
    }
    setSubmitting(true);
    try {
      const lineItems =
        sourcePo?.lineItems?.map((l) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          qtyOrdered: l.qty,
          qtyReceived: l.qty,
          unit: l.unit,
          ratePaise: l.ratePaise,
        })) ?? [];

      const dto = {
        financialYear: dayjs().format('YYYY-YY'),
        voucherDate: (values.voucherDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        partyId: values.partyId as string,
        sourcePoId: sourcePoId ?? undefined,
        vendorDeliveryNoteNumber: (values.vendorDeliveryNoteNumber as string) || undefined,
        lineItems,
      };
      const grn = await createGrn(wsId, firmId, dto);
      // Immediately confirm GRN (mark as received)
      const confirmed = await confirmGrn(wsId, firmId, grn._id);
      message.success(t('grnForm.created'));
      router.push(`/dashboard/finance/firms/${firmId}/purchases/grn/${confirmed._id}`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('grnForm.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <Typography.Title level={1} style={{ marginBottom: 24, fontSize: 22 }}>
        {t('newGrnTitle')}
      </Typography.Title>
      {sourcePo && (
        <Alert
          type="info"
          showIcon
          title={t('grnForm.linkedToPo', { ref: sourcePo.voucherNumber ?? sourcePo._id })}
          style={{ marginBottom: 16 }}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        style={{ maxWidth: 700 }}
        initialValues={{ voucherDate: dayjs() }}
      >
        <Space wrap size={16}>
          <Form.Item
            label={t('grnForm.receiptDate')}
            name="voucherDate"
            rules={[{ required: true }]}
            style={{ minWidth: 180 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('grnForm.vendor')} name="partyId" style={{ minWidth: 240 }}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('grnForm.selectVendor')}
              options={parties.map((p) => ({ value: p._id, label: p.name }))}
            />
          </Form.Item>
          <Form.Item
            label={t('grnForm.deliveryNote')}
            name="vendorDeliveryNoteNumber"
            style={{ minWidth: 200 }}
          >
            <Input placeholder={t('grnForm.deliveryNotePlaceholder')} />
          </Form.Item>
        </Space>

        <Space style={{ marginTop: 24 }}>
          <DsButton
            dsVariant="ghost"
            onClick={() => router.push(`/dashboard/finance/firms/${firmId}/purchases/grn`)}
          >
            {t('cancel')}
          </DsButton>
          <DsButton dsVariant="primary" htmlType="submit" loading={submitting}>
            {t('grnForm.createConfirm')}
          </DsButton>
        </Space>
      </Form>
    </div>
  );
}
