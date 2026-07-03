'use client';

// Worker-facing list of the member's own 0% loan requests + live status.
// What it does: shows each request's requested amount, desired months, status,
// and (for approved rows) a small "Loan active, ₹X remaining" line from the
// joined `loan` summary. Refetches when `refreshKey` changes (the request
// drawer bumps it on submit).
// Links: salary.api.ts getMyLoanRequests -> GET /salary/loan-requests/mine (self);
//   LoanRequestDrawer (the submit that creates these rows).
// Watch: amounts are paise on the wire -> divide by 100 for display. Mirrors
//   MyAdvanceRequests. Gated by the caller (MySalary) on salary.request_loan@self
//   + the loanManagement feature, same as the advance list.

import { useCallback, useEffect, useState } from 'react';
import { Card, Empty, Table, Tag, Button } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { getMyLoanRequests } from '@/lib/api/modules/salary.api';
import type { LoanRequest } from '@/types';
import { parseApiError } from '@/lib/utils';
import { useCurrencyFormatter } from '@/features/salary/hooks/useCurrencyFormatter';

interface MyLoanRequestsProps {
  workspaceId: string;
  /** Bumped by the parent on a successful submit to force a refetch. */
  refreshKey?: number;
}

const STATUS_COLOR: Record<LoanRequest['status'], string> = {
  pending: 'gold',
  approved: 'blue',
  rejected: 'red',
  cancelled: 'default',
};

export function MyLoanRequests({ workspaceId, refreshKey }: MyLoanRequestsProps) {
  const t = useTranslations('salary.mySalary.loanRequest');
  const currencyFmt = useCurrencyFormatter();
  const [requests, setRequests] = useState<LoanRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getMyLoanRequests(workspaceId);
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

  const statusLabel = (status: LoanRequest['status']): string => {
    switch (status) {
      case 'pending':
        return t('statusPending');
      case 'approved':
        return t('statusApproved');
      case 'rejected':
        return t('statusRejected');
      case 'cancelled':
        return t('statusCancelled');
      default:
        return status;
    }
  };

  const columns: ColumnsType<LoanRequest> = [
    {
      title: t('colRequested'),
      dataIndex: 'requestedAmount',
      key: 'requestedAmount',
      align: 'right',
      render: (paise: number) => (
        <span className="tabular-nums">{currencyFmt.inline(paise / 100)}</span>
      ),
    },
    {
      title: t('colMonths'),
      dataIndex: 'desiredTenorMonths',
      key: 'desiredTenorMonths',
      align: 'right',
      render: (months: number) => <span className="tabular-nums">{months}</span>,
    },
    {
      title: t('colStatus'),
      key: 'status',
      render: (_: unknown, r: LoanRequest) => (
        <div className="flex flex-col gap-1">
          <Tag color={STATUS_COLOR[r.status] ?? 'default'} className="w-fit">
            {statusLabel(r.status)}
          </Tag>
          {/* Approved rows: surface the materialized loan + remaining balance. */}
          {r.status === 'approved' && r.loan ? (
            <span className="text-[11px] text-muted tabular-nums">
              {t('loanActive', {
                remaining:
                  r.loan.remainingAmount != null
                    ? currencyFmt.inline(r.loan.remainingAmount / 100)
                    : currencyFmt.inline(0),
              })}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      title: t('colNote'),
      key: 'note',
      render: (_: unknown, r: LoanRequest) =>
        r.purpose || r.rejectionReason ? (
          <span className="text-[13px]">{r.rejectionReason || r.purpose}</span>
        ) : (
          <span className="text-faint">-</span>
        ),
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
        <Table<LoanRequest>
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
