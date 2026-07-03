'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Space, Typography, Descriptions, Skeleton, message } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { getPaymentOut, cancelPaymentOut } from '@/lib/actions/finance-purchases.actions';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { PaymentOut } from '@/types';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PaymentOutDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.paymentOutDetail');
  const tp = useTranslations('finance.purchases');
  // Reuse the already-committed, locale-complete record-load error copy so a fetch failure
  // reads as "could not load" (with Retry) rather than a misleading "not found".
  const tDetail = useTranslations('finance.sales.detail');
  const tErr = useTranslations('finance.sales.listCommon');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [paymentOut, setPaymentOut] = useState<PaymentOut | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // true = fetch failed (distinct from a genuine 404)
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    getPaymentOut(wsId, firmId, id)
      .then(setPaymentOut)
      .catch(() => {
        setPaymentOut(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, id, reloadKey]);

  async function handleCancel() {
    setCancelling(true);
    try {
      const updated = await cancelPaymentOut(wsId, firmId, id);
      setPaymentOut(updated);
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
  if (!paymentOut) return <div style={{ padding: 24 }}>{tp('paymentOut.notFound')}</div>;

  const allocColumns = [
    { title: t('allocCol.billNo'), dataIndex: 'billNumber', key: 'billNumber' },
    {
      title: t('allocCol.billDue'),
      dataIndex: 'billDuePaise',
      key: 'billDuePaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('allocCol.allocated'),
      dataIndex: 'allocatedPaise',
      key: 'allocatedPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('allocCol.runningDue'),
      dataIndex: 'runningDuePaise',
      key: 'runningDuePaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
  ];

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
            {t('title', { number: paymentOut.voucherNumber ?? t('draft') })}
          </Typography.Title>
          <Tag color={STATE_COLOR[paymentOut.state] ?? 'default'} style={{ marginTop: 4 }}>
            {paymentOut.state.toUpperCase()}
          </Tag>
        </div>
        {paymentOut.state === 'draft' && (
          <DsButton dsVariant="danger" loading={cancelling} onClick={handleCancel}>
            {t('cancel')}
          </DsButton>
        )}
      </div>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.paymentDate')}>
          {new Date(paymentOut.paymentDate).toLocaleDateString('en-IN')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendor')}>
          {paymentOut.partySnapshot?.name ?? paymentOut.partyId ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.mode')}>
          {paymentOut.paymentMode.toUpperCase()}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.refNo')}>
          {paymentOut.referenceNo ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.totalAmount')}>
          {formatPaise(paymentOut.totalAmountPaise)}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.netPaid')}>
          {formatPaise(paymentOut.netPaidPaise)}
        </Descriptions.Item>
        {paymentOut.tdsApplied && (
          <>
            <Descriptions.Item label={t('field.tdsSection')}>
              {paymentOut.tdsApplied.section}
            </Descriptions.Item>
            <Descriptions.Item label={t('field.tdsAmount')}>
              {formatPaise(paymentOut.tdsApplied.tdsPaise)}
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item label={t('field.unapplied')}>
          {formatPaise(paymentOut.unappliedPaise)}
        </Descriptions.Item>
      </Descriptions>

      {paymentOut.billAllocations.length > 0 && (
        <>
          <Typography.Title level={2} style={{ fontSize: 16 }}>
            {t('billAllocations')}
          </Typography.Title>
          <DsTable
            dataSource={paymentOut.billAllocations}
            columns={allocColumns}
            rowKey="billId"
            pagination={false}
            size="small"
          />
        </>
      )}
    </div>
  );
}
