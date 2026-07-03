'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { App, Button, Card, Drawer, Input, Segmented, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  InboxOutlined,
  PaperClipOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useLocale, useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { leaveApi } from '@/lib/api/modules/leave.api';
import { teamApi } from '@/lib/api/modules/team.api';
import { LIST_ALL_LIMIT } from '@/lib/constants';
import { parseApiError } from '@/lib/utils';
import { DsButton, DsEmptyState, DsPageHeader, DsTag, InfoTooltip } from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type {
  CompOffRequest,
  LeaveApprovalStep,
  LeaveRequest,
  LeaveType,
  LeaveTypeLocale,
  TeamMember,
} from '@/types';

type RequestKind = 'leave' | 'compoff';
type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

type Detail = { kind: 'leave'; row: LeaveRequest } | { kind: 'compoff'; row: CompOffRequest };

/**
 * Map a leave/comp-off request status onto a key in the shared `STATUS_COLORS`
 * palette so the request tags use CR design tokens instead of antd presets.
 * `<DsTag>` reads the colour pair from `STATUS_COLORS[statusTone(...)]`.
 */
function statusTone(status: string): string {
  switch (status) {
    case 'approved':
      return 'active';
    case 'rejected':
      return 'inactive';
    case 'withdrawn':
      return 'warning';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

function typeLabel(lt: LeaveType | undefined, locale: string): string {
  if (!lt) return '-';
  return lt.labels[locale as LeaveTypeLocale] || lt.labels.en;
}

export default function LeaveApprovalsPage() {
  const t = useTranslations('leave.approvals');
  const locale = useLocale();
  const { message } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { loading: permissionsLoading, canPath } = useMyPermissions();

  const [kind, setKind] = useState<RequestKind>('leave');
  const [status, setStatus] = useState<StatusFilter>('pending');

  const [leaveRows, setLeaveRows] = useState<LeaveRequest[]>([]);
  const [compOffRows, setCompOffRows] = useState<CompOffRequest[]>([]);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [types, setTypes] = useState<Map<string, LeaveType>>(new Map());
  // `firstLoad` drives the full-card skeleton on the very first mount only.
  // `loading` drives the in-table spinner for status-filter refetches so the
  // table stays on screen rather than blanking behind a skeleton.
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [note, setNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    const statusParam = status === 'all' ? undefined : status;
    try {
      const [leave, compoff] = await Promise.all([
        leaveApi.listRequests(wsId, statusParam),
        leaveApi.listCompOffRequests(wsId, statusParam),
      ]);
      setLeaveRows(leave);
      setCompOffRows(compoff);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [wsId, status]);

  // Mount + status-change fetch - single shared fetch path via `load`.
  // `loading` is already true on mount and is re-armed by the status
  // Segmented's onChange; the `load` call is deferred through a microtask so
  // it sits outside the synchronous effect body (set-state-in-effect rule).
  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  useEffect(() => {
    if (!wsId) return;
    teamApi
      .list(wsId, { limit: LIST_ALL_LIMIT })
      .then((res) => {
        const list: TeamMember[] = Array.isArray(res)
          ? res
          : ((res as { members?: TeamMember[] }).members ?? []);
        setMembers(new Map(list.map((m) => [m.id, m.name])));
      })
      .catch(() => setMembers(new Map()));
    leaveApi
      .listTypes(wsId, true)
      .then((list) => setTypes(new Map(list.map((lt) => [lt._id, lt]))))
      .catch(() => setTypes(new Map()));
  }, [wsId]);

  const memberName = useCallback((id: string) => members.get(id) ?? id, [members]);

  const openDetail = (d: Detail) => {
    setDetail(d);
    setNote('');
  };

  const decide = async (action: 'approve' | 'reject') => {
    if (!wsId || !detail) return;
    setDeciding(true);
    const payload = { note: note.trim() || undefined };
    try {
      if (detail.kind === 'leave') {
        if (action === 'approve') {
          await leaveApi.approveRequest(wsId, detail.row._id, payload);
        } else {
          await leaveApi.rejectRequest(wsId, detail.row._id, payload);
        }
      } else if (action === 'approve') {
        await leaveApi.approveCompOffRequest(wsId, detail.row._id, payload);
      } else {
        await leaveApi.rejectCompOffRequest(wsId, detail.row._id, payload);
      }
      message.success(action === 'approve' ? t('approved') : t('rejected'));
      setDetail(null);
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setDeciding(false);
    }
  };

  // ── Columns ─────────────────────────────────────────────────
  const leaveColumns: ColumnsType<LeaveRequest> = useMemo(
    () => [
      {
        title: t('col.member'),
        key: 'member',
        render: (_: unknown, r) => memberName(r.teamMemberId),
      },
      {
        title: t('col.type'),
        key: 'type',
        render: (_: unknown, r) => {
          const lt = types.get(r.primaryLeaveTypeId);
          return (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: lt?.color ?? 'var(--cr-neutral-300)' }}
              />
              {typeLabel(lt, locale)}
            </span>
          );
        },
      },
      {
        title: t('col.period'),
        key: 'period',
        render: (_: unknown, r) => {
          const from = dayjs(r.fromDate);
          const to = dayjs(r.toDate);
          return from.isSame(to, 'day')
            ? from.format('DD MMM YYYY')
            : `${from.format('DD MMM')} – ${to.format('DD MMM YYYY')}`;
        },
      },
      {
        title: t('col.days'),
        key: 'days',
        align: 'right',
        render: (_: unknown, r) =>
          r.lwpDays > 0
            ? t('daysSplit', { total: r.totalDays, paid: r.paidDays, lwp: r.lwpDays })
            : t('daysTotal', { total: r.totalDays }),
      },
      {
        title: t('col.status'),
        key: 'status',
        render: (_: unknown, r) => (
          <DsTag status={statusTone(r.status)} label={t(`status.${r.status}`)} />
        ),
      },
      {
        title: t('col.applied'),
        key: 'applied',
        render: (_: unknown, r) => (r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY') : '-'),
      },
      {
        title: '',
        key: 'action',
        align: 'right',
        render: (_: unknown, r) => (
          <Button
            size="small"
            aria-label={t('reviewAria', { member: memberName(r.teamMemberId) })}
            onClick={() => openDetail({ kind: 'leave', row: r })}
          >
            {t('review')}
          </Button>
        ),
      },
    ],
    [t, locale, types, memberName],
  );

  const compOffColumns: ColumnsType<CompOffRequest> = useMemo(
    () => [
      {
        title: t('col.member'),
        key: 'member',
        render: (_: unknown, r) => memberName(r.teamMemberId),
      },
      {
        title: t('col.workDate'),
        key: 'workDate',
        render: (_: unknown, r) => dayjs(r.workDate).format('DD MMM YYYY'),
      },
      {
        title: t('col.earned'),
        key: 'earned',
        align: 'right',
        render: (_: unknown, r) => t('daysCount', { n: r.quantity }),
      },
      {
        title: t('col.status'),
        key: 'status',
        render: (_: unknown, r) => (
          <DsTag status={statusTone(r.status)} label={t(`status.${r.status}`)} />
        ),
      },
      {
        title: t('col.applied'),
        key: 'applied',
        render: (_: unknown, r) => (r.createdAt ? dayjs(r.createdAt).format('DD MMM YYYY') : '-'),
      },
      {
        title: '',
        key: 'action',
        align: 'right',
        render: (_: unknown, r) => (
          <Button
            size="small"
            aria-label={t('reviewAria', { member: memberName(r.teamMemberId) })}
            onClick={() => openDetail({ kind: 'compoff', row: r })}
          >
            {t('review')}
          </Button>
        ),
      },
    ],
    [t, memberName],
  );

  const statusOptions = useMemo(
    () =>
      (['pending', 'approved', 'rejected', 'all'] as StatusFilter[]).map((s) => ({
        value: s,
        label: t(`filter.${s}`),
      })),
    [t],
  );

  const renderChain = (chain: LeaveApprovalStep[]) => {
    if (chain.length === 0) {
      return <p className="m-0 text-[13px] text-subtle">{t('detail.autoApproved')}</p>;
    }
    return (
      <div className="flex flex-col gap-2">
        {chain.map((step) => (
          <div key={step.level} className="flex items-start gap-2">
            <DsTag
              status={step.decision ? statusTone(step.decision) : 'cancelled'}
              label={t('detail.level', { n: step.level })}
            />

            <div className="min-w-0 text-[13px]">
              <span className="font-semibold text-heading">
                {step.decision ? t(`status.${step.decision}`) : t('status.pending')}
              </span>
              {step.decidedAt && (
                <span className="text-subtle">
                  {' '}
                  · {dayjs(step.decidedAt).format('DD MMM YYYY')}
                </span>
              )}
              {step.note && <p className="m-0 mt-0.5 text-muted">“{step.note}”</p>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const detailIsPending = detail != null && detail.row.status === 'pending';

  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }
  if (!canPath('leave.approval.decide')) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <Card>
          <DsEmptyState title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate module="leave" subFeature="approve" as="h1">
      <div className="mx-auto max-w-6xl p-6">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<InboxOutlined />}
          right={
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                setLoading(true);
                load();
              }}
            >
              {t('refresh')}
            </Button>
          }
        />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Segmented
            value={kind}
            onChange={(v) => setKind(v as RequestKind)}
            options={[
              { value: 'leave', label: t('kindLeave') },
              { value: 'compoff', label: t('kindCompOff') },
            ]}
          />
          <Segmented
            value={status}
            onChange={(v) => {
              setStatus(v as StatusFilter);
              setLoading(true);
            }}
            options={statusOptions}
          />
        </div>

        {firstLoad ? (
          <Card>
            <Skeleton active paragraph={{ rows: 6 }} />
          </Card>
        ) : loadError ? (
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
        ) : kind === 'leave' ? (
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="_id"
              size="middle"
              loading={loading}
              columns={leaveColumns}
              dataSource={leaveRows}
              scroll={{ x: 760 }}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              locale={{ emptyText: <DsEmptyState title={t('emptyLeave')} sub={t('emptySub')} /> }}
            />
          </Card>
        ) : (
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="_id"
              size="middle"
              loading={loading}
              columns={compOffColumns}
              dataSource={compOffRows}
              scroll={{ x: 680 }}
              pagination={{ pageSize: 20, hideOnSinglePage: true }}
              locale={{ emptyText: <DsEmptyState title={t('emptyCompOff')} sub={t('emptySub')} /> }}
            />
          </Card>
        )}

        {/* ── Detail drawer ─────────────────────────────────── */}
        <Drawer
          open={detail != null}
          onClose={() => setDetail(null)}
          size={520}
          title={detail?.kind === 'compoff' ? t('detail.compOffTitle') : t('detail.leaveTitle')}
          footer={
            detailIsPending ? (
              <div className="flex flex-col gap-2">
                <Input.TextArea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('detail.notePlaceholder')}
                  maxLength={500}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    danger
                    icon={<CloseOutlined />}
                    loading={deciding}
                    onClick={() => decide('reject')}
                  >
                    {t('detail.reject')}
                  </Button>
                  <DsButton
                    dsVariant="primary"
                    loading={deciding}
                    onClick={() => decide('approve')}
                  >
                    <CheckOutlined /> {t('detail.approve')}
                  </DsButton>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <Button onClick={() => setDetail(null)}>{t('detail.close')}</Button>
              </div>
            )
          }
        >
          {detail && (
            <div className="flex flex-col gap-5">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="m-0 font-display text-[16px] font-bold text-heading">
                    {memberName(detail.row.teamMemberId)}
                  </h3>
                  <DsTag
                    status={statusTone(detail.row.status)}
                    label={t(`status.${detail.row.status}`)}
                  />
                </div>
              </div>

              {detail.kind === 'leave' ? (
                <>
                  <div className="grid grid-cols-2 gap-3 text-[13px]">
                    <div>
                      <p className="m-0 text-subtle">{t('detail.period')}</p>
                      <p className="m-0 font-semibold text-heading">
                        {dayjs(detail.row.fromDate).format('DD MMM')} –{' '}
                        {dayjs(detail.row.toDate).format('DD MMM YYYY')}
                      </p>
                    </div>
                    <div>
                      <p className="m-0 text-subtle">{t('detail.total')}</p>
                      <p className="m-0 font-semibold text-heading">
                        {t('daysCount', { n: detail.row.totalDays })}
                      </p>
                    </div>
                    <div>
                      <p className="m-0 text-subtle">{t('detail.paid')}</p>
                      <p className="m-0 font-semibold" style={{ color: 'var(--cr-success-700)' }}>
                        {t('daysCount', { n: detail.row.paidDays })}
                      </p>
                    </div>
                    <div>
                      <p className="m-0 inline-flex items-center gap-1 text-subtle">
                        {t('detail.lwp')}
                        <InfoTooltip text={t('infoTip.lwp.title')} body={t('infoTip.lwp.body')} />
                      </p>
                      <p className="m-0 font-semibold" style={{ color: 'var(--cr-warning-700)' }}>
                        {t('daysCount', { n: detail.row.lwpDays })}
                      </p>
                    </div>
                  </div>

                  {detail.row.isRetroactive && (
                    <span className="inline-flex w-fit items-center gap-1">
                      <Tag color="warning" className="m-0">
                        {t('detail.retroactive')}
                      </Tag>
                      <InfoTooltip
                        text={t('infoTip.retroactive.title')}
                        body={t('infoTip.retroactive.body')}
                      />
                    </span>
                  )}

                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-heading">
                      {t('detail.breakdown')}
                    </p>
                    <div className="flex flex-col gap-1">
                      {detail.row.dayBreakdown.map((seg, i) => {
                        const lt = types.get(seg.leaveTypeId);
                        return (
                          <div
                            key={`${seg.date}-${i}`}
                            className="flex items-center justify-between gap-2 text-[13px]"
                          >
                            <span className="text-body">
                              {dayjs(seg.date).format('ddd, DD MMM')}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                aria-hidden
                                className="inline-block h-2 w-2 rounded-full"
                                style={{ background: lt?.color ?? 'var(--cr-neutral-300)' }}
                              />
                              <span className="text-muted">{typeLabel(lt, locale)}</span>
                              <span className="font-semibold text-heading">
                                {t('daysCount', { n: seg.quantity })}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <p className="m-0 text-subtle">{t('detail.workDate')}</p>
                    <p className="m-0 font-semibold text-heading">
                      {dayjs(detail.row.workDate).format('DD MMM YYYY')}
                    </p>
                  </div>
                  <div>
                    <p className="m-0 text-subtle">{t('detail.earned')}</p>
                    <p className="m-0 font-semibold text-heading">
                      {t('daysCount', { n: detail.row.quantity })}
                    </p>
                  </div>
                  {detail.row.lotExpiresOn && (
                    <div>
                      <p className="m-0 text-subtle">{t('detail.lotExpires')}</p>
                      <p className="m-0 font-semibold text-heading">
                        {dayjs(detail.row.lotExpiresOn).format('DD MMM YYYY')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {detail.row.reason && (
                <div>
                  <p className="mb-1 text-[13px] font-semibold text-heading">
                    {t('detail.reason')}
                  </p>
                  <p className="m-0 text-[13px] text-muted">{detail.row.reason}</p>
                </div>
              )}

              {detail.row.attachments.length > 0 && (
                <p className="m-0 inline-flex items-center gap-1.5 text-[13px] text-muted">
                  <PaperClipOutlined />
                  {t('detail.attachments', { n: detail.row.attachments.length })}
                </p>
              )}

              <div>
                <p className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-heading">
                  {t('detail.chain')}
                  <InfoTooltip text={t('infoTip.chain.title')} body={t('infoTip.chain.body')} />
                </p>
                {renderChain(detail.row.approvalChain)}
              </div>
            </div>
          )}
        </Drawer>
      </div>
    </FeatureGate>
  );
}
