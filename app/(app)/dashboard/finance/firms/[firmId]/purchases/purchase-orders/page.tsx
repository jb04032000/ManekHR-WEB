'use client';
// Purchase Orders list. Polish slot: i18n via finance.purchases (orders.* + listCol.*)
// and DsPageHeader. Rows link to the PO detail page; "New Order" opens the PO editor.
// Error/retry copy reuses finance.sales.listCommon (already in all locales) to avoid adding
// new keys mid-translation-batch. Cross-link: components/finance/ListErrorState.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Row, Col, Input, DatePicker } from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listPurchaseOrders } from '@/lib/actions/finance-purchases.actions';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { PurchaseOrder } from '@/types';
import dayjs from 'dayjs';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  confirmed: 'processing',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PurchaseOrdersListPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases');
  const tErr = useTranslations('finance.sales.listCommon'); // shared error/retry copy
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from an empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [party, setParty] = useState('');

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    // Server-side filters (backend list supports state/date/q). Date is sent as ISO; party
    // search (q) matches voucher number prefix or party name.
    const query: Record<string, unknown> = {};
    if (dateRange?.[0]) query.dateFrom = dateRange[0].toISOString();
    if (dateRange?.[1]) query.dateTo = dateRange[1].toISOString();
    if (party) query.q = party;
    listPurchaseOrders(wsId, firmId, query)
      .then((data) => setOrders(Array.isArray(data) ? data : []))
      .catch(() => {
        setOrders([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, reloadKey, dateRange, party]);

  const columns = [
    {
      title: t('listCol.voucherNo'),
      dataIndex: 'voucherNumber',
      key: 'voucherNumber',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('listCol.date'),
      dataIndex: 'voucherDate',
      key: 'voucherDate',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
      sorter: (a: PurchaseOrder, b: PurchaseOrder) =>
        new Date(a.voucherDate).getTime() - new Date(b.voucherDate).getTime(),
    },
    {
      title: t('listCol.party'),
      key: 'party',
      render: (_: unknown, r: PurchaseOrder) => r.partySnapshot?.name ?? r.partyId ?? '-',
    },
    {
      title: t('listCol.grandTotal'),
      dataIndex: 'grandTotalPaise',
      key: 'grandTotalPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
      sorter: (a: PurchaseOrder, b: PurchaseOrder) => a.grandTotalPaise - b.grandTotalPaise,
    },
    {
      title: t('listCol.state'),
      dataIndex: 'state',
      key: 'state',
      render: (s: string) => <Tag color={STATE_COLOR[s] ?? 'default'}>{s.toUpperCase()}</Tag>,
    },
    {
      title: t('listCol.actions'),
      key: 'actions',
      render: (_: unknown, r: PurchaseOrder) => (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          onClick={() =>
            router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-orders/${r._id}`)
          }
        >
          {t('action.view')}
        </DsButton>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('orders.title')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-orders/new`)
            }
          >
            {t('orders.new')}
          </DsButton>
        }
      />
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <DatePicker.RangePicker
            aria-label={tErr('filter.dateRange')}
            value={dateRange}
            onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
        </Col>
        <Col>
          <Input
            aria-label={tErr('filter.partySearch')}
            placeholder={tErr('filter.partySearch')}
            value={party}
            onChange={(e) => setParty(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
        </Col>
      </Row>
      {error ? (
        <ListErrorState
          title={tErr('errorTitle')}
          body={tErr('errorBody')}
          retryLabel={tErr('retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <DsTable
          dataSource={orders}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scrollX={800}
        />
      )}
    </div>
  );
}
