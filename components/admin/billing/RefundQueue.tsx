'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Table, Tag, Button, Empty, Spin } from 'antd';
import { CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminListPendingRefunds } from '@/lib/actions';
import { Money } from '@/lib/money';
import { RefundReviewModal } from './RefundReviewModal';
import type { RefundRequest } from '@/types';

export function RefundQueue() {
  const [items, setItems] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<RefundRequest | null>(null);

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await adminListPendingRefunds({ limit: 100 });
      setItems(res ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-10">
        <Spin />
      </div>
    );
  }

  return (
    <>
      {items.length === 0 ? (
        <Empty
          image={<CheckCircleOutlined className="text-5xl text-green-700" />}
          description="No pending refund requests"
        />
      ) : (
        <Table
          dataSource={items}
          rowKey="_id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Customer',
              dataIndex: 'userId',
              key: 'userId',
              render: (id: string) => <span className="font-mono text-xs">{id.slice(0, 18)}…</span>,
            },
            {
              title: 'Amount',
              dataIndex: 'amountPaise',
              key: 'amount',
              align: 'right' as const,
              render: (p: number) => Money.fromPaise(p).format(),
            },
            {
              title: 'Reason',
              dataIndex: 'reason',
              key: 'reason',
              ellipsis: true,
            },
            {
              title: 'Requested',
              dataIndex: 'createdAt',
              key: 'createdAt',
              render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY HH:mm') : '-'),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (s: string) => (
                <Tag color="orange" className="capitalize">
                  {s.replace('_', ' ')}
                </Tag>
              ),
            },
            {
              title: <span className="sr-only">Actions</span>,
              key: 'actions',
              align: 'right' as const,
              render: (_: unknown, row: RefundRequest) => (
                <div className="flex items-center justify-end gap-1">
                  <Button size="small" icon={<EyeOutlined />} onClick={() => setReviewing(row)}>
                    Review
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}

      <RefundReviewModal
        open={!!reviewing}
        request={reviewing}
        onCancel={() => setReviewing(null)}
        onResolved={() => {
          setReviewing(null);
          refresh();
        }}
      />
    </>
  );
}
