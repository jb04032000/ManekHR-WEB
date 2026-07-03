'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Table,
  Tag,
  Button,
  Tooltip,
  Spin,
  Empty,
  message,
  Input,
  Select,
  DatePicker,
} from 'antd';
import {
  DownloadOutlined,
  FileTextOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { listPayments, downloadInvoice, regenerateInvoice } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import type { SubscriptionPaymentStatus, PaymentsListQuery, SubscriptionPayment } from '@/types';

const PAGE_SIZE = 10;

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
  hasInvoice?: boolean;
  invoiceNumber?: string;
  dateRange?: [Dayjs, Dayjs] | null;
}

interface Props {
  /** When true, only show paid (captured) rows + invoice columns. */
  invoicesOnly?: boolean;
}

export function InvoicesTable({ invoicesOnly = false }: Props) {
  const [items, setItems] = useState<SubscriptionPayment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>(
    invoicesOnly ? { status: 'captured', hasInvoice: true } : {},
  );
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
        if (nextFilters.hasInvoice !== undefined) query.hasInvoice = nextFilters.hasInvoice;
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

  const handleDownload = async (payment: SubscriptionPayment) => {
    if (!payment.invoiceNumber) {
      msgApi.warning('No invoice generated yet. Click Regenerate.');
      return;
    }
    setDownloading(payment._id);
    try {
      const res = await downloadInvoice(payment._id);
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setDownloading(null);
    }
  };

  const handleRegenerate = async (payment: SubscriptionPayment) => {
    setRegenerating(payment._id);
    try {
      await regenerateInvoice(payment._id);
      msgApi.success('Invoice regenerated.');
      fetchPage(page, filters);
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setRegenerating(null);
    }
  };

  const baseColumns = [
    {
      title: 'Invoice / Receipt',
      key: 'invoice',
      render: (_: unknown, row: SubscriptionPayment) => (
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-muted" />
          <div>
            <p className="m-0 text-sm font-medium">
              {row.invoiceNumber ?? <span className="text-subtle">-</span>}
            </p>
            <p className="m-0 text-xs text-subtle">
              {row.gateway === 'manual' ? 'Manual' : 'Razorpay'} ·
              <span className="ml-1 capitalize">{row.paymentMode.replace('_', '-')}</span>
            </p>
          </div>
        </div>
      ),
    },
    {
      title: 'Plan',
      key: 'plan',
      render: (_: unknown, row: SubscriptionPayment) => {
        const planObj = typeof row.planId === 'object' ? row.planId : null;
        return (
          <div>
            <p className="m-0 text-sm font-medium">{planObj?.name ?? '-'}</p>
            <p className="m-0 text-xs text-subtle capitalize">{row.billingCycle}</p>
          </div>
        );
      },
    },
    {
      title: 'Amount',
      key: 'amount',
      align: 'right' as const,
      render: (_: unknown, row: SubscriptionPayment) => (
        <div className="text-right">
          <p className="m-0 text-sm font-semibold">{Money.fromPaise(row.totalPaise).format()}</p>
          {row.discountPaise > 0 && (
            <p className="m-0 text-xs text-green-700">
              −{Money.fromPaise(row.discountPaise).format()} coupon
            </p>
          )}
        </div>
      ),
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
      render: (_: unknown, row: SubscriptionPayment) => {
        const d = row.capturedAt ?? row.createdAt;
        return (
          <span className="text-sm text-muted">{d ? dayjs(d).format('DD MMM YYYY') : '-'}</span>
        );
      },
    },
    {
      title: '',
      key: 'actions',
      align: 'right' as const,
      render: (_: unknown, row: SubscriptionPayment) => {
        const canDownload = !!row.invoiceNumber && row.status === 'captured';
        const canRegenerate = row.status === 'captured' && !row.invoiceNumber;
        return (
          <div className="flex items-center justify-end gap-1">
            {canDownload && (
              <Tooltip title="Download invoice PDF">
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={downloading === row._id}
                  onClick={() => handleDownload(row)}
                >
                  PDF
                </Button>
              </Tooltip>
            )}
            {canRegenerate && (
              <Tooltip title="Generate invoice">
                <Button
                  size="small"
                  icon={<ReloadOutlined />}
                  loading={regenerating === row._id}
                  onClick={() => handleRegenerate(row)}
                >
                  Generate
                </Button>
              </Tooltip>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card className="rounded-2xl">
      {ctx}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          allowClear
          placeholder="Search invoice number"
          aria-label="Search invoice number"
          prefix={<SearchOutlined className="text-muted" />}
          value={filters.invoiceNumber ?? ''}
          onChange={(e) => {
            setFilters((f) => ({ ...f, invoiceNumber: e.target.value || undefined }));
            setPage(1);
          }}
          style={{ width: 220 }}
        />

        {!invoicesOnly && (
          <Select
            allowClear
            placeholder="Status"
            aria-label="Filter by payment status"
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
        )}

        <DatePicker.RangePicker
          value={filters.dateRange ?? undefined}
          aria-label="Filter by date range"
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
        <Empty description={invoicesOnly ? 'No invoices yet' : 'No payments yet'} />
      ) : (
        <Table
          dataSource={items}
          columns={baseColumns}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 'max-content' }}
          pagination={{
            current: page,
            pageSize: PAGE_SIZE,
            total,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
          }}
        />
      )}
    </Card>
  );
}
