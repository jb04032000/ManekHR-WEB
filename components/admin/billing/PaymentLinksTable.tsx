'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Table, Tag, Button, Tooltip, Popconfirm, message, Select } from 'antd';
import { CopyOutlined, StopOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminListPaymentLinks, adminCancelPaymentLink } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { SubscriptionPayment } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  created: 'blue',
  authorised: 'gold',
  captured: 'green',
  failed: 'red',
  cancelled: 'default',
};

export function PaymentLinksTable() {
  const [items, setItems] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'created' | 'captured' | 'failed' | undefined>(
    undefined,
  );
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await adminListPaymentLinks({
        status: statusFilter,
        limit: 100,
      });
      startTransition(() => {
        setItems(res.items ?? []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, msgApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCopy = async (url?: string) => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    msgApi.success('Link copied to clipboard');
  };

  const handleCancel = async (paymentId: string) => {
    setCancelling(paymentId);
    try {
      await adminCancelPaymentLink(paymentId);
      msgApi.success('Payment link cancelled');
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setCancelling(null);
    }
  };

  return (
    <>
      {ctx}

      <div className="mb-3 flex items-center gap-2">
        <Select
          allowClear
          placeholder="Filter by status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'created', label: 'Created (open)' },
            { value: 'captured', label: 'Paid' },
            { value: 'failed', label: 'Failed' },
          ]}
          style={{ width: 200 }}
        />
      </div>

      <Table
        dataSource={items}
        rowKey="_id"
        loading={loading}
        size="middle"
        pagination={{ pageSize: 20 }}
        columns={[
          {
            title: 'Razorpay Link Id',
            key: 'linkId',
            render: (_: unknown, row: SubscriptionPayment) => (
              <span className="font-mono text-xs">{row.gatewayPaymentLinkId ?? '-'}</span>
            ),
          },
          {
            title: 'Plan',
            key: 'plan',
            render: (_: unknown, row: SubscriptionPayment) =>
              typeof row.planId === 'object' ? row.planId.name : '-',
          },
          {
            title: 'Cycle',
            dataIndex: 'billingCycle',
            key: 'cycle',
            render: (c: string) => <Tag className="capitalize">{c}</Tag>,
          },
          {
            title: 'Amount',
            dataIndex: 'totalPaise',
            key: 'amount',
            align: 'right' as const,
            render: (p: number) => Money.fromPaise(p).format(),
          },
          {
            title: 'Status',
            dataIndex: 'status',
            key: 'status',
            render: (s: string) => (
              <Tag color={STATUS_COLORS[s] ?? 'default'} className="capitalize">
                {s}
              </Tag>
            ),
          },
          {
            title: 'Issued',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY HH:mm') : '-'),
          },
          {
            title: <span className="sr-only">Actions</span>,
            key: 'actions',
            align: 'right' as const,
            render: (_: unknown, row: SubscriptionPayment) => {
              const url = (row as SubscriptionPayment & { paymentLinkUrl?: string }).paymentLinkUrl;
              const isOpen = row.status === 'created';
              return (
                <div className="flex items-center justify-end gap-1">
                  {url && (
                    <Tooltip title="Copy link">
                      <Button
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() => handleCopy(url)}
                      />
                    </Tooltip>
                  )}
                  {isOpen && (
                    <Popconfirm
                      title="Cancel this payment link?"
                      okText="Cancel link"
                      okButtonProps={{ danger: true }}
                      onConfirm={() => handleCancel(row._id)}
                    >
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        loading={cancelling === row._id}
                      >
                        Cancel
                      </Button>
                    </Popconfirm>
                  )}
                </div>
              );
            },
          },
        ]}
      />
    </>
  );
}
