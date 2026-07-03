'use client';
// Payment-Out list. Polish slot: i18n via finance.purchases (paymentOut.* + listCol.*)
// and DsPageHeader. Rows link to the payment-out detail; "New Payment-Out" opens the
// PaymentOutForm editor. Payment-mode labels stay a local map (display-only).
// Error/retry copy reuses finance.sales.listCommon (already in all locales) to avoid adding
// new keys mid-translation-batch. Cross-link: components/finance/ListErrorState.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Row, Col, Input, DatePicker } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useWorkspaceStore } from '@/lib/store';
import { listPaymentOuts } from '@/lib/actions/finance-purchases.actions';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { PaymentOut } from '@/types';
import dayjs from 'dayjs';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  bank: 'Bank',
  upi: 'UPI',
  cheque: 'Cheque',
  neft: 'NEFT',
  rtgs: 'RTGS',
  imps: 'IMPS',
};

export default function PaymentOutListPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases');
  const tErr = useTranslations('finance.sales.listCommon'); // shared error/retry copy
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [paymentOuts, setPaymentOuts] = useState<PaymentOut[]>([]);
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
    // Server-side filters (backend payment-out list supports state/date/q). Date sent as ISO;
    // party search (q) matches voucher number prefix or party name.
    const query: Record<string, unknown> = {};
    if (dateRange?.[0]) query.dateFrom = dateRange[0].toISOString();
    if (dateRange?.[1]) query.dateTo = dateRange[1].toISOString();
    if (party) query.q = party;
    listPaymentOuts(wsId, firmId, query)
      .then((data) => setPaymentOuts(Array.isArray(data) ? data : []))
      .catch(() => {
        setPaymentOuts([]);
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
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
    },
    {
      title: t('listCol.vendor'),
      key: 'vendor',
      render: (_: unknown, r: PaymentOut) => r.partySnapshot?.name ?? r.partyId ?? '-',
    },
    {
      title: t('listCol.mode'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (m: string) => PAYMENT_MODE_LABELS[m] ?? m,
    },
    {
      title: t('listCol.total'),
      dataIndex: 'totalAmountPaise',
      key: 'totalAmountPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('listCol.tds'),
      key: 'tds',
      align: 'right' as const,
      render: (_: unknown, r: PaymentOut) =>
        r.tdsApplied ? (
          <Tag color="orange">{formatPaise(r.tdsApplied.tdsPaise)}</Tag>
        ) : (
          <span style={{ color: '#ccc' }}>-</span>
        ),
    },
    {
      title: t('listCol.netPaid'),
      dataIndex: 'netPaidPaise',
      key: 'netPaidPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
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
      render: (_: unknown, r: PaymentOut) => (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          onClick={() =>
            router.push(`/dashboard/finance/firms/${firmId}/purchases/payment-out/${r._id}`)
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
        title={t('paymentOut.title')}
        icon={<RupeeOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/purchases/payment-out/new`)
            }
          >
            {t('paymentOut.new')}
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
          dataSource={paymentOuts}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scrollX={900}
        />
      )}
    </div>
  );
}
