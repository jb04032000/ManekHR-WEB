'use client';
import { startTransition, useEffect, useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Row, Col, DatePicker, Select, Input, Space, Tag, Checkbox } from 'antd';
import {
  PlusOutlined,
  PrinterOutlined,
  MailOutlined,
  MoreOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import { Can } from '@/components/rbac/Can';
import { BulkActionBar, type BulkAction } from '@/components/ui/BulkActionBar';
import { VoucherStatusBadge, EInvoiceBadge } from '@/components/finance/sales/VoucherStatusBadge';
import { SendInvoiceDialog } from '@/components/finance/sales/SendInvoiceDialog';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { SaleInvoice } from '@/types';
import type { Key } from 'react';
import dayjs from 'dayjs';

// The dropdown/checkbox filters are persisted per firm (platform bar: saved filter defaults);
// the date range and the free-text party search stay session-only (transient + non-serialisable).
interface PersistedFilters {
  state: string[];
  paymentStatus: string;
  einvoiceStatus: string;
  needsAttention: boolean; // R10: the failed-post quarantine bucket
}

export default function InvoicesPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  // Finance polish (slot 10, sales): i18n via finance.sales namespace. Column/filter labels
  // shared with the other voucher lists live under finance.sales.listCommon.
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [data, setData] = useState<SaleInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [sendOpen, setSendOpen] = useState<SaleInvoice | null>(null);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  const [party, setParty] = useState('');
  // Cross-link: hooks/usePersistedState.ts (localStorage, SSR-safe).
  const [filters, setFilters] = usePersistedState<PersistedFilters>(
    `finance:sales:invoices:filters:${firmId}`,
    { state: [], paymentStatus: 'all', einvoiceStatus: 'all', needsAttention: false },
  );

  useEffect(() => {
    if (!ws?._id) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    const p: Record<string, unknown> = {};
    if (dateRange?.[0]) p.dateFrom = dateRange[0].toISOString();
    if (dateRange?.[1]) p.dateTo = dateRange[1].toISOString();
    if (party) p.q = party;
    if (filters.state.length > 0) p.state = filters.state.join(',');
    if (filters.paymentStatus !== 'all') p.paymentStatus = filters.paymentStatus;
    if (filters.einvoiceStatus !== 'all') p.einvoiceStatus = filters.einvoiceStatus;
    if (filters.needsAttention) p.postingStatus = 'needs_attention'; // R10: quarantine filter
    financeSalesApi.invoices
      .list(ws._id, firmId, p)
      .then((res) => setData(res.data ?? []))
      .catch(() => {
        setData([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, dateRange, party, filters, reloadKey]);

  const fmt = (p?: number) =>
    p == null ? '-' : '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const columns = useMemo(
    () => [
      {
        title: t('listCommon.col.voucherNo'),
        dataIndex: 'voucherNumber',
        width: 140,
        render: (v: string, row: SaleInvoice) => (
          <Link
            href={`/dashboard/finance/firms/${firmId}/sales/invoices/${row._id}`}
            className="font-bold"
            style={{ color: 'var(--cr-primary)' }}
          >
            {v ?? '(draft)'}
          </Link>
        ),
      },
      {
        title: t('listCommon.col.date'),
        dataIndex: 'voucherDate',
        width: 100,
        sorter: (a: SaleInvoice, b: SaleInvoice) =>
          dayjs(a.voucherDate).valueOf() - dayjs(b.voucherDate).valueOf(),
        render: (d: string) => dayjs(d).format('DD MMM YYYY'),
      },
      {
        title: t('listCommon.col.party'),
        dataIndex: ['partySnapshot', 'name'],
        width: 180,
        ellipsis: true,
      },
      {
        title: t('listCommon.col.amount'),
        dataIndex: 'grandTotalPaise',
        width: 120,
        align: 'right' as const,
        sorter: (a: SaleInvoice, b: SaleInvoice) =>
          (a.grandTotalPaise ?? 0) - (b.grandTotalPaise ?? 0),
        render: fmt,
      },
      {
        title: t('listCommon.col.paid'),
        dataIndex: 'amountPaidPaise',
        width: 100,
        align: 'right' as const,
        render: (p: number) =>
          p > 0 ? <span style={{ color: 'var(--cr-success-700)' }}>{fmt(p)}</span> : fmt(p),
      },
      {
        title: t('listCommon.col.due'),
        dataIndex: 'amountDuePaise',
        width: 100,
        align: 'right' as const,
        sorter: (a: SaleInvoice, b: SaleInvoice) =>
          (a.amountDuePaise ?? 0) - (b.amountDuePaise ?? 0),
        render: (p: number, row: SaleInvoice) =>
          row.paymentStatus === 'overdue' ? (
            <span style={{ color: 'var(--cr-danger-700)' }}>{fmt(p)}</span>
          ) : (
            fmt(p)
          ),
      },
      {
        title: t('listCommon.col.status'),
        dataIndex: 'state',
        width: 120,
        // D23: surface a failed-post quarantine flag next to the normal status so a post that
        // rolled back (postingStatus='needs_attention', set by the BE on a posting failure) is
        // visible for follow-up rather than looking like an ordinary draft.
        render: (s: string, row: SaleInvoice) => (
          <Space size={4}>
            <VoucherStatusBadge state={s as Parameters<typeof VoucherStatusBadge>[0]['state']} />
            {(row as { postingStatus?: string }).postingStatus === 'needs_attention' && (
              <Tag color="warning">{t('listCommon.needsAttention')}</Tag>
            )}
          </Space>
        ),
      },
      {
        title: t('listCommon.col.eInvoice'),
        dataIndex: ['eInvoice', 'status'],
        width: 130,
        render: (s: string, row: SaleInvoice) => (
          <EInvoiceBadge
            status={(s ?? 'not_applicable') as Parameters<typeof EInvoiceBadge>[0]['status']}
            irn={row.eInvoice?.irn}
          />
        ),
      },
      {
        title: t('listCommon.col.lateFee'),
        dataIndex: 'lateFeeSchedule',
        width: 80,
        align: 'center' as const,
        render: (lfs: unknown) => (lfs ? '●' : '-'),
      },
      {
        title: t('listCommon.col.actions'),
        width: 100,
        render: (_: unknown, row: SaleInvoice) => (
          <Space size="small">
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<PrinterOutlined />}
              aria-label={t('listCommon.action.print')}
              onClick={() =>
                window.open(
                  `/dashboard/finance/firms/${firmId}/sales/invoices/${row._id}/print`,
                  '_blank',
                )
              }
            />
            <Can path="finance.invoice.send" scope="all">
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<MailOutlined />}
                aria-label={t('listCommon.action.send')}
                onClick={() => setSendOpen(row)}
              />
            </Can>
            <DsButton
              dsVariant="ghost"
              dsSize="sm"
              icon={<MoreOutlined />}
              aria-label={t('listCommon.action.more')}
            />
          </Space>
        ),
      },
    ],
    [firmId, t],
  );

  const bulkActions: BulkAction[] = [
    {
      key: 'send',
      label: t('listCommon.bulk.send'),
      onClick: () => {
        /* TODO: open send modal - Wave 8 */
      },
    },
    {
      key: 'print',
      label: t('listCommon.bulk.print'),
      onClick: () => {
        /* TODO: Wave 9 */
      },
    },
    {
      key: 'export-csv',
      label: t('listCommon.bulk.exportCsv'),
      onClick: () => {
        /* TODO: lazy export */
      },
    },
  ];

  return (
    <div>
      <DsPageHeader
        title={t('invoices.title')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Link href={`/dashboard/finance/firms/${firmId}/sales/invoices/new`}>
            <DsButton dsVariant="primary" icon={<PlusOutlined />}>
              {t('invoices.new')}
            </DsButton>
          </Link>
        }
      />

      {selectedKeys.length > 0 && (
        <BulkActionBar
          selectedCount={selectedKeys.length}
          selectionMode="mixed"
          actions={bulkActions}
          onClearSelection={() => setSelectedKeys([])}
        />
      )}

      <Row
        gutter={[12, 12]}
        className="mb-4 rounded-lg p-4"
        style={{
          background: 'var(--cr-surface, #fff)',
          borderBottom: '1px solid var(--cr-border, var(--cr-border-light))',
        }}
      >
        <Col>
          <DatePicker.RangePicker
            aria-label={t('listCommon.filter.dateRange')}
            value={dateRange}
            onChange={(v) => setDateRange(v as [dayjs.Dayjs, dayjs.Dayjs] | null)}
          />
        </Col>
        <Col>
          <Input
            aria-label={t('listCommon.filter.partySearch')}
            placeholder={t('listCommon.filter.partySearch')}
            value={party}
            onChange={(e) => setParty(e.target.value)}
            style={{ width: 200 }}
            allowClear
          />
        </Col>
        <Col>
          <Select
            mode="multiple"
            placeholder={t('listCommon.filter.status')}
            aria-label={t('listCommon.filter.status')}
            value={filters.state}
            onChange={(v) => setFilters((f) => ({ ...f, state: v }))}
            options={[
              { value: 'draft', label: t('listCommon.state.draft') },
              { value: 'pending_approval', label: t('listCommon.state.pendingApproval') },
              { value: 'posted', label: t('listCommon.state.posted') },
              { value: 'cancelled', label: t('listCommon.state.cancelled') },
            ]}
            style={{ width: 180 }}
          />
        </Col>
        <Col>
          <Select
            value={filters.paymentStatus}
            aria-label={t('listCommon.filter.allPayment')}
            onChange={(v) => setFilters((f) => ({ ...f, paymentStatus: v }))}
            options={[
              { value: 'all', label: t('listCommon.filter.allPayment') },
              { value: 'unpaid', label: t('listCommon.filter.unpaid') },
              { value: 'partial', label: t('listCommon.filter.partial') },
              { value: 'paid', label: t('listCommon.filter.paid') },
            ]}
            style={{ width: 140 }}
          />
        </Col>
        <Col>
          <Select
            value={filters.einvoiceStatus}
            aria-label={t('invoices.filter.allEInvoice')}
            onChange={(v) => setFilters((f) => ({ ...f, einvoiceStatus: v }))}
            options={[
              { value: 'all', label: t('invoices.filter.allEInvoice') },
              { value: 'generated', label: t('invoices.filter.generated') },
              { value: 'pending', label: t('invoices.filter.pending') },
              { value: 'not_applicable', label: t('invoices.filter.na') },
            ]}
            style={{ width: 160 }}
          />
        </Col>
        {/* R10: quick filter to the failed-post quarantine bucket (postingStatus=needs_attention). */}
        <Col style={{ display: 'flex', alignItems: 'center' }}>
          <Checkbox
            checked={filters.needsAttention}
            onChange={(e) => setFilters((f) => ({ ...f, needsAttention: e.target.checked }))}
          >
            {t('listCommon.needsAttention')}
          </Checkbox>
        </Col>
      </Row>

      {error ? (
        <ListErrorState
          title={t('listCommon.errorTitle')}
          body={t('listCommon.errorBody')}
          retryLabel={t('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && data.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-2 text-base font-bold">{t('invoices.emptyTitle')}</div>
          <div className="mb-4 text-sm" style={{ color: 'var(--cr-text-3)' }}>
            {t('invoices.emptyBody')}
          </div>
          <Link href={`/dashboard/finance/firms/${firmId}/sales/invoices/new`}>
            <DsButton dsVariant="primary">{t('invoices.new')}</DsButton>
          </Link>
        </div>
      ) : (
        <DsTable
          rowKey="_id"
          columns={columns}
          dataSource={data}
          loading={loading}
          selectedRowKeys={selectedKeys}
          onSelectionChange={(keys) => setSelectedKeys(keys)}
        />
      )}

      {sendOpen && (
        <SendInvoiceDialog
          open={!!sendOpen}
          invoice={sendOpen}
          firmId={firmId}
          onClose={() => setSendOpen(null)}
          onSent={() => setSendOpen(null)}
        />
      )}
    </div>
  );
}
