'use client';

import { useEffect, useState, useCallback, startTransition } from 'react';
import Link from 'next/link';
import {
  Card,
  Table,
  Tag,
  Button,
  Input,
  Select,
  Spin,
  Empty,
  Tooltip,
  Popconfirm,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  TagOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { adminListCoupons, adminArchiveCoupon } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import { Money } from '@/lib/money';
import { CouponEditor } from '@/components/admin/billing/CouponEditor';
import type { Coupon } from '@/types';

export default function AdminCouponsPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>();
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    startTransition(() => {
      setLoading(true);
    });
    try {
      const res = await adminListCoupons({
        search: search || undefined,
        isActive:
          statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
        limit: 100,
      });
      startTransition(() => {
        setItems(res.items ?? []);
        setTotal(res.total ?? 0);
      });
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, msgApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleArchive = async (id: string) => {
    setArchiving(id);
    try {
      await adminArchiveCoupon(id);
      msgApi.success('Coupon archived');
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setArchiving(null);
    }
  };

  return (
    <Card
      className="rounded-2xl"
      title={
        <div className="flex items-center gap-2">
          <TagOutlined /> Coupons ({total})
        </div>
      }
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>
          New Coupon
        </Button>
      }
    >
      {ctx}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input.Search
          aria-label="Search coupons by code"
          allowClear
          placeholder="Search by code"
          value={search}
          onChange={(e) => setSearch(e.target.value.toUpperCase())}
          style={{ width: 240 }}
        />
        <Select
          aria-label="Filter by status"
          allowClear
          placeholder="Status"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Archived' },
          ]}
          style={{ width: 140 }}
        />
      </div>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      ) : items.length === 0 ? (
        <Empty description="No coupons yet" />
      ) : (
        <Table
          dataSource={items}
          rowKey="_id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20 }}
          columns={[
            {
              title: 'Code',
              dataIndex: 'code',
              key: 'code',
              render: (code: string, row: Coupon) => (
                <Link href={`/admin/billing/coupons/${row._id}`}>
                  <span className="font-mono font-semibold">{code}</span>
                </Link>
              ),
            },
            {
              title: 'Discount',
              key: 'discount',
              render: (_: unknown, row: Coupon) => {
                if (row.discountType === 'percentage')
                  return <Tag color="green">{row.valueOrPaise}% off</Tag>;
                if (row.discountType === 'fixed_amount')
                  return <Tag color="blue">{Money.fromPaise(row.valueOrPaise).format()} off</Tag>;
                return <Tag color="purple">Final {Money.fromPaise(row.valueOrPaise).format()}</Tag>;
              },
            },
            {
              title: 'Used',
              dataIndex: 'redemptionsCount',
              key: 'redemptionsCount',
              render: (n: number, row: Coupon) =>
                row.maxRedemptions ? `${n} / ${row.maxRedemptions}` : `${n}`,
            },
            {
              title: 'Stack',
              key: 'stack',
              render: (_: unknown, row: Coupon) =>
                row.isStackable ? <Tag color="cyan">Stackable</Tag> : <Tag>Solo</Tag>,
            },
            {
              title: 'First-time only',
              key: 'firstOnly',
              render: (_: unknown, row: Coupon) =>
                row.isFirstTimeOnly ? <Tag color="orange">Yes</Tag> : '-',
            },
            {
              title: 'Valid',
              key: 'valid',
              render: (_: unknown, row: Coupon) => {
                const f = row.validFrom ? dayjs(row.validFrom).format('DD MMM') : '-';
                const u = row.validUntil ? dayjs(row.validUntil).format('DD MMM') : '∞';
                return (
                  <span className="text-xs text-muted">
                    {f} → {u}
                  </span>
                );
              },
            },
            {
              title: 'Status',
              key: 'status',
              render: (_: unknown, row: Coupon) =>
                row.isActive ? <Tag color="green">Active</Tag> : <Tag color="red">Archived</Tag>,
            },
            {
              title: <span className="sr-only">Actions</span>,
              key: 'actions',
              align: 'right' as const,
              render: (_: unknown, row: Coupon) => (
                <div className="flex items-center justify-end gap-1">
                  <Tooltip title="View detail + stats">
                    <Link href={`/admin/billing/coupons/${row._id}`}>
                      <Button size="small" icon={<EyeOutlined />} />
                    </Link>
                  </Tooltip>
                  <Tooltip title="Edit">
                    <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(row)} />
                  </Tooltip>
                  {row.isActive && (
                    <Popconfirm
                      title="Archive this coupon?"
                      description="Existing redemptions stay; no new redemptions will succeed."
                      okText="Archive"
                      okButtonProps={{ danger: true, loading: archiving === row._id }}
                      onConfirm={() => handleArchive(row._id)}
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <CouponEditor
        open={creating || !!editing}
        coupon={editing}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          refresh();
        }}
      />
    </Card>
  );
}
