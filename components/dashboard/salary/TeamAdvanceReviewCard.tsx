'use client';

import { useCallback, useEffect, useState } from 'react';
import { App, Badge, Button, Card, Input, Modal, Skeleton, Table, Tag } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import {
  listAdvanceRequestsForMyReports,
  verifyAdvanceRequest,
} from '@/lib/api/modules/salary.api';
import { parseApiError } from '@/lib/utils';
import type { AdvanceSalaryRequest } from '@/types';

/**
 * TeamAdvanceReviewCard (Phase 3a, Plan 2026-06-22 Task 4).
 * Shows advance requests for the caller's direct reports (reportsTo-filtered).
 * Rendered in MySalary only when can('salary','review_advance','self') is true.
 * Verify is advisory: stamps verifiedBy/verifiedAt/verifyNote but does NOT
 * change status or block the owner's approve/reject flow.
 * Links: listAdvanceRequestsForMyReports + verifyAdvanceRequest (salary.api.ts),
 *        BE GET /advance-requests/for-my-reports + PATCH /advance-requests/:id/verify.
 */

interface TeamAdvanceReviewCardProps {
  /** Current workspace id - passed from MySalary to avoid re-reading the store here. */
  workspaceId: string;
}

/** Derive a human-readable period label from month+year (e.g. "Jun 2026"). */
function periodLabel(month: number, year: number): string {
  return dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY');
}

/** Display rupees from a paise integer value (paise / 100, comma-formatted). */
function rupees(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'default',
  approved: 'success',
  rejected: 'error',
  paid: 'processing',
  cancelled: 'warning',
};

export function TeamAdvanceReviewCard({ workspaceId }: TeamAdvanceReviewCardProps) {
  const t = useTranslations('salary.teamAdvanceReview');
  const { message } = App.useApp();

  const [requests, setRequests] = useState<AdvanceSalaryRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifyTarget, setVerifyTarget] = useState<AdvanceSalaryRequest | null>(null);
  const [verifyNote, setVerifyNote] = useState('');
  const [verifying, setVerifying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listAdvanceRequestsForMyReports(workspaceId);
      setRequests(data);
    } catch (e) {
      message.error(
        parseApiError(e) || t('loadError', { defaultValue: 'Failed to load team advances' }),
      );
    } finally {
      setLoading(false);
    }
  }, [workspaceId, message, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleVerify = useCallback(async () => {
    if (!verifyTarget) return;
    setVerifying(true);
    try {
      const updated = await verifyAdvanceRequest(workspaceId, verifyTarget._id, {
        note: verifyNote || undefined,
      });
      setRequests((prev) => prev.map((r) => (r._id === updated._id ? updated : r)));
      message.success(t('verifySuccess', { defaultValue: 'Advance verified' }));
      setVerifyTarget(null);
      setVerifyNote('');
    } catch (e) {
      message.error(
        parseApiError(e) || t('loadError', { defaultValue: 'Failed to load team advances' }),
      );
    } finally {
      setVerifying(false);
    }
  }, [verifyTarget, verifyNote, workspaceId, message, t]);

  const columns: ColumnsType<AdvanceSalaryRequest> = [
    {
      title: t('periodLabel', { defaultValue: 'Period' }),
      key: 'period',
      render: (_: unknown, row: AdvanceSalaryRequest) => periodLabel(row.month, row.year),
    },
    {
      title: t('amountLabel', { defaultValue: 'Requested' }),
      dataIndex: 'requestedAmount',
      key: 'requestedAmount',
      align: 'right',
      render: (v: number) => <span className="tabular-nums">{rupees(v)}</span>,
    },
    {
      title: t('statusLabel', { defaultValue: 'Status' }),
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <Tag color={STATUS_COLOR[s] ?? 'default'}>{s}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      render: (_: unknown, row: AdvanceSalaryRequest) => {
        if (row.verifiedAt) {
          return (
            <Badge
              status="success"
              text={
                <span className="text-[12px] text-green-600">
                  <CheckCircleOutlined className="mr-1" />
                  {t('verifiedBadge', { defaultValue: 'Verified' })}
                </span>
              }
            />
          );
        }
        return (
          <Button
            size="small"
            type="default"
            onClick={() => {
              setVerifyTarget(row);
              setVerifyNote('');
            }}
          >
            {t('verifyButton', { defaultValue: 'Verify' })}
          </Button>
        );
      },
    },
  ];

  return (
    <>
      <Card
        title={
          <span className="font-display font-bold">
            {t('cardTitle', { defaultValue: 'Team advance requests' })}
          </span>
        }
        loading={loading}
        style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
        styles={{ body: { padding: 16 } }}
      >
        {loading ? (
          <Skeleton active paragraph={{ rows: 2 }} />
        ) : (
          <Table<AdvanceSalaryRequest>
            rowKey="_id"
            size="small"
            dataSource={requests}
            columns={columns}
            pagination={false}
            locale={{
              emptyText: t('empty', { defaultValue: 'No pending advance requests from your team' }),
            }}
            scroll={{ x: 'max-content' }}
          />
        )}
      </Card>

      {/* Verify modal: lets the reporting person leave an optional note and confirm. */}
      <Modal
        open={!!verifyTarget}
        title={t('verifyModalTitle', { defaultValue: 'Verify advance request' })}
        okText={t('verifySubmit', { defaultValue: 'Confirm' })}
        cancelText={t('verifyCancel', { defaultValue: 'Cancel' })}
        onOk={handleVerify}
        onCancel={() => {
          setVerifyTarget(null);
          setVerifyNote('');
        }}
        confirmLoading={verifying}
        destroyOnHidden
        centered
        styles={{ body: { maxHeight: '50vh', overflowY: 'auto' } }}
      >
        <div className="flex flex-col gap-3 py-2">
          {verifyTarget && (
            <p className="m-0 text-[13px] text-subtle">
              {periodLabel(verifyTarget.month, verifyTarget.year)}
              {' — '}
              {rupees(verifyTarget.requestedAmount)}
            </p>
          )}
          <div>
            <p className="m-0 mb-1 text-[12px] font-medium text-subtle">
              {t('verifyNoteLabel', { defaultValue: 'Note (optional)' })}
            </p>
            <Input.TextArea
              rows={3}
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              placeholder={t('verifyNoteHint', { defaultValue: 'Leave a note for the record' })}
              maxLength={500}
              showCount
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
