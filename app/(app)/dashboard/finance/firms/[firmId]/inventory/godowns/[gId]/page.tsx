'use client';
// Finance polish (inventory): i18n via finance.inventory.godowns; DsPageHeader for the
// godown detail header (title + Edit/Transfer actions). No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Breadcrumb, Spin, Tag } from 'antd';
import { DsTable } from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import DsCard from '@/components/ui/DsCard';
import { DsPageHeader } from '@/components/ui';
import { useWorkspaceStore } from '@/lib/store';
import { getGodown, listStockSummary } from '@/lib/actions/inventory.actions';
import type { Godown, StockSummaryRow } from '@/types';
import { GodownDrawer } from '@/components/finance/inventory/GodownDrawer';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

export default function GodownDetailPage() {
  const params = useParams<{ firmId: string; gId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.inventory');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const inventoryAccess = useFeatureAccess('inventory');
  const [godown, setGodown] = useState<Godown | null>(null);
  const [rows, setRows] = useState<StockSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);

  const reload = async () => {
    startTransition(() => {
      setLoading(true);
    });
    const [g, summary] = await Promise.all([
      getGodown(wsId, params.firmId, params.gId),
      listStockSummary(wsId, params.firmId, { godownId: params.gId }),
    ]);
    startTransition(() => {
      setGodown(g);
      // listStockSummary returns { kpi, rows } envelope - destructure rows for the table.
      setRows(summary.rows);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (wsId && !inventoryAccess.isLocked) reload();
  }, [wsId, params.firmId, params.gId, inventoryAccess.isLocked]);

  const formatPaise = (p: number) =>
    `₹${(p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

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
                {t('godowns.detailBreadcrumbInventory')}
              </a>
            ),
          },
          {
            title: (
              <a
                onClick={() =>
                  router.push(`/dashboard/finance/firms/${params.firmId}/inventory/godowns`)
                }
              >
                {t('godowns.detailBreadcrumbGodowns')}
              </a>
            ),
          },
          { title: godown?.name ?? t('listCommon.loadingFallback') },
        ]}
        style={{ marginBottom: 16 }}
      />
      <DsPageHeader
        title={godown?.name ?? t('listCommon.loadingFallback')}
        style={{ marginBottom: 16 }}
        right={
          <span style={{ display: 'inline-flex', gap: 8 }}>
            <DsButton dsVariant="ghost" onClick={() => setEditOpen(true)}>
              {t('listCommon.edit')}
            </DsButton>
            <DsButton
              dsVariant="primary"
              onClick={() =>
                router.push(
                  `/dashboard/finance/firms/${params.firmId}/inventory/transfers/new?fromGodownId=${params.gId}`,
                )
              }
            >
              {t('godowns.transferStock')}
            </DsButton>
          </span>
        }
      />

      {godown && (
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
                {t('godowns.fieldCode')}
              </div>
              <Tag color="cyan">{godown.code}</Tag>
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
                {t('godowns.fieldAddress')}
              </div>
              <div>{godown.address ?? '-'}</div>
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
                {t('godowns.fieldContact')}
              </div>
              <div>
                {godown.contactPerson ?? '-'} {godown.contactPhone && `(${godown.contactPhone})`}
              </div>
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
                {t('godowns.fieldDefault')}
              </div>
              {godown.isDefault ? (
                <Tag color="blue">{t('godowns.defaultTag')}</Tag>
              ) : (
                <Tag>{t('godowns.no')}</Tag>
              )}
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
                {t('godowns.fieldStatus')}
              </div>
              <Tag color={godown.isActive ? 'green' : 'default'}>
                {godown.isActive ? t('godowns.active') : t('godowns.inactive')}
              </Tag>
            </div>
          </div>
        </DsCard>
      )}

      <DsTable
        columns={[
          { title: t('godowns.colItem'), dataIndex: 'name', key: 'name' },
          { title: t('godowns.colCategory'), dataIndex: 'categoryName', key: 'categoryName' },
          { title: t('godowns.colUnit'), dataIndex: 'unitName', key: 'unitName' },
          {
            title: t('godowns.colOnHand'),
            dataIndex: 'onHandQty',
            key: 'onHandQty',
            align: 'right',
          },
          {
            title: t('godowns.colReserved'),
            dataIndex: 'reservedQty',
            key: 'reservedQty',
            align: 'right',
          },
          {
            title: t('godowns.colAvgCost'),
            dataIndex: 'avgCostPaise',
            key: 'avgCostPaise',
            align: 'right',
            render: formatPaise,
          },
          {
            title: t('godowns.colStockValue'),
            dataIndex: 'stockValuePaise',
            key: 'stockValuePaise',
            align: 'right',
            render: formatPaise,
          },
        ]}
        dataSource={rows}
        rowKey="itemId"
        loading={loading}
        pagination={{ defaultPageSize: 20 }}
      />

      {godown && (
        <GodownDrawer
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={reload}
          workspaceId={wsId}
          firmId={params.firmId}
          initial={godown}
        />
      )}
    </div>
  );
}
