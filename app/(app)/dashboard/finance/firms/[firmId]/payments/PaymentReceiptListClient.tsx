'use client';
// Payment receipts list (Finance > Payments & Banking). Platform-bar pass (Workstream 7
// payments module): adds ListErrorState (retry) + usePersistedState (per-firm saved status
// filter) + server-side date range/status + client party/voucher search + a designed empty
// state with CTA. i18n via finance.banking.payments (+ finance.sales.listCommon for the shared
// error/retry/search/date labels). Cross-link: hooks/usePersistedState.ts,
// components/finance/ListErrorState.tsx, lib/actions/finance.actions.ts (listPaymentReceipts
// supports state/dateFrom/dateTo). Watch: the action filters party by id only, so the free-text
// search filters the loaded page client-side.
import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Typography, Space, Select, DatePicker, Input } from 'antd';
import { PlusOutlined, BankOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listPaymentReceipts } from '@/lib/actions/finance.actions';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { PaymentReceipt } from '@/types';

const STATE_COLORS: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (paise: number) =>
  `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function PaymentReceiptListClient() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.banking');
  const tShared = useTranslations('finance.sales'); // shared listCommon.* labels (error/retry/search/date)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // Per-firm saved status filter (platform bar): persists across reloads. Cross-link usePersistedState.
  const [stateFilter, setStateFilter] = usePersistedState<string | undefined>(
    `finance:payments:status:${firmId}`,
    undefined,
  );
  const [fromDate, setFromDate] = useState<string | undefined>(undefined);
  const [toDate, setToDate] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState(''); // client-side party/voucher search over the loaded page

  const PAYMENT_MODE_LABELS: Record<string, string> = {
    cash: t('payments.mode.cash'),
    bank: t('payments.mode.bank'),
    upi: t('payments.mode.upi'),
    cheque: t('payments.mode.cheque'),
    neft: t('payments.mode.neft'),
    rtgs: t('payments.mode.rtgs'),
    imps: t('payments.mode.imps'),
    razorpay: t('payments.mode.razorpay'),
    cashfree: t('payments.mode.cashfree'),
  };

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listPaymentReceipts(wsId, firmId, {
      state: stateFilter,
      dateFrom: fromDate,
      dateTo: toDate,
    })
      .then(setReceipts)
      .catch(() => {
        setReceipts([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, stateFilter, fromDate, toDate, reloadKey]);

  // Client-side search: party name or voucher number contains the query (the action filters
  // party by id, not free text).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter(
      (r) =>
        (r.partySnapshot?.name ?? '').toLowerCase().includes(q) ||
        (r.voucherNumber ?? '').toLowerCase().includes(q),
    );
  }, [receipts, search]);

  const columns = [
    {
      title: t('payments.col.voucherNo'),
      dataIndex: 'voucherNumber',
      key: 'voucherNumber',
      render: (v?: string) => v ?? '-',
    },
    {
      title: t('payments.col.date'),
      dataIndex: 'receiptDate',
      key: 'receiptDate',
      render: (d: string) => new Date(d).toLocaleDateString('en-IN'),
      sorter: (a: PaymentReceipt, b: PaymentReceipt) =>
        new Date(a.receiptDate).getTime() - new Date(b.receiptDate).getTime(),
    },
    {
      title: t('payments.col.party'),
      key: 'party',
      render: (_: unknown, r: PaymentReceipt) => r.partySnapshot?.name ?? r.partyId,
    },
    {
      title: t('payments.col.mode'),
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (m: string) => PAYMENT_MODE_LABELS[m] ?? m,
    },
    {
      title: t('payments.col.amount'),
      dataIndex: 'totalAmountPaise',
      key: 'totalAmountPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
      sorter: (a: PaymentReceipt, b: PaymentReceipt) => a.totalAmountPaise - b.totalAmountPaise,
    },
    {
      title: t('payments.col.appliedUnapplied'),
      key: 'applied',
      align: 'right' as const,
      render: (_: unknown, r: PaymentReceipt) => {
        const applied = r.totalAmountPaise - r.unappliedPaise;
        return (
          <span>
            {formatPaise(applied)}
            {r.unappliedPaise > 0 && (
              <Typography.Text type="warning" style={{ marginLeft: 4, fontSize: 11 }}>
                +{formatPaise(r.unappliedPaise)} {t('payments.advanceSuffix')}
              </Typography.Text>
            )}
          </span>
        );
      },
    },
    {
      title: t('payments.col.state'),
      dataIndex: 'state',
      key: 'state',
      render: (s: string) => <Tag color={STATE_COLORS[s] ?? 'default'}>{s.toUpperCase()}</Tag>,
    },
    {
      title: t('payments.col.actions'),
      key: 'actions',
      render: (_: unknown, r: PaymentReceipt) => (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/payments/${r._id}`)}
        >
          {t('common.view')}
        </DsButton>
      ),
    },
  ];

  const goNew = () => router.push(`/dashboard/finance/firms/${firmId}/payments/new`);

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('payments.title')}
        icon={<BankOutlined />}
        titleAside={<InfoTooltip text={t('payments.info')} />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton dsVariant="primary" icon={<PlusOutlined />} onClick={goNew}>
            {t('payments.new')}
          </DsButton>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          aria-label={t('payments.searchPlaceholder')}
          placeholder={t('payments.searchPlaceholder')}
          allowClear
          style={{ width: 240 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t('payments.filter.status')}
          placeholder={t('payments.filter.allStates')}
          allowClear
          style={{ width: 150 }}
          value={stateFilter}
          options={[
            { value: 'draft', label: t('payments.filter.draft') },
            { value: 'posted', label: t('payments.filter.posted') },
            { value: 'cancelled', label: t('payments.filter.cancelled') },
          ]}
          onChange={(v) => setStateFilter(v)}
        />
        <DatePicker.RangePicker
          aria-label={tShared('listCommon.filter.dateRange')}
          onChange={(dates) => {
            setFromDate(dates?.[0]?.toISOString());
            setToDate(dates?.[1]?.toISOString());
          }}
        />
      </Space>

      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-2 text-base font-bold">{t('payments.emptyTitle')}</div>
          <div className="mb-4 text-sm" style={{ color: 'var(--cr-text-3)' }}>
            {t('payments.emptyBody')}
          </div>
          <DsButton dsVariant="primary" icon={<PlusOutlined />} onClick={goNew}>
            {t('payments.new')}
          </DsButton>
        </div>
      ) : (
        <DsTable
          dataSource={filtered}
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
