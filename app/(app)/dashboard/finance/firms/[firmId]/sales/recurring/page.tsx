'use client';
import { startTransition, useEffect, useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Row, Col, Select, Input, Space } from 'antd';
import {
  PlusOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { BulkActionBar, type BulkAction } from '@/components/ui/BulkActionBar';
import { EntitlementGate } from '@/components/finance/EntitlementGate';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { RecurringInvoiceTemplate } from '@/types';
import type { Key } from 'react';
import dayjs from 'dayjs';

export default function RecurringPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.sales');
  const FREQ_LABELS: Record<string, string> = {
    monthly: t('recurring.freq.monthly'),
    quarterly: t('recurring.freq.quarterly'),
    yearly: t('recurring.freq.yearly'),
    every_n_days: t('recurring.freq.customInterval'),
  };
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [data, setData] = useState<RecurringInvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [search, setSearch] = useState('');
  // Per-firm saved filter default (platform bar). The recurring-template list endpoint returns
  // every template (no server-side filter), so name search + active/paused status are applied
  // client-side over `data` below. Cross-link: hooks/usePersistedState.ts.
  const [status, setStatus] = usePersistedState<string>(
    `finance:sales:recurring:status:${firmId}`,
    'all',
  );

  useEffect(() => {
    if (!ws?._id) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    financeSalesApi.recurring
      .list(ws._id, firmId, {})
      .then((res) => setData(res.data ?? []))
      .catch(() => {
        setData([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, reloadKey]);

  // Client-side filter: name/party contains the search term, and active/paused matches `status`.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((row) => {
      if (status === 'active' && !row.isActive) return false;
      if (status === 'paused' && row.isActive) return false;
      if (!term) return true;
      const name = (row.templateName ?? '').toLowerCase();
      const partyName = (
        (row as { partySnapshot?: { name?: string } }).partySnapshot?.name ?? ''
      ).toLowerCase();
      return name.includes(term) || partyName.includes(term);
    });
  }, [data, search, status]);

  const columns = useMemo(
    () => [
      {
        title: t('recurring.col.templateName'),
        dataIndex: 'templateName',
        width: 180,
        render: (v: string, row: RecurringInvoiceTemplate) => (
          <Link
            href={`/dashboard/finance/firms/${firmId}/sales/recurring/${row._id}`}
            className="font-bold"
            style={{ color: 'var(--cr-primary)' }}
          >
            {v}
          </Link>
        ),
      },
      {
        title: t('recurring.col.voucherType'),
        dataIndex: 'voucherType',
        width: 130,
        render: () => t('recurring.taxInvoice'),
      },
      {
        title: t('listCommon.col.party'),
        dataIndex: ['partySnapshot', 'name'],
        width: 180,
        ellipsis: true,
      },
      {
        title: t('recurring.col.frequency'),
        dataIndex: ['schedule', 'mode'],
        width: 130,
        render: (m?: string) => (m ? (FREQ_LABELS[m] ?? m) : '-'),
      },
      {
        title: t('recurring.col.lastRun'),
        dataIndex: 'lastRunAt',
        width: 110,
        render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : t('recurring.never')),
      },
      {
        title: t('recurring.col.nextRun'),
        dataIndex: 'nextRunAt',
        width: 110,
        render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
      },
      {
        title: t('listCommon.col.status'),
        dataIndex: 'isActive',
        width: 100,
        render: (active: boolean) => (
          <span
            className="rounded px-2 py-1 text-xs font-bold"
            style={{
              background: active ? 'var(--cr-success-50)' : 'var(--cr-border-light)',
              color: active ? 'var(--cr-success-700)' : 'var(--cr-text-5)',
            }}
          >
            {active ? t('recurring.statusActive') : t('recurring.statusPaused')}
          </span>
        ),
      },
      {
        title: t('listCommon.col.actions'),
        width: 100,
        render: (_: unknown, row: RecurringInvoiceTemplate) => (
          <Space size="small">
            {row.isActive ? (
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<PauseCircleOutlined />}
                aria-label={t('recurring.action.pause')}
              />
            ) : (
              <DsButton
                dsVariant="ghost"
                dsSize="sm"
                icon={<PlayCircleOutlined />}
                aria-label={t('recurring.action.resume')}
              />
            )}
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
    [firmId, t, FREQ_LABELS],
  );

  const bulkActions: BulkAction[] = [
    {
      key: 'pause',
      label: t('recurring.bulkPause'),
      onClick: () => {
        /* TODO: Wave 8 */
      },
    },
  ];

  const content = (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <Link href={`/dashboard/finance/firms/${firmId}/sales/recurring/new`}>
          <DsButton dsVariant="primary" icon={<PlusOutlined />}>
            {t('recurring.new')}
          </DsButton>
        </Link>
      </div>

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
          <Input
            aria-label={t('recurring.filter.search')}
            placeholder={t('recurring.filter.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
        </Col>
        <Col>
          <Select
            placeholder={t('listCommon.filter.status')}
            value={status}
            onChange={setStatus}
            aria-label={t('listCommon.filter.status')}
            options={[
              { value: 'all', label: t('recurring.filter.all') },
              { value: 'active', label: t('recurring.statusActive') },
              { value: 'paused', label: t('recurring.statusPaused') },
            ]}
            style={{ width: 130 }}
          />
        </Col>
      </Row>

      {error ? (
        <ListErrorState
          title={t('listCommon.errorTitle')}
          body={t('listCommon.errorBody')}
          retryLabel={t('listCommon.retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : !loading && filtered.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-2 text-base font-bold">{t('recurring.emptyTitle')}</div>
          <div className="mb-4 text-sm" style={{ color: 'var(--cr-text-3)' }}>
            {t('recurring.emptyBody')}
          </div>
          <Link href={`/dashboard/finance/firms/${firmId}/sales/recurring/new`}>
            <DsButton dsVariant="primary">{t('recurring.new')}</DsButton>
          </Link>
        </div>
      ) : (
        <DsTable
          rowKey="_id"
          columns={columns}
          dataSource={filtered}
          loading={loading}
          selectedRowKeys={selectedKeys}
          onSelectionChange={(keys) => setSelectedKeys(keys)}
        />
      )}
    </div>
  );

  return (
    <div>
      <DsPageHeader
        title={t('recurring.title')}
        icon={<FileTextOutlined />}
        titleAside={<InfoTooltip text={t('recurring.explainer')} />}
        style={{ marginBottom: 16 }}
      />
      <EntitlementGate feature="sales_recurring" fallback="upsell-overlay">
        {content}
      </EntitlementGate>
    </div>
  );
}
