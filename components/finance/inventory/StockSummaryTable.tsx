'use client';
import { useState, useCallback } from 'react';
import { Table, Dropdown, Spin } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DsTable } from '@/components/ui/DsTable';
import type { StockSummaryRow, PerGodownBalance } from '@/types';
import { getStockSummaryForItem } from '@/lib/actions/inventory.actions';

interface Props {
  workspaceId: string;
  firmId: string;
  rows: StockSummaryRow[];
  loading?: boolean;
  onPrintLabels?: (itemId: string) => void;
  onViewMovements?: (itemId: string) => void;
  onRecordWastage?: (itemId: string) => void;
}

const formatPaise = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export function StockSummaryTable({
  workspaceId,
  firmId,
  rows,
  loading,
  onPrintLabels,
  onViewMovements,
  onRecordWastage,
}: Props) {
  // Cache of per-item godown breakdowns. Map itemId -> { loading, data }
  const [expandedData, setExpandedData] = useState<
    Map<string, { loading: boolean; data: PerGodownBalance[] }>
  >(new Map());

  const handleExpand = useCallback(
    async (expanded: boolean, row: StockSummaryRow) => {
      if (!expanded) return;
      if (expandedData.has(row.itemId)) return; // cached - skip refetch
      setExpandedData((prev) => {
        const next = new Map(prev);
        next.set(row.itemId, { loading: true, data: [] });
        return next;
      });
      try {
        const data = await getStockSummaryForItem(workspaceId, firmId, row.itemId);
        setExpandedData((prev) => {
          const next = new Map(prev);
          next.set(row.itemId, { loading: false, data });
          return next;
        });
      } catch {
        setExpandedData((prev) => {
          const next = new Map(prev);
          next.set(row.itemId, { loading: false, data: [] });
          return next;
        });
      }
    },
    [workspaceId, firmId, expandedData],
  );

  const columns: ColumnsType<StockSummaryRow> = [
    {
      title: 'Item',
      dataIndex: 'name',
      key: 'name',
      fixed: 'left',
      width: 220,
      render: (name: string, row: StockSummaryRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{name}</div>
          {row.itemCode && (
            <div style={{ fontSize: 11, color: 'var(--cr-text-3)' }}>{row.itemCode}</div>
          )}
        </div>
      ),
    },
    { title: 'Category', dataIndex: 'categoryName', key: 'categoryName', width: 140 },
    { title: 'Unit', dataIndex: 'unitName', key: 'unitName', width: 80 },
    { title: 'On Hand', dataIndex: 'onHandQty', key: 'onHandQty', width: 100, align: 'right' },
    {
      title: 'Reserved',
      dataIndex: 'reservedQty',
      key: 'reservedQty',
      width: 100,
      align: 'right',
    },
    {
      title: 'Available',
      dataIndex: 'availableQty',
      key: 'availableQty',
      width: 100,
      align: 'right',
      render: (v: number) => (
        <span style={{ color: v < 0 ? 'var(--cr-error)' : 'inherit', fontWeight: 600 }}>{v}</span>
      ),
    },
    {
      title: 'Avg Cost',
      dataIndex: 'avgCostPaise',
      key: 'avgCostPaise',
      width: 110,
      align: 'right',
      render: formatPaise,
    },
    {
      title: 'Stock Value',
      dataIndex: 'stockValuePaise',
      key: 'stockValuePaise',
      width: 130,
      align: 'right',
      render: formatPaise,
    },
    { title: 'Lots', dataIndex: 'lotCount', key: 'lotCount', width: 70, align: 'right' },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 100,
      render: (_: unknown, row: StockSummaryRow) => (
        <Dropdown
          menu={{
            items: [
              {
                key: 'labels',
                label: 'Print Labels',
                onClick: () => onPrintLabels?.(row.itemId),
              },
              {
                key: 'movements',
                label: 'View Movements',
                onClick: () => onViewMovements?.(row.itemId),
              },
              {
                key: 'wastage',
                label: 'Record Wastage',
                onClick: () => onRecordWastage?.(row.itemId),
              },
            ],
          }}
        >
          <a onClick={(e) => e.preventDefault()}>Actions</a>
        </Dropdown>
      ),
    },
  ];

  return (
    <DsTable
      columns={columns}
      dataSource={rows}
      rowKey="itemId"
      loading={loading}
      scrollX="max-content"
      expandable={{
        onExpand: handleExpand,
        expandedRowRender: (row: StockSummaryRow) => {
          const cached = expandedData.get(row.itemId);
          if (!cached || cached.loading) {
            return (
              <div style={{ padding: 16, textAlign: 'center' }}>
                <Spin size="small" /> Loading per-godown breakdown...
              </div>
            );
          }
          return (
            <Table
              size="small"
              pagination={false}
              columns={[
                { title: 'Godown', dataIndex: 'godownName' },
                { title: 'Bucket', dataIndex: 'bucketType', width: 120 },
                { title: 'Qty', dataIndex: 'qty', align: 'right', width: 100 },
                {
                  title: 'Last Movement',
                  dataIndex: 'lastMovementAt',
                  render: (v: string | undefined) => (v ? new Date(v).toLocaleString() : '-'),
                },
              ]}
              dataSource={cached.data}
              rowKey={(r: PerGodownBalance) => `${r.godownId}-${r.bucketType}`}
              locale={{ emptyText: 'No stock recorded for this item' }}
            />
          );
        },
      }}
      pagination={{ defaultPageSize: 15, showSizeChanger: true, showQuickJumper: true }}
    />
  );
}
