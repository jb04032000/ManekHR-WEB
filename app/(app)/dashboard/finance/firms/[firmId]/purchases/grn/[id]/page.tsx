'use client';
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Space, Typography, Descriptions, Skeleton } from 'antd';
import { useWorkspaceStore } from '@/lib/store';
import { getGrn } from '@/lib/actions/finance-purchases.actions';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { GoodsReceiptNote } from '@/types';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  received: 'success',
  cancelled: 'error',
};

export default function GrnDetailPage() {
  const { firmId, id } = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases.grnDetail');
  const tp = useTranslations('finance.purchases');
  // Reuse the already-committed, locale-complete record-load error copy so a fetch failure
  // reads as "could not load" (with Retry) rather than a misleading "not found".
  const tDetail = useTranslations('finance.sales.detail');
  const tErr = useTranslations('finance.sales.listCommon');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [grn, setGrn] = useState<GoodsReceiptNote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // true = fetch failed (distinct from a genuine 404)
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    getGrn(wsId, firmId, id)
      .then(setGrn)
      .catch(() => {
        setGrn(null);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, id, reloadKey]);

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
  if (!grn) return <div style={{ padding: 24 }}>{tp('grn.notFound')}</div>;

  const lineColumns = [
    {
      title: t('lineCol.item'),
      dataIndex: 'itemName',
      key: 'itemName',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('lineCol.qtyOrdered'),
      dataIndex: 'qtyOrdered',
      key: 'qtyOrdered',
      align: 'right' as const,
    },
    {
      title: t('lineCol.qtyReceived'),
      dataIndex: 'qtyReceived',
      key: 'qtyReceived',
      align: 'right' as const,
    },
    { title: t('lineCol.unit'), dataIndex: 'unit', key: 'unit', render: (v?: string) => v ?? '-' },
    {
      title: t('lineCol.batchNo'),
      dataIndex: 'batchNumber',
      key: 'batchNumber',
      render: (v?: string) => v ?? '-',
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
            {t('title', { number: grn.voucherNumber ?? t('draft') })}
          </Typography.Title>
          <Tag color={STATE_COLOR[grn.state] ?? 'default'} style={{ marginTop: 4 }}>
            {grn.state.toUpperCase()}
          </Tag>
        </div>
        <Space>
          {grn.state === 'received' && (
            <DsButton
              dsVariant="primary"
              onClick={() =>
                router.push(
                  `/dashboard/finance/firms/${firmId}/purchases/purchase-bills/new?sourceGrnId=${id}`,
                )
              }
            >
              {t('convertToBill')}
            </DsButton>
          )}
        </Space>
      </div>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 24 }}>
        <Descriptions.Item label={t('field.date')}>
          {new Date(grn.voucherDate).toLocaleDateString('en-IN')}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.vendor')}>
          {grn.partySnapshot?.name ?? grn.partyId ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.poRef')}>
          {grn.sourcePoNumber ?? grn.sourcePoId ?? '-'}
        </Descriptions.Item>
        <Descriptions.Item label={t('field.deliveryNote')}>
          {grn.vendorDeliveryNoteNumber ?? '-'}
        </Descriptions.Item>
        {grn.receivedAt && (
          <Descriptions.Item label={t('field.receivedAt')}>
            {new Date(grn.receivedAt).toLocaleDateString('en-IN')}
          </Descriptions.Item>
        )}
      </Descriptions>

      <Typography.Title level={2} style={{ fontSize: 16 }}>
        {t('lineItems')}
      </Typography.Title>
      <DsTable
        dataSource={grn.lineItems}
        columns={lineColumns}
        rowKey={(_, i) => String(i)}
        pagination={false}
        size="small"
      />
    </div>
  );
}
