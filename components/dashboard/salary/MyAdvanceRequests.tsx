'use client';

// Worker-facing list of the member's own advance requests + live status.
// What it does: shows each request's period, requested/approved amount, status,
// and the reviewer's note. Refetches when `refreshKey` changes (the request
// drawer bumps it on submit).
// Links: salary.api.ts listMyAdvanceRequests -> GET /salary/advance-requests/mine (self);
//   AdvanceRequestDrawer (the submit that creates these rows).
// Watch: amounts are paise on the wire -> divide by 100 for display (same as the
//   owner AdvanceApprovalQueue).

import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Table, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { listMyAdvanceRequests } from '@/lib/api/modules/salary.api';
import type { AdvanceSalaryRequest } from '@/types';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

interface MyAdvanceRequestsProps {
  workspaceId: string;
  /** Bumped by the parent on a successful submit to force a refetch. */
  refreshKey?: number;
}

const STATUS_COLOR: Record<AdvanceSalaryRequest['status'], string> = {
  pending: 'gold',
  approved: 'blue',
  rejected: 'red',
  paid: 'green',
  cancelled: 'default',
};

export function MyAdvanceRequests({ workspaceId, refreshKey }: MyAdvanceRequestsProps) {
  const t = useTranslations('salary.mySalary');
  const currencyFmt = useCurrencyFormatter();
  const [requests, setRequests] = useState<AdvanceSalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listMyAdvanceRequests(workspaceId);
      setRequests(data);
    } catch (err) {
      setError(parseApiError(err) || t('myRequestsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const statusLabel = (status: AdvanceSalaryRequest['status']): string => {
    switch (status) {
      case 'pending':
        return t('requestStatusPending');
      case 'approved':
        return t('requestStatusApproved');
      case 'rejected':
        return t('requestStatusRejected');
      case 'paid':
        return t('requestStatusPaid');
      case 'cancelled':
        return t('requestStatusCancelled');
      default:
        return status;
    }
  };

  const columns: ColumnsType<AdvanceSalaryRequest> = [
    {
      title: t('requestColPeriod'),
      key: 'period',
      render: (_: unknown, r: AdvanceSalaryRequest) =>
        dayjs(`${r.year}-${String(r.month).padStart(2, '0')}-01`).format('MMM YYYY'),
    },
    {
      title: t('requestColRequested'),
      dataIndex: 'requestedAmount',
      key: 'requestedAmount',
      align: 'right',
      render: (paise: number) => (
        <span className="tabular-nums">{currencyFmt.inline(paise / 100)}</span>
      ),
    },
    {
      title: t('requestColApproved'),
      dataIndex: 'approvedAmount',
      key: 'approvedAmount',
      align: 'right',
      render: (paise?: number) =>
        paise != null ? (
          <span className="tabular-nums">{currencyFmt.inline(paise / 100)}</span>
        ) : (
          <span className="text-faint">-</span>
        ),
    },
    {
      title: t('requestColStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: AdvanceSalaryRequest['status']) => (
        <Tag color={STATUS_COLOR[status] ?? 'default'}>{statusLabel(status)}</Tag>
      ),
    },
    {
      title: t('requestColNote'),
      dataIndex: 'reviewNote',
      key: 'reviewNote',
      render: (note?: string) =>
        note ? <span className="text-[13px]">{note}</span> : <span className="text-faint">-</span>,
    },
  ];

  return (
    <Card
      title={t('myRequestsTitle')}
      style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
      styles={{ body: { padding: 16 } }}
    >
      {error ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={error}>
          <Button type="primary" size="small" onClick={() => void load()}>
            {t('myRequestsRetry')}
          </Button>
        </Empty>
      ) : (
        <Table<AdvanceSalaryRequest>
          rowKey="_id"
          size="small"
          loading={loading}
          columns={columns}
          dataSource={requests}
          pagination={false}
          locale={{ emptyText: <Empty description={t('myRequestsEmpty')} /> }}
          scroll={{ x: 'max-content' }}
        />
      )}
    </Card>
  );
}
