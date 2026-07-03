'use client';
// Finance polish (inventory): i18n via finance.inventory.lots; DsPageHeader for the lot
// detail header (title + QR/Print actions). No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Breadcrumb, Spin, Tag } from 'antd';
import { DsTable } from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { getLot, getLotMovements } from '@/lib/actions/inventory.actions';
import type { Lot, StockMovement } from '@/types';
import { ExpiryBadge } from '@/components/finance/inventory/ExpiryBadge';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const movementBadgeColor: Record<string, string> = {
  purchase_in: 'green',
  sale_out: 'red',
  dc_out: 'orange',
  transfer_in: 'cyan',
  transfer_out: 'cyan',
  wastage_out: 'volcano',
  sample_out: 'orange',
  sample_return_in: 'lime',
  consignment_out: 'orange',
  consignment_return_in: 'lime',
  opening_stock: 'blue',
  grn_in: 'green',
  purchase_return_out: 'red',
  credit_note_in: 'lime',
  debit_note_out: 'red',
  manufacturing_in: 'purple',
  manufacturing_out: 'purple',
  so_reserve: 'gold',
  so_release: 'gold',
};

export default function LotDetailPage() {
  const params = useParams<{ firmId: string; id: string }>();
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [lot, setLot] = useState<Lot | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!wsId || inventoryAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
    });
    Promise.all([
      getLot(wsId, params.firmId, params.id),
      getLotMovements(wsId, params.firmId, params.id),
    ])
      .then(([l, m]) => {
        setLot(l);
        setMovements(m);
      })
      .finally(() => setLoading(false));
  }, [wsId, params.firmId, params.id, inventoryAccess.isLocked]);

  if (inventoryAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (inventoryAccess.isLocked) {
    return <ModuleLockedPage module="inventory" />;
  }

  return (
    <div className="p-6">
      <Breadcrumb
        items={[
          {
            title: (
              <a onClick={() => router.push(`/dashboard/finance/firms/${params.firmId}/inventory`)}>
                {t('lots.detailBreadcrumbInventory')}
              </a>
            ),
          },
          {
            title: (
              <a
                onClick={() =>
                  router.push(`/dashboard/finance/firms/${params.firmId}/inventory/lots`)
                }
              >
                {t('lots.detailBreadcrumbLots')}
              </a>
            ),
          },
          { title: lot?.lotNo ?? t('listCommon.loadingFallback') },
        ]}
        style={{ marginBottom: 16 }}
      />
      <DsPageHeader
        title={lot?.lotNo ?? t('listCommon.loadingFallback')}
        style={{ marginBottom: 16 }}
        right={
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <DsButton
              dsVariant="ghost"
              onClick={() =>
                router.push(
                  `/dashboard/finance/firms/${params.firmId}/items/${lot?.itemId}/labels?lotId=${params.id}`,
                )
              }
            >
              {t('lots.qrLabel')}
            </DsButton>
            <DsButton
              dsVariant="primary"
              onClick={() =>
                router.push(
                  `/dashboard/finance/firms/${params.firmId}/items/${lot?.itemId}/labels?lotId=${params.id}`,
                )
              }
            >
              {t('lots.printLabels')}
            </DsButton>
          </span>
        }
      />
      {lot && (
        <DsCard style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldItem')}
              </div>
              {lot.itemId}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldInwardDate')}
              </div>
              {new Date(lot.inwardDate).toLocaleDateString()}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldExpiry')}
              </div>
              <ExpiryBadge expiryDate={lot.expiryDate} />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldMfgDate')}
              </div>
              {lot.mfgDate ? new Date(lot.mfgDate).toLocaleDateString() : '-'}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldSupplier')}
              </div>
              {lot.supplierId ?? '-'}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldSourceVoucher')}
              </div>
              {lot.sourceVoucherType ?? '-'}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldQtyInward')}
              </div>
              {lot.qtyInward}
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldQtyRemaining')}
              </div>
              <span style={{ fontWeight: 600 }}>{lot.qtyRemaining}</span>
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--cr-text-4)',
                }}
              >
                {t('lots.fieldGodown')}
              </div>
              {lot.godownId}
            </div>
          </div>
        </DsCard>
      )}
      <h2
        style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          color: 'var(--cr-text-4)',
          marginBottom: 12,
        }}
      >
        {t('lots.movementHistory')}
      </h2>
      <DsTable
        columns={[
          {
            title: t('lots.colDate'),
            dataIndex: 'createdAt',
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: t('lots.colMovementType'),
            dataIndex: 'movementType',
            render: (v: string) => (
              <Tag color={movementBadgeColor[v] ?? 'default'}>{v.replace(/_/g, ' ')}</Tag>
            ),
          },
          {
            title: t('lots.colQty'),
            dataIndex: 'qty',
            align: 'right' as const,
            render: (v: number) => (
              <span style={{ color: v < 0 ? 'var(--cr-error)' : 'var(--cr-success)' }}>
                {v > 0 ? '+' : ''}
                {v}
              </span>
            ),
          },
          {
            title: t('lots.colGodown'),
            dataIndex: 'godownId',
          },
          {
            title: t('lots.colVoucherNo'),
            dataIndex: 'sourceVoucherNumber',
          },
          {
            title: t('lots.colNarration'),
            dataIndex: 'narration',
            ellipsis: true,
          },
          {
            title: t('lots.colBy'),
            dataIndex: 'createdBy',
          },
        ]}
        dataSource={movements}
        rowKey="_id"
        loading={loading}
        pagination={{ defaultPageSize: 25 }}
      />
    </div>
  );
}
