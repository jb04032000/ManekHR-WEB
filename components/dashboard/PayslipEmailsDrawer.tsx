'use client';

import { useState } from 'react';
import { App, Drawer, Table, Badge, Button, Tooltip, Alert } from 'antd';
import { MailOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { ColumnsType } from 'antd/es/table';
import { DsAvatar } from '@/components/ui';
import { salaryApi } from '@/lib/api';
import { parseApiError } from '@/lib/utils';
import type { MonthlyTaskStatusMember, MonthlyTaskStatusResponse } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  data: MonthlyTaskStatusResponse | null;
  month: number;
  year: number;
  workspaceId: string;
  onRefetch: () => void;
}

export function PayslipEmailsDrawer({
  open,
  onClose,
  data,
  month,
  year,
  workspaceId,
  onRefetch,
}: Props) {
  const [sending, setSending] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [bulkResult, setBulkResult] = useState<{
    sent: number;
    failed: number;
    skipped: number;
  } | null>(null);
  const { message: msgApi } = App.useApp();

  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');
  const members = data?.payslipEmails.members ?? [];
  const quota = data?.emailQuota;
  const quotaExhausted = quota ? quota.used >= quota.limit && quota.limit > 0 : false;

  const pendingMembers = members.filter((m) => !m.payslipEmailSentAt && m.email && !m.isLocked);
  const pendingCount = pendingMembers.length;

  async function handleResend(row: MonthlyTaskStatusMember) {
    setSending((prev) => new Set(prev).add(row.salaryId));
    try {
      await salaryApi.sendPayslipEmail(workspaceId, { salaryId: row.salaryId });
      void msgApi.success(`Payslip sent to ${row.name}`);
      onRefetch();
    } catch (err) {
      void msgApi.error(parseApiError(err));
    } finally {
      setSending((prev) => {
        const next = new Set(prev);
        next.delete(row.salaryId);
        return next;
      });
    }
  }

  async function handleBulkSend() {
    if (pendingCount === 0 || quotaExhausted) return;
    setBulkSending(true);
    setBulkResult(null);
    try {
      const result = await salaryApi.sendBulkPayslipEmails(workspaceId, {
        items: pendingMembers.map((m) => ({ salaryId: m.salaryId })),
      });
      setBulkResult({
        sent: result.sent,
        failed: result.failed,
        skipped: result.skipped,
      });
      void msgApi.success(`Sent ${result.sent} payslip${result.sent !== 1 ? 's' : ''}`);
      onRefetch();
    } catch (err) {
      void msgApi.error(parseApiError(err));
    } finally {
      setBulkSending(false);
    }
  }

  const columns: ColumnsType<MonthlyTaskStatusMember> = [
    {
      title: 'Member',
      key: 'member',
      render: (_, row) => (
        <div className="flex items-center gap-2.5">
          <DsAvatar name={row.name} size={32} />
          <span className="text-[13px] font-medium text-heading">{row.name || '-'}</span>
        </div>
      ),
    },
    {
      title: 'Email',
      key: 'email',
      render: (_, row) => (
        <span className="text-[12px] text-muted">
          {row.email || <span className="italic">No email</span>}
        </span>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, row) =>
        row.payslipEmailSentAt ? (
          <Badge status="success" text={<span className="text-[12px]">Sent</span>} />
        ) : (
          <Badge status="default" text={<span className="text-[12px] text-muted">Not sent</span>} />
        ),
    },
    {
      title: 'Sent at',
      key: 'sentAt',
      render: (_, row) =>
        row.payslipEmailSentAt ? (
          <span className="text-[12px] text-muted">
            {dayjs(row.payslipEmailSentAt).format('DD MMM, h:mm A')}
          </span>
        ) : (
          <span className="text-[12px] text-muted">-</span>
        ),
    },
    {
      title: 'Sent by',
      key: 'sentBy',
      render: (_, row) => (
        <span className="text-[12px] text-muted">{row.payslipEmailSentByName || '-'}</span>
      ),
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'action',
      width: 95,
      render: (_, row) => {
        const noEmail = !row.email;
        const isLocked = row.isLocked;
        const isSending = sending.has(row.salaryId);
        const disabled = noEmail || isLocked || quotaExhausted || isSending;
        const tipText = noEmail
          ? 'No email address on record'
          : isLocked
            ? 'Record is locked'
            : quotaExhausted
              ? 'Email quota exhausted'
              : undefined;

        return (
          <Tooltip title={tipText}>
            <Button
              size="small"
              icon={<SendOutlined />}
              disabled={disabled}
              loading={isSending}
              onClick={() => handleResend(row)}
            >
              {row.payslipEmailSentAt ? 'Resend' : 'Send'}
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <Drawer
      open={open}
      onClose={onClose}
      closeIcon={true}
      title={
        <div className="flex items-center gap-2">
          <MailOutlined className="text-blue-700" />
          <span>Payslip Emails - {monthLabel}</span>
        </div>
      }
      size="min(760px, 96vw)"
      styles={{ body: { padding: 0, overflowY: 'auto' } }}
    >
      {/* Stats + bulk action strip */}
      <div
        className="flex flex-wrap items-center gap-3 border-b px-5 py-3 text-[13px]"
        style={{
          borderColor: 'var(--cr-border,var(--cr-border))',
          background: 'var(--cr-surface-2,var(--cr-bg))',
        }}
      >
        <span>
          <span className="font-semibold text-heading">{data?.payslipEmails.sent ?? 0}</span>
          <span className="text-muted"> / {data?.payslipEmails.total ?? 0} sent</span>
        </span>
        {quota && quota.limit > 0 && (
          <>
            <span className="text-[var(--cr-border,var(--cr-border))]">|</span>
            <span>
              <span className={`font-semibold ${quotaExhausted ? 'text-red-700' : 'text-heading'}`}>
                {quota.used}
              </span>
              <span className="text-muted"> / {quota.limit} quota used</span>
            </span>
          </>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Tooltip
            title={
              quotaExhausted
                ? 'Email quota exhausted'
                : pendingCount === 0
                  ? 'No pending members with email addresses'
                  : undefined
            }
          >
            <Button
              type="primary"
              size="small"
              icon={<ThunderboltOutlined />}
              loading={bulkSending}
              disabled={pendingCount === 0 || quotaExhausted}
              onClick={handleBulkSend}
            >
              Send Pending ({pendingCount})
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* Bulk result banner */}
      {bulkResult && (
        <div className="px-4 pt-3">
          <Alert
            type={bulkResult.failed > 0 ? 'warning' : 'success'}
            showIcon
            closable
            onClose={() => setBulkResult(null)}
            title={`Sent ${bulkResult.sent}${bulkResult.failed > 0 ? ` · ${bulkResult.failed} failed` : ''}${bulkResult.skipped > 0 ? ` · ${bulkResult.skipped} skipped` : ''}`}
          />
        </div>
      )}

      <Table<MonthlyTaskStatusMember>
        dataSource={members}
        columns={columns}
        rowKey="salaryId"
        size="small"
        pagination={false}
        scroll={{ x: 'max-content' }}
        className="px-2 pt-2"
      />
    </Drawer>
  );
}
