'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import Link from 'next/link';
import { Card, Table, Tag, Spin, Empty, Input, Select, DatePicker, Button, message } from 'antd';
import { SearchOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { listPayments } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { PaymentsListQuery, SubscriptionPayment, SubscriptionPaymentStatus } from '@/types';

/**
 * Admin cross-user payments page. Reuses the self-serve `GET
 * /api/subscriptions/payments` endpoint - but admins are NOT scoped
 * to a single user. To list cross-user we'd need a BE admin endpoint
 * (not yet shipped). For now, this page focuses on the admin's own
 * payments OR a target user via URL `?userId=` (passed through). When
 * cross-user is needed, drill in from /admin/users/<id>.
 */
const PAGE_SIZE = 25;

const STATUS_LABELS: Record<SubscriptionPaymentStatus, { color: string; label: string }> = {
  created: { color: 'default', label: 'Pending' },
  authorised: { color: 'blue', label: 'Authorised' },
  captured: { color: 'green', label: 'Paid' },
  failed: { color: 'red', label: 'Failed' },
  refunded: { color: 'orange', label: 'Refunded' },
  partially_refunded: { color: 'orange', label: 'Partial Refund' },
  cancelled: { color: 'default', label: 'Cancelled' },
};

interface FilterState {
  status?: SubscriptionPaymentStatus;
  paymentMode?: 'one_time' | 'recurring';
  invoiceNumber?: string;
  dateRange?: [Dayjs, Dayjs] | null;
}

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<SubscriptionPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({});
  const [msgApi, ctx] = message.useMessage();

  const fetchPage = useCallback(
    async (nextPage: number, nextFilters: FilterState) => {
      startTransition(() => {
        setLoading(true);
      });
      try {
        const query: PaymentsListQuery = {
          limit: PAGE_SIZE,
          offset: (nextPage - 1) * PAGE_SIZE,
        };
        if (nextFilters.status) query.status = nextFilters.status;
        if (nextFilters.paymentMode) query.paymentMode = nextFilters.paymentMode;
        if (nextFilters.invoiceNumber) query.invoiceNumber = nextFilters.invoiceNumber;
        if (nextFilters.dateRange?.[0]) query.from = nextFilters.dateRange[0].toISOString();
        if (nextFilters.dateRange?.[1])
          query.to = nextFilters.dateRange[1].endOf('day').toISOString();

        const res = await listPayments(query);
        startTransition(() => {
          setItems(res.items ?? []);
          setTotal(res.total ?? 0);
        });
      } catch (e) {
        msgApi.error(parseApiError(e));
      } finally {
        setLoading(false);
      }
    },
    [msgApi],
  );

  useEffect(() => {
    fetchPage(page, filters);
  }, [page, filters, fetchPage]);

  return (
    <Card className="rounded-2xl" title={`Payments (${total})`}>
      {ctx}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          aria-label="Search invoice number"
          allowClear
          placeholder="Search invoice number"
          prefix={<SearchOutlined className="text-muted" />}
          value={filters.invoiceNumber ?? ''}
          onChange={(e) => {
            setFilters((f) => ({ ...f, invoiceNumber: e.target.value || undefined }));
            setPage(1);
          }}
          style={{ width: 240 }}
        />
        <Select
          aria-label="Filter by status"
          allowClear
          placeholder="Status"
          value={filters.status}
          onChange={(v) => {
            setFilters((f) => ({ ...f, status: v }));
            setPage(1);
          }}
          options={Object.entries(STATUS_LABELS).map(([key, meta]) => ({
            value: key,
            label: meta.label,
          }))}
          style={{ width: 160 }}
        />
        <Select
          aria-label="Filter by mode"
          allowClear
          placeholder="Mode"
          value={filters.paymentMode}
          onChange={(v) => {
            setFilters((f) => ({ ...f, paymentMode: v }));
            setPage(1);
          }}
          options={[
            { value: 'one_time', label: 'One-time' },
            { value: 'recurring', label: 'Recurring' },
          ]}
          style={{ width: 140 }}
        />
        <DatePicker.RangePicker
          value={filters.dateRange ?? undefined}
          onChange={(range) => {
            setFilters((f) => ({ ...f, dateRange: range as [Dayjs, Dayjs] | null }));
            setPage(1);
          }}
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No payments match these filters" />
      ) : (
        <Table
          dataSource={items}
          rowKey="_id"
          loading={loading}
          size="middle"
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
          }}
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
              title: 'Mode',
              dataIndex: 'paymentMode',
              key: 'mode',
              render: (m: string) => <Tag className="capitalize">{m.replace('_', '-')}</Tag>,
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
              render: (s: SubscriptionPaymentStatus) => {
                const meta = STATUS_LABELS[s];
                return <Tag color={meta?.color ?? 'default'}>{meta?.label ?? s}</Tag>;
              },
            },
            {
              title: 'Date',
              key: 'date',
              render: (_: unknown, row: SubscriptionPayment) => (
                <span className="text-xs text-muted">
                  {row.capturedAt
                    ? dayjs(row.capturedAt).format('DD MMM YYYY')
                    : dayjs(row.createdAt).format('DD MMM YYYY')}
                </span>
              ),
            },
            {
              title: <span className="sr-only">Actions</span>,
              key: 'actions',
              align: 'right' as const,
              render: (_: unknown, row: SubscriptionPayment) => (
                <Link href={`/admin/billing/payments/${row._id}`}>
                  <Button size="small" icon={<EyeOutlined />}>
                    Open
                  </Button>
                </Link>
              ),
            },
          ]}
        />
      )}
    </Card>
  );
}
