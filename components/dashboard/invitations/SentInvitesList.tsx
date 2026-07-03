'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Skeleton, Tag, Tooltip } from 'antd';
import {
  CalendarOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import type { MessageInstance } from 'antd/es/message/interface';
import AccessResendModal from '@/components/dashboard/team/AccessResendModal';
import { listMySentInvites } from '@/lib/actions/invites.actions';
import { resendTeamInvite, revokeTeamAccess } from '@/lib/actions';
import type { ResendInviteResponse, SentInvite } from '@/types';

interface Props {
  onMessage: MessageInstance;
}

type StatusFilter = 'all' | 'invited' | 'active' | 'declined' | 'removed' | 'expired';

function isExpired(inv: SentInvite): boolean {
  return (
    inv.status === 'invited' && !!inv.inviteExpiry && dayjs(inv.inviteExpiry).isBefore(dayjs())
  );
}

/**
 * P2.0 (2026-05-15) - Sent tab. Aggregates invitations created by the
 * caller across every workspace. Workspace chip + status filter chips.
 * Per-row Resend (opens AccessResendModal) / Cancel (revokeTeamAccess -
 * only meaningful for status='invited', and only when the bridge row
 * has a linkedTeamMemberId since revokeTeamAccess targets the team
 * member surface).
 */
export default function SentInvitesList({ onMessage }: Props) {
  const t = useTranslations();
  const { modal } = App.useApp();

  const [invites, setInvites] = useState<SentInvite[] | null>(null);
  const [workspaceFilter, setWorkspaceFilter] = useState<string | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [resendTarget, setResendTarget] = useState<SentInvite | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listMySentInvites();
      setInvites(Array.isArray(data) ? data : []);
    } catch (e) {
      onMessage.error((e as Error).message || t('invitations.loadFailed'));
      setInvites([]);
    }
  }, [onMessage, t]);

  // Mount load - inlined (setState confined to promise callbacks) so it does
  // not trip react-hooks/set-state-in-effect. `load` stays for handler reloads.
  useEffect(() => {
    listMySentInvites()
      .then((data) => setInvites(Array.isArray(data) ? data : []))
      .catch((e) => {
        onMessage.error((e as Error).message || t('invitations.loadFailed'));
        setInvites([]);
      });
  }, [onMessage, t]);

  const workspaceOptions = useMemo(() => {
    if (!invites) return [];
    const map = new Map<string, string>();
    for (const inv of invites) {
      if (inv.workspace) map.set(inv.workspace.id, inv.workspace.name);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [invites]);

  const filtered = useMemo(() => {
    if (!invites) return [];
    return invites.filter((inv) => {
      if (workspaceFilter !== 'all' && inv.workspace?.id !== workspaceFilter) return false;
      if (statusFilter === 'all') return true;
      if (statusFilter === 'expired') return isExpired(inv);
      // Hide expired from the plain 'invited' filter so they live only under the Expired chip.
      if (statusFilter === 'invited') return inv.status === 'invited' && !isExpired(inv);
      return inv.status === statusFilter;
    });
  }, [invites, workspaceFilter, statusFilter]);

  function handleResend(inv: SentInvite) {
    setResendTarget(inv);
  }

  async function handleResendConfirm(opts: {
    channels: ('email' | 'sms' | 'in_app')[];
    whatsapp: boolean;
    justRotate: boolean;
  }): Promise<ResendInviteResponse> {
    if (!resendTarget?.linkedTeamMemberId || !resendTarget.workspace) {
      throw new Error(t('invitations.resendUnavailable'));
    }
    const res = await resendTeamInvite(resendTarget.workspace.id, resendTarget.linkedTeamMemberId, {
      sendMethod: 'auto',
      forceRegenerate: true,
      channels: opts.channels,
    });
    if (res?.inviteToken && opts.whatsapp && resendTarget.inviteeIdentifier) {
      const url = `${window.location.origin}/invite/${res.inviteToken}`;
      const text = encodeURIComponent(
        t('team.grantAccessSuccess.shareMessage', {
          name: resendTarget.invitee?.name ?? resendTarget.inviteeIdentifier,
          url,
        }),
      );
      window.open(
        `https://wa.me/${resendTarget.inviteeIdentifier.replace(/\D/g, '')}?text=${text}`,
        '_blank',
        'noopener,noreferrer',
      );
    }
    onMessage.success(t('invitations.resendSuccess'));
    void load();
    return res;
  }

  async function handleCancel(inv: SentInvite) {
    if (!inv.linkedTeamMemberId || !inv.workspace) {
      onMessage.error(t('invitations.cancelUnavailable'));
      return;
    }
    const wsId = inv.workspace.id;
    const teamId = inv.linkedTeamMemberId;
    modal.confirm({
      title: t('invitations.cancelConfirmTitle'),
      content: t('invitations.cancelConfirmContent', {
        identifier: inv.inviteeIdentifier ?? '',
      }),
      okText: t('invitations.cancelConfirmOk'),
      okButtonProps: { danger: true },
      cancelText: t('common.cancel'),
      onOk: async () => {
        setBusy(inv.id);
        try {
          await revokeTeamAccess(wsId, teamId, { hardRevoke: true });
          onMessage.success(t('invitations.cancelSuccess'));
          void load();
        } catch (e) {
          onMessage.error((e as Error).message || t('invitations.cancelFailed'));
        } finally {
          setBusy(null);
        }
      },
    });
  }

  const statusChips: Array<{ key: StatusFilter; labelKey: string; count: number }> = useMemo(
    () => [
      { key: 'all', labelKey: 'invitations.statusAll', count: invites?.length ?? 0 },
      {
        key: 'invited',
        labelKey: 'invitations.statusInvited',
        count: invites?.filter((i) => i.status === 'invited' && !isExpired(i)).length ?? 0,
      },
      {
        key: 'active',
        labelKey: 'invitations.statusAccepted',
        count: invites?.filter((i) => i.status === 'active').length ?? 0,
      },
      {
        key: 'declined',
        labelKey: 'invitations.statusDeclined',
        count: invites?.filter((i) => i.status === 'declined').length ?? 0,
      },
      {
        key: 'removed',
        labelKey: 'invitations.statusRevoked',
        count: invites?.filter((i) => i.status === 'removed').length ?? 0,
      },
      {
        key: 'expired',
        labelKey: 'invitations.statusExpired',
        count: invites?.filter(isExpired).length ?? 0,
      },
    ],
    [invites],
  );

  function statusTag(inv: SentInvite) {
    if (isExpired(inv)) {
      return <Tag color="default">{t('invitations.statusExpired')}</Tag>;
    }
    const map: Record<SentInvite['status'], { color: string; key: string }> = {
      invited: { color: 'warning', key: 'invitations.statusInvited' },
      active: { color: 'success', key: 'invitations.statusAccepted' },
      declined: { color: 'default', key: 'invitations.statusDeclined' },
      removed: { color: 'error', key: 'invitations.statusRevoked' },
    };
    const { color, key } = map[inv.status];
    return <Tag color={color}>{t(key)}</Tag>;
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Filter region - both strips share the card header to keep the
          frame consistent with the Received tab. */}
      <div className="flex flex-col gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
        {workspaceOptions.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setWorkspaceFilter('all')}
              className={`cr-filter-chip ${workspaceFilter === 'all' ? 'cr-filter-chip--active' : ''}`}
            >
              {t('invitations.allWorkspaces')}
            </button>
            {workspaceOptions.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWorkspaceFilter(w.id)}
                className={`cr-filter-chip ${
                  workspaceFilter === w.id ? 'cr-filter-chip--active' : ''
                }`}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {statusChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setStatusFilter(c.key)}
              className={`cr-filter-chip ${statusFilter === c.key ? 'cr-filter-chip--active' : ''}`}
            >
              {t(c.labelKey)}
              {c.count > 0 && (
                <span className="ml-1.5 text-[11px] tabular-nums opacity-60">{c.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {invites === null ? (
        <div className="px-4 py-5 sm:px-5">
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
            <SendOutlined className="text-[22px]" />
          </div>
          <p className="m-0 text-[14px] font-semibold text-gray-800">
            {t('invitations.sentEmptyTitle')}
          </p>
          <p className="mx-auto mt-1 mb-0 max-w-[420px] text-[12px] leading-relaxed text-gray-500">
            {t('invitations.sentEmptyDesc')}
          </p>
        </div>
      ) : (
        <ul className="m-0 list-none divide-y divide-gray-100 p-0">
          {filtered.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center gap-4 px-4 py-4 transition-colors hover:bg-gray-50/60 sm:px-5"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  {inv.workspace && (
                    <Tag color="blue" className="!m-0">
                      {inv.workspace.name}
                    </Tag>
                  )}
                  <h3 className="m-0 font-display text-[15px] font-bold text-gray-900">
                    {inv.invitee?.name || inv.inviteeIdentifier || t('invitations.unknownInvitee')}
                  </h3>
                  {inv.role && (
                    <Tag color="default" className="!m-0">
                      {inv.role.name}
                    </Tag>
                  )}
                  {statusTag(inv)}
                </div>
                <p className="m-0 text-[12px] text-gray-600">
                  <UserOutlined className="mr-1" />
                  {inv.inviteeIdentifier ?? t('invitations.unknownIdentifier')}
                </p>
                <p className="m-0 text-[11px] text-gray-500">
                  <CalendarOutlined className="mr-1" />
                  {t('invitations.sentOn', {
                    date: dayjs(inv.createdAt).format('DD MMM YYYY'),
                  })}
                  {inv.status === 'invited' && inv.inviteExpiry && (
                    <span className="ml-2">
                      {isExpired(inv)
                        ? t('invitations.expiredOn', {
                            date: dayjs(inv.inviteExpiry).format('DD MMM YYYY'),
                          })
                        : t('invitations.expiresOn', {
                            date: dayjs(inv.inviteExpiry).format('DD MMM YYYY'),
                          })}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {inv.status === 'invited' && inv.linkedTeamMemberId && (
                  <>
                    <Tooltip title={t('invitations.resendTooltip')}>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={() => handleResend(inv)}
                        disabled={busy !== null}
                      >
                        {t('invitations.resendBtn')}
                      </Button>
                    </Tooltip>
                    <Tooltip title={t('invitations.cancelTooltip')}>
                      <Button
                        danger
                        icon={<StopOutlined />}
                        loading={busy === inv.id}
                        disabled={busy !== null && busy !== inv.id}
                        onClick={() => void handleCancel(inv)}
                      >
                        {t('invitations.cancelBtn')}
                      </Button>
                    </Tooltip>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {resendTarget && (
        <AccessResendModal
          open={!!resendTarget}
          memberEmail={
            resendTarget.inviteeType === 'email'
              ? (resendTarget.inviteeIdentifier ?? undefined)
              : undefined
          }
          memberMobile={
            resendTarget.inviteeType === 'mobile'
              ? (resendTarget.inviteeIdentifier ?? undefined)
              : undefined
          }
          // Warm/cold detection on this surface is conservative - invitee
          // identity for the sent list doesn't include a User lookup here.
          // BE silently no-ops the in_app channel for cold invitees, so
          // optimistically enabling it (warm=true) is the safe default.
          isWarm
          onCancel={() => setResendTarget(null)}
          onConfirm={handleResendConfirm}
        />
      )}
    </section>
  );
}
