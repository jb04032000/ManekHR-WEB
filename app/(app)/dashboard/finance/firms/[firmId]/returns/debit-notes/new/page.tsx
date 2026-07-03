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
  Checkbox,
} from 'antd';
import { InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getPurchaseBill } from '@/lib/actions/finance-purchases.actions';
import {
  createDebitNote,
  postDebitNote,
  listDebitNotesByBill,
} from '@/lib/actions/finance-returns.actions';
import type { PurchaseBill, DebitNote, PurchaseLineItem } from '@/types';
import dayjs, { Dayjs } from 'dayjs';

const { Text } = Typography;

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

interface LineFormItem {
  itemId?: string;
  itemName?: string;
  hsnSacCode?: string;
  originalQty?: number;
  qty?: number;
  unit?: string;
  ratePaise?: number;
  taxRate?: number;
  isCapitalGoods?: boolean;
}

export default function NewDebitNotePage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.purchases.returns.dnEditor');
  const searchParams = useSearchParams();
  const sourceBillId = searchParams.get('sourceBillId');
  const sourceGrnReturnId = searchParams.get('sourceGrnReturnId');
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const DN_TYPE_OPTIONS = [
    { value: 'goods_return', label: t('dnType_goods_return') },
    { value: 'price_correction', label: t('dnType_price_correction') },
    { value: 'excess_billing', label: t('dnType_excess_billing') },
    { value: 'quality_rejection', label: t('dnType_quality_rejection') },
    { value: 'other', label: t('dnType_other') },
  ];

  const [form] = Form.useForm();
  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [existingDNs, setExistingDNs] = useState<DebitNote[]>([]);
  const [loadingBill, setLoadingBill] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [lineItems, setLineItems] = useState<LineFormItem[]>([]);
  const [dnType, setDnType] = useState<string>('goods_return');
  const [voucherDate, setVoucherDate] = useState<Dayjs>(dayjs());
  const [vendorAccepted, setVendorAccepted] = useState(false);

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId || !sourceBillId) return;
    startTransition(() => {
      setLoadingBill(true);
    });
    Promise.all([
      getPurchaseBill(workspaceId, firmId, sourceBillId),
      listDebitNotesByBill(workspaceId, firmId, sourceBillId),
    ])
      .then(([b, dns]) => {
        setBill(b);
        setExistingDNs(dns.filter((d) => d.state === 'posted'));
        const prefilled: LineFormItem[] = (b.lineItems ?? []).map((l: PurchaseLineItem) => ({
          itemId: l.itemId,
          itemName: l.itemName,
          hsnSacCode: l.hsnSacCode,
          originalQty: l.qty,
          qty: l.qty,
          unit: l.unit,
          ratePaise: l.ratePaise,
          taxRate: l.taxRate,
          isCapitalGoods: l.isCapitalGoods,
        }));
        setLineItems(prefilled);
      })
      .catch((e: unknown) =>
        message.error((e as { message?: string })?.message ?? t('loadBillFailed')),
      )
      .finally(() => setLoadingBill(false));
  }, [workspaceId, isHydrated, firmId, sourceBillId]);

  const grandTotalPaise = bill?.grandTotalPaise ?? 0;
  const alreadyReturnedPaise = existingDNs.reduce((s, dn) => s + (dn.grandTotalPaise ?? 0), 0);
  const remainingReturnablePaise = Math.max(0, grandTotalPaise - alreadyReturnedPaise);

  const thisDnTotalPaise = lineItems.reduce((s, l) => {
    const taxable = (l.qty ?? 0) * (l.ratePaise ?? 0);
    const tax = taxable * ((l.taxRate ?? 0) / 100);
    return s + taxable + tax;
  }, 0);

  const hasCapitalGoods = lineItems.some((l) => l.isCapitalGoods);
  const hasTds = (bill?.tds194Q?.tdsPaise ?? 0) > 0;

  const submitDisabled = thisDnTotalPaise > remainingReturnablePaise;

  const handleSubmit = useCallback(
    async (postAfterCreate: boolean) => {
      if (!workspaceId || !firmId) return;
      setSubmitting(true);
      try {
        const values = form.getFieldsValue();
        const dn = await createDebitNote(workspaceId, firmId, {
          voucherDate: voucherDate.toISOString(),
          sourceBillId: sourceBillId ?? values.sourceBillId,
          sourceGrnReturnId: sourceGrnReturnId ?? undefined,
          vendorBillRef: values.vendorBillRef,
          dnType: dnType as 'goods_return',
          vendorAccepted,
          lineItems: lineItems.map((l) => ({
            itemId: l.itemId,
            itemName: l.itemName,
            hsnSacCode: l.hsnSacCode,
            qty: l.qty,
            unit: l.unit,
            ratePaise: l.ratePaise,
            taxRate: l.taxRate,
          })),
          narration: values.narration,
        });
        if (postAfterCreate) {
          await postDebitNote(workspaceId, firmId, dn._id);
        }
        message.success(postAfterCreate ? t('posted') : t('savedDraft'));
        router.push(`/dashboard/finance/firms/${firmId}/returns/debit-notes/${dn._id}`);
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
      sourceBillId,
      sourceGrnReturnId,
      dnType,
      vendorAccepted,
      lineItems,
      router,
    ],
  );

  if (loadingBill) return <Skeleton active style={{ padding: 24 }} />;

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2 style={{ marginBottom: 24 }}>{t('title')}</h2>

      {/* Source Bill summary */}
      {bill && (
        <Alert
          type="info"
          style={{ marginBottom: 16 }}
          title={
            <span>
              {t('sourceBill', {
                number: bill.voucherNumber ?? t('draft'),
                date: dayjs(bill.voucherDate).format('DD MMM YYYY'),
                total: formatPaise(grandTotalPaise),
              })}
              <Text type="warning">
                {t('remainingReturnable', { amount: formatPaise(remainingReturnablePaise) })}
              </Text>
            </span>
          }
        />
      )}

      {/* TDS-194Q informational panel */}
      {hasTds && bill?.tds194Q && (
        <Alert
          type="warning"
          icon={<InfoCircleOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
          title={t('tdsTitle')}
          description={t('tdsBody', { amount: formatPaise(bill.tds194Q.tdsPaise) })}
        />
      )}

      {/* Capital Goods warning */}
      {hasCapitalGoods && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
          title={t('capitalGoodsTitle')}
          description={t('capitalGoodsBody')}
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

        <Form.Item label={t('dnType')} name="dnType" initialValue="goods_return">
          <Select options={DN_TYPE_OPTIONS} onChange={(v) => setDnType(v as string)} />
        </Form.Item>

        <Form.Item label={t('vendorBillRef')} name="vendorBillRef">
          <Input placeholder={t('vendorBillRefPlaceholder')} />
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
                  t('col.capitalGoods'),
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
                    {line.isCapitalGoods ? (
                      <Tag color="orange">{t('capitalGoodsTag')}</Tag>
                    ) : (
                      <Tag color="default">{t('regularTag')}</Tag>
                    )}
                  </td>
                </tr>
              ))}
              {lineItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{ padding: 16, color: 'var(--cr-text-3)', textAlign: 'center' }}
                  >
                    {t('noLineItemsBill')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Divider>{t('summary')}</Divider>
        <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
          <Text>{t('billTotal', { amount: formatPaise(grandTotalPaise) })}</Text>
          <Text>{t('alreadyReturned', { amount: formatPaise(alreadyReturnedPaise) })}</Text>
          <Text strong>
            {t('remainingReturnableLine', { amount: formatPaise(remainingReturnablePaise) })}
          </Text>
          <Text>{t('thisDnAmount', { amount: formatPaise(thisDnTotalPaise) })}</Text>
          {thisDnTotalPaise > remainingReturnablePaise && (
            <Alert type="error" title={t('exceedsWarning')} />
          )}
        </Space>

        <Form.Item>
          <Checkbox checked={vendorAccepted} onChange={(e) => setVendorAccepted(e.target.checked)}>
            {t('vendorAccepted')}
          </Checkbox>
        </Form.Item>

        <Form.Item label={t('narration')} name="narration">
          <Input.TextArea rows={2} placeholder={t('narrationPlaceholder')} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Tooltip title={submitDisabled ? t('exceedsTooltip') : ''}>
              <Button
                onClick={() => handleSubmit(false)}
                disabled={submitDisabled}
                loading={submitting}
              >
                {t('saveDraft')}
              </Button>
            </Tooltip>
            <Tooltip title={submitDisabled ? t('exceedsTooltip') : ''}>
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
