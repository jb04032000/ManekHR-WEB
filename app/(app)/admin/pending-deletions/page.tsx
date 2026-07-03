'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Alert, Button, Input, Popconfirm, Space, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { getAdminUsers, restoreUserDeletion } from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
import type { AdminUserWithSubscription } from '@/types';
import {
  pendingDeletionScopes,
  earliestPurgeAfter,
  type ScopedMarker,
} from '@/components/account-deletion/pending';

/**
 * Admin support view for DPDP self-serve deletions (ACCOUNT-DELETION-AND-DPDP-PLAN.md
 * §6/§7). Lists accounts in their 30-day recovery window and offers an admin-mediated
 * Restore (mirrors the existing admin user restore). Recovery is NOT self-serve: the
 * suspended user contacts Zari, an admin verifies identity out-of-band, then restores.
 *
 * No dedicated "list pending" backend endpoint exists, so this filters the admin users
 * list client-side (pending accounts keep deletedAt unset during grace, so the default
 * list returns them). Use search to find a specific account that contacted support.
 * Cross-link: lib/actions/admin.actions.ts restoreUserDeletion.
 */

const SCOPE_LABELS: Record<ScopedMarker['scope'], { label: string; color: string }> = {
  connect: { label: 'Connect', color: 'blue' },
  erp: { label: 'Business / ERP', color: 'gold' },
  account: { label: 'Whole account', color: 'red' },
};

// Client-side scan cap. Pending accounts past this many rows won't show without a
// search - surfaced in the UI so the cap is never silent (POLISH-RULES).
const SCAN_LIMIT = 100;

interface PendingRow {
  user: AdminUserWithSubscription;
  scopes: ScopedMarker[];
}

export default function AdminPendingDeletionsPage() {
  const { message: msgApi } = App.useApp();
  const [rows, setRows] = useState<PendingRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const load = useCallback(async (term: string) => {
    setRows(null);
    setError(null);
    try {
      const res = await getAdminUsers({ page: 1, limit: SCAN_LIMIT, search: term || undefined });
      const pending = (res.data || [])
        .map((user) => ({ user, scopes: pendingDeletionScopes(user) }))
        .filter((r) => r.scopes.length > 0);
      setRows(pending);
    } catch (e) {
      setRows([]);
      setError(parseApiError(e));
    }
  }, []);

  useEffect(() => {
    void load('');
  }, [load]);

  const handleRestore = useCallback(
    async (user: AdminUserWithSubscription) => {
      setRestoringId(user._id);
      try {
        const res = await restoreUserDeletion(user._id);
        if (res.ok) {
          msgApi.success(
            `Restored ${user.name || user.email || 'account'}${
              res.memberWorkspacesNeedReinvite ? ' (member workspaces need re-invite)' : ''
            }.`,
          );
          setRows((prev) => prev?.filter((r) => r.user._id !== user._id) ?? null);
        } else if (res.code === 'DELETION_WINDOW_EXPIRED') {
          msgApi.error(
            'The 30-day recovery window has passed. This account can no longer be restored.',
          );
        } else if (res.code === 'NO_PENDING_DELETION') {
          msgApi.info('This account has no pending deletion. Refreshing the list.');
          await load(search);
        } else {
          msgApi.error(res.error);
        }
      } finally {
        setRestoringId(null);
      }
    },
    [msgApi, load, search],
  );

  const columns: ColumnsType<PendingRow> = useMemo(
    () => [
      {
        title: 'Account',
        key: 'account',
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <span className="font-semibold text-heading">{row.user.name || '(no name)'}</span>
            <span className="text-[12px] text-muted">
              {row.user.email || row.user.mobile || row.user._id}
            </span>
            {!row.user.isActive && <Tag color="volcano">Suspended</Tag>}
          </Space>
        ),
      },
      {
        title: 'Scheduled',
        key: 'scopes',
        render: (_, row) => (
          <Space size={4} wrap>
            {row.scopes.map((s) => (
              <Tag key={s.scope} color={SCOPE_LABELS[s.scope].color}>
                {SCOPE_LABELS[s.scope].label}
              </Tag>
            ))}
          </Space>
        ),
      },
      {
        title: 'Recover by',
        key: 'recoverBy',
        render: (_, row) => {
          const purgeAfter = earliestPurgeAfter(row.scopes);
          if (!purgeAfter) return <span className="text-muted">-</span>;
          const daysLeft = Math.max(
            0,
            dayjs(purgeAfter).startOf('day').diff(dayjs().startOf('day'), 'day'),
          );
          return (
            <Space direction="vertical" size={0}>
              <span>{dayjs(purgeAfter).format('DD MMM YYYY')}</span>
              <Tag color={daysLeft <= 5 ? 'red' : 'default'} className="!m-0 !text-[10.5px]">
                {daysLeft <= 0 ? 'Last day' : `${daysLeft} day(s) left`}
              </Tag>
            </Space>
          );
        },
      },
      {
        title: 'Action',
        key: 'action',
        render: (_, row) => (
          <Popconfirm
            title="Restore this account?"
            description={
              <span className="block max-w-[280px] text-[12px]">
                Only after verifying the requester&apos;s identity against the registered email /
                mobile. This clears the pending deletion and reactivates the account.
              </span>
            }
            okText="Restore"
            okButtonProps={{ danger: false }}
            onConfirm={() => handleRestore(row.user)}
          >
            <Button
              size="small"
              type="primary"
              icon={<ReloadOutlined />}
              loading={restoringId === row.user._id}
            >
              Restore
            </Button>
          </Popconfirm>
        ),
      },
    ],
    [handleRestore, restoringId],
  );

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-4">
        <h1 className="m-0 font-display text-[22px] font-bold text-heading">Pending Deletions</h1>
        <Button icon={<ReloadOutlined />} onClick={() => load(search)}>
          Refresh
        </Button>
      </div>
      <p className="mt-0 mb-4 text-[13px] text-muted">
        Accounts in their 30-day recovery window. Recovery is admin-mediated - verify the
        requester&apos;s identity before restoring. There is no self-undo for the user.
      </p>

      <Input
        allowClear
        prefix={<SearchOutlined />}
        placeholder="Search by name, email, or mobile"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onPressEnter={() => load(search)}
        className="mb-4 max-w-[360px]"
      />

      {error && <Alert type="error" showIcon className="mb-4 rounded-[10px]" title={error} />}

      <Table<PendingRow>
        columns={columns}
        dataSource={rows ?? []}
        loading={rows === null}
        rowKey={(r) => r.user._id}
        pagination={false}
        locale={{
          emptyText: search
            ? 'No matching account is scheduled for deletion.'
            : `No accounts are scheduled for deletion (scanned the latest ${SCAN_LIMIT}). Search to find a specific account.`,
        }}
      />
    </div>
  );
}
