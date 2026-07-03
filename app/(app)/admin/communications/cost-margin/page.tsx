'use client';

/**
 * Wave 8 - admin per-workspace SMS margin report.
 *
 * Aggregates `SmsDispatchLog.providerCostPaise` for the chosen window. Sorts
 * top-spenders first. Does NOT compute revenue server-side yet - that depends
 * on per-PurchasedAddOn snapshot pricing which lands in Wave 9. Today the
 * page surfaces COST visibility + refund-rate flags.
 */

import { useCallback, useEffect, useState, startTransition } from 'react';
import { Card, Table, DatePicker, Button, Tag, Tabs, message, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import {
  getMsg91MarginReport,
  getMsg91RefundQueue,
  type Msg91MarginRow,
  type Msg91RefundQueueRow,
} from '@/lib/actions/admin-communications.actions';

const { RangePicker } = DatePicker;

export default function AdminCostMarginPage() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, 'day').startOf('day'),
    dayjs().endOf('day'),
  ]);
  const [margin, setMargin] = useState<Msg91MarginRow[]>([]);
  const [refunds, setRefunds] = useState<Msg91RefundQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [m, r] = await Promise.all([
        getMsg91MarginReport({
          from: range[0].toISOString(),
          to: range[1].toISOString(),
          limit: 100,
        }).catch(() => []),
        getMsg91RefundQueue().catch(() => []),
      ]);
      setMargin(Array.isArray(m) ? m : []);
      setRefunds(Array.isArray(r) ? r : []);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      {ctx}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="m-0 mb-1 font-display text-2xl font-extrabold text-heading">
              SMS Cost &amp; Margin
            </h2>
            <p className="m-0 text-sm text-muted">
              Per-workspace MSG91 wholesale spend + refund-rate flags. Revenue attribution lands in
              Wave 9.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <RangePicker
              value={range}
              onChange={(v) => v && v[0] && v[1] && setRange([v[0], v[1]])}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refresh()}>
              Refresh
            </Button>
          </div>
        </div>

        <Tabs
          items={[
            {
              key: 'cost',
              label: 'Cost by Workspace',
              children: (
                <Card className="rounded-2xl">
                  <Table
                    rowKey="workspaceId"
                    loading={loading}
                    dataSource={margin}
                    pagination={{ pageSize: 25 }}
                    locale={{
                      emptyText: <Empty description="No SMS sent in window" />,
                    }}
                    columns={[
                      {
                        title: 'Workspace',
                        dataIndex: 'workspaceId',
                        render: (v: string) => <code className="text-xs">{v.slice(-8)}</code>,
                      },
                      {
                        title: 'Sent',
                        dataIndex: 'sentCount',
                        align: 'right',
                      },
                      {
                        title: 'Credits',
                        dataIndex: 'creditsConsumed',
                        align: 'right',
                      },
                      {
                        title: 'MSG91 Cost',
                        dataIndex: 'providerCostPaise',
                        align: 'right',
                        render: (v: number) => `₹${(v / 100).toFixed(2)}`,
                        sorter: (a, b) => a.providerCostPaise - b.providerCostPaise,
                        defaultSortOrder: 'descend',
                      },
                    ]}
                  />
                </Card>
              ),
            },
            {
              key: 'refunds',
              label: (
                <span>
                  Refund Queue {refunds.length > 0 && <Tag color="red">{refunds.length}</Tag>}
                </span>
              ),
              children: (
                <Card className="rounded-2xl">
                  <p className="mb-3 text-xs text-muted">
                    Workspaces whose 30-day auto-refund rate exceeds the 5% threshold. Investigate
                    for abuse or systemic delivery failures (bad sender ID, DLT template mismatch).
                  </p>
                  <Table
                    rowKey="workspaceId"
                    loading={loading}
                    dataSource={refunds}
                    pagination={{ pageSize: 25 }}
                    locale={{
                      emptyText: <Empty description="No workspaces over threshold" />,
                    }}
                    columns={[
                      {
                        title: 'Workspace',
                        dataIndex: 'workspaceId',
                        render: (v: string) => <code className="text-xs">{v.slice(-8)}</code>,
                      },
                      {
                        title: 'Refunded',
                        dataIndex: 'refundedCount',
                        align: 'right',
                      },
                      {
                        title: 'Sent',
                        dataIndex: 'consumedCount',
                        align: 'right',
                      },
                      {
                        title: 'Refund Rate',
                        dataIndex: 'refundRatePct',
                        align: 'right',
                        render: (v: number) => (
                          <Tag color={v > 10 ? 'red' : 'orange'}>{v.toFixed(2)}%</Tag>
                        ),
                        sorter: (a, b) => a.refundRatePct - b.refundRatePct,
                        defaultSortOrder: 'descend',
                      },
                    ]}
                  />
                </Card>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
