'use client';
// Purchase Bills list. Polish slot: i18n via finance.purchases (bills.* + listCol.*)
// and DsPageHeader. Rows link to the purchase-bill detail page; "New Bill" opens the
// PurchaseBillForm editor. Shared TDS/payment-status colour maps stay local.
// Finance/Bills hardening (2026-06-15) Pillar 4: migrated from useEffect+useState
// to React Query (stable ['purchaseBills', wsId, firmId, needsAttention] key +
// 30s staleTime), added an error state (was a silent empty list on failure).
import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Checkbox, Result } from 'antd'; // R10: Checkbox for the needs-attention quarantine filter
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useWorkspaceStore } from '@/lib/store';
import { listPurchaseBills } from '@/lib/actions/finance-purchases.actions';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import type { PurchaseBill } from '@/types';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  unpaid: 'warning',
  partial: 'processing',
  paid: 'success',
  overdue: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PurchaseBillsListPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases');
  const tShared = useTranslations('finance.sales'); // R10: shared listCommon.needsAttention label
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [needsAttention, setNeedsAttention] = useState(false); // R10: show only the failed-post quarantine bucket

  // React Query: stable key includes the firm + the needsAttention filter so the
  // quarantine toggle re-fetches and each view caches independently. `enabled`
  // gates on hydration so we don't fire with an empty wsId. On error we surface
  // an error state instead of a silent empty list (Pillar 3).
  const {
    data: bills = [],
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['purchaseBills', wsId, firmId, needsAttention],
    queryFn: () => {
      const params: Record<string, unknown> = {};
      if (needsAttention) params.postingStatus = 'needs_attention'; // R10: quarantine filter -> BE postingStatus
      return listPurchaseBills(wsId, firmId, params);
    },
    enabled: !!wsId && isHydrated,
    staleTime: 30_000,
  });

  const columns = [
    {
      title: t('listCol.voucherNo'),
      dataIndex: 'voucherNumber',
      key: 'voucherNumber',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('listCol.vendorBillNo'),
      dataIndex: 'vendorBillNumber',
      key: 'vendorBillNumber',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('listCol.date'),
      dataIndex: 'voucherDate',
      key: 'voucherDate',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
    },
    {
      title: t('listCol.vendor'),
      key: 'vendor',
      render: (_: unknown, r: PurchaseBill) => r.partySnapshot?.name ?? r.partyId ?? '-',
    },
    {
      title: t('listCol.grandTotal'),
      dataIndex: 'grandTotalPaise',
      key: 'grandTotalPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('listCol.netPayable'),
      dataIndex: 'netPayableToCreditorsAfterTdsPaise',
      key: 'netPayable',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('listCol.tds194Q'),
      key: 'tds',
      render: (_: unknown, r: PurchaseBill) =>
        r.tds194Q ? (
          <Tag color="orange">{formatPaise(r.tds194Q.tdsPaise)}</Tag>
        ) : (
          <span style={{ color: '#ccc' }}>-</span>
        ),
    },
    {
      title: t('listCol.payment'),
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      render: (s: string) => (
        <Tag color={PAYMENT_STATUS_COLOR[s] ?? 'default'}>{s.toUpperCase()}</Tag>
      ),
    },
    {
      title: t('listCol.state'),
      dataIndex: 'state',
      key: 'state',
      // R10: keep the normal state badge; ADD a warning tag when the BE flagged a failed post.
      render: (s: string, r: PurchaseBill) => (
        <>
          <Tag color={STATE_COLOR[s] ?? 'default'}>{s.toUpperCase()}</Tag>
          {(r as { postingStatus?: string }).postingStatus === 'needs_attention' && (
            <Tag color="warning">{tShared('listCommon.needsAttention')}</Tag>
          )}
        </>
      ),
    },
    {
      title: t('listCol.actions'),
      key: 'actions',
      render: (_: unknown, r: PurchaseBill) => (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          onClick={() =>
            router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-bills/${r._id}`)
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
        title={t('bills.title')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/purchases/purchase-bills/new`)
            }
          >
            {t('bills.new')}
          </DsButton>
        }
      />
      {/* R10: quick filter to the failed-post quarantine bucket (postingStatus=needs_attention). */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center' }}>
        <Checkbox checked={needsAttention} onChange={(e) => setNeedsAttention(e.target.checked)}>
          {tShared('listCommon.needsAttention')}
        </Checkbox>
      </div>
      {isError ? (
        // Error state — never a silent empty list on a failed fetch (Pillar 3).
        <Result
          status="warning"
          title={tShared('listCommon.errorTitle')}
          subTitle={tShared('listCommon.errorBody')}
          extra={
            <DsButton dsVariant="primary" onClick={() => refetch()}>
              {tShared('listCommon.retry')}
            </DsButton>
          }
        />
      ) : (
        <DsTable
          dataSource={bills}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scrollX={1100}
        />
      )}
    </div>
  );
}
