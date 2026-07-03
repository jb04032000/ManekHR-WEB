'use client';
// Expenses list (firm-scoped expense vouchers). Polish slot: i18n via
// finance.purchases.expenses (col.*, filter.*, action.*) and DsPageHeader. Rows link to
// the expense detail; "New Expense" / "Recurring" open the respective editors. Data
// fetching, pagination, and the cancel flow are unchanged.
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Button,
  Tag,
  Space,
  Spin,
  Empty,
  Typography,
  DatePicker,
  Segmented,
  Tooltip,
  message,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  StopOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/lib/store';
import { listFirms } from '@/lib/actions/finance.actions';
import { listExpenses, cancelExpense } from '@/lib/actions/finance-expenses.actions';
import { DsPageHeader } from '@/components/ui';
import DsTable from '@/components/ui/DsTable';
import { ListErrorState } from '@/components/finance/ListErrorState';
import { usePersistedState } from '@/hooks/usePersistedState';
import type { ExpenseVoucher, ExpenseVoucherState, Firm } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { Text } = Typography;
const { RangePicker } = DatePicker;

const STATE_COLORS: Record<string, string> = {
  draft: 'orange',
  posted: 'green',
  cancelled: 'red',
};

function formatPaise(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(rupees);
}

export default function ExpensesListPage() {
  const router = useRouter();
  const t = useTranslations('finance.purchases.expenses');
  // tShared only sources the shared list error-state labels (finance.sales.listCommon.*).
  const tShared = useTranslations('finance.sales');
  const { currentWorkspace } = useWorkspaceStore();
  const wsId = currentWorkspace?._id ?? '';

  const [firms, setFirms] = useState<Firm[]>([]);
  const [items, setItems] = useState<ExpenseVoucher[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const firmId = firms[0]?._id ?? '';

  // Persist the status filter per firm (survives navigation / reload).
  const [stateFilter, setStateFilter] = usePersistedState<string>(
    `finance:expenses:state:${firmId || 'global'}`,
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
    listExpenses(wsId, firmId, filters)
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

  function handleCancel(id: string) {
    const reason = window.prompt(t('cancelPrompt'));
    if (!reason) return;
    setCancellingId(id);
    startTransition(async () => {
      try {
        await cancelExpense(wsId, firmId, id, reason);
        message.success(t('cancelled'));
        setItems((prev) =>
          prev.map((v) => (v._id === id ? { ...v, state: 'cancelled' as ExpenseVoucherState } : v)),
        );
      } catch {
        message.error(t('cancelFailed'));
      } finally {
        setCancellingId(null);
      }
    });
  }

  const columns: ColumnsType<ExpenseVoucher> = [
    {
      title: t('col.voucherNo'),
      dataIndex: 'voucherNumber',
      render: (v) => v ?? <Text type="secondary">{t('draft')}</Text>,
    },
    {
      title: t('col.date'),
      dataIndex: 'voucherDate',
      render: (v) => dayjs(v).format('DD MMM YYYY'),
    },
    {
      title: t('col.vendorNarration'),
      dataIndex: 'narration',
      ellipsis: true,
    },
    {
      title: t('col.taxable'),
      dataIndex: 'taxableValuePaise',
      render: (v) => formatPaise(v ?? 0),
      align: 'right',
    },
    {
      title: t('col.gst'),
      dataIndex: 'totalGstPaise',
      render: (v) => formatPaise(v ?? 0),
      align: 'right',
    },
    {
      title: t('col.netPayable'),
      dataIndex: 'netPayablePaise',
      render: (v) => <Text strong>{formatPaise(v ?? 0)}</Text>,
      align: 'right',
    },
    {
      title: t('col.state'),
      dataIndex: 'state',
      render: (v) => <Tag color={STATE_COLORS[v] ?? 'default'}>{String(v).toUpperCase()}</Tag>,
    },
    {
      title: t('col.actions'),
      render: (_, record) => (
        <Space size="small">
          <Tooltip title={t('action.view')}>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => router.push(`/dashboard/finance/expenses/${record._id}`)}
            />
          </Tooltip>
          {record.state === 'draft' && (
            <Tooltip title={t('action.edit')}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => router.push(`/dashboard/finance/expenses/${record._id}?edit=1`)}
              />
            </Tooltip>
          )}
          {record.state === 'posted' && (
            <Tooltip title={t('action.cancel')}>
              <Button
                size="small"
                danger
                icon={<StopOutlined />}
                loading={cancellingId === record._id}
                onClick={() => handleCancel(record._id)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (!firmId && !loading) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description={t('noFirm')} />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <DsPageHeader
        title={t('title')}
        icon={<WalletOutlined />}
        style={{ marginBottom: 16 }}
        right={
          <Space>
            <Button onClick={() => router.push('/dashboard/finance/expenses/recurring')}>
              {t('recurring')}
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => router.push('/dashboard/finance/expenses/new')}
            >
              {t('new')}
            </Button>
          </Space>
        }
      />

      <Space style={{ marginBottom: 16 }} wrap>
        <Segmented
          options={[
            { label: t('filter.all'), value: 'all' },
            { label: t('filter.draft'), value: 'draft' },
            { label: t('filter.posted'), value: 'posted' },
            { label: t('filter.cancelled'), value: 'cancelled' },
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
        <Empty description={t('emptyBody')} />
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
