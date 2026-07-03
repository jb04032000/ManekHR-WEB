'use client';

import { useEffect, useState } from 'react';
import { Card, Table, Tag, Spin, Empty } from 'antd';
import dayjs from 'dayjs';
import { getMySubscriptionHistory } from '@/lib/actions';
import { InvoicesTable } from '@/components/subscription/InvoicesTable';
import { DsTag } from '@/components/ui';
import type { Subscription } from '@/types';

export default function HistoryPage() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMySubscriptionHistory()
      .then((res) => setSubs(res ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">
          Subscription History
        </h2>
        <p className="m-0 text-sm text-muted">
          All your past and current subscriptions, plus every payment attempt.
        </p>
      </div>

      <Card className="rounded-2xl" title="Subscriptions">
        {loading ? (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        ) : subs.length === 0 ? (
          <Empty description="No subscription history yet" />
        ) : (
          <Table
            dataSource={subs}
            rowKey="_id"
            size="middle"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10 }}
            columns={[
              {
                title: 'Plan',
                key: 'plan',
                render: (_: unknown, row: Subscription) =>
                  typeof row.planId === 'object' ? row.planId.name : 'Custom',
              },
              {
                title: 'Tier',
                key: 'tier',
                render: (_: unknown, row: Subscription) => {
                  const tier = typeof row.planId === 'object' ? row.planId.tier : null;
                  return tier ? <Tag className="capitalize">{tier}</Tag> : <Tag>-</Tag>;
                },
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (s: string) => (
                  <DsTag status={s as Parameters<typeof DsTag>[0]['status']} />
                ),
              },
              {
                title: 'Cycle',
                dataIndex: 'billingCycle',
                key: 'cycle',
                render: (c: string) => <Tag className="capitalize">{c}</Tag>,
              },
              {
                title: 'Start',
                dataIndex: 'currentPeriodStart',
                key: 'start',
                render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
              },
              {
                title: 'End',
                dataIndex: 'currentPeriodEnd',
                key: 'end',
                render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
              },
              {
                title: 'Source',
                dataIndex: 'source',
                key: 'source',
                render: (s?: string) => (
                  <Tag color={s === 'admin' ? 'geekblue' : 'default'} className="capitalize">
                    {s ?? 'self'}
                  </Tag>
                ),
              },
            ]}
          />
        )}
      </Card>

      <InvoicesTable />
    </div>
  );
}
