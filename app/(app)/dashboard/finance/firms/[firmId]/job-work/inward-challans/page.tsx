'use client';
// Finance polish (job-work): i18n via finance.jobWork.inward + .listCommon; DsPageHeader
// title + New action + InfoTooltip on the job-work concept. No data/columns logic changed.
import { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Button, Select, DatePicker, Input, Skeleton, Spin, Tabs, Empty } from 'antd';
import { EyeOutlined, PlusOutlined, ImportOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listJwInwardChallans } from '@/lib/actions/finance/job-work.actions';
import { listParties } from '@/lib/actions/finance.actions';
import type { JobWorkInwardChallan, Party } from '@/types';
import dayjs from 'dayjs';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { ModuleLockedPage } from '@/components/subscription/ModuleLockedPage';

const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
  draft: { bg: 'var(--cr-info-bg)', color: 'var(--cr-info)' },
  posted: { bg: 'var(--cr-success-bg)', color: 'var(--cr-success)' },
  closed: { bg: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' },
};

export default function InwardChallansPage() {
  const params = useParams<{ firmId: string }>();
  const firmId = params.firmId;
  const router = useRouter();
  const t = useTranslations('finance.jobWork');
  const tShared = useTranslations('finance.sales'); // shared listCommon.* labels (error/retry)
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const jobWorkAccess = useFeatureAccess('job_work');

  const [challans, setChallans] = useState<JobWorkInwardChallan[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Filters
  // Per-firm saved status tab (platform bar): persists across reloads. Cross-link usePersistedState.
  const [statusTab, setStatusTab] = usePersistedState<string>(
    `finance:jobWork:inward:status:${firmId}`,
    'all',
  );
  const [partyFilter, setPartyFilter] = useState<string | undefined>();
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    null,
    null,
  ]);

  // Load parties for filter
  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    listParties(wsId, firmId, { pageSize: 100 })
      .then((res) => setParties(res.items ?? []))
      .catch(() => {});
  }, [wsId, firmId, jobWorkAccess.isLocked]);

  // Load challans
  useEffect(() => {
    if (!wsId || !firmId || jobWorkAccess.isLocked) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listJwInwardChallans(wsId, firmId, {
      status: statusTab === 'all' ? undefined : statusTab,
      partyId: partyFilter,
      dateFrom: dateRange[0]?.format('YYYY-MM-DD'),
      dateTo: dateRange[1]?.format('YYYY-MM-DD'),
      page,
      pageSize,
    })
      .then((res) => {
        setChallans(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setChallans([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, firmId, statusTab, partyFilter, dateRange, page, reloadKey, jobWorkAccess.isLocked]);

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

  // Client-side quick-filter over the loaded page (the list endpoint has no search param) -
  // matches voucher number or party name, case-insensitive.
  const searchQuery = search.trim().toLowerCase();
  const filteredChallans = searchQuery
    ? challans.filter((c) => {
        const voucher = (c.voucherNumber ?? '').toLowerCase();
        const party =
          typeof c.partyId === 'object' && c.partyId !== null
            ? ((c.partyId as { name?: string }).name ?? '').toLowerCase()
            : '';
        return voucher.includes(searchQuery) || party.includes(searchQuery);
      })
    : challans;

  const columns: ColumnsType<JobWorkInwardChallan> = [
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
      title: t('inward.colLots'),
      dataIndex: 'lines',
      render: (lines: unknown[]) => (
        <span style={{ fontSize: 14 }}>{Array.isArray(lines) ? lines.length : 0}</span>
      ),
    },
    {
      title: t('listCommon.status'),
      dataIndex: 'status',
      render: (v: string) => {
        const c = STATUS_COLOR[v] ?? { bg: 'var(--cr-surface-2)', color: 'var(--cr-text-3)' };
        return (
          <Tag style={{ background: c.bg, color: c.color, border: 'none' }}>{v?.toUpperCase()}</Tag>
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
            router.push(`/dashboard/finance/firms/${firmId}/job-work/inward-challans/${row._id}`)
          }
        />
      ),
    },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <DsPageHeader
        title={t('inward.title')}
        icon={<ImportOutlined />}
        titleAside={<InfoTooltip text={t('listCommon.tip')} />}
        style={{ marginBottom: 16 }}
        right={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() =>
              router.push(`/dashboard/finance/firms/${firmId}/job-work/inward-challans/new`)
            }
          >
            {t('inward.new')}
          </Button>
        }
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
            { key: 'closed', label: t('listCommon.closed') },
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
          <DatePicker.RangePicker
            value={dateRange}
            onChange={(range) => setDateRange(range as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            format="DD MMM YYYY"
          />
          <Input.Search
            aria-label={t('listCommon.searchChallans')}
            placeholder={t('listCommon.search')}
            allowClear
            style={{ minWidth: 200, marginLeft: 'auto' }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
      ) : challans.length === 0 ? (
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
                {t('inward.emptyTitle')}
              </div>
              <div style={{ fontSize: 14, color: 'var(--cr-text-3)', marginBottom: 16 }}>
                {t('inward.emptyBody')}
              </div>
              <Button
                type="primary"
                onClick={() =>
                  router.push(`/dashboard/finance/firms/${firmId}/job-work/inward-challans/new`)
                }
              >
                {t('inward.emptyCta')}
              </Button>
            </div>
          }
        />
      ) : filteredChallans.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('inward.noMatch', { query: search.trim() })}
        />
      ) : (
        <DsTable<JobWorkInwardChallan>
          dataSource={filteredChallans}
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
              router.push(`/dashboard/finance/firms/${firmId}/job-work/inward-challans/${row._id}`),
          })}
        />
      )}
    </div>
  );
}
