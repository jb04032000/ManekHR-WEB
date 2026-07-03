'use client';
import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  DatePicker,
  Select,
  Space,
  Divider,
  message,
  Typography,
  Alert,
  Switch,
  Modal,
  Button,
} from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { useWorkspaceStore } from '@/lib/store';
import {
  createPurchaseBill,
  postPurchaseBill,
  listPurchaseBills,
} from '@/lib/actions/finance-purchases.actions';
import { listParties, createParty, gstinLookup } from '@/lib/actions/finance.actions';
import { GST_STATE_CODES } from '@/lib/billing/gst-states';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import PurchaseBillLineItemsTable from './PurchaseBillLineItemsTable';
import TdsInfoBox from './TdsInfoBox';
import type {
  PurchaseBill,
  PurchaseOrder,
  GoodsReceiptNote,
  PurchaseLineItem,
  Party,
} from '@/types';

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/** Returns Indian Financial Year string (April-start). E.g. April 2026 → "2026-27", Jan 2026 → "2025-26" */
function currentFinancialYear(): string {
  const now = dayjs();
  const year = now.month() >= 3 ? now.year() : now.year() - 1; // month() is 0-based; April = 3
  return `${year}-${String(year + 1).slice(-2)}`;
}

interface Props {
  firmId: string;
  wsId: string;
  initialBill?: Partial<PurchaseBill>;
  sourcePo?: PurchaseOrder;
  sourceGrn?: GoodsReceiptNote;
  onSaved: (bill: PurchaseBill) => void;
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

function sumPaise(items: PurchaseLineItem[], key: keyof PurchaseLineItem): number {
  return items.reduce((s, item) => s + ((item[key] as number) || 0), 0);
}

export default function PurchaseBillForm({
  firmId,
  wsId,
  initialBill,
  sourcePo,
  sourceGrn,
  onSaved,
}: Props) {
  const t = useTranslations('finance.purchases');
  const [form] = Form.useForm();
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [parties, setParties] = useState<Party[]>([]);
  const [lineItems, setLineItems] = useState<PurchaseLineItem[]>(
    initialBill?.lineItems ??
      sourcePo?.lineItems ??
      sourceGrn?.lineItems?.map((l) => ({
        itemName: l.itemName ?? '',
        qty: l.qtyReceived ?? l.qtyOrdered ?? 1,
        unit: l.unit,
        ratePaise: l.ratePaise ?? 0,
        lineTotalPaise: 0,
      })) ??
      [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [savedBill, setSavedBill] = useState<PurchaseBill | null>(null);

  // ── Inline vendor quick-create (mirrors the sales invoice editor) ──
  const [createPartyOpen, setCreatePartyOpen] = useState(false);
  const [partySearch, setPartySearch] = useState('');
  const [creatingParty, setCreatingParty] = useState(false);
  const [gstinFetching, setGstinFetching] = useState(false);
  const [partyForm] = Form.useForm();

  const openPartyCreate = (presetName: string) => {
    partyForm.resetFields();
    partyForm.setFieldsValue({ partyType: 'vendor', name: presetName });
    setCreatePartyOpen(true);
  };

  const fetchPartyGstin = async () => {
    const gstin = String(partyForm.getFieldValue('gstin') ?? '').trim();
    if (!gstin) {
      message.warning(t('editor.bill.enterGstinToFetch'));
      return;
    }
    setGstinFetching(true);
    try {
      const info = await gstinLookup(wsId, gstin, firmId);
      partyForm.setFieldsValue({ name: info.legalName, state: info.stateCode });
      message.success(t('editor.bill.gstinFetched'));
    } catch {
      message.error(t('editor.bill.gstinFetchFailed'));
    } finally {
      setGstinFetching(false);
    }
  };

  const submitPartyCreate = async () => {
    let values: Record<string, unknown>;
    try {
      values = await partyForm.validateFields();
    } catch {
      return;
    }
    setCreatingParty(true);
    try {
      const created = (await createParty(
        wsId,
        firmId,
        values as Parameters<typeof createParty>[2],
      )) as Party;
      setParties((prev) => [created, ...prev]);
      form.setFieldsValue({ partyId: created._id });
      setCreatePartyOpen(false);
      message.success(t('editor.bill.vendorAdded', { name: created.name }));
    } catch {
      message.error(t('editor.bill.vendorCreateFailed'));
    } finally {
      setCreatingParty(false);
    }
  };

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    listParties(wsId, firmId)
      .then((r) => setParties((r as { items?: Party[] })?.items ?? []))
      .catch(() => {});
  }, [wsId, isHydrated, firmId]);

  // Totals
  const taxableValuePaise = sumPaise(lineItems, 'taxableValuePaise');
  const cgstPaise = sumPaise(lineItems, 'cgstPaise');
  const sgstPaise = sumPaise(lineItems, 'sgstPaise');
  const igstPaise = sumPaise(lineItems, 'igstPaise');
  const grandTotalPaise = sumPaise(lineItems, 'lineTotalPaise');

  async function handleSaveDraft(values: Record<string, unknown>) {
    if (!wsId) {
      message.error(t('editor.workspaceNotLoaded'));
      return;
    }
    setSubmitting(true);
    try {
      const dto = {
        financialYear: currentFinancialYear(),
        voucherDate: (values.voucherDate as dayjs.Dayjs).format('YYYY-MM-DD'),
        vendorBillNumber: values.vendorBillNumber as string,
        vendorBillDate: values.vendorBillDate
          ? (values.vendorBillDate as dayjs.Dayjs).format('YYYY-MM-DD')
          : undefined,
        partyId: values.partyId as string,
        isReverseCharge: Boolean(values.isReverseCharge),
        lineItems,
        sourcePoId: sourcePo?._id,
        sourceGrnId: sourceGrn?._id,
      };
      const bill = await createPurchaseBill(wsId, firmId, dto);
      setSavedBill(bill);
      message.success(t('editor.bill.savedAsDraft'));
      onSaved(bill);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('editor.bill.saveDraftFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePost() {
    if (!savedBill) {
      message.warning(t('editor.bill.saveDraftFirst'));
      return;
    }
    setPosting(true);
    try {
      const bill = await postPurchaseBill(wsId, firmId, savedBill._id, crypto.randomUUID());
      message.success(t('editor.bill.postedSuccessfully'));
      onSaved(bill);
    } catch (e: unknown) {
      const err = e as { message?: string };
      message.error(err?.message ?? t('editor.bill.postFailed'));
    } finally {
      setPosting(false);
    }
  }

  return (
    <div style={{ maxWidth: 900 }}>
      {sourcePo && (
        <Alert
          type="info"
          showIcon
          title={t('editor.bill.linkedToPo', { ref: sourcePo.voucherNumber ?? sourcePo._id })}
          style={{ marginBottom: 16 }}
        />
      )}
      {sourceGrn && (
        <Alert
          type="info"
          showIcon
          title={t('editor.bill.linkedToGrn', { ref: sourceGrn.voucherNumber ?? sourceGrn._id })}
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={handleSaveDraft}
        initialValues={{
          voucherDate: dayjs(),
          partyId: initialBill?.partyId ?? sourcePo?.partyId ?? sourceGrn?.partyId,
        }}
      >
        <Space wrap size={16} style={{ width: '100%' }}>
          <Form.Item
            label={t('editor.bill.voucherDate')}
            name="voucherDate"
            rules={[{ required: true, message: t('editor.bill.selectDate') }]}
            style={{ minWidth: 180 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label={t('editor.bill.vendorBillNumber')}
            name="vendorBillNumber"
            style={{ minWidth: 200 }}
          >
            <Input placeholder={t('editor.bill.vendorBillNumberPlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('editor.bill.vendorBillDate')}
            name="vendorBillDate"
            style={{ minWidth: 180 }}
          >
            <DatePicker format="DD MMM YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label={t('editor.bill.vendor')}
            name="partyId"
            rules={[{ required: true, message: t('editor.bill.selectVendor') }]}
            style={{ minWidth: 240 }}
          >
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t('editor.bill.selectVendorPlaceholder')}
              options={parties.map((p) => ({ value: p._id, label: p.name }))}
              loading={!isHydrated}
              onSearch={(v) => setPartySearch(v)}
              notFoundContent={
                partySearch.trim() ? (
                  <div style={{ padding: '4px 0' }}>
                    <Button
                      type="link"
                      size="small"
                      icon={<PlusOutlined />}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => openPartyCreate(partySearch.trim())}
                    >
                      {t('editor.bill.addNewVendor', { name: partySearch.trim() })}
                    </Button>
                  </div>
                ) : undefined
              }
            />
          </Form.Item>

          <Form.Item
            label={t('editor.bill.reverseCharge')}
            name="isReverseCharge"
            valuePropName="checked"
            tooltip={t('editor.bill.reverseChargeTooltip')}
            style={{ minWidth: 160 }}
          >
            <Switch />
          </Form.Item>
        </Space>

        <Divider>{t('editor.lineItems')}</Divider>
        <PurchaseBillLineItemsTable lineItems={lineItems} onChange={setLineItems} />

        {/* Totals */}
        <div
          style={{
            textAlign: 'right',
            marginTop: 16,
            padding: '12px 16px',
            background: 'var(--cr-surface-2)',
            borderRadius: 8,
          }}
        >
          <div>
            {t('editor.bill.taxable')}: <strong>{formatPaise(taxableValuePaise)}</strong>
          </div>
          <div>
            {t('editor.bill.cgst')}: <strong>{formatPaise(cgstPaise)}</strong>
          </div>
          <div>
            {t('editor.bill.sgst')}: <strong>{formatPaise(sgstPaise)}</strong>
          </div>
          {igstPaise > 0 && (
            <div>
              {t('editor.bill.igst')}: <strong>{formatPaise(igstPaise)}</strong>
            </div>
          )}
          <Divider style={{ margin: '8px 0' }} />
          <Typography.Title level={5} style={{ margin: 0 }}>
            {t('editor.grandTotal', { amount: formatPaise(grandTotalPaise) })}
          </Typography.Title>
        </div>

        {/* RCM self-invoice generated at post (Rule 47A) */}
        {savedBill?.rcmSelfInvoice?.number && (
          <Alert
            type="success"
            showIcon
            style={{ marginTop: 16 }}
            title={t('editor.bill.selfInvoiceGenerated', {
              number: savedBill.rcmSelfInvoice.number,
            })}
            description={
              savedBill.rcmSelfInvoice.dueDate
                ? t('editor.bill.selfInvoiceDueDate', {
                    date: dayjs(savedBill.rcmSelfInvoice.dueDate).format('DD MMM YYYY'),
                  })
                : undefined
            }
          />
        )}

        {/* TDS preview box */}
        {savedBill?.tds194Q && (
          <>
            <Divider>{t('editor.bill.tdsInformation')}</Divider>
            <TdsInfoBox tds194Q={savedBill.tds194Q} />
          </>
        )}

        <Space style={{ marginTop: 24 }}>
          <DsButton dsVariant="ghost" onClick={() => window.history.back()}>
            {t('editor.cancel')}
          </DsButton>
          <DsButton dsVariant="secondary" htmlType="submit" loading={submitting}>
            {t('editor.bill.saveDraft')}
          </DsButton>
          {savedBill && (
            <DsButton dsVariant="primary" onClick={handlePost} loading={posting}>
              {t('editor.bill.postBill')}
            </DsButton>
          )}
        </Space>
      </Form>

      <Modal
        title={t('editor.bill.addVendorTitle')}
        open={createPartyOpen}
        onCancel={() => setCreatePartyOpen(false)}
        onOk={submitPartyCreate}
        okText={t('editor.bill.createAndSelect')}
        confirmLoading={creatingParty}
        destroyOnHidden
      >
        <Form form={partyForm} layout="vertical" requiredMark="optional">
          <Form.Item
            label={t('editor.bill.partyType')}
            name="partyType"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'vendor', label: t('editor.bill.vendorOption') },
                { value: 'customer', label: t('editor.bill.customerOption') },
              ]}
            />
          </Form.Item>
          <Form.Item
            label={t('editor.bill.gstin')}
            name="gstin"
            normalize={(v?: string) => (v ? v.toUpperCase() : v)}
            rules={[
              {
                pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/,
                message: t('editor.bill.gstinInvalid'),
              },
            ]}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder={t('editor.bill.gstinPlaceholder')} />
              <Button loading={gstinFetching} onClick={fetchPartyGstin} icon={<SearchOutlined />}>
                {t('editor.bill.fetch')}
              </Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item
            label={t('editor.bill.name')}
            name="name"
            rules={[{ required: true, message: t('editor.bill.nameRequired') }]}
          >
            <Input placeholder={t('editor.bill.namePlaceholder')} />
          </Form.Item>
          <Form.Item label={t('editor.bill.state')} name="state">
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={t('editor.bill.selectState')}
              options={GST_STATE_CODES.map((s) => ({
                value: s.code,
                label: `${s.code} - ${s.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item label={t('editor.bill.phone')} name="phone">
            <Input placeholder={t('editor.bill.phonePlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
