'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import {
  Card,
  Table,
  Tag,
  Input,
  Select,
  DatePicker,
  Button,
  Empty,
  Spin,
  Drawer,
  Descriptions,
  message,
} from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { adminQueryAuditLog } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AuditActorType, AuditLogQuery, BillingAuditEntry } from '@/types';

const ACTOR_COLORS: Record<AuditActorType, string> = {
  admin: 'geekblue',
  self: 'green',
  system: 'purple',
  webhook: 'gold',
};

interface FilterState {
  action?: string;
  actorType?: AuditActorType;
  actorUserId?: string;
  targetUserId?: string;
  subscriptionId?: string;
  paymentId?: string;
  dateRange?: [Dayjs, Dayjs] | null;
}

const PAGE_SIZE = 25;

interface Props {
  /** When set, restrict to one entity (audit table embedded in detail page). */
  scope?: {
    targetUserId?: string;
    subscriptionId?: string;
    paymentId?: string;
  };
}

export function AuditLogTable({ scope }: Props) {
  const [items, setItems] = useState<BillingAuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FilterState>({});
  const [viewing, setViewing] = useState<BillingAuditEntry | null>(null);
  const [msgApi, ctx] = message.useMessage();

  const fetchPage = useCallback(
    async (nextPage: number, nextFilters: FilterState) => {
      startTransition(() => {
        setLoading(true);
      });
      try {
        const query: AuditLogQuery = {
          limit: PAGE_SIZE,
          offset: (nextPage - 1) * PAGE_SIZE,
          ...scope,
        };
        if (nextFilters.action) query.action = nextFilters.action;
        if (nextFilters.actorType) query.actorType = nextFilters.actorType;
        if (nextFilters.actorUserId) query.actorUserId = nextFilters.actorUserId;
        if (nextFilters.targetUserId) query.targetUserId = nextFilters.targetUserId;
        if (nextFilters.subscriptionId) query.subscriptionId = nextFilters.subscriptionId;
        if (nextFilters.paymentId) query.paymentId = nextFilters.paymentId;
        if (nextFilters.dateRange?.[0]) query.dateFrom = nextFilters.dateRange[0].toISOString();
        if (nextFilters.dateRange?.[1])
          query.dateTo = nextFilters.dateRange[1].endOf('day').toISOString();

        const res = await adminQueryAuditLog(query);
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
    [msgApi, scope],
  );

  useEffect(() => {
    fetchPage(page, filters);
  }, [page, filters, fetchPage]);

  return (
    <Card className="rounded-2xl">
      {ctx}

      {!scope && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Input
            allowClear
            placeholder="Action filter (e.g. admin.refund_approved)"
            prefix={<SearchOutlined className="text-muted" />}
            value={filters.action ?? ''}
            onChange={(e) => {
              setFilters((f) => ({ ...f, action: e.target.value || undefined }));
              setPage(1);
            }}
            style={{ width: 280 }}
          />
          <Select
            allowClear
            placeholder="Actor type"
            value={filters.actorType}
            onChange={(v) => {
              setFilters((f) => ({ ...f, actorType: v }));
              setPage(1);
            }}
            options={[
              { value: 'admin', label: 'Admin' },
              { value: 'self', label: 'Customer' },
              { value: 'system', label: 'System' },
              { value: 'webhook', label: 'Webhook' },
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
      )}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No audit events match these filters" />
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
              title: 'When',
              dataIndex: 'occurredAt',
              key: 'occurredAt',
              render: (d: string) =>
                d ? (
                  <span className="text-xs text-muted">
                    {dayjs(d).format('DD MMM YYYY HH:mm:ss')}
                  </span>
                ) : (
                  '-'
                ),
            },
            {
              title: 'Actor',
              key: 'actor',
              render: (_: unknown, row: BillingAuditEntry) => (
                <Tag color={ACTOR_COLORS[row.actorType]}>{row.actorType}</Tag>
              ),
            },
            {
              title: 'Action',
              dataIndex: 'action',
              key: 'action',
              render: (a: string) => <span className="font-mono text-xs">{a}</span>,
            },
            {
              title: 'Target user',
              dataIndex: 'targetUserId',
              key: 'targetUserId',
              render: (id?: string) =>
                id ? <span className="font-mono text-xs">{id.slice(0, 12)}…</span> : '-',
            },
            {
              title: 'Sub',
              dataIndex: 'subscriptionId',
              key: 'subscriptionId',
              render: (id?: string) =>
                id ? <span className="font-mono text-xs">{id.slice(0, 10)}…</span> : '-',
            },
            {
              title: <span className="sr-only">Actions</span>,
              key: 'view',
              align: 'right' as const,
              render: (_: unknown, row: BillingAuditEntry) => (
                <Button size="small" icon={<EyeOutlined />} onClick={() => setViewing(row)}>
                  Details
                </Button>
              ),
            },
          ]}
        />
      )}

      <Drawer
        open={!!viewing}
        onClose={() => setViewing(null)}
        width={520}
        title={viewing?.action ?? 'Audit event'}
      >
        {viewing && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Action">{viewing.action}</Descriptions.Item>
              <Descriptions.Item label="Actor type">
                <Tag color={ACTOR_COLORS[viewing.actorType]}>{viewing.actorType}</Tag>
              </Descriptions.Item>
              {viewing.actorUserId && (
                <Descriptions.Item label="Actor user">
                  <span className="font-mono text-xs">{viewing.actorUserId}</span>
                </Descriptions.Item>
              )}
              {viewing.targetUserId && (
                <Descriptions.Item label="Target user">
                  <span className="font-mono text-xs">{viewing.targetUserId}</span>
                </Descriptions.Item>
              )}
              {viewing.subscriptionId && (
                <Descriptions.Item label="Subscription">
                  <span className="font-mono text-xs">{viewing.subscriptionId}</span>
                </Descriptions.Item>
              )}
              {viewing.paymentId && (
                <Descriptions.Item label="Payment">
                  <span className="font-mono text-xs">{viewing.paymentId}</span>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="Occurred at">
                {dayjs(viewing.occurredAt).format('DD MMM YYYY HH:mm:ss')}
              </Descriptions.Item>
              {viewing.ipAddress && (
                <Descriptions.Item label="IP">{viewing.ipAddress}</Descriptions.Item>
              )}
              {viewing.userAgent && (
                <Descriptions.Item label="User-Agent">
                  <span className="text-xs">{viewing.userAgent}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
            {viewing.metadata && (
              <>
                <p className="mt-4 mb-2 text-sm font-semibold">Metadata</p>
                <pre className="max-h-[400px] overflow-auto rounded-lg bg-gray-50 p-3 text-xs">
                  {JSON.stringify(viewing.metadata, null, 2)}
                </pre>
              </>
            )}
          </>
        )}
      </Drawer>
    </Card>
  );
}
