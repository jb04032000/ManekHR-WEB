'use client';
import React, { useState, useEffect } from 'react';
import { Form, Select, DatePicker, Input, InputNumber, Space, Divider, message, Alert } from 'antd';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import { createPaymentOut, postPaymentOut } from '@/lib/actions/finance-purchases.actions';
import { listParties } from '@/lib/actions/finance.actions';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import PaymentOutBillAllocationTable from './PaymentOutBillAllocationTable';
import type { PaymentOut, PaymentOutBillAllocation, Party } from '@/types';

/** Indian Financial Year (April-start) of the given date. Apr 2026 -> "2026-27", Jan 2026 -> "2025-26". */
function financialYearOf(date: dayjs.Dayjs): string {
  const year = date.month() >= 3 ? date.year() : date.year() - 1; // month() is 0-based; April = 3
  return `${year}-${String(year + 1).slice(-2)}`;
}

const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
];

interface Props {
  firmId: string;
  wsId: string;
  partyId?: string;
  onSaved: (out: PaymentOut) => void;
}

export default function PaymentOutForm({ firmId, wsId, partyId: initialPartyId, onSaved }: Props) {
  const t = useTranslations('finance.purchases');
  const [form] = Form.useForm();
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(initialPartyId ?? null);
  const [allocations, setAllocations] = useState<PaymentOutBillAllocation[]>([]);
  const [totalAmountPaise, setTotalAmountPaise] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [savedOut, setSavedOut] = useState<PaymentOut | null>(null);

  // Estimated TDS preview (client-side, informational only - server is authoritative)
  const selectedParty = parties.find((p) => p._id === selectedPartyId);
  const supplierType = (selectedParty as any)?.supplierType as string | undefined;
  const tdsRatePreview =
    supplierType === 'contractor'
      ? 1
      : supplierType === 'broker'
        ? 5
        : supplierType === 'professional'
          ? 10
          : null;
  const estimatedTdsPaise =
    tdsRatePreview !== null ? Math.round(totalAmountPaise * (tdsRatePreview / 100)) : null;

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    listParties(wsId, firmId)
      .then((r) => setParties((r as { items?: Party[] })?.items ?? []))
      .catch(() => {});
  }, [wsId, isHydrated, firmId]);

  useEffect(() => {
    if (initialPartyId) {
      form.setFieldValue('partyId', initialPartyId);
    }
  }, [initialPartyId, form]);

  function buildDto(values: Record<string, unknown>) {
    return {
      financialYear: financialYearOf(values.paymentDate as dayjs.Dayjs),
      paymentDate: (values.paymentDate as dayjs.Dayjs).format('YYYY-MM-DD'),
      partyId: selectedPartyId as string,
      paymentMode: values.paymentMode as string,
      referenceNo: (values.referenceNo as string) || undefined,
      referenceDate: values.referenceDate
        ? (values.referenceDate as dayjs.Dayjs).format('YYYY-MM-DD')
        : undefined,
      totalAmountPaise,
      billAllocations: allocations.map((a) => ({
        billId: a.billId,
        billNumber: a.billNumber,
        billDuePaise: a.billDuePaise,
        allocatedPaise: a.allocatedPaise,
      })),
    };
  }

  async function handleSaveDraft(values: Record<string, unknown>) {
    if (!wsId || !selectedPartyId) {
      message.error(t('editor.payment.selectVendor'));
      return;
    }
    setSubmitting(true);
    try {
      const out = await createPaymentOut(wsId, firmId, buildDto(values));
      setSavedOut(out);
      message.success(t('editor.payment.savedAsDraft'));
      onSaved(out);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('editor.payment.saveFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  // Create + post in one step, mirroring the receipt flow so both surfaces share
  // a single "save & post" action (was receipt=create+post in 1 step vs
  // payment-out=save-draft then post in 2 steps).
  async function handleSaveAndPost() {
    if (!wsId || !selectedPartyId) {
      message.error(t('editor.payment.selectVendor'));
      return;
    }
    let values: Record<string, unknown>;
    try {
      values = await form.validateFields();
    } catch {
      return; // field-level errors are surfaced inline by the form
    }
    setSubmitting(true);
    try {
      const out = await createPaymentOut(wsId, firmId, buildDto(values));
      const posted = await postPaymentOut(wsId, firmId, out._id, crypto.randomUUID());
      message.success(t('editor.payment.savedAndPosted'));
      onSaved(posted);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('editor.payment.saveAndPostFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost() {
    if (!savedOut) {
      message.warning(t('editor.payment.saveDraftFirst'));
      return;
    }
    setPosting(true);
    try {
      const out = await postPaymentOut(wsId, firmId, savedOut._id, crypto.randomUUID());
      message.success(t('editor.payment.postedSuccessfully'));
      onSaved(out);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('editor.payment.postFailed'));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      {estimatedTdsPaise !== null && estimatedTdsPaise > 0 && (
        <Alert
          type="info"
          showIcon
          title={t('editor.payment.estimatedTds', {
            rate: tdsRatePreview ?? '',
            type: supplierType ?? '',
            amount: `₹${(estimatedTdsPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          })}
          description={t('editor.payment.tdsPreviewNote')}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveDraft}
        initialValues={{ paymentDate: dayjs() }}
      >
        <Space wrap size={16} style={{ width: '100%' }}>
          <Form.Item
            label={t('editor.payment.paymentDate')}
            name="paymentDate"
            rules={[{ required: true, message: t('editor.payment.selectDate') }]}
            style={{ minWidth: 180 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label={t('editor.payment.vendor')}
            name="partyId"
            rules={[{ required: true, message: t('editor.payment.selectVendor') }]}
            style={{ minWidth: 240 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('editor.payment.selectVendorPlaceholder')}
              options={parties.map((p) => ({ value: p._id, label: p.name }))}
              onChange={(val: string) => {
                setSelectedPartyId(val);
                setAllocations([]);
              }}
              loading={!isHydrated}
            />
          </Form.Item>

          <Form.Item
            label={t('editor.payment.paymentMode')}
            name="paymentMode"
            rules={[{ required: true, message: t('editor.payment.selectMode') }]}
            style={{ minWidth: 180 }}
          >
            <Select
              options={PAYMENT_MODE_OPTIONS}
              placeholder={t('editor.payment.selectPlaceholder')}
            />
          </Form.Item>

          <Form.Item
            label={t('editor.payment.totalAmount')}
            name="totalAmountRupees"
            rules={[{ required: true }]}
            style={{ minWidth: 180 }}
          >
            <InputNumber
              min={0.01}
              precision={2}
              style={{ width: '100%' }}
              prefix="₹"
              onChange={(v) => setTotalAmountPaise(Math.round((v ?? 0) * 100))}
            />
          </Form.Item>

          <Form.Item label={t('editor.payment.refNo')} name="referenceNo" style={{ minWidth: 180 }}>
            <Input placeholder={t('editor.payment.refNoPlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('editor.payment.refDate')}
            name="referenceDate"
            style={{ minWidth: 160 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>
        </Space>

        {selectedPartyId && (
          <>
            <Divider>{t('editor.payment.billAllocation')}</Divider>
            <PaymentOutBillAllocationTable
              partyId={selectedPartyId}
              firmId={firmId}
              wsId={wsId}
              allocations={allocations}
              onChange={setAllocations}
              totalAmountPaise={totalAmountPaise}
              onRequestTotal={(paise) => {
                setTotalAmountPaise(paise);
                form.setFieldValue('totalAmountRupees', paise / 100);
              }}
            />
          </>
        )}

        <Space style={{ marginTop: 24 }}>
          <DsButton dsVariant="ghost" onClick={() => window.history.back()}>
            {t('editor.payment.cancel')}
          </DsButton>
          <DsButton dsVariant="secondary" htmlType="submit" loading={submitting}>
            {t('editor.payment.saveDraft')}
          </DsButton>
          {!savedOut && (
            <DsButton dsVariant="primary" onClick={handleSaveAndPost} loading={submitting}>
              {t('editor.payment.saveAndPost')}
            </DsButton>
          )}
          {savedOut && (
            <DsButton dsVariant="primary" onClick={handlePost} loading={posting}>
              {t('editor.payment.postPayment')}
            </DsButton>
          )}
        </Space>
      </Form>
    </div>
  );
}
