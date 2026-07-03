'use client';
// Capital Goods ITC Schedules list. Polish slot: i18n via finance.purchases
// (capitalGoodsItc.* + listCol.*) and DsPageHeader. Status filter sits in the header
// right slot; rows are amortisation schedules sourced from posted bills with capital goods.
// Error/retry copy reuses finance.sales.listCommon (already in all locales).
// Cross-link: components/finance/ListErrorState.
import React, { startTransition, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Tag, Select } from 'antd';
import { FileDoneOutlined } from '@ant-design/icons';
import { useWorkspaceStore } from '@/lib/store';
import { listCapitalGoodsItcSchedules } from '@/lib/actions/finance-purchases.actions';
import DsTable from '@/components/ui/DsTable';
import { DsPageHeader } from '@/components/ui';
import { ListErrorState } from '@/components/finance/ListErrorState';
import type { CapitalGoodsItcSchedule } from '@/types';

const STATUS_COLOR: Record<string, string> = {
  amortising: 'blue',
  completed: 'green',
  reversed: 'default',
};

const formatPaise = (v: number) =>
  `₹${(v / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

export default function CapitalGoodsItcPage() {
  const { firmId } = useParams<{ firmId: string }>();
  const t = useTranslations('finance.purchases');
  const tErr = useTranslations('finance.sales.listCommon'); // shared error/retry copy
  const wsId = useWorkspaceStore((s) => s.currentWorkspace?._id ?? '');
  const isHydrated = useWorkspaceStore((s) => s.isHydrated);

  const [schedules, setSchedules] = useState<CapitalGoodsItcSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false); // distinguishes a failed fetch from an empty list
  const [reloadKey, setReloadKey] = useState(0); // bumped by the error-state Retry button
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!wsId || !isHydrated) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    listCapitalGoodsItcSchedules(wsId, firmId, statusFilter)
      .then((data) => setSchedules(Array.isArray(data) ? data : []))
      .catch(() => {
        setSchedules([]);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, isHydrated, firmId, statusFilter, reloadKey]);

  const columns = [
    {
      title: t('listCol.item'),
      dataIndex: 'itemName',
      key: 'itemName',
    },
    {
      title: t('listCol.sourceBill'),
      dataIndex: 'sourceBillNumber',
      key: 'sourceBillNumber',
      render: (v: string) => v ?? '-',
    },
    {
      title: t('listCol.totalItc'),
      dataIndex: 'totalItcPaise',
      key: 'totalItcPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('listCol.monthly'),
      dataIndex: 'monthlyAmountPaise',
      key: 'monthlyAmountPaise',
      align: 'right' as const,
      render: (v: number) => formatPaise(v),
    },
    {
      title: t('listCol.amortised'),
      key: 'progress',
      align: 'center' as const,
      render: (_: unknown, r: CapitalGoodsItcSchedule) => (
        <span>
          {r.monthsAmortised}/{r.monthsTotal}
        </span>
      ),
    },
    {
      title: t('listCol.nextRelease'),
      dataIndex: 'nextAmortisationMonth',
      key: 'nextRelease',
      render: (v: string) => v ?? '-',
    },
    {
      title: t('listCol.status'),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s.toUpperCase()}</Tag>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('capitalGoodsItc.title')}
        icon={<FileDoneOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Select
            aria-label={t('capitalGoodsItc.filterStatus')}
            placeholder={t('capitalGoodsItc.filterStatus')}
            allowClear
            style={{ width: 180 }}
            options={[
              { value: 'amortising', label: t('capitalGoodsItc.status.amortising') },
              { value: 'completed', label: t('capitalGoodsItc.status.completed') },
              { value: 'reversed', label: t('capitalGoodsItc.status.reversed') },
            ]}
            onChange={setStatusFilter}
          />
        }
      />
      {error ? (
        <ListErrorState
          title={tErr('errorTitle')}
          body={tErr('errorBody')}
          retryLabel={tErr('retry')}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <DsTable
          dataSource={schedules}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scrollX={800}
        />
      )}
    </div>
  );
}
