'use client';

import { useState } from 'react';
import { Drawer, Table, Button, Tooltip, message } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
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
  canEdit: boolean;
  onRefetch: () => void;
}

export function LockedRecordsDrawer({
  open,
  onClose,
  data,
  month,
  year,
  workspaceId,
  canEdit,
  onRefetch,
}: Props) {
  const [unlocking, setUnlocking] = useState<Set<string>>(new Set());
  const [msgApi, msgCtx] = message.useMessage();

  const monthLabel = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');
  const lockedMembers = (data?.payslipEmails.members ?? []).filter((m) => m.isLocked);

  async function handleUnlock(row: MonthlyTaskStatusMember) {
    setUnlocking((prev) => new Set(prev).add(row.salaryId));
    try {
      await salaryApi.unlockSalaryRecord(workspaceId, row.salaryId);
      void msgApi.success(`${row.name} record unlocked`);
      onRefetch();
    } catch (err) {
      void msgApi.error(parseApiError(err));
    } finally {
      setUnlocking((prev) => {
        const next = new Set(prev);
        next.delete(row.salaryId);
        return next;
      });
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
      title: 'Locked at',
      key: 'lockedAt',
      render: (_, row) =>
        row.lockedAt ? (
          <span className="text-[12px] text-muted">
            {dayjs(row.lockedAt).format('DD MMM YYYY, h:mm A')}
          </span>
        ) : (
          <span className="text-[12px] text-muted">-</span>
        ),
    },
    {
      title: 'Locked by',
      key: 'lockedBy',
      render: (_, row) => <span className="text-[12px] text-muted">{row.lockedByName || '-'}</span>,
    },
    {
      title: <span className="sr-only">Actions</span>,
      key: 'action',
      width: 100,
      render: (_, row) => {
        const isUnlocking = unlocking.has(row.salaryId);
        return (
          <Tooltip title={!canEdit ? 'No permission to edit salary' : undefined}>
            <Button
              size="small"
              icon={<UnlockOutlined />}
              disabled={!canEdit || isUnlocking}
              loading={isUnlocking}
              onClick={() => handleUnlock(row)}
            >
              Unlock
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
      title={
        <div className="flex items-center gap-2">
          <LockOutlined className="text-amber-700" />
          <span>Locked Records - {monthLabel}</span>
        </div>
      }
      size={680}
      styles={{ body: { padding: 0 } }}
    >
      {msgCtx}
      <div
        className="flex items-center gap-2 border-b px-5 py-3 text-[13px]"
        style={{
          borderColor: 'var(--cr-border,var(--cr-border))',
          background: 'var(--cr-surface-2,var(--cr-bg))',
        }}
      >
        <span className="font-semibold text-heading">{lockedMembers.length}</span>
        <span className="text-muted">
          record{lockedMembers.length !== 1 ? 's' : ''} locked for {monthLabel}
        </span>
      </div>
      <Table<MonthlyTaskStatusMember>
        dataSource={lockedMembers}
        columns={columns}
        rowKey="salaryId"
        size="small"
        pagination={false}
        className="px-2"
        locale={{ emptyText: 'No locked records' }}
      />
    </Drawer>
  );
}
