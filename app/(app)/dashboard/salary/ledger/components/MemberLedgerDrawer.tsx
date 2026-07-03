'use client';

import { useCallback, useEffect, useState, startTransition } from 'react';
import {
  Alert,
  App,
  Button,
  DatePicker,
  Drawer,
  Popconfirm,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { salaryApi } from '@/lib/api';
import { formatCurrencyFull, parseApiError } from '@/lib/utils';
import type { CashLedgerEntry, MemberLedgerResult } from '@/types';
import { SettleModal } from './SettleModal';

const { RangePicker } = DatePicker;
const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
  memberId: string;
  memberName: string;
  onSettled: () => void;
}

function BalanceDisplay({ balance }: { balance: number }) {
  const t = useTranslations('salary.ledger');
  if (balance > 0) {
    return (
      <div className="mb-4 flex items-center gap-2">
        <span
          className="rounded-lg px-4 py-2 text-xl font-bold"
          style={{ background: '#f6ffed', color: '#389e0d', border: '1px solid #b7eb8f' }}
        >
          {t('bakiLabel')}: {formatCurrencyFull(balance)}
        </span>
        <Text type="secondary" className="text-xs">
          {t('bakiExplain')}
        </Text>
      </div>
    );
  }
  if (balance < 0) {
    return (
      <div className="mb-4 flex items-center gap-2">
        <span
          className="rounded-lg px-4 py-2 text-xl font-bold"
          style={{ background: '#fff2f0', color: '#cf1322', border: '1px solid #ffa39e' }}
        >
          {t('udhaarLabel')}: {formatCurrencyFull(Math.abs(balance))}
        </span>
        <Text type="secondary" className="text-xs">
          {t('udhaarExplain')}
        </Text>
      </div>
    );
  }
  return (
    <div className="mb-4">
      <span
        className="rounded-lg px-4 py-2 text-xl font-bold"
        style={{ background: '#f0f0f0', color: '#595959', border: '1px solid #d9d9d9' }}
      >
        {t('balanceClear')}
      </span>
    </div>
  );
}

export function MemberLedgerDrawer({
  open,
  onClose,
  workspaceId,
  memberId,
  memberName,
  onSettled,
}: Props) {
  const t = useTranslations('salary.ledger');
  const { message } = App.useApp();

  const [result, setResult] = useState<MemberLedgerResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([
    null,
    null,
  ]);

  const load = useCallback(async () => {
    if (!memberId) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 200 };
      if (dateRange[0]) params.fromDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange[1]) params.toDate = dateRange[1].format('YYYY-MM-DD');
      const data = await salaryApi.getMemberCashLedger(
        workspaceId,
        memberId,
        params as Parameters<typeof salaryApi.getMemberCashLedger>[2],
      );
      startTransition(() => setResult(data));
    } catch (e) {
      void message.error(parseApiError(e) || t('loadError'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, memberId, dateRange, message, t]);

  useEffect(() => {
    // Fetch-on-open is the intended pattern here; the synchronous loading flag
    // is harmless for a drawer that only mounts its data when opened.

    if (open && memberId) void load();
  }, [open, memberId, load]);

  const handleDelete = async (entryId: string) => {
    setDeleting(entryId);
    try {
      await salaryApi.softDeleteLedgerEntry(workspaceId, entryId);
      void message.success(t('entryDeletedSuccess'));
      void load();
    } catch (e) {
      void message.error(parseApiError(e) || t('deleteError'));
    } finally {
      setDeleting(null);
    }
  };

  const typeColor: Record<string, string> = {
    earning: 'green',
    draw: 'red',
    settlement: 'blue',
    adjustment: 'orange',
  };

  const columns: ColumnsType<CashLedgerEntry> = [
    {
      title: t('colDate'),
      dataIndex: 'date',
      width: 100,
      render: (d: string) => dayjs(d).format('DD MMM YYYY'),
      sorter: (a, b) => dayjs(a.date).unix() - dayjs(b.date).unix(),
    },
    {
      title: t('colType'),
      dataIndex: 'type',
      width: 100,
      render: (type: string) => (
        <Tag color={typeColor[type] ?? 'default'}>
          {t(`type.${type}` as Parameters<typeof t>[0])}
        </Tag>
      ),
    },
    {
      title: t('colAmount'),
      dataIndex: 'amount',
      width: 110,
      align: 'right',
      render: (amt: number, row) => {
        const isNegative = row.type === 'adjustment' && amt < 0;
        return (
          <span style={{ color: isNegative ? '#cf1322' : undefined }}>
            {formatCurrencyFull(Math.abs(amt))}
          </span>
        );
      },
    },
    {
      title: t('colRunningBalance'),
      dataIndex: 'runningBalance',
      width: 120,
      align: 'right',
      render: (bal?: number) => {
        if (bal === undefined || bal === null) return '-';
        return (
          <span style={{ color: bal >= 0 ? '#389e0d' : '#cf1322', fontWeight: 600 }}>
            {formatCurrencyFull(bal)}
          </span>
        );
      },
    },
    {
      title: t('colNote'),
      dataIndex: 'note',
      ellipsis: true,
    },
    {
      title: '',
      width: 48,
      render: (_: unknown, row) => {
        if (row.type === 'settlement' || row.settledInEntryId) return null;
        return (
          <Popconfirm
            title={t('deleteConfirmTitle')}
            description={t('deleteConfirmDesc')}
            okText={t('deleteConfirmOk')}
            cancelText={t('cancelBtn')}
            onConfirm={() => handleDelete(row._id)}
          >
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              loading={deleting === row._id}
            />
          </Popconfirm>
        );
      },
    },
  ];

  const currentBalance = result?.currentBalance ?? 0;

  return (
    <>
      <Drawer
        open={open}
        onClose={onClose}
        title={t('memberDrawerTitle', { name: memberName })}
        size={700}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
            <Button
              type="primary"
              onClick={() => setSettleOpen(true)}
              disabled={currentBalance <= 0}
            >
              {t('settleBtn')}
            </Button>
          </Space>
        }
      >
        {loading && !result ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : (
          <>
            <BalanceDisplay balance={currentBalance} />

            <div className="mb-4">
              <RangePicker
                value={dateRange}
                onChange={(range) => setDateRange(range ?? [null, null])}
                format="DD MMM YYYY"
                allowClear
                placeholder={[t('fromDatePlaceholder'), t('toDatePlaceholder')]}
                disabledDate={(d) => d.isAfter(dayjs(), 'day')}
              />
              <Button className="ml-2" size="small" onClick={load} loading={loading}>
                {t('applyFilter')}
              </Button>
            </div>

            <Table<CashLedgerEntry>
              columns={columns}
              dataSource={result?.entries ?? []}
              rowKey="_id"
              size="small"
              pagination={{ pageSize: 50, showSizeChanger: false }}
              loading={loading}
              locale={{ emptyText: t('emptyLedger') }}
              scroll={{ x: 'max-content' }}
            />
          </>
        )}
      </Drawer>

      {settleOpen && (
        <SettleModal
          open={settleOpen}
          onClose={() => setSettleOpen(false)}
          workspaceId={workspaceId}
          memberIds={[memberId]}
          memberNames={{ [memberId]: memberName }}
          onSettled={() => {
            setSettleOpen(false);
            void load();
            onSettled();
          }}
        />
      )}
    </>
  );
}
