'use client';
import React, { useEffect, useState, startTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Tag, Typography, Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { listFixedAssets } from '@/lib/actions/finance-fixed-assets.actions';
import { useWorkspaceStore } from '@/lib/store';
import { fmt, formatCurrencyFull } from '@/lib/utils';
import type { FixedAsset } from '@/types';

interface Filters {
  categoryId?: string;
  status?: string;
  financialYear?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface FixedAssetRegisterTableProps {
  firmId: string;
  filters?: Filters;
  onRowClick?: (asset: FixedAsset) => void;
  onAction?: (asset: FixedAsset, action: 'view' | 'dispose' | 'transfer' | 'delete') => void;
}

const STATUS_COLOR: Record<string, string> = {
  active: 'success',
  disposed: 'default',
  scrapped: 'error',
  transferred: 'processing',
};

const formatPaise = (v: number) => formatCurrencyFull(v / 100);

export default function FixedAssetRegisterTable({
  firmId,
  filters,
  onRowClick,
  onAction,
}: FixedAssetRegisterTableProps) {
  const t = useTranslations('finance.fixedAssets');
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const pageSize = filters?.limit ?? 50;

  const fetchAssets = () => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
    });
    listFixedAssets(wsId, firmId, { ...filters, page, limit: pageSize })
      .then((data) => {
        const result = data as { items: FixedAsset[]; total: number };
        setAssets(Array.isArray(result.items) ? result.items : []);
        setTotal(result.total ?? 0);
      })
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsId, isHydrated, firmId, JSON.stringify(filters), page]);

  // Footer totals
  const totalCost = assets.reduce((s, a) => s + a.costPaise, 0);
  const totalAccDep = assets.reduce((s, a) => s + a.accumulatedDepreciationPaise, 0);
  const totalNbv = assets.reduce((s, a) => s + a.nbvPaise, 0);

  const columns = [
    {
      title: t('register.columns.assetCode'),
      dataIndex: 'assetCode',
      key: 'assetCode',
      sorter: true,
      render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
    },
    {
      title: t('register.columns.name'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('register.columns.category'),
      key: 'category',
      render: (_: unknown, r: FixedAsset) =>
        ((r.categorySnapshot as Record<string, unknown>)?.name as string) ?? '-',
    },
    {
      title: t('register.columns.purchaseDate'),
      dataIndex: 'purchaseDate',
      key: 'purchaseDate',
      sorter: true,
      render: (v: string) => fmt(v),
    },
    {
      title: t('register.columns.cost'),
      dataIndex: 'costPaise',
      key: 'costPaise',
      sorter: true,
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('register.columns.accDepreciation'),
      dataIndex: 'accumulatedDepreciationPaise',
      key: 'accumulatedDepreciationPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('register.columns.nbv'),
      dataIndex: 'nbvPaise',
      key: 'nbvPaise',
      sorter: true,
      align: 'right' as const,
      render: (v: number) => (
        <Typography.Text strong style={{ color: 'var(--cr-primary)' }}>
          {formatPaise(v)}
        </Typography.Text>
      ),
    },
    {
      title: t('register.columns.status'),
      dataIndex: 'status',
      key: 'status',
      render: (v: string, r: FixedAsset) => (
        <span>
          <Tag color={STATUS_COLOR[v] ?? 'default'}>{t(`status.${v}`)}</Tag>
          {r.isFullyDepreciated && (
            <Tag color="gold" style={{ marginLeft: 4 }}>
              {t('register.fullyDepreciatedShort')}
            </Tag>
          )}
        </span>
      ),
    },
    {
      title: t('register.columns.actions'),
      key: 'actions',
      render: (_: unknown, r: FixedAsset) => (
        <Dropdown
          menu={{
            items: [
              { key: 'view', label: t('register.actions.view') },
              {
                key: 'dispose',
                label: t('register.actions.dispose'),
                disabled: r.status !== 'active',
              },
              {
                key: 'transfer',
                label: t('register.actions.transfer'),
                disabled: r.status !== 'active',
              },
              { key: 'delete', label: t('register.actions.delete'), danger: true },
            ],
            onClick: ({ key }) => onAction?.(r, key as 'view' | 'dispose' | 'transfer' | 'delete'),
          }}
          trigger={['click']}
        >
          <DsButton dsVariant="ghost" dsSize="sm">
            {t('register.actions.button')} <DownOutlined />
          </DsButton>
        </Dropdown>
      ),
    },
  ];

  return (
    <>
      <DsTable
        dataSource={assets}
        columns={columns}
        rowKey="_id"
        loading={loading}
        size="small"
        scrollX={1200}
        onRow={(record) => ({
          onClick: () => onRowClick?.(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (count) => t('register.totalCount', { count }),
        }}
        summary={() => (
          <tr style={{ fontWeight: 600, background: 'var(--cr-surface-2)' }}>
            <td colSpan={4} style={{ paddingLeft: 8 }}>
              {t('register.totalsShown', { count: assets.length })}
            </td>
            <td style={{ textAlign: 'right', paddingRight: 8 }}>{formatPaise(totalCost)}</td>
            <td style={{ textAlign: 'right', paddingRight: 8 }}>{formatPaise(totalAccDep)}</td>
            <td style={{ textAlign: 'right', paddingRight: 8, color: 'var(--cr-primary)' }}>
              {formatPaise(totalNbv)}
            </td>
            <td colSpan={2} />
          </tr>
        )}
      />
    </>
  );
}
