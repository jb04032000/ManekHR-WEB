'use client';

import { useEffect, useState } from 'react';
import { Button, Popconfirm, Skeleton, Tag, Tooltip } from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  InboxOutlined,
  HistoryOutlined,
  CalendarOutlined,
  UserOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import type { MessageInstance } from 'antd/es/message/interface';
import { meApi, type PendingInvite } from '@/lib/api/modules/me.api';
import { listMyInviteHistory } from '@/lib/actions/invites.actions';
import { listWorkspaces, leaveWorkspace } from '@/lib/actions/workspaces.actions';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { normalizeWorkspaceList } from '@/lib/utils/workspace.utils';
import type { InviteHistoryItem } from '@/types';

type Filter = 'pending' | 'history';

interface Props {
  onMessage: MessageInstance;
}

/**
 * P2.0 (2026-05-15) - Received tab. Defaults to Pending list (Accept /
 * Decline inline). History filter chip shows past invitations.
 */
export default function ReceivedInvitesList({ onMessage }: Props) {
  const t = useTranslations();
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces);
  const setCurrentWorkspaceId = useWorkspaceStore((s) => s.setCurrentWorkspaceId);
  const currentWorkspaceId = useWorkspaceStore((s) => s.currentWorkspaceId);
  // Owned-workspace ids: used to hide the "Leave" action for a workspace the
  // caller owns (owners are blocked server-side; this avoids offering a dead
  // action). Invite-history rows are invite-derived so this is belt-and-braces.
  const workspaces = useWorkspaceStore((s) => s.workspaces);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);

  const [filter, setFilter] = useState<Filter>('pending');
  const [pending, setPending] = useState<PendingInvite[] | null>(null);
  const [history, setHistory] = useState<InviteHistoryItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Lazy-load the active filter's list. Fetches are inlined here with
  // setState confined to promise callbacks, so this does not trip
  // react-hooks/set-state-in-effect.
  useEffect(() => {
    if (filter === 'pending' && pending === null) {
      meApi
        .pendingInvites()
        .then((data) => setPending(Array.isArray(data) ? data : []))
        .catch((e) => {
          onMessage.error((e as Error).message || t('invitations.loadFailed'));
          setPending([]);
        });
    }
    if (filter === 'history' && history === null) {
      listMyInviteHistory()
        .then((data) => setHistory(Array.isArray(data) ? data : []))
        .catch((e) => {
          onMessage.error((e as Error).message || t('invitations.loadFailed'));
          setHistory([]);
        });
    }
  }, [filter, pending, history, onMessage, t]);

  async function handleAccept(inv: PendingInvite) {
    setBusy(inv.id);
    try {
      const res = await meApi.acceptInvite(inv.id);
      onMessage.success(t('invitations.acceptedToast', { workspace: res.workspace?.name ?? '' }));
      // Refresh the workspace list so the freshly-joined membership shows
      // up in the switcher, then switch into it.
      try {
        const wsRes = await listWorkspaces(accessToken ?? undefined);
        if (wsRes && typeof wsRes === 'object' && 'ok' in wsRes && wsRes.ok) {
          setWorkspaces(normalizeWorkspaceList(wsRes.data));
        }
      } catch {
        // Best-effort; the dashboard layout reconciles on next navigation.
      }
      if (res.workspace?._id) {
        setCurrentWorkspaceId(res.workspace._id);
      }
      // Optimistic: remove from pending list locally
      setPending((prev) => prev?.filter((p) => p.id !== inv.id) ?? null);
      // Invalidate history so the next visit shows the freshly-accepted row
      setHistory(null);
      // P2.0.2 (2026-05-15) - broadcast so the Sidebar switcher's stale
      // "Pending invites" group drops the accepted row immediately.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
    } catch (e) {
      onMessage.error((e as Error).message || t('invitations.acceptFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function handleDecline(inv: PendingInvite) {
    setBusy(inv.id);
    try {
      await meApi.declineInvite(inv.id);
      onMessage.success(t('invitations.declinedToast'));
      setPending((prev) => prev?.filter((p) => p.id !== inv.id) ?? null);
      setHistory(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
    } catch (e) {
      onMessage.error((e as Error).message || t('invitations.declineFailed'));
    } finally {
      setBusy(null);
    }
  }

  // OQ-W6 - self-serve "Leave workspace" for an active (non-owner) membership.
  // The owner is blocked server-side; we additionally hide the action for owned
  // workspaces. On success we drop the workspace from the switcher, switch away
  // if it was active, and refresh history so the row flips to "removed".
  async function handleLeave(inv: InviteHistoryItem) {
    const wsId = inv.workspace?.id;
    if (!wsId) return;
    setBusy(inv.id);
    try {
      const res = await leaveWorkspace(wsId);
      if (!res.ok) {
        onMessage.error(res.error || t('workspace.leave.failed'));
        return;
      }
      onMessage.success(t('workspace.leave.success'));
      // Refresh the workspace list so the left workspace leaves the switcher.
      try {
        const wsRes = await listWorkspaces(accessToken ?? undefined);
        if (wsRes && typeof wsRes === 'object' && 'ok' in wsRes && wsRes.ok) {
          const list = normalizeWorkspaceList(wsRes.data);
          setWorkspaces(list);
          // If we just left the active workspace, switch into another one.
          if (currentWorkspaceId === wsId && list.length > 0) {
            setCurrentWorkspaceId(list[0]._id);
          }
        }
      } catch {
        // Best-effort; the dashboard layout reconciles on next navigation.
      }
      // Invalidate history so the next render shows the freshly-left row state.
      setHistory(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('z360:invites-changed'));
      }
    } catch (e) {
      onMessage.error((e as Error).message || t('workspace.leave.failed'));
    } finally {
      setBusy(null);
    }
  }

  // P2.6.1 (2026-05-15) - compact filter chips. Switched from antd
  // Segmented to bare buttons so the inactive chip carries no heavy
  // outline + the active chip uses a subtle primary tint rather than the
  // dark filled block antd defaults to. Matches the `cr-filter-chip`
  // pattern used in Team v2 / Salary.
  const filters: Array<{
    key: Filter;
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    {
      key: 'pending',
      label: t('invitations.filterPendingShort'),
      icon: <InboxOutlined />,
      count: pending?.length,
    },
    { key: 'history', label: t('invitations.filterHistory'), icon: <HistoryOutlined /> },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Filter strip - sits inside the card header to share visual frame
          with the list / empty state below. */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 px-4 py-3 sm:px-5">
        {filters.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={[
                'inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] font-medium transition-colors',
                active
                  ? 'bg-primary-50 border-primary text-primary'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <span aria-hidden="true" className="text-[12px]">
                {f.icon}
              </span>
              {f.label}
              {typeof f.count === 'number' && f.count > 0 && (
                <span
                  className={[
                    'ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums',
                    active ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600',
                  ].join(' ')}
                >
                  {f.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {filter === 'pending' &&
        (pending === null ? (
          <div className="px-4 py-5 sm:px-5">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <InboxOutlined className="text-[22px]" />
            </div>
            <p className="m-0 text-[14px] font-semibold text-gray-800">
              {t('invitations.pendingEmptyTitle')}
            </p>
            <p className="mx-auto mt-1 mb-0 max-w-[420px] text-[12px] leading-relaxed text-gray-500">
              {t('invitations.pendingEmptyDesc')}
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-gray-100 p-0">
            {pending.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50/60 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="m-0 font-display text-[15px] font-bold text-gray-900">
                      {inv.workspace?.name ?? t('invitations.unknownWorkspace')}
                    </h3>
                    {inv.role && (
                      <Tag color="warning" className="!m-0">
                        {inv.role.name}
                      </Tag>
                    )}
                  </div>
                  <p className="m-0 text-[12px] text-gray-600">
                    <UserOutlined className="mr-1" />
                    {t('invitations.invitedBy', { name: inv.invitedBy })}
                  </p>
                  {inv.inviteExpiry && (
                    <p className="m-0 text-[11px] text-gray-500">
                      <CalendarOutlined className="mr-1" />
                      {t('invitations.expiresIn', {
                        days: Math.max(0, dayjs(inv.inviteExpiry).diff(dayjs(), 'day')),
                      })}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Tooltip title={t('invitations.declineTooltip')}>
                    <Button
                      icon={<CloseOutlined />}
                      onClick={() => void handleDecline(inv)}
                      loading={busy === inv.id}
                      disabled={busy !== null && busy !== inv.id}
                    >
                      {t('invitations.declineBtn')}
                    </Button>
                  </Tooltip>
                  <Button
                    type="primary"
                    icon={<CheckOutlined />}
                    onClick={() => void handleAccept(inv)}
                    loading={busy === inv.id}
                    disabled={busy !== null && busy !== inv.id}
                  >
                    {t('invitations.acceptBtn')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ))}

      {filter === 'history' &&
        (history === null ? (
          <div className="px-4 py-5 sm:px-5">
            <Skeleton active paragraph={{ rows: 3 }} />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <HistoryOutlined className="text-[22px]" />
            </div>
            <p className="m-0 text-[14px] font-semibold text-gray-800">
              {t('invitations.historyEmpty')}
            </p>
          </div>
        ) : (
          <ul className="m-0 list-none divide-y divide-gray-100 p-0">
            {history.map((inv) => {
              const statusColor =
                inv.status === 'active'
                  ? 'success'
                  : inv.status === 'declined'
                    ? 'default'
                    : 'error';
              const dateLabel =
                inv.status === 'active'
                  ? inv.joinedAt
                  : inv.status === 'declined'
                    ? inv.declinedAt
                    : inv.removedAt;
              // OQ-W6 - offer "Leave" only on a currently-active membership the
              // caller does NOT own (owners are blocked server-side).
              const isOwnedByMe =
                !!inv.workspace?.id &&
                workspaces.some((w) => w._id === inv.workspace?.id && w.ownerId === user?._id);
              const canLeave = inv.status === 'active' && !isOwnedByMe;
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50/60 sm:px-5"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="m-0 font-display text-[15px] font-bold text-gray-900">
                        {inv.workspace?.name ?? t('invitations.unknownWorkspace')}
                      </h3>
                      {inv.role && (
                        <Tag color="default" className="!m-0">
                          {inv.role.name}
                        </Tag>
                      )}
                      <Tag color={statusColor} className="!m-0">
                        {t(`invitations.status.${inv.status}`)}
                      </Tag>
                    </div>
                    <p className="m-0 text-[12px] text-gray-600">
                      <UserOutlined className="mr-1" />
                      {t('invitations.invitedBy', { name: inv.invitedBy })}
                    </p>
                    {dateLabel && (
                      <p className="m-0 text-[11px] text-gray-500">
                        <CalendarOutlined className="mr-1" />
                        {dayjs(dateLabel).format('DD MMM YYYY')}
                      </p>
                    )}
                  </div>
                  {canLeave && (
                    <Popconfirm
                      title={t('workspace.leave.confirmTitle', {
                        name: inv.workspace?.name ?? '',
                      })}
                      description={
                        <span className="block max-w-[280px] text-[12px]">
                          {t('workspace.leave.confirmDescription')}
                        </span>
                      }
                      okText={t('workspace.leave.confirmOk')}
                      okButtonProps={{ danger: true }}
                      onConfirm={() => void handleLeave(inv)}
                    >
                      <Button
                        danger
                        icon={<LogoutOutlined />}
                        loading={busy === inv.id}
                        disabled={busy !== null && busy !== inv.id}
                      >
                        {t('workspace.leave.action')}
                      </Button>
                    </Popconfirm>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
