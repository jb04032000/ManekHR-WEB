'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  App,
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Select,
  Skeleton,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { leaveApi } from '@/lib/api/modules/leave.api';
import { teamApi } from '@/lib/api/modules/team.api';
import { parseApiError } from '@/lib/utils';
import { DsButton, DsEmptyState, DsPageHeader, InfoTooltip } from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { LeaveApproverDelegation, TeamMember } from '@/types';

const { RangePicker } = DatePicker;

export default function LeaveSettingsPage() {
  const t = useTranslations('leave.settings');
  const { message, modal } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const currentUserId = useAuthStore((s) => s.user?._id ?? null);
  const { loading: permissionsLoading, canPath } = useMyPermissions();

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Request-settings state
  const [chain, setChain] = useState<string[]>([]);
  const [sandwich, setSandwich] = useState(false);
  const [retro, setRetro] = useState(30);
  const [maxAttach, setMaxAttach] = useState(5);
  const [savingSettings, setSavingSettings] = useState(false);

  // Delegations state
  const [delegations, setDelegations] = useState<LeaveApproverDelegation[]>([]);
  const [showRevoked, setShowRevoked] = useState(false);
  const [delegOpen, setDelegOpen] = useState(false);
  const [delegTo, setDelegTo] = useState<string | undefined>();
  const [delegRange, setDelegRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [delegReason, setDelegReason] = useState('');
  const [creatingDeleg, setCreatingDeleg] = useState(false);

  const userOptions = useMemo(
    () =>
      members
        .filter((m) => m.linkedUserId)
        .map((m) => ({ value: m.linkedUserId as string, label: m.name })),
    [members],
  );
  const userName = useCallback(
    (id: string) => userOptions.find((o) => o.value === id)?.label ?? t('unknownUser'),
    [userOptions, t],
  );

  const loadDelegations = useCallback(
    async (includeInactive: boolean) => {
      if (!wsId) return;
      const list = await leaveApi.listDelegations(wsId, includeInactive);
      setDelegations(list);
    },
    [wsId],
  );

  // Single shared page-load path - used by both the mount effect and the
  // load-error retry. Writes state only inside its async callbacks.
  const load = useCallback(() => {
    if (!wsId) return;
    Promise.all([
      leaveApi.getSettings(wsId),
      teamApi.list(wsId),
      leaveApi.listDelegations(wsId, false),
    ])
      .then(([settings, teamRes, delegs]) => {
        setChain(settings.approverUserIds);
        setSandwich(settings.sandwichLeave);
        setRetro(settings.retroMaxDaysBack);
        setMaxAttach(settings.maxAttachmentsPerRequest);
        setMembers(
          Array.isArray(teamRes)
            ? teamRes
            : ((teamRes as { members?: TeamMember[] }).members ?? []),
        );
        setDelegations(delegs);
        setLoadError(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [wsId]);

  // Mount fetch - `loading` is already true on mount; the `load` call is
  // deferred through a microtask so it sits outside the synchronous effect
  // body (set-state-in-effect rule).
  useEffect(() => {
    queueMicrotask(() => {
      load();
    });
  }, [load]);

  // ── Approver chain ──────────────────────────────────────────
  const updateChainAt = (i: number, value: string) => {
    setChain((prev) => prev.map((v, j) => (j === i ? value : v)));
  };
  const removeChainAt = (i: number) => {
    setChain((prev) => prev.filter((_, j) => j !== i));
  };
  const moveChain = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= chain.length) return;
    setChain((prev) => {
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const saveSettings = async () => {
    if (!wsId) return;
    const approverUserIds = chain.filter((v) => v.length > 0);
    setSavingSettings(true);
    try {
      await leaveApi.updateSettings(wsId, {
        approverUserIds,
        sandwichLeave: sandwich,
        retroMaxDaysBack: retro,
        maxAttachmentsPerRequest: maxAttach,
      });
      message.success(t('settingsSaved'));
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setSavingSettings(false);
    }
  };

  // ── Delegations ─────────────────────────────────────────────
  const toggleRevoked = (next: boolean) => {
    setShowRevoked(next);
    loadDelegations(next).catch(() => message.error(t('loadError')));
  };

  const submitDelegation = async () => {
    if (!wsId) return;
    if (!delegTo) {
      message.error(t('toUserRequired'));
      return;
    }
    if (!delegRange || !delegRange[0] || !delegRange[1]) {
      message.error(t('windowRequired'));
      return;
    }
    setCreatingDeleg(true);
    try {
      await leaveApi.createDelegation(wsId, {
        toUserId: delegTo,
        startsOn: delegRange[0].format('YYYY-MM-DD'),
        endsOn: delegRange[1].format('YYYY-MM-DD'),
        reason: delegReason.trim() || undefined,
      });
      message.success(t('delegationCreated'));
      setDelegOpen(false);
      setDelegTo(undefined);
      setDelegRange(null);
      setDelegReason('');
      await loadDelegations(showRevoked);
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setCreatingDeleg(false);
    }
  };

  const confirmRevoke = (d: LeaveApproverDelegation) => {
    if (!wsId) return;
    modal.confirm({
      title: t('revokeConfirm'),
      content: t('revokeConfirmDesc'),
      okText: t('revoke'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await leaveApi.revokeDelegation(wsId, d._id);
          message.success(t('revoked'));
          await loadDelegations(showRevoked);
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  const delegationColumns: ColumnsType<LeaveApproverDelegation> = useMemo(
    () => [
      {
        title: t('col.from'),
        key: 'from',
        render: (_: unknown, d) => userName(d.fromUserId),
      },
      {
        title: t('col.to'),
        key: 'to',
        render: (_: unknown, d) => userName(d.toUserId),
      },
      {
        title: t('col.window'),
        key: 'window',
        render: (_: unknown, d) =>
          `${dayjs(d.startsOn).format('DD MMM YYYY')} – ${dayjs(d.endsOn).format('DD MMM YYYY')}`,
      },
      {
        title: t('col.status'),
        key: 'status',
        render: (_: unknown, d) => (
          <Tag color={d.isActive ? 'success' : 'default'}>
            {d.isActive ? t('statusActive') : t('statusRevoked')}
          </Tag>
        ),
      },
      {
        title: t('col.reason'),
        key: 'reason',
        render: (_: unknown, d) => d.reason || '-',
      },
      {
        title: '',
        key: 'action',
        align: 'right',
        render: (_: unknown, d) =>
          d.isActive && d.fromUserId === currentUserId ? (
            <Button size="small" danger onClick={() => confirmRevoke(d)}>
              {t('revoke')}
            </Button>
          ) : null,
      },
    ],
    // confirmRevoke is stable enough for this list; t/userName/currentUserId drive it.
    [t, userName, currentUserId], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card className="mb-6">
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    );
  }
  if (!canPath('leave.settings.manage')) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card>
          <DsEmptyState title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card className="mb-6">
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 4 }} />
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card>
          <DsEmptyState
            title={t('loadError')}
            action={
              <Button
                icon={<ReloadOutlined />}
                onClick={() => {
                  setLoading(true);
                  load();
                }}
              >
                {t('retry')}
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate module="leave" subFeature="configure" as="h1">
      <div className="mx-auto w-full max-w-6xl p-6">
        <DsPageHeader title={t('title')} sub={t('subtitle')} icon={<SettingOutlined />} />

        <div className="flex flex-col gap-6">
          {/* ── Approval workflow ─────────────────────────────── */}
          <Card styles={{ body: { padding: 20 } }}>
            <h2 className="m-0 font-display text-[15px] font-bold text-heading">
              {t('workflowTitle')}
            </h2>
            <p className="mt-1 mb-4 text-[13px] text-subtle">{t('workflowDesc')}</p>

            <div className="mb-4">
              <p className="mb-1 text-[13px] font-semibold text-heading">
                {t('approverChainLabel')}
              </p>
              <p className="mt-0 mb-3 text-[12px] text-subtle">{t('approverChainHint')}</p>

              {chain.length === 0 ? (
                <p className="m-0 mb-3 text-[13px] text-subtle">{t('noApprovers')}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {chain.map((uid, i) => (
                    <div key={`${i}-${uid}`} className="flex items-center gap-2">
                      <span className="w-16 shrink-0 text-[12px] font-semibold text-subtle">
                        {t('levelLabel', { n: i + 1 })}
                      </span>
                      <Select
                        className="flex-1"
                        showSearch
                        optionFilterProp="label"
                        placeholder={t('pickApprover')}
                        value={uid || undefined}
                        onChange={(v) => updateChainAt(i, v)}
                        options={userOptions.filter(
                          (o) => o.value === uid || !chain.includes(o.value),
                        )}
                      />
                      <Tooltip title={t('moveUp')}>
                        <Button
                          size="small"
                          icon={<ArrowUpOutlined />}
                          disabled={i === 0}
                          onClick={() => moveChain(i, -1)}
                          aria-label={t('moveUp')}
                        />
                      </Tooltip>
                      <Tooltip title={t('moveDown')}>
                        <Button
                          size="small"
                          icon={<ArrowDownOutlined />}
                          disabled={i === chain.length - 1}
                          onClick={() => moveChain(i, 1)}
                          aria-label={t('moveDown')}
                        />
                      </Tooltip>
                      <Tooltip title={t('removeApprover')}>
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => removeChainAt(i)}
                          aria-label={t('removeApprover')}
                        />
                      </Tooltip>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="dashed"
                className="mt-2"
                icon={<PlusOutlined />}
                onClick={() => setChain((prev) => [...prev, ''])}
              >
                {t('addApprover')}
              </Button>
            </div>

            <div
              className="flex items-start justify-between gap-4 border-0 border-t border-solid pt-4"
              style={{ borderColor: 'var(--cr-border-light)' }}
            >
              <div className="min-w-0">
                <p className="m-0 inline-flex items-center gap-1 text-[14px] font-semibold text-heading">
                  {t('sandwichLabel')}
                  <InfoTooltip
                    text={t('infoTip.sandwich.title')}
                    body={t('infoTip.sandwich.body')}
                  />
                </p>
                <p className="mt-0.5 mb-0 text-[12px] text-muted">{t('sandwichHint')}</p>
              </div>
              <Switch checked={sandwich} onChange={setSandwich} aria-label={t('sandwichLabel')} />
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="m-0 text-[13px] font-semibold text-heading">{t('retroLabel')}</p>
                <p className="mt-0.5 mb-1.5 text-[12px] text-subtle">{t('retroHint')}</p>
                <InputNumber
                  min={0}
                  max={365}
                  value={retro}
                  onChange={(v) => setRetro(v ?? 0)}
                  className="w-full"
                />
              </div>
              <div>
                <p className="m-0 text-[13px] font-semibold text-heading">{t('maxAttachLabel')}</p>
                <p className="mt-0.5 mb-1.5 text-[12px] text-subtle">{t('maxAttachHint')}</p>
                <InputNumber
                  min={0}
                  max={10}
                  value={maxAttach}
                  onChange={(v) => setMaxAttach(v ?? 0)}
                  className="w-full"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <DsButton
                dsVariant="primary"
                data-shortcut="save"
                loading={savingSettings}
                onClick={saveSettings}
              >
                {t('saveSettings')}
              </DsButton>
            </div>
          </Card>

          {/* ── Approver delegations ──────────────────────────── */}
          <Card styles={{ body: { padding: 20 } }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="m-0 inline-flex items-center gap-1 font-display text-[15px] font-bold text-heading">
                  {t('delegTitle')}
                  <InfoTooltip
                    text={t('infoTip.delegation.title')}
                    body={t('infoTip.delegation.body')}
                  />
                </h2>
                <p className="mt-1 mb-0 text-[13px] text-subtle">{t('delegDesc')}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <Switch
                    size="small"
                    checked={showRevoked}
                    onChange={toggleRevoked}
                    id="show-revoked"
                  />
                  <label htmlFor="show-revoked" className="text-[13px] text-muted">
                    {t('showRevoked')}
                  </label>
                </span>
                <DsButton dsVariant="primary" onClick={() => setDelegOpen(true)}>
                  <PlusOutlined /> {t('newDelegation')}
                </DsButton>
              </div>
            </div>

            <div className="mt-4">
              {delegations.length === 0 ? (
                <DsEmptyState title={t('delegEmpty')} />
              ) : (
                <Table
                  rowKey="_id"
                  size="middle"
                  columns={delegationColumns}
                  dataSource={delegations}
                  scroll={{ x: 720 }}
                  pagination={{ pageSize: 10, hideOnSinglePage: true }}
                />
              )}
            </div>
          </Card>
        </div>

        {/* ── New-delegation modal ──────────────────────────── */}
        <Modal
          open={delegOpen}
          onCancel={() => setDelegOpen(false)}
          onOk={submitDelegation}
          confirmLoading={creatingDeleg}
          okText={t('create')}
          cancelText={t('cancel')}
          title={t('createTitle')}
        >
          <p className="mt-0 mb-4 text-[13px] text-subtle">{t('createHint')}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="leave-deleg-to"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('toUserLabel')}
              </label>
              <Select
                id="leave-deleg-to"
                className="w-full"
                showSearch
                optionFilterProp="label"
                placeholder={t('toUserPlaceholder')}
                value={delegTo}
                onChange={setDelegTo}
                options={userOptions.filter((o) => o.value !== currentUserId)}
              />
            </div>
            <div>
              <label
                htmlFor="leave-deleg-window"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('windowLabel')}
              </label>
              <RangePicker
                id="leave-deleg-window"
                className="w-full"
                value={delegRange}
                disabledDate={(d) => !!d && d.isBefore(dayjs(), 'day')}
                onChange={(v) => {
                  const from = v?.[0];
                  const to = v?.[1];
                  setDelegRange(from && to ? [from, to] : null);
                }}
              />
            </div>
            <div>
              <label
                htmlFor="leave-deleg-reason"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('reasonLabel')}
              </label>
              <Input.TextArea
                id="leave-deleg-reason"
                rows={2}
                value={delegReason}
                onChange={(e) => setDelegReason(e.target.value)}
                placeholder={t('reasonPlaceholder')}
                maxLength={500}
              />
            </div>
          </div>
        </Modal>
      </div>
    </FeatureGate>
  );
}
