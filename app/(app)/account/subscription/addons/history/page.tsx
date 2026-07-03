'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, Empty } from 'antd';
import dayjs from 'dayjs';
import { getMyAddOns } from '@/lib/actions';
import type { PurchasedAddOn } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  active: 'green',
  expired: 'orange',
  cancelled: 'red',
  superseded: 'default',
};

export default function AddOnHistoryPage() {
  const [items, setItems] = useState<PurchasedAddOn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyAddOns()
      .then((res) => setItems(Array.isArray(res) ? res : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">Add-On History</h2>
        <p className="m-0 text-sm text-muted">
          Every add-on you&apos;ve ever purchased - active, expired, or superseded.
        </p>
      </div>

      <Card className="rounded-2xl">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : items.length === 0 ? (
          <Empty description="No add-ons purchased yet" />
        ) : (
          <Table
            dataSource={items}
            rowKey="_id"
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: 'Add-On',
                key: 'addon',
                render: (_: unknown, row: PurchasedAddOn) => {
                  const def =
                    typeof row.addOnDefinitionId === 'object' ? row.addOnDefinitionId : null;
                  return def?.name ?? 'Unknown';
                },
              },
              {
                title: 'Type',
                key: 'type',
                render: (_: unknown, row: PurchasedAddOn) => {
                  const def =
                    typeof row.addOnDefinitionId === 'object' ? row.addOnDefinitionId : null;
                  return def?.type ?? '-';
                },
              },
              {
                title: 'Quantity',
                dataIndex: 'quantity',
                key: 'qty',
                render: (q: number) => q ?? 1,
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (s: string) => <Tag color={STATUS_COLORS[s] ?? 'default'}>{s}</Tag>,
              },
              {
                title: 'Activated',
                dataIndex: 'activatedAt',
                key: 'activatedAt',
                render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
              },
              {
                title: 'Expires',
                dataIndex: 'expiresAt',
                key: 'expiresAt',
                render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : 'Lifetime'),
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                render: (s?: string) =>
                  s === 'admin' ? <Tag color="geekblue">Admin</Tag> : <Tag>Self</Tag>,
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
