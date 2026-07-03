'use client';
// Goods Receipt Notes list. Polish slot: i18n via finance.purchases (grn.* + listCol.*)
// and DsPageHeader. Rows link to the GRN detail page; "New GRN" opens the GRN editor.
// Error/retry copy reuses finance.sales.listCommon (already in all locales) to avoid adding
// new keys mid-translation-batch. Cross-link: components/finance/ListErrorState.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Row, Col, Input, DatePicker } from 'antd';
import { PlusOutlined, InboxOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listGrns } from '@/lib/actions/finance-purchases.actions';
import DsTable from '@/components/ui/DsTable';
import DsButton from '@/components/ui/DsButton';
import { DsPageHeader } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { GoodsReceiptNote } from '@/types';
import dayjs from 'dayjs';

const STATE_COLOR: Record<string, string> = {
  draft: 'default',
  received: 'success',
  cancelled: 'error',
};

export default function GrnListPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const router = useRouter();
  const t = useTranslations('finance.purchases');
  const tErr = useTranslations('finance.sales.listCommon'); // shared error/retry copy
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [grns, setGrns] = useState<GoodsReceiptNote[]>([]);
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
    // Server-side filters (backend GRN list supports state/date/q). Date sent as ISO; party
    // search (q) matches voucher number prefix or party name.
    const query: Record<string, unknown> = {};
    if (dateRange?.[0]) query.dateFrom = dateRange[0].toISOString();
    if (dateRange?.[1]) query.dateTo = dateRange[1].toISOString();
    if (party) query.q = party;
    listGrns(wsId, firmId, query)
      .then((data) => setGrns(Array.isArray(data) ? data : []))
      .catch(() => {
        setGrns([]);
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
    },
    {
      title: t('listCol.vendor'),
      key: 'vendor',
      render: (_: unknown, r: GoodsReceiptNote) => r.partySnapshot?.name ?? r.partyId ?? '-',
    },
    {
      title: t('listCol.poRef'),
      dataIndex: 'sourcePoNumber',
      key: 'sourcePoNumber',
      render: (v?: string) => v ?? '-',
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
      render: (_: unknown, r: GoodsReceiptNote) => (
        <DsButton
          dsVariant="ghost"
          dsSize="sm"
          onClick={() => router.push(`/dashboard/finance/firms/${firmId}/purchases/grn/${r._id}`)}
        >
          {t('action.view')}
        </DsButton>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('grn.title')}
        icon={<InboxOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <DsButton
            dsVariant="primary"
            icon={<PlusOutlined />}
            onClick={() => router.push(`/dashboard/finance/firms/${firmId}/purchases/grn/new`)}
          >
            {t('grn.new')}
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
          dataSource={grns}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scrollX={700}
        />
      )}
    </div>
  );
}
