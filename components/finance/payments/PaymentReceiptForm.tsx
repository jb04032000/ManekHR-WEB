'use client';
import React, { useEffect, useState, startTransition } from 'react';
import {
  Form,
  Select,
  DatePicker,
  Input,
  InputNumber,
  message,
  Space,
  Typography,
  Divider,
} from 'antd';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import {
  listParties,
  createPaymentReceipt,
  postPaymentReceipt,
  getOutstandingInvoices,
} from '@/lib/actions/finance.actions';
import DsButton from '@/components/ui/DsButton';
import PaymentAllocationTable, { type AllocationRow } from './PaymentAllocationTable';
import type { Party, OutstandingInvoice, CreatePaymentReceiptPayload } from '@/types';

const PAYMENT_MODE_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'neft', label: 'NEFT' },
  { value: 'rtgs', label: 'RTGS' },
  { value: 'imps', label: 'IMPS' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'cashfree', label: 'Cashfree' },
];

interface Props {
  firmId: string;
}

export default function PaymentReceiptForm({ firmId }: Props) {
  const router = useRouter();
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [form] = Form.useForm();
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string | null>(null);
  const [outstandingInvoices, setOutstandingInvoices] = useState<OutstandingInvoice[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  // Load parties
  useEffect(() => {
    if (!wsId || !isHydrated) return;
    listParties(wsId, firmId)
      .then((r) => setParties((r as { items?: Party[] })?.items ?? []))
      .catch(() => {});
  }, [wsId, isHydrated, firmId]);

  // Load outstanding invoices when party is selected
  useEffect(() => {
    if (!wsId || !isHydrated || !selectedPartyId) {
      startTransition(() => {
        setOutstandingInvoices([]);
        setAllocations([]);
      });
      return;
    }
    startTransition(() => {
      setLoadingInvoices(true);
    });
    getOutstandingInvoices(wsId, firmId, selectedPartyId)
      .then(setOutstandingInvoices)
      .catch(() => setOutstandingInvoices([]))
      .finally(() => setLoadingInvoices(false));
  }, [wsId, isHydrated, firmId, selectedPartyId]);

  const allocatedTotal = allocations.reduce((s, a) => s + a.allocatedPaise / 100, 0);
  const unapplied = totalAmount - allocatedTotal;

  async function handleSubmit(values: Record<string, unknown>) {
    if (!wsId) {
      message.error('Workspace not loaded');
      return;
    }

    // Indian financial year (April-start) of the RECEIPT date, so a back-dated
    // receipt lands in the correct FY: 15-Jun-2026 -> "2026-27", 10-Feb-2026 ->
    // "2025-26". (Was dayjs().format('YYYY-YY'), which produced today's year twice,
    // e.g. "2026-26", and ignored the April boundary + the receipt date.)
    const receiptDate = values.receiptDate as dayjs.Dayjs;
    const fyStartYear = receiptDate.month() >= 3 ? receiptDate.year() : receiptDate.year() - 1;

    const payload: CreatePaymentReceiptPayload = {
      financialYear: `${fyStartYear}-${String(fyStartYear + 1).slice(-2)}`,
      receiptDate: receiptDate.format('YYYY-MM-DD'),
      partyId: values.partyId as string,
      paymentMode: values.paymentMode as CreatePaymentReceiptPayload['paymentMode'],
      referenceNo: (values.referenceNo as string | undefined) || undefined,
      totalAmountPaise: Math.round((values.totalAmountRupees as number) * 100),
      allocations: allocations.map((a) => ({
        invoiceId: a.invoiceId,
        invoiceNumber: a.invoiceNumber,
        invoiceDuePaise: a.invoiceDuePaise,
        allocatedPaise: a.allocatedPaise,
      })),
    };

    setSubmitting(true);
    try {
      const receipt = await createPaymentReceipt(wsId, firmId, payload);
      // Immediately post the receipt
      await postPaymentReceipt(wsId, firmId, receipt._id, crypto.randomUUID());
      message.success('Payment receipt created and posted');
      router.push(`/dashboard/finance/firms/${firmId}/payments`);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? 'Failed to create payment receipt');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          label="Party"
          name="partyId"
          rules={[{ required: true, message: 'Select a party' }]}
        >
          <Select
            showSearch
            placeholder="Search party..."
            optionFilterProp="label"
            options={parties.map((p) => ({ value: p._id, label: p.name }))}
            onChange={(val: string) => {
              setSelectedPartyId(val);
              setAllocations([]);
            }}
            loading={!isHydrated}
          />
        </Form.Item>

        <Form.Item
          label="Receipt Date"
          name="receiptDate"
          rules={[{ required: true, message: 'Select a date' }]}
          initialValue={dayjs()}
        >
          <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
        </Form.Item>

        <Form.Item
          label="Payment Mode"
          name="paymentMode"
          rules={[{ required: true, message: 'Select payment mode' }]}
        >
          <Select options={PAYMENT_MODE_OPTIONS} placeholder="Select mode..." />
        </Form.Item>

        <Form.Item label="Reference No. (optional)" name="referenceNo">
          <Input placeholder="UTR / Cheque no. / Transaction ID" />
        </Form.Item>

        <Form.Item
          label="Total Amount (₹)"
          name="totalAmountRupees"
          rules={[
            { required: true, message: 'Enter amount' },
            { type: 'number', min: 0.01, message: 'Amount must be > 0' },
          ]}
        >
          <InputNumber
            min={0.01}
            precision={2}
            style={{ width: '100%' }}
            prefix="₹"
            onChange={(v) => setTotalAmount(v ?? 0)}
          />
        </Form.Item>

        {selectedPartyId && (
          <>
            <Divider>Invoice Allocation</Divider>
            <PaymentAllocationTable
              outstandingInvoices={loadingInvoices ? [] : outstandingInvoices}
              paymentTotalPaise={Math.round(totalAmount * 100)}
              onAllocationsChange={setAllocations}
              onRequestTotal={(paise) => {
                const rupees = paise / 100;
                setTotalAmount(rupees);
                form.setFieldValue('totalAmountRupees', rupees);
              }}
            />
            {unapplied > 0 && (
              <Typography.Text type="warning" style={{ display: 'block', marginTop: 8 }}>
                Advance Credit (unapplied): ₹
                {unapplied.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </Typography.Text>
            )}
            {unapplied < 0 && (
              <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
                Over-allocated by ₹
                {Math.abs(unapplied).toLocaleString('en-IN', { minimumFractionDigits: 2 })} - reduce
                allocation amounts
              </Typography.Text>
            )}
          </>
        )}

        <Space style={{ marginTop: 24 }}>
          <DsButton
            dsVariant="ghost"
            onClick={() => router.push(`/dashboard/finance/firms/${firmId}/payments`)}
          >
            Cancel
          </DsButton>
          <DsButton
            dsVariant="primary"
            htmlType="submit"
            loading={submitting}
            disabled={unapplied < 0}
          >
            Create &amp; Post Receipt
          </DsButton>
        </Space>
      </Form>
    </div>
  );
}
