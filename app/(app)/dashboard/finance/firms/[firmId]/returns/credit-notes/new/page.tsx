'use client';

import { startTransition, useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Form,
  Button,
  Select,
  DatePicker,
  InputNumber,
  Input,
  Alert,
  Tooltip,
  Tag,
  Skeleton,
  message,
  Divider,
  Typography,
  Space,
  Switch,
} from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getSaleInvoice } from '@/lib/actions/finance.actions';
import {
  createCreditNote,
  postCreditNote,
  listCreditNotesByInvoice,
} from '@/lib/actions/finance-returns.actions';
// Phase 17 / D-04 - non-blocking warning when source-invoice party is blacklisted.
import BlacklistedPartyWarning from '@/components/parties/BlacklistedPartyWarning';
import type { SaleInvoice, CreditNote, LineItem } from '@/types';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

/** 30 Nov of the calendar year following the FY end year (statutory CN deadline) */
function computeDeadline(financialYear: string): Date {
  // financialYear format e.g. "2024-25"
  // startYear + 1 = FY end year (e.g. 2025 for FY 2024-25)
  // Deadline is 30 Nov of the year AFTER FY end = startYear + 1
  const startYear = parseInt(financialYear.split('-')[0], 10);
  return new Date(startYear + 1, 10, 30); // Month 10 = November (0-indexed)
}

interface LineFormItem {
  itemId?: string;
  itemName?: string;
  hsnSacCode?: string;
  originalQty?: number;
  qty?: number;
  unit?: string;
  ratePaise?: number;
  discountPct?: number;
  taxRate?: number;
  reverseStock?: boolean;
}

