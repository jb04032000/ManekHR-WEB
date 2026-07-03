'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Space, Typography, Descriptions, Skeleton, message } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import {
  getPurchaseOrder,
  confirmPurchaseOrder,
  cancelPurchaseOrder,
} from '@/lib/actions/finance-purchases.actions';
import DsButton from '@/components/ui/DsButton';
import PurchaseBillLineItemsTable from '@/components/finance/purchases/PurchaseBillLineItemsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { PurchaseOrder } from '@/types';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  confirmed: 'processing',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PurchaseOrderDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.orderDetail');
  const tp = useTranslations('finance.purchases');
  // Reuse the already-committed, locale-complete record-load error copy so a fetch failure
  // reads as "could not load" (with Retry) rather than a misleading "not found".
  const tDetail = useTranslations('finance.sales.detail');
  const tErr = useTranslations('finance.sales.listCommon');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // true = fetch failed (distinct from a genuine 404)
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    getPurchaseOrder(wsId, firmId, id)
      .then(setOrder)
      .catch(() => {
        setOrder(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, id, reloadKey]);

  async function handleConfirm() {
    if (!order) return;
    setConfirming(true);
    try {
      const updated = await confirmPurchaseOrder(wsId, firmId, id);
      setOrder(updated);
      message.success(t('confirmed'));
    } catch (e: unknown) {
      message.error((e as { message?: string })?.message ?? t('confirmFailed'));
    } finally {
      setConfirming(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    try {
      const updated = await cancelPurchaseOrder(wsId, firmId, id);
      setOrder(updated);
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
  if (!order) return <div style={{ padding: 24 }}>{tp('orders.notFound')}</div>;

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
            {t('title', { number: order.voucherNumber ?? t('draft') })}
          </Typography.Title>
          <Tag color={STATE_COLOR[order.state] ?? 'default'} style={{ marginTop: 4 }}>
            {order.state.toUpperCase()}
          </Tag>
        </div>
        <Space wrap>
          {order.state === 'draft' && (
            <DsButton dsVariant="primary" loading={confirming} onClick={handleConfirm}>
              {t('confirmOrder')}
            </DsButton>
          )}
          {order.state === 'confirmed' && (
            <>
              <DsButton
                dsVariant="ghost"
                onClick={() =>
                  router.push(
                    `/dashboard/finance/firms/${firmId}/purchases/grn/new?sourcePoId=${id}`,
                  )
                }
              >
                {t('convertToGrn')}
              </DsButton>
              <DsButton
                dsVariant="ghost"
                onClick={() =>
                  router.push(
                    `/dashboard/finance/firms/${firmId}/purchases/purchase-bills/new?sourcePoId=${id}`,
                  )
                }
              >
                {t('convertToBill')}
              </DsButton>
            </>
          )}
          {order.state !== 'cancelled' && (
            <DsButton dsVariant="danger" loading={cancelling} onClick={handleCancel}>
              {t('cancel')}
            </DsButton>
          )}
        </Space>
      </div>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.date')}>
          {new Date(order.voucherDate).toLocaleDateString('en-IN')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.party')}>
          {order.partySnapshot?.name ?? order.partyId ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.financialYear')}>
          {order.financialYear}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.expectedDelivery')}>
          {order.expectedDeliveryDate
            ? new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN')
            : '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.grandTotal')}>
          {formatPaise(order.grandTotalPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.notes')}>{order.notes ?? '-'}</Descriptions.Item>
      </Descriptions>

      <Typography.Title level={2} style={{ fontSize: 16 }}>
        {t('lineItems')}
      </Typography.Title>
      <PurchaseBillLineItemsTable lineItems={order.lineItems} onChange={() => {}} readOnly />
    </div>
  );
}
