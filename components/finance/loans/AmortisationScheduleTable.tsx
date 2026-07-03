'use client';

import { useEffect, useState, useTransition } from 'react';
import { Table, Tag, Button, Typography, Switch, Space, Spin, Empty, message, Modal } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { getLoanSchedule, runEmiNow } from '@/lib/actions/finance-loans.actions';
import type { LoanScheduleEntry } from '@/types';
import dayjs from 'dayjs';

const { Text } = Typography;

function formatPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'gold',
  paid: 'success',
  prepaid: 'purple',
  overdue: 'error',
};

interface AmortisationScheduleTableProps {
  loanId: string;
  wsId: string;
  firmId: string;
  onRefresh?: () => void;
}

export default function AmortisationScheduleTable({
  loanId,
  wsId,
  firmId,
  onRefresh,
}: AmortisationScheduleTableProps) {
  const [schedule, setSchedule] = useState<LoanScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPendingOnly, setShowPendingOnly] = useState(false);
  const [runningEmiId, setRunningEmiId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    if (!wsId || !firmId || !loanId) return;
    setLoading(true);
    getLoanSchedule(wsId, firmId, loanId)
      .then(setSchedule)
      .catch(() => setSchedule([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [wsId, firmId, loanId]); // eslint-disable-line

  const handleRunEmi = (entry: LoanScheduleEntry) => {
    Modal.confirm({
      title: `Post EMI for ${entry.month}?`,
      content:
        'This will post the EMI ledger entry for this month. The operation is idempotent - safe to run multiple times.',
      onOk: async () => {
        setRunningEmiId(entry._id);
        try {
          const result = await runEmiNow(wsId, firmId, loanId);
          if (result.skipped) {
            message.info('EMI already posted for this period.');
          } else {
            message.success(`EMI posted (Ledger Entry: ${result.ledgerEntryId ?? 'created'})`);
          }
          load();
          onRefresh?.();
        } catch (e: unknown) {
          message.error(e instanceof Error ? e.message : 'Failed to post EMI');
        } finally {
          setRunningEmiId(null);
        }
      },
    });
  };

  const thisMonth = currentYearMonth();

  const displayRows = showPendingOnly
    ? schedule.filter((r) => r.status === 'pending' || r.status === 'overdue')
    : schedule;

  const columns: ColumnsType<LoanScheduleEntry> = [
    {
      title: 'Month',
      dataIndex: 'month',
      key: 'month',
      width: 100,
      render: (m) => <Text strong={m === thisMonth}>{m}</Text>,
    },
    {
      title: 'Opening',
      dataIndex: 'openingPrincipalPaise',
      key: 'opening',
      align: 'right',
      render: (p) => formatPaise(p),
    },
    {
      title: 'EMI',
      dataIndex: 'emiAmountPaise',
      key: 'emi',
      align: 'right',
      render: (p) => <Text strong>{formatPaise(p)}</Text>,
    },
    {
      title: 'Principal',
      dataIndex: 'principalComponentPaise',
      key: 'principal',
      align: 'right',
      render: (p) => formatPaise(p),
    },
    {
      title: 'Interest',
      dataIndex: 'interestComponentPaise',
      key: 'interest',
      align: 'right',
      render: (p) => <Text type="warning">{formatPaise(p)}</Text>,
    },
    {
      title: 'Closing',
      dataIndex: 'closingPrincipalPaise',
      key: 'closing',
      align: 'right',
      render: (p) => formatPaise(p),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s) => (
        <Tag color={STATUS_COLORS[s] ?? 'default'}>{s.charAt(0).toUpperCase() + s.slice(1)}</Tag>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 120,
      render: (_, entry) => {
        if (entry.status === 'paid') {
          return entry.ledgerEntryId ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Paid {entry.paidOn ? dayjs(entry.paidOn).format('DD MMM') : ''}
            </Text>
          ) : null;
        }
        if (entry.status === 'prepaid') {
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Prepaid
            </Text>
          );
        }
        // Show Run EMI for pending rows where month <= current month
        const canRun = entry.status === 'pending' && entry.month <= thisMonth;
        const isRunning = runningEmiId === entry._id || isPending;
        return canRun ? (
          <Button
            size="small"
            type="primary"
            loading={isRunning}
            onClick={() => handleRunEmi(entry)}
          >
            Run EMI
          </Button>
        ) : null;
      },
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spin />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Space>
        <Text>Show Pending Only:</Text>
        <Switch checked={showPendingOnly} onChange={setShowPendingOnly} />
        <Text type="secondary">
          {schedule.filter((r) => r.status === 'paid').length} / {schedule.length} EMIs paid
        </Text>
      </Space>

      {displayRows.length === 0 ? (
        <Empty description="No schedule entries found" />
      ) : (
        <Table
          rowKey="_id"
          dataSource={displayRows}
          columns={columns}
          size="small"
          scroll={{ x: 800 }}
          pagination={displayRows.length > 60 ? { pageSize: 60 } : false}
          rowClassName={(rec) => (rec.month === thisMonth ? 'bg-blue-50' : '')}
          sticky
        />
      )}
    </div>
  );
}