export default function NewCreditNotePage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.purchases.returns.cnEditor');
  const searchParams = useSearchParams();
  const sourceInvoiceId = searchParams.get('sourceInvoiceId');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const CN_TYPE_OPTIONS = [
    { value: 'goods_return', label: t('cnType_goods_return') },
    { value: 'price_correction', label: t('cnType_price_correction') },
    { value: 'post_sale_discount', label: t('cnType_post_sale_discount') },
    { value: 'deficiency', label: t('cnType_deficiency') },
    { value: 'other', label: t('cnType_other') },
  ];

  const REASON_CODE_OPTIONS = [
    { value: 'sales_return', label: t('reason_sales_return') },
    { value: 'post_sale_discount', label: t('reason_post_sale_discount') },
    { value: 'deficiency_in_services', label: t('reason_deficiency_in_services') },
    { value: 'correction_in_invoice', label: t('reason_correction_in_invoice') },
    { value: 'change_in_pos', label: t('reason_change_in_pos') },
    {
      value: 'finalization_of_provisional_assessment',
      label: t('reason_finalization_of_provisional_assessment'),
    },
    { value: 'others', label: t('reason_others') },
  ];

  const ITC_REVERSAL_OPTIONS = [
    { value: 'pending', label: t('itc_pending') },
    { value: 'self_declared', label: t('itc_self_declared') },
    { value: 'ca_certified', label: t('itc_ca_certified') },
    { value: 'not_applicable', label: t('itc_not_applicable') },
  ];

  const [form] = Form.useForm();
  const [invoice, setInvoice] = useState<SaleInvoice | null>(null);
  const [existingCNs, setExistingCNs] = useState<CreditNote[]>([]);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [lineItems, setLineItems] = useState<LineFormItem[]>([]);
  const [cnType, setCnType] = useState<string>('goods_return');
  const [voucherDate, setVoucherDate] = useState<Dayjs>(dayjs());
  const [recipientItcReversalStatus, setRecipientItcReversalStatus] = useState<string>('pending');

  // Load source invoice
  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId || !sourceInvoiceId) return;
    startTransition(() => {
      setLoadingInvoice(true);
    });
    Promise.all([
      getSaleInvoice(workspaceId, firmId, sourceInvoiceId),
      listCreditNotesByInvoice(workspaceId, firmId, sourceInvoiceId),
    ])
      .then(([inv, cns]) => {
        setInvoice(inv);
        setExistingCNs(cns.filter((c) => c.state === 'posted'));
        // Pre-fill line items
        const prefilled: LineFormItem[] = (inv.lineItems ?? []).map((l: LineItem) => ({
          itemId: typeof l.itemId === 'string' ? l.itemId : undefined,
          itemName: typeof l.itemName === 'string' ? l.itemName : undefined,
          hsnSacCode: typeof l.hsnSacCode === 'string' ? l.hsnSacCode : undefined,
          originalQty: typeof l.qty === 'number' ? l.qty : 1,
          qty: typeof l.qty === 'number' ? l.qty : 1,
          unit: typeof l.unit === 'string' ? l.unit : undefined,
          ratePaise: typeof l.ratePaise === 'number' ? l.ratePaise : 0,
          discountPct: typeof l.discountPct === 'number' ? l.discountPct : 0,
          taxRate: typeof l.taxRate === 'number' ? l.taxRate : 0,
          reverseStock: true,
        }));
        setLineItems(prefilled);
      })
      .catch((e: unknown) =>
        message.error((e as { message?: string })?.message ?? t('loadInvoiceFailed')),
      )
      .finally(() => setLoadingInvoice(false));
  }, [workspaceId, isHydrated, firmId, sourceInvoiceId]);

  const isB2B = Boolean((invoice?.partySnapshot as Record<string, unknown> | undefined)?.gstin);
  const grandTotalPaise = invoice?.grandTotalPaise ?? 0;
  const alreadyReturnedPaise = existingCNs.reduce((s, cn) => s + (cn.grandTotalPaise ?? 0), 0);
  const remainingReturnablePaise = Math.max(0, grandTotalPaise - alreadyReturnedPaise);

  // Compute this CN's approximate total from line items
  const thisCnTotalPaise = lineItems.reduce((s, l) => {
    const taxable = (l.qty ?? 0) * (l.ratePaise ?? 0) * (1 - (l.discountPct ?? 0) / 100);
    const tax = taxable * ((l.taxRate ?? 0) / 100);
    return s + taxable + tax;
  }, 0);

  // Derive FY from invoice date (format "YYYY-YY") then compute deadline
  const invoiceFY = invoice
    ? (() => {
        const d = dayjs(invoice.voucherDate);
        const yr = d.year();
        // FY starts April; if month < April → previous FY start
        const fyStart = d.month() < 3 ? yr - 1 : yr;
        return `${fyStart}-${String(fyStart + 1).slice(-2)}`;
      })()
    : '2024-25';
  const deadline = invoice ? computeDeadline(invoiceFY) : null;
  const deadlineExceeded = deadline ? voucherDate.toDate() > deadline : false;

  // Finance Act 2025 submit block
  const itcSubmitBlocked =
    isB2B && recipientItcReversalStatus === 'pending' && thisCnTotalPaise > 50000000; // ₹5,00,000 = 500000 * 100 paise

  const submitDisabled =
    deadlineExceeded || itcSubmitBlocked || thisCnTotalPaise > remainingReturnablePaise;

  const getDisabledReason = () => {
    if (deadlineExceeded && deadline)
      return t('deadlineExpiredReason', { year: deadline.getFullYear() });
    if (itcSubmitBlocked) return t('itcBlockedReason');
    if (thisCnTotalPaise > remainingReturnablePaise) return t('exceedsReturnableReason');
    return '';
  };

  const handleSubmit = useCallback(
    async (postAfterCreate: boolean) => {
      if (!workspaceId || !firmId) return;
      setSubmitting(true);
      try {
        const values = form.getFieldsValue();
        const cn = await createCreditNote(workspaceId, firmId, {
          voucherDate: voucherDate.toISOString(),
          sourceInvoiceId: sourceInvoiceId ?? values.sourceInvoiceId,
          cnType: cnType as 'goods_return',
          reasonCode: values.reasonCode,
          lineItems: lineItems.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            hsnSacCode: l.hsnSacCode,
            qty: l.qty,
            unit: l.unit,
            ratePaise: l.ratePaise,
            discountPct: l.discountPct,
            taxRate: l.taxRate,
            // Only a goods-return puts stock back; price-correction / discount /
            // deficiency notes are pure financial adjustments and must NOT restock.
            reverseStock: cnType === 'goods_return' ? l.reverseStock : false,
          })),
          narration: values.narration,
          notes: values.notes,
          recipientItcReversalStatus: isB2B
            ? (recipientItcReversalStatus as 'pending')
            : 'not_applicable',
          // D11: kasar-vatav / pure trade discount - BE zeroes GST + posts to 5026.
          isCommercial: values.isCommercial,
        });
        if (postAfterCreate) {
          await postCreditNote(workspaceId, firmId, cn._id);
        }
        message.success(postAfterCreate ? t('posted') : t('savedDraft'));
        router.push(`/dashboard/finance/firms/${firmId}/returns/credit-notes/${cn._id}`);
      } catch (e: unknown) {
        message.error((e as { message?: string })?.message ?? t('saveFailed'));
      } finally {
        setSubmitting(false);
      }
    },
    [
      workspaceId,
      firmId,
      form,
      voucherDate,
      sourceInvoiceId,
      cnType,
      lineItems,
      isB2B,
      recipientItcReversalStatus,
      router,
    ],
  );

  if (loadingInvoice) return <Skeleton active style={{ padding: 24 }} />;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginBottom: 24 }}>{t('title')}</h2>

      {/* Phase 17 / D-04 - non-blocking warning when intelligence.blacklisted on source party. */}
      {workspaceId && invoice?.partyId ? (
        <BlacklistedPartyWarning
          wsId={workspaceId}
          partyId={typeof invoice.partyId === 'string' ? invoice.partyId : String(invoice.partyId)}
        />
      ) : null}

      {/* Source Invoice summary */}
      {invoice && (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          title={
            <span>
              {t('sourceInvoice', {
                number: invoice.voucherNumber ?? t('draft'),
                date: dayjs(invoice.voucherDate).format('DD MMM YYYY'),
                total: formatPaise(grandTotalPaise ?? 0),
              })}
              <Text type="warning">
                {t('remainingReturnable', { amount: formatPaise(remainingReturnablePaise) })}
              </Text>
            </span>
          }
        />
      )}

      {/* 30 Nov deadline warning */}
      {deadlineExceeded && deadline && (
        <Alert
          type="error"
          style={{ marginBottom: 16 }}
          title={t('deadlineExpiredBanner', { year: deadline.getFullYear() })}
        />
      )}

      <Form form={form} layout="vertical">
        <Form.Item label={t('voucherDate')} required>
          <DatePicker
            value={voucherDate}
            onChange={(d) => d && setVoucherDate(d)}
            disabledDate={(d) => d.isAfter(dayjs())}
            style={{ width: '100%' }}
          />
        </Form.Item>

        <Form.Item label={t('cnType')} name="cnType" initialValue="goods_return">
          <Select
            options={CN_TYPE_OPTIONS}
            onChange={(v) => {
              setCnType(v as string);
              // Keep each line's restock flag in sync with the note type so the
              // UI matches what will be sent (only goods-returns restock).
              setLineItems((prev) =>
                prev.map((l) => ({ ...l, reverseStock: v === 'goods_return' })),
              );
            }}
          />
        </Form.Item>

        <Form.Item label={t('reasonCode')} name="reasonCode">
          <Select options={REASON_CODE_OPTIONS} allowClear placeholder={t('selectReasonCode')} />
        </Form.Item>

        {/* D11: kasar-vatav / pure trade discount. When on, the BE posts the full value to
            Kasar-Vatav Allowed with NO GST reversal and excludes it from GSTR-1. */}
        <Form.Item
          label={t('isCommercial')}
          name="isCommercial"
          valuePropName="checked"
          initialValue={false}
          tooltip={t('isCommercialHelp')}
        >
          <Switch />
        </Form.Item>

        {/* Line Items */}
        <Divider>{t('lineItems')}</Divider>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead style={{ background: 'var(--cr-neutral-100)' }}>
              <tr>
                {[
                  t('col.item'),
                  t('col.hsn'),
                  t('col.origQty'),
                  t('col.returnQty'),
                  t('col.ratePaise'),
                  t('col.gstPercent'),
                  t('col.reverseStock'),
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
                  <td style={{ padding: '6px 10px' }}>{line.hsnSacCode ?? '-'}</td>
                  <td style={{ padding: '6px 10px' }}>{line.originalQty ?? 0}</td>
                  <td style={{ padding: '6px 10px' }}>
                    <InputNumber
                      min={0}
                      max={line.originalQty}
                      value={line.qty}
                      onChange={(v) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], qty: v ?? 0 };
                        setLineItems(updated);
                      }}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td style={{ padding: '6px 10px' }}>{line.ratePaise ?? 0}</td>
                  <td style={{ padding: '6px 10px' }}>{line.taxRate ?? 0}%</td>
                  <td style={{ padding: '6px 10px' }}>
                    <Select
                      value={line.reverseStock ? 'yes' : 'no'}
                      onChange={(v) => {
                        const updated = [...lineItems];
                        updated[i] = { ...updated[i], reverseStock: v === 'yes' };
                        setLineItems(updated);
                      }}
                      options={[
                        { value: 'yes', label: t('yes') },
                        { value: 'no', label: t('no') },
                      ]}
                      style={{ width: 80 }}
                    />
                  </td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: 16, color: 'var(--cr-text-3)', textAlign: 'center' }}
                  >
                    {t('noLineItemsInvoice')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Divider>{t('summary')}</Divider>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Text>{t('invoiceTotal', { amount: formatPaise(grandTotalPaise) })}</Text>
          <Text>{t('alreadyReturned', { amount: formatPaise(alreadyReturnedPaise) })}</Text>
          <Text strong>
            {t('remainingReturnableLine', { amount: formatPaise(remainingReturnablePaise) })}
          </Text>
          <Text>{t('thisCnAmount', { amount: formatPaise(thisCnTotalPaise) })}</Text>
          {thisCnTotalPaise > remainingReturnablePaise && (
            <Alert type="warning" title={t('exceedsWarning')} />
          )}
        </Space>

        {/* Finance Act 2025 Compliance Panel - B2B only */}
        {isB2B && (
          <>
            <Divider>
              <Space>
                <InfoCircleOutlined style={{ color: 'var(--cr-warning-500)' }} />
                {t('complianceDivider')}
              </Space>
            </Divider>
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title={t('complianceTitle')}
              description={t('complianceBody')}
            />
            <Form.Item
              label={t('itcReversalStatus')}
              name="recipientItcReversalStatus"
              initialValue="pending"
            >
              <Select
                options={ITC_REVERSAL_OPTIONS}
                onChange={(v) => setRecipientItcReversalStatus(v as string)}
              />
            </Form.Item>
            {(recipientItcReversalStatus === 'self_declared' ||
              recipientItcReversalStatus === 'ca_certified') && (
              <Alert type="info" title={t('itcAttachNote')} />
            )}
          </>
        )}

        <Form.Item label={t('narration')} name="narration" style={{ marginTop: 16 }}>
          <Input.TextArea rows={2} placeholder={t('narrationPlaceholder')} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Tooltip title={submitDisabled ? getDisabledReason() : ''}>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={submitDisabled}
                loading={submitting}
              >
                {t('saveDraft')}
              </Button>
            </Tooltip>
            <Tooltip title={submitDisabled ? getDisabledReason() : ''}>
              <Button
                type="primary"
                onClick={() => handleSubmit(true)}
                disabled={submitDisabled}
                loading={submitting}
              >
                {t('saveAndPost')}
              </Button>
            </Tooltip>
            <Button onClick={() => router.back()} disabled={submitting}>
              {t('cancel')}
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
