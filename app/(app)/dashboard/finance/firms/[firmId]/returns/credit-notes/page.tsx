'use client';
// Credit Notes list (sales returns). Platform-bar pass (Workstream 7 returns module):
// DsTable + ListErrorState (retry) + usePersistedState (per-firm saved status filter) +
// client-side party search + designed empty state. i18n via finance.purchases.returns
// (creditNotes.* + filter.*) and finance.sales.listCommon (shared error/retry/search labels).
// Cross-link: hooks/usePersistedState.ts, components/finance/ListErrorState.tsx, DsTable.
// Watch: BE listCreditNotes has no `q` param (polish-only, no endpoint change), so party
// search filters the loaded page client-side. postingStatus=needs_attention is the quarantine
// bucket flagged on the row.
import { startTransition, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Select, DatePicker, Space, Input, Checkbox } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listCreditNotes } from '@/lib/actions/finance-returns.actions';
import DsButton from '@/components/ui/DsButton';
import DsTable from '@/components/ui/DsTable';
import { DsPageHeader } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { CreditNote } from '@/types';
import dayjs from 'dayjs';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  posted: 'success',
  cancelled: 'error',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CreditNotesPage() {
  const router = useRouter();
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.purchases.returns');
  const tShared = useTranslations('finance.sales'); // shared listCommon.* labels (error/retry/search)
  const workspaceId = useWorkspaceStore((s) => s.currentWorkspace?._id);
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [items, setItems] = useState<CreditNote[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  // Per-firm saved status filter (platform bar): persists across reloads. Cross-link usePersistedState.
  const [stateFilter, setStateFilter] = usePersistedState<string | undefined>(
    `finance:returns:creditNotes:status:${firmId}`,
    undefined,
  );
  const [fromDate, setFromDate] = useState<string | undefined>(undefined);
  const [toDate, setToDate] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState(''); // client-side party/voucher search over the loaded page
  const [needsAttention, setNeedsAttention] = useState(false); // failed-post quarantine bucket

  useEffect(() => {
    if (!workspaceId || !isHydrated || !firmId) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listCreditNotes(workspaceId, firmId, {
      state: stateFilter,
      fromDate,
      toDate,
      limit: 50,
      skip: 0,
      ...(needsAttention ? { postingStatus: 'needs_attention' } : {}), // quarantine filter -> BE postingStatus
    })
      .then((r) => {
        setItems(r.items ?? []);
        setTotal(r.total ?? 0);
      })
      .catch(() => {
        setItems([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [workspaceId, isHydrated, firmId, stateFilter, fromDate, toDate, needsAttention, reloadKey]);

  // Client-side search: party name or voucher number contains the query (BE has no `q` param).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((cn) => {
      const party = (cn.partySnapshot as Record<string, string> | undefined)?.name ?? '';
      return party.toLowerCase().includes(q) || (cn.voucherNumber ?? '').toLowerCase().includes(q);
    });
  }, [items, search]);

  const columns = useMemo(
    () => [
      {
        title: t('creditNotes.col.voucherNo'),
        dataIndex: 'voucherNumber',
        width: 140,
        render: (v: string) => v ?? t('draftDash'),
      },
      {
        title: t('creditNotes.col.date'),
        dataIndex: 'voucherDate',
        width: 110,
        sorter: (a: CreditNote, b: CreditNote) =>
          dayjs(a.voucherDate).valueOf() - dayjs(b.voucherDate).valueOf(),
        render: (d: string) => dayjs(d).format('DD MMM YYYY'),
      },
      {
        title: t('creditNotes.col.party'),
        dataIndex: ['partySnapshot', 'name'],
        ellipsis: true,
        render: (_: unknown, row: CreditNote) =>
          (row.partySnapshot as Record<string, string> | undefined)?.name ?? '-',
      },
      {
        title: t('creditNotes.col.originalInvoice'),
        dataIndex: 'sourceInvoiceNumber',
        width: 150,
        render: (v?: string) => v ?? '-',
      },
      {
        title: t('creditNotes.col.amount'),
        dataIndex: 'grandTotalPaise',
        width: 130,
        align: 'right' as const,
        sorter: (a: CreditNote, b: CreditNote) =>
          (a.grandTotalPaise ?? 0) - (b.grandTotalPaise ?? 0),
        render: (v: number) => formatPaise(v),
      },
      {
        title: t('creditNotes.col.status'),
        dataIndex: 'state',
        width: 150,
        render: (s: string, row: CreditNote) => (
          <>
            <Tag color={STATE_COLOR[s] ?? 'default'}>{s.toUpperCase()}</Tag>
            {(row as { postingStatus?: string }).postingStatus === 'needs_attention' && (
              <Tag color="warning">{tShared('listCommon.needsAttention')}</Tag>
            )}
          </>
        ),
      },
    ],
    [t, tShared],
  );

  const goNew = () => router.push(`/dashboard/finance/firms/${firmId}/returns/credit-notes/new`);

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('creditNotes.title')}
        icon={<FileTextOutlined />}
        style={{ marginBottom: 24 }}
        right={
          <DsButton dsVariant="primary" onClick={goNew}>
            {t('creditNotes.new')}
          </DsButton>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          aria-label={tShared('listCommon.filter.partySearch')}
          placeholder={t('filter.searchParty')}
          allowClear
          style={{ width: 220 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          aria-label={t('filter.state')}
          placeholder={t('filter.allStates')}
          allowClear
          style={{ width: 150 }}
          value={stateFilter}
          options={[
            { value: 'draft', label: t('filter.draft') },
            { value: 'posted', label: t('filter.posted') },
            { value: 'cancelled', label: t('filter.cancelled') },
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
        {/* quick filter to the failed-post quarantine bucket (postingStatus=needs_attention). */}
        <Checkbox checked={needsAttention} onChange={(e) => setNeedsAttention(e.target.checked)}>
          {tShared('listCommon.needsAttention')}
        </Checkbox>
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
          <div className="mb-2 text-base font-bold">{t('creditNotes.emptyTitle')}</div>
          <div className="mb-4 text-sm" style={{ color: 'var(--cr-text-3)' }}>
            {t('creditNotes.emptyBody')}
          </div>
          <DsButton dsVariant="primary" onClick={goNew}>
            {t('creditNotes.new')}
          </DsButton>
        </div>
      ) : (
        <DsTable<CreditNote>
          rowKey="_id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          onRow={(row) => ({
            onClick: () =>
              router.push(`/dashboard/finance/firms/${firmId}/returns/credit-notes/${row._id}`),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--cr-text-3)' }}>
        {t('totalShowing', { total, shown: filtered.length })}
      </div>
    </div>
  );
}
