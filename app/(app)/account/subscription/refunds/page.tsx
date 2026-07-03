'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import { Card, Tag, Button, Spin, Empty, Table, message } from 'antd';
import { RollbackOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { listMyRefundRequests, listPayments } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import { RefundRequestModal } from '@/components/subscription/RefundRequestModal';
import type { RefundRequest, RefundStatus, SubscriptionPayment } from '@/types';

const STATUS_COLORS: Record<RefundStatus, string> = {
  pending_admin: 'orange',
  approved: 'blue',
  processing: 'blue',
  processed: 'green',
  failed: 'red',
  rejected: 'red',
  cancelled: 'default',
};

export default function RefundsPage() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<SubscriptionPayment | null>(null);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const [reqs, pays] = await Promise.all([
        listMyRefundRequests(),
        listPayments({ status: 'captured', limit: 50 }),
      ]);
      startTransition(() => {
        setRequests(reqs ?? []);
        setPayments(pays?.items ?? []);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex justify-center py-15">
        <Spin size="large" />
      </div>
    );
  }

  // Filter to payments that have remaining refundable balance.
  const refundablePayments = payments.filter((p) => {
    const refundedSoFar = (p.refunds ?? []).reduce(
      (s, r) => s + (r.status !== 'failed' ? r.amountPaise : 0),
      0,
    );
    return p.totalPaise - refundedSoFar > 0;
  });

  return (
    <>
      {ctx}

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="m-0 mb-1 font-display text-xl font-bold text-heading">Refunds</h2>
          <p className="m-0 text-sm text-muted">
            Request a refund on any past payment. Within-policy refunds process automatically;
            others are reviewed by our team within 48 hours.
          </p>
        </div>

        {/* Eligible payments */}
        <Card className="rounded-2xl" title="Refundable payments" extra={<RollbackOutlined />}>
          {refundablePayments.length === 0 ? (
            <Empty description="No payments eligible for refund" />
          ) : (
            <Table
              dataSource={refundablePayments}
              rowKey="_id"
              size="middle"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: 'Invoice',
                  key: 'invoice',
                  render: (_: unknown, row: SubscriptionPayment) => (
                    <div className="flex items-center gap-2">
                      <FileTextOutlined className="text-muted" />
                      <span className="text-sm font-medium">{row.invoiceNumber ?? '-'}</span>
                    </div>
                  ),
                },
                {
                  title: 'Plan',
                  key: 'plan',
                  render: (_: unknown, row: SubscriptionPayment) =>
                    typeof row.planId === 'object' ? row.planId.name : '-',
                },
                {
                  title: 'Amount',
                  dataIndex: 'totalPaise',
                  key: 'amount',
                  align: 'right' as const,
                  render: (paise: number) => Money.fromPaise(paise).format(),
                },
                {
                  title: 'Date',
                  key: 'date',
                  render: (_: unknown, row: SubscriptionPayment) =>
                    row.capturedAt ? dayjs(row.capturedAt).format('DD MMM YYYY') : '-',
                },
                {
                  title: '',
                  key: 'action',
                  align: 'right' as const,
                  render: (_: unknown, row: SubscriptionPayment) => (
                    <Button
                      size="small"
                      icon={<RollbackOutlined />}
                      onClick={() => setSelectedPayment(row)}
                    >
                      Request Refund
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </Card>

        {/* Existing requests */}
        <Card className="rounded-2xl" title="Refund history">
          {requests.length === 0 ? (
            <Empty description="No refund requests yet" />
          ) : (
            <Table
              dataSource={requests}
              rowKey="_id"
              size="middle"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 10 }}
              columns={[
                {
                  title: 'Status',
                  dataIndex: 'status',
                  key: 'status',
                  render: (s: RefundStatus) => (
                    <Tag color={STATUS_COLORS[s]} className="capitalize">
                      {s.replace('_', ' ')}
                    </Tag>
                  ),
                },
                {
                  title: 'Amount',
                  dataIndex: 'amountPaise',
                  key: 'amount',
                  align: 'right' as const,
                  render: (paise: number) => Money.fromPaise(paise).format(),
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
                  render: (d: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
                },
                {
                  title: 'Processed',
                  dataIndex: 'processedAt',
                  key: 'processedAt',
                  render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
                },
              ]}
            />
          )}
        </Card>
      </div>

      <RefundRequestModal
        open={!!selectedPayment}
        payment={selectedPayment}
        onCancel={() => setSelectedPayment(null)}
        onSuccess={() => {
          setSelectedPayment(null);
          refresh();
        }}
      />
    </>
  );
}
