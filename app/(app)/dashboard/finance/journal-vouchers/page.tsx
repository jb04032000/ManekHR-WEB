'use client';
// Journal vouchers list (Finance > Payments & Banking). Polish: i18n via
// finance.banking.journalVouchers + DsPageHeader. Links to journal-vouchers/new + contras/new.
import { startTransition, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Tag, Space, Spin, Empty, Typography, Segmented, DatePicker } from 'antd';
import { PlusOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import dayjs from 'dayjs';
import { DsPageHeader, InfoTooltip } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import { listJournalVouchers } from '@/lib/actions/finance-journal.actions';
import type { JournalVoucher, Firm } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATE_COLORS: Record<string, string> = {
  draft: 'orange',
  posted: 'green',
  cancelled: 'red',
};

const TYPE_COLORS: Record<string, string> = {
  journal: 'blue',
  contra: 'purple',
};

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format((paise ?? 0) / 100);
}

export default function JournalVouchersPage() {
  const router = useRouter();
  const t = useTranslations('finance.banking');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';
  const [firms, setFirms] = useState<Firm[]>([]);
  const [items, setItems] = useState<JournalVoucher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [page, setPage] = useState(1);

  const firmId = firms[0]?._id ?? '';

  // Persist the status filter per firm (survives navigation / reload).
  const [stateFilter, setStateFilter] = usePersistedState<string>(
    `finance:journalVouchers:state:${firmId || 'global'}`,
    'all',
  );

  useEffect(() => {
    if (!wsId) return;
    listFirms(wsId)
      .then((f) => setFirms(f ?? []))
      .catch(() => {});
  }, [wsId]);

  useEffect(() => {
    if (!wsId || !firmId) return;
    startTransition(() => {
      setLoading(true);
      setError(false);
    });
    const filters: Record<string, unknown> = { page, limit: 20 };
    if (stateFilter !== 'all') filters.state = stateFilter;
    if (dateRange) {
      filters.dateFrom = dateRange[0];
      filters.dateTo = dateRange[1];
    }
    listJournalVouchers(wsId, firmId, filters)
      .then((res) => {
        setItems(res.items ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, [wsId, firmId, stateFilter, dateRange, page, reloadKey]);

  const columns: ColumnsType<JournalVoucher> = [
    {
      title: t('journalVouchers.col.voucherNo'),
      dataIndex: 'voucherNumber',
      render: (v) => v ?? <Text type="secondary">{t('common.stateDraft')}</Text>,
    },
    {
      title: t('journalVouchers.col.date'),
      dataIndex: 'voucherDate',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: t('journalVouchers.col.type'),
      dataIndex: 'voucherType',
      render: (v) => <Tag color={TYPE_COLORS[v] ?? 'default'}>{String(v).toUpperCase()}</Tag>,
    },
    {
      title: t('journalVouchers.col.narration'),
      dataIndex: 'narration',
      ellipsis: true,
    },
    {
      title: t('journalVouchers.col.totalDebit'),
      dataIndex: 'totalDebitPaise',
      render: (v) => formatPaise(v ?? 0),
      align: 'right',
    },
    {
      title: t('journalVouchers.col.state'),
      dataIndex: 'state',
      render: (v) => <Tag color={STATE_COLORS[v] ?? 'default'}>{String(v).toUpperCase()}</Tag>,
    },
    {
      title: <span className="sr-only">{t('journalVouchers.col.actions')}</span>,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}>
            {t('common.view')}
          </Button>
        </Space>
      ),
    },
  ];

  if (!firmId && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description={t('journalVouchers.noFirm')} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('journalVouchers.title')}
        icon={<FileTextOutlined />}
        titleAside={<InfoTooltip text={t('journalVouchers.info')} />}
        style={{ marginBottom: 16 }}
        right={
          <Space>
            <Button
              icon={<PlusOutlined />}
              onClick={() => router.push('/dashboard/finance/contras/new')}
            >
              {t('journalVouchers.newContra')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/dashboard/finance/journal-vouchers/new')}
            >
              {t('journalVouchers.newJournal')}
            </Button>
          </Space>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Segmented
          options={[
            { label: t('common.stateAll'), value: 'all' },
            { label: t('common.stateDraft'), value: 'draft' },
            { label: t('common.statePosted'), value: 'posted' },
            { label: t('common.stateCancelled'), value: 'cancelled' },
          ]}
          value={stateFilter}
          onChange={(v) => {
            setStateFilter(String(v));
            setPage(1);
          }}
        />
        <RangePicker
          onChange={(_, strs) => {
            setDateRange(strs[0] && strs[1] ? [strs[0], strs[1]] : null);
            setPage(1);
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
      ) : loading ? (
        <Spin style={{ display: 'block', marginTop: 48 }} />
      ) : items.length === 0 ? (
        <Empty description={t('journalVouchers.empty')} />
      ) : (
        <DsTable
          dataSource={items}
          columns={columns}
          rowKey="_id"
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showSizeChanger: false,
          }}
          size="small"
        />
      )}
    </div>
  );
}
