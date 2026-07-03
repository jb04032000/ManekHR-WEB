'use client';
// Finance polish (job-work): i18n via finance.jobWork.invoices + .listCommon; DsPageHeader
// title. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  Tag,
  Button,
  Select,
  DatePicker,
  Input,
  Skeleton,
  Spin,
  Tabs,
  Empty,
  Checkbox,
} from 'antd'; // R10: Checkbox for the needs-attention quarantine filter
import { EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DsPageHeader } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listJwInvoices } from '@/lib/actions/finance/job-work.actions';
import { listParties } from '@/lib/actions/finance.actions';
import type { JobWorkInvoice, Party } from '@/types';
import dayjs from 'dayjs';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--cr-info-bg)', color: 'var(--cr-info)' },
  posted: { bg: 'var(--cr-success-bg)', color: 'var(--cr-success)' },
  cancelled: { bg: 'var(--cr-error-bg)', color: 'var(--cr-error)' },
};

const PAYMENT_STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  unpaid: { bg: 'var(--cr-warning-bg)', color: 'var(--cr-warning)' },
  partial: { bg: 'var(--cr-orange-bg)', color: 'var(--cr-orange)' },
  paid: { bg: 'var(--cr-success-bg)', color: 'var(--cr-success)' },
};

export default function JwInvoicesPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const router = useRouter();
  const t = useTranslations('finance.jobWork');
  const tShared = useTranslations('finance.sales'); // R10: shared listCommon.needsAttention label
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [invoices, setInvoices] = useState<JobWorkInvoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Per-firm saved status tab (platform bar): persists across reloads. Cross-link usePersistedState.
  const [statusTab, setStatusTab] = usePersistedState<string>(
    `finance:jobWork:invoices:status:${firmId}`,
    'all',
  );
  const [partyFilter, setPartyFilter] = useState<string | undefined>();
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [needsAttention, setNeedsAttention] = useState(false); // R10: show only the failed-post quarantine bucket
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    null,
    null,
  ]);

  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    listParties(wsId, firmId, { pageSize: 100 })
      .then((res) => setParties(res.items ?? []))
      .catch(() => {});
  }, [wsId, firmId, jobWorkAccess.isLocked]);

  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listJwInvoices(wsId, firmId, {
      status: statusTab === 'all' ? undefined : statusTab,
      partyId: partyFilter,
      paymentStatus: paymentStatusFilter,
      postingStatus: needsAttention ? 'needs_attention' : undefined, // R10: quarantine filter -> BE postingStatus
      dateFrom: dateRange[0]?.format('YYYY-MM-DD'),
      dateTo: dateRange[1]?.format('YYYY-MM-DD'),
      page,
      pageSize,
    })
      .then((res) => {
        setInvoices(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setInvoices([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [
    wsId,
    firmId,
    statusTab,
    partyFilter,
    paymentStatusFilter,
    needsAttention, // R10: re-fetch when the quarantine filter toggles
    dateRange,
    page,
    reloadKey, // bumped by the error-state Retry button
    jobWorkAccess.isLocked,
  ]);

  if (jobWorkAccess.isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (jobWorkAccess.isLocked) {
    return <ModuleLockedPage module="job_work" />;
  }

  // Client-side quick-filter over the loaded page (the list endpoint has no
  // search param) - matches voucher number or party name, case-insensitive.
  const searchQuery = search.trim().toLowerCase();
  const filteredInvoices = searchQuery
    ? invoices.filter((inv) => {
        const voucher = (inv.voucherNumber ?? '').toLowerCase();
        const party =
          typeof inv.partyId === 'object' && inv.partyId !== null
            ? ((inv.partyId as { name?: string }).name ?? '').toLowerCase()
            : '';
        return voucher.includes(searchQuery) || party.includes(searchQuery);
      })
    : invoices;

  const columns: ColumnsType<JobWorkInvoice> = [
    {
      title: t('listCommon.voucherNo'),
      dataIndex: 'voucherNumber',
      render: (v: string) => (
        <span style={{ color: 'var(--cr-primary)', fontWeight: 600, fontSize: 14 }}>
          {v || t('listCommon.draftBadge')}
        </span>
      ),
    },
    {
      title: t('listCommon.date'),
      dataIndex: 'voucherDate',
      render: (v: string) => <span style={{ fontSize: 14 }}>{dayjs(v).format('DD MMM YYYY')}</span>,
    },
    {
      title: t('listCommon.party'),
      dataIndex: 'partyId',
      render: (v: unknown) => {
        const p = v as { name?: string; gstin?: string } | string;
        if (typeof p === 'object' && p !== null) {
          return (
            <div>
              <div style={{ fontSize: 14 }}>{p.name}</div>
              {p.gstin && <div style={{ fontSize: 13, color: 'var(--cr-text-3)' }}>{p.gstin}</div>}
            </div>
          );
        }
        return <span style={{ fontSize: 14, color: 'var(--cr-text-3)' }}>{String(p)}</span>;
      },
    },
    {
      title: t('invoices.colSubTotal'),
      dataIndex: 'subTotalPaise',
      align: 'right',
      render: (v: number) => <span style={{ fontSize: 14 }}>₹{((v ?? 0) / 100).toFixed(2)}</span>,
    },
    {
      title: t('invoices.colTax'),
      render: (_v, row) => {
        const tax = (row.cgstPaise ?? 0) + (row.sgstPaise ?? 0) + (row.igstPaise ?? 0);
        return <span style={{ fontSize: 14 }}>₹{(tax / 100).toFixed(2)}</span>;
      },
      align: 'right',
    },
    {
      title: t('invoices.colTotal'),
      dataIndex: 'totalPaise',
      align: 'right',
      render: (v: number) => (
        <span style={{ fontSize: 14, fontWeight: 600 }}>₹{((v ?? 0) / 100).toFixed(2)}</span>
      ),
    },
    {
      title: t('invoices.colPayment'),
      dataIndex: 'paymentStatus',
      width: 100,
      render: (v: string) => {
        const c = PAYMENT_STATUS_COLOR[v] ?? {
          bg: 'var(--cr-surface-2)',
          color: 'var(--cr-text-3)',
        };
        return (
          <Tag style={{ background: c.bg, color: c.color, border: 'none' }}>{v?.toUpperCase()}</Tag>
        );
      },
    },
    {
      title: t('listCommon.status'),
      dataIndex: 'status',
      width: 90,
      // R10: keep the normal status badge; ADD a warning tag when the BE flagged a failed post.
      render: (v: string, row: JobWorkInvoice) => {
        const c = STATUS_COLOR[v] ?? { bg: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' };
        return (
          <>
            <Tag style={{ background: c.bg, color: c.color, border: 'none' }}>
              {v?.toUpperCase()}
            </Tag>
            {(row as { postingStatus?: string }).postingStatus === 'needs_attention' && (
              <Tag color="warning">{tShared('listCommon.needsAttention')}</Tag>
            )}
          </>
        );
      },
    },
    {
      title: <span className="sr-only">{t('listCommon.actions')}</span>,
      width: 60,
      render: (_v, row) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() =>
            router.push(`/dashboard/finance/firms/${firmId}/job-work/invoices/${row._id}`)
          }
        />
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <DsPageHeader
        title={t('invoices.title')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 16 }}
      />

      {/* Filter bar */}
      <div
        style={{
          background: 'var(--cr-surface)',
          borderRadius: 8,
          padding: '8px 16px',
          border: '1px solid var(--cr-border)',
          marginBottom: 16,
        }}
      >
        <Tabs
          activeKey={statusTab}
          onChange={setStatusTab}
          size="small"
          items={[
            { key: 'all', label: t('listCommon.all') },
            { key: 'draft', label: t('listCommon.draft') },
            { key: 'posted', label: t('listCommon.posted') },
            { key: 'cancelled', label: t('listCommon.cancelled') },
          ]}
        />
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 8 }}>
          <Select
            aria-label={t('listCommon.filterByParty')}
            allowClear
            placeholder={t('listCommon.filterByParty')}
            style={{ minWidth: 200 }}
            value={partyFilter}
            onChange={setPartyFilter}
            options={parties.map((p) => ({ value: p._id, label: p.name }))}
          />
          <Select
            aria-label={t('invoices.filterByPaymentStatus')}
            allowClear
            placeholder={t('invoices.paymentStatus')}
            style={{ minWidth: 160 }}
            value={paymentStatusFilter}
            onChange={setPaymentStatusFilter}
            options={[
              { value: 'unpaid', label: t('invoices.paymentUnpaid') },
              { value: 'partial', label: t('invoices.paymentPartial') },
              { value: 'paid', label: t('invoices.paymentPaid') },
            ]}
          />
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(range) => setDateRange(range as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD MMM YYYY"
          />
          <Input.Search
            aria-label={t('invoices.searchInvoices')}
            placeholder={t('listCommon.search')}
            allowClear
            style={{ minWidth: 200, marginLeft: 'auto' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {/* R10: quick filter to the failed-post quarantine bucket (postingStatus=needs_attention). */}
          <Checkbox
            checked={needsAttention}
            onChange={(e) => setNeedsAttention(e.target.checked)}
            style={{ alignSelf: 'center' }}
          >
            {tShared('listCommon.needsAttention')}
          </Checkbox>
        </div>
      </div>

      {/* Table */}
      {error ? (
        <ListErrorState
          title={tShared('listCommon.errorTitle')}
          body={tShared('listCommon.errorBody')}
          retryLabel={tShared('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(5)].map((_, i) => (
            <Skeleton.Input key={i} active style={{ height: 44, width: '100%' }} />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div
                style={{
                  fontSize: 16,
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                {t('invoices.emptyTitle')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--cr-text-3)', marginBottom: 16 }}>
                {t('invoices.emptyBody')}
              </div>
              <Button
                type="primary"
                onClick={() =>
                  router.push(`/dashboard/finance/firms/${firmId}/job-work/outward-challans/new`)
                }
              >
                {t('invoices.emptyCta')}
              </Button>
            </div>
          }
        />
      ) : filteredInvoices.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('invoices.noMatch', { query: search.trim() })}
        />
      ) : (
        <DsTable<JobWorkInvoice>
          dataSource={filteredInvoices}
          columns={columns}
          rowKey="_id"
          size="middle"
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showSizeChanger: false,
          }}
          onRow={(row) => ({
            style: { cursor: 'pointer' },
            onClick: () =>
              router.push(`/dashboard/finance/firms/${firmId}/job-work/invoices/${row._id}`),
          })}
        />
      )}
    </div>
  );
}
