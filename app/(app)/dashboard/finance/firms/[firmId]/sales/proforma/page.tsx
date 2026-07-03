'use client';
import { startTransition, useEffect, useState, useMemo, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Row, Col, Select, Input, Space, DatePicker } from 'antd';
import { PlusOutlined, MoreOutlined, FileTextOutlined } from '@ant-design/icons';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import { BulkActionBar, type BulkAction } from '@/components/ui/BulkActionBar';
import { VoucherStatusBadge } from '@/components/finance/sales/VoucherStatusBadge';
import { ConvertWizard } from '@/components/finance/sales/ConvertWizard';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { financeSalesApi } from '@/lib/api/modules/finance-sales.api';
import { useWorkspaceStore } from '@/lib/store';
import type { Proforma } from '@/types';
import type { Key } from 'react';
import dayjs from 'dayjs';

export default function ProformaPage({ params }: { params: Promise<{ firmId: string }> }) {
  const { firmId } = use(params);
  const t = useTranslations('finance.sales');
  const ws = useWorkspaceStore((s) => s.currentWorkspace);
  const [data, setData] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from a genuinely empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [selectedKeys, setSelectedKeys] = useState<Key[]>([]);
  const [party, setParty] = useState('');
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);
  // Per-firm saved filter default (platform bar): the status filter persists across reloads.
  // Date range + party text stay session-only. Cross-link: hooks/usePersistedState.ts.
  const [state, setState] = usePersistedState<string[]>(
    `finance:sales:proforma:status:${firmId}`,
    [],
  );
  const [convertOpen, setConvertOpen] = useState(false);

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
    if (state.length > 0) p.state = state.join(',');
    financeSalesApi.proforma
      .list(ws._id, firmId, p)
      .then((res) => setData(res.data ?? []))
      .catch(() => {
        setData([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [ws?._id, firmId, party, state, dateRange, reloadKey]);

  const fmt = (p?: number) =>
    p == null ? '-' : '₹' + (p / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });

  const columns = useMemo(
    () => [
      {
        title: t('listCommon.col.voucherNo'),
        dataIndex: 'voucherNumber',
        width: 140,
        render: (v: string, row: Proforma) => (
          <Link
            href={`/dashboard/finance/firms/${firmId}/sales/proforma/${row._id}`}
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
        sorter: (a: Proforma, b: Proforma) =>
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
        sorter: (a: Proforma, b: Proforma) => (a.grandTotalPaise ?? 0) - (b.grandTotalPaise ?? 0),
        render: fmt,
      },
      {
        title: t('listCommon.col.validUntil'),
        dataIndex: 'validUntilDate',
        width: 110,
        render: (d?: string) => (d ? dayjs(d).format('DD MMM YYYY') : '-'),
      },
      {
        title: t('listCommon.col.status'),
        dataIndex: 'state',
        width: 120,
        render: (s: string) => (
          <VoucherStatusBadge state={s as Parameters<typeof VoucherStatusBadge>[0]['state']} />
        ),
      },
      {
        title: t('listCommon.col.actions'),
        width: 80,
        render: () => (
          <Space size="small">
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
      key: 'convert',
      label: t('proforma.convertToInvoice'),
      onClick: () => setConvertOpen(true),
    },
  ];

  return (
    <div>
      <DsPageHeader
        title={t('proforma.title')}
        icon={<FileTextOutlined />}
        titleAside={<InfoTooltip text={t('proforma.explainer')} />}
        style={{ marginBottom: 16 }}
        right={
          <Link href={`/dashboard/finance/firms/${firmId}/sales/proforma/new`}>
            <DsButton dsVariant="primary" icon={<PlusOutlined />}>
              {t('proforma.new')}
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
            aria-label={t('listCommon.filter.status')}
            mode="multiple"
            placeholder={t('listCommon.filter.status')}
            value={state}
            onChange={setState}
            options={[
              { value: 'draft', label: t('listCommon.state.draft') },
              { value: 'posted', label: t('listCommon.state.posted') },
              { value: 'cancelled', label: t('listCommon.state.cancelled') },
            ]}
            style={{ width: 180 }}
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
      ) : !loading && data.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-2 text-base font-bold">{t('proforma.emptyTitle')}</div>
          <div className="mb-4 text-sm" style={{ color: 'var(--cr-text-3)' }}>
            {t('proforma.emptyBody')}
          </div>
          <Link href={`/dashboard/finance/firms/${firmId}/sales/proforma/new`}>
            <DsButton dsVariant="primary">{t('proforma.new')}</DsButton>
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

      <ConvertWizard
        open={convertOpen}
        sourceType="proforma"
        sourceIds={selectedKeys.map(String)}
        firmId={firmId}
        onClose={() => {
          setConvertOpen(false);
          setSelectedKeys([]);
        }}
      />
    </div>
  );
}
