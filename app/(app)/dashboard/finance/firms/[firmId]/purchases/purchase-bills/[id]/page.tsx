'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Space, Typography, Descriptions, Skeleton, Alert, Divider, message } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { getPurchaseBill, cancelPurchaseBill } from '@/lib/actions/finance-purchases.actions';
import { listDebitNotesByBill } from '@/lib/actions/finance-returns.actions';
import DsButton from '@/components/ui/DsButton';
import PurchaseBillLineItemsTable from '@/components/finance/purchases/PurchaseBillLineItemsTable';
import TdsInfoBox from '@/components/finance/purchases/TdsInfoBox';
import CapitalGoodsItcBadge from '@/components/finance/purchases/CapitalGoodsItcBadge';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { PurchaseBill, DebitNote } from '@/types';
import dayjs from 'dayjs';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  unpaid: 'warning',
  partial: 'processing',
  paid: 'success',
  overdue: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PurchaseBillDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.billDetail');
  const tp = useTranslations('finance.purchases');
  // Reuse the already-committed, locale-complete record-load error copy so a fetch failure
  // reads as "could not load" (with Retry) rather than a misleading "not found".
  const tDetail = useTranslations('finance.sales.detail');
  const tErr = useTranslations('finance.sales.listCommon');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [bill, setBill] = useState<PurchaseBill | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // true = fetch failed (distinct from a genuine 404)
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [cancelling, setCancelling] = useState(false);
  const [debitNotes, setDebitNotes] = useState<DebitNote[]>([]);
  const [loadingDNs, setLoadingDNs] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    getPurchaseBill(wsId, firmId, id)
      .then(setBill)
      .catch(() => {
        setBill(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, id, reloadKey]);

  useEffect(() => {
    if (!wsId || !isHydrated || !id) return;
    startTransition(() => {
      setLoadingDNs(true);
    });
    listDebitNotesByBill(wsId, firmId, id)
      .then(setDebitNotes)
      .catch(() => {
        /* silently skip - non-critical */
      })
      .finally(() => setLoadingDNs(false));
  }, [wsId, isHydrated, firmId, id]);

  async function handleCancel() {
    if (!bill) return;
    setCancelling(true);
    try {
      const updated = await cancelPurchaseBill(wsId, firmId, id);
      setBill(updated);
      message.success(t('cancelled'));
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('cancelFailed'));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Skeleton active style={{ padding: 24 }} />;
  if (error)
    return (
      <ListErrorState
        title={tDetail('loadFailed')}
        body={tErr('errorBody')}
        retryLabel={tErr('retry')}
        onRetry={() => {
          setLoading(true);
          setReloadKey((k) => k + 1);
        }}
      />
    );
  if (!bill) return <div style={{ padding: 24 }}>{tp('bills.notFound')}</div>;

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Typography.Title level={1} style={{ margin: 0, fontSize: 22 }}>
            {t('title', { number: bill.voucherNumber ?? t('draft') })}
          </Typography.Title>
          <Space style={{ marginTop: 4 }}>
            <Tag color={STATE_COLOR[bill.state] ?? 'default'}>{bill.state.toUpperCase()}</Tag>
            <Tag color={PAYMENT_STATUS_COLOR[bill.paymentStatus] ?? 'default'}>
              {bill.paymentStatus.toUpperCase()}
            </Tag>
          </Space>
        </div>
        <Space>
          {bill.state === 'posted' && bill.amountDuePaise > 0 && (
            <DsButton
              dsVariant="primary"
              onClick={() =>
                router.push(
                  `/dashboard/finance/firms/${firmId}/purchases/payment-out/new?partyId=${bill.partyId}&billId=${id}`,
                )
              }
            >
              {t('payNow')}
            </DsButton>
          )}
          {bill.state === 'posted' && (
            <DsButton
              dsVariant="secondary"
              onClick={() =>
                router.push(
                  `/dashboard/finance/firms/${firmId}/returns/debit-notes/new?sourceBillId=${id}`,
                )
              }
            >
              {t('issueDebitNote')}
            </DsButton>
          )}
          {bill.state === 'draft' && (
            <DsButton dsVariant="danger" loading={cancelling} onClick={handleCancel}>
              {t('cancel')}
            </DsButton>
          )}
        </Space>
      </div>

      {/* MSME warning */}
      {bill.msmeApplicable && bill.msmePaymentDeadline && (
        <Alert
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          title={t('msmeDeadline', {
            date: new Date(bill.msmePaymentDeadline).toLocaleDateString('en-IN'),
          })}
          style={{ marginBottom: 16 }}
        />
      )}

      {/* TDS-194Q info */}
      {bill.state === 'posted' && <TdsInfoBox tds194Q={bill.tds194Q} />}

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.voucherDate')}>
          {new Date(bill.voucherDate).toLocaleDateString('en-IN')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendor')}>
          {bill.partySnapshot?.name ?? bill.partyId ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendorBillNo')}>
          {bill.vendorBillNumber ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendorBillDate')}>
          {bill.vendorBillDate ? new Date(bill.vendorBillDate).toLocaleDateString('en-IN') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.poRef')}>{bill.sourcePoNumber ?? '-'}</Descriptions.Item>
        <Descriptions.Item label={t('field.grnRef')}>
          {bill.sourceGrnNumber ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.taxable')}>
          {formatPaise(bill.taxableValuePaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.cgst')}>{formatPaise(bill.cgstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.sgst')}>{formatPaise(bill.sgstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.igst')}>{formatPaise(bill.igstPaise)}</Descriptions.Item>
        <Descriptions.Item label={t('field.grandTotal')}>
          {formatPaise(bill.grandTotalPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.netPayableAfterTds')}>
          {formatPaise(bill.netPayableToCreditorsAfterTdsPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.amountPaid')}>
          {formatPaise(bill.amountPaidPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.amountDue')}>
          {formatPaise(bill.amountDuePaise)}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Title level={2} style={{ fontSize: 16 }}>
        {t('lineItems')}
      </Typography.Title>
      <PurchaseBillLineItemsTable lineItems={bill.lineItems} onChange={() => {}} readOnly />

      {/* Capital Goods ITC badges per line */}
      {bill.lineItems.some((l) => l.isCapitalGoods) && (
        <div style={{ marginTop: 16 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {t('capitalGoodsItcStatus')}
          </Typography.Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            {bill.lineItems
              .filter((l) => l.isCapitalGoods)
              .map((l, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Typography.Text style={{ fontSize: 12 }}>{l.itemName}:</Typography.Text>
                  <CapitalGoodsItcBadge />
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Debit Notes section */}
      <Divider />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Typography.Title level={2} style={{ margin: 0, fontSize: 16 }}>
          {t('debitNotes')}
        </Typography.Title>
      </div>
      {loadingDNs ? (
        <Skeleton active paragraph={{ rows: 2 }} />
      ) : debitNotes.length === 0 ? (
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {t('noDebitNotes')}
        </Typography.Text>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ background: 'var(--cr-neutral-100)' }}>
            <tr>
              {[
                t('dnCol.voucherNo'),
                t('dnCol.date'),
                t('dnCol.type'),
                t('dnCol.amount'),
                t('dnCol.state'),
              ].map((h) => (
                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {debitNotes.map((dn) => (
              <tr
                key={dn._id}
                style={{ borderTop: '1px solid var(--cr-border-light)', cursor: 'pointer' }}
                onClick={() =>
                  router.push(`/dashboard/finance/firms/${firmId}/returns/debit-notes/${dn._id}`)
                }
              >
                <td style={{ padding: '8px 10px' }}>{dn.voucherNumber ?? t('draft')}</td>
                <td style={{ padding: '8px 10px' }}>
                  {dayjs(dn.voucherDate).format('DD MMM YYYY')}
                </td>
                <td style={{ padding: '8px 10px' }}>{dn.dnType ?? '-'}</td>
                <td style={{ padding: '8px 10px' }}>{formatPaise(dn.grandTotalPaise ?? 0)}</td>
                <td style={{ padding: '8px 10px' }}>
                  <Tag
                    color={
                      dn.state === 'posted'
                        ? 'success'
                        : dn.state === 'cancelled'
                          ? 'error'
                          : 'default'
                    }
                  >
                    {dn.state?.toUpperCase()}
                  </Tag>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
