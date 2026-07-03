'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Drawer, Input, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CalendarOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useLocale, useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { leaveApi } from '@/lib/api/modules/leave.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { parseApiError } from '@/lib/utils';
import {
  DsButton,
  DsEmptyState,
  DsPageHeader,
  DsTag,
  InfoTooltip,
  StatTile,
} from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { HolidaysNextPill } from '@/components/dashboard/holidays/HolidaysYearCard';
import type {
  LeaveBalance,
  LeaveHalfDaySession,
  LeavePreviewResult,
  LeaveRequest,
  LeaveType,
  LeaveTypeLocale,
} from '@/types';

const { RangePicker } = DatePicker;

/**
 * Map a leave request status onto a key in the shared `STATUS_COLORS`
 * palette so request tags use CR design tokens instead of antd presets.
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

export default function MyLeavePage() {
  const t = useTranslations('leave.me');
  const locale = useLocale();
  const { message, modal } = App.useApp();
  const { currentWorkspaceId: wsId, currentWorkspace } = useWorkspaceStore();
  const { canPath, data: myPerms } = useMyPermissions();
  // Apply is gated by the grant AND, for a self-scoped member, the workspace
  // self-service policy - mirrors the backend self-leave gate so the button is
  // hidden up front rather than failing on submit. An all-scope approver / owner
  // applying on someone's behalf bypasses the policy toggle.
  const appliesAtAll = !!myPerms?.isOwner || canPath('leave.request.apply', 'all');
  const canApply =
    canPath('leave.request.apply', 'self') &&
    (appliesAtAll || !!currentWorkspace?.selfServiceConfig?.selfLeaveApply);
  // Has the self-apply grant but the workspace policy is OFF - explain it
  // instead of silently hiding the Apply button (mirrors My Attendance).
  const selfApplyBlockedByPolicy =
    canPath('leave.request.apply', 'self') &&
    !appliesAtAll &&
    !currentWorkspace?.selfServiceConfig?.selfLeaveApply;
  // The balance widget needs its own grant (leave.balance.view), independent of
  // leave.request.view. Hide the whole balances section when the member lacks
  // it instead of blanking the page or showing an empty "no balances" card.
  const canViewBalances = !!myPerms?.isOwner || canPath('leave.balance.view');
  // Subscription gate (dynamic plans): the Leave module / sub-feature can be
  // plan-locked. When locked, the reads 403 - show the upgrade prompt instead
  // of firing doomed calls that surface as a generic "Could not load" error.
  const { isLocked: leaveLocked, isLoading: leaveAccessLoading } = useFeatureAccess(
    'leave',
    'apply',
  );

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [types, setTypes] = useState<Map<string, LeaveType>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Apply drawer
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyTypeId, setApplyTypeId] = useState<string | undefined>();
  const [applyRange, setApplyRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [firstHalf, setFirstHalf] = useState<LeaveHalfDaySession>('none');
  const [lastHalf, setLastHalf] = useState<LeaveHalfDaySession>('none');
  const [applyReason, setApplyReason] = useState('');
  const [preview, setPreview] = useState<LeavePreviewResult | null>(null);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    // Balances (leave.balance.view) and the request history + type catalogue
    // (leave.request.view) are independent grants. Settle them independently so
    // a member who holds one but not the other still sees what they can - a
    // missing balance grant must never blank the whole page.
    const [balRes, reqRes, typeRes] = await Promise.allSettled([
      leaveApi.myBalances(wsId),
      leaveApi.myRequests(wsId),
      leaveApi.listTypes(wsId, true),
    ]);
    if (balRes.status === 'fulfilled') setBalances(balRes.value);
    if (reqRes.status === 'fulfilled') setRequests(reqRes.value);
    if (typeRes.status === 'fulfilled') {
      setTypes(new Map(typeRes.value.map((lt) => [lt._id, lt])));
    }
    // Hard error only when the core history view is unusable - both the
    // requests list AND the type catalogue (the same leave.request.view grant)
    // failed. The balance widget is gated separately in the render.
    setLoadError(reqRes.status === 'rejected' && typeRes.status === 'rejected');
    setLoading(false);
  }, [wsId]);

  // Mount + workspace-change fetch - single shared fetch path via `load`.
  // `loading` is already true on mount; the `load` call is deferred through a
  // microtask so it sits outside the synchronous effect body
  // (set-state-in-effect rule). `load` writes state only in its async body.
  useEffect(() => {
    // Skip the fetch while subscription access is resolving or when Leave is
    // plan-locked - the upgrade prompt renders instead of doomed 403 reads.
    if (leaveAccessLoading || leaveLocked) return;
    queueMicrotask(() => {
      void load();
    });
  }, [load, leaveAccessLoading, leaveLocked]);

  const isMultiDay = !!applyRange && !applyRange[0].isSame(applyRange[1], 'day');

  // Live paid-vs-LWP preview - setState lives only in the async callback.
  useEffect(() => {
    if (!wsId || !applyOpen || !applyTypeId || !applyRange) return;
    let cancelled = false;
    leaveApi
      .previewLeave(wsId, {
        leaveTypeId: applyTypeId,
        fromDate: applyRange[0].format('YYYY-MM-DD'),
        toDate: applyRange[1].format('YYYY-MM-DD'),
        firstDayHalf: firstHalf,
        lastDayHalf: isMultiDay ? lastHalf : 'none',
      })
      .then((r) => {
        if (!cancelled) setPreview(r);
      })
      .catch(() => {
        if (!cancelled) setPreview(null);
      });
    return () => {
      cancelled = true;
    };
  }, [wsId, applyOpen, applyTypeId, applyRange, firstHalf, lastHalf, isMultiDay]);

  const typeOptions = useMemo(
    () =>
      [...types.values()]
        .filter((lt) => lt.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((lt) => ({ value: lt._id, label: typeLabel(lt, locale) })),
    [types, locale],
  );

  const openApply = () => {
    setApplyTypeId(undefined);
    setApplyRange(null);
    setFirstHalf('none');
    setLastHalf('none');
    setApplyReason('');
    setPreview(null);
    setApplyOpen(true);
  };

  const submitApply = async () => {
    if (!wsId) return;
    if (!applyTypeId) {
      message.error(t('drawer.typeRequired'));
      return;
    }
    if (!applyRange) {
      message.error(t('drawer.datesRequired'));
      return;
    }
    // Reason is required (owner directive 2026-07-03) - approvers need context.
    if (!applyReason.trim()) {
      message.error(t('drawer.reasonRequired'));
      return;
    }
    setApplying(true);
    try {
      await leaveApi.applyLeave(wsId, {
        leaveTypeId: applyTypeId,
        fromDate: applyRange[0].format('YYYY-MM-DD'),
        toDate: applyRange[1].format('YYYY-MM-DD'),
        firstDayHalf: firstHalf,
        lastDayHalf: isMultiDay ? lastHalf : 'none',
        reason: applyReason.trim(),
      });
      message.success(t('applied'));
      setApplyOpen(false);
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setApplying(false);
    }
  };

  const confirmCancel = (req: LeaveRequest) => {
    if (!wsId) return;
    modal.confirm({
      title: t('cancelConfirm'),
      content: t('cancelConfirmDesc'),
      // Distinct button texts - okText t('cancel') rendered two "Cancel"
      // buttons side by side (confirm + dismiss looked identical).
      okText: t('cancelConfirmOk'),
      cancelText: t('cancelConfirmKeep'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await leaveApi.cancelRequest(wsId, req._id);
          message.success(t('cancelled'));
          await load();
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  const confirmWithdraw = (req: LeaveRequest) => {
    if (!wsId) return;
    modal.confirm({
      title: t('withdrawConfirm'),
      content: t('withdrawConfirmDesc'),
      okText: t('withdraw'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await leaveApi.withdrawRequest(wsId, req._id);
          message.success(t('withdrawn'));
          await load();
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  const columns: ColumnsType<LeaveRequest> = useMemo(
    () => [
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
        title: (
          <span className="inline-flex items-center gap-1">
            {t('col.days')}
            <InfoTooltip text={t('infoTip.lwp.title')} body={t('infoTip.lwp.body')} />
          </span>
        ),
        key: 'days',
        align: 'right',
        render: (_: unknown, r) =>
          r.lwpDays > 0
            ? t('daysSplit', { total: r.totalDays, paid: r.paidDays, lwp: r.lwpDays })
            : t('daysCount', { n: r.totalDays }),
      },
      {
        title: t('col.status'),
        key: 'status',
        render: (_: unknown, r) => {
          // A rejection is terminal, so at most one step carries the reject note.
          // Surface it to the applicant so a "Rejected" badge is never a dead end.
          const rejectionNote =
            r.status === 'rejected'
              ? r.approvalChain.find((s) => s.decision === 'rejected')?.note
              : null;
          return (
            <div className="flex flex-col items-start gap-1">
              <DsTag status={statusTone(r.status)} label={t(`status.${r.status}`)} />
              {rejectionNote && (
                <span className="max-w-[240px] text-[12px] leading-snug text-subtle">
                  {t('rejectionReason', { reason: rejectionNote })}
                </span>
              )}
            </div>
          );
        },
      },
      {
        title: '',
        key: 'action',
        align: 'right',
        render: (_: unknown, r) => {
          if (r.status === 'pending') {
            return (
              <Button size="small" danger onClick={() => confirmCancel(r)}>
                {t('cancel')}
              </Button>
            );
          }
          if (r.status === 'approved') {
            return (
              <Button size="small" onClick={() => confirmWithdraw(r)}>
                {t('withdraw')}
              </Button>
            );
          }
          return null;
        },
      },
    ],
    // confirmCancel / confirmWithdraw are stable for this list's lifetime.
    [t, locale, types], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Plan-locked (subscription) - show the upgrade prompt, never the generic
  // load error. `FeatureGate` with no children renders the UpgradePrompt when
  // locked. Guarded by `!leaveAccessLoading` so it never flashes mid-resolve.
  if (leaveLocked && !leaveAccessLoading) {
    return <FeatureGate module="leave" subFeature="apply" as="h1" />;
  }

  if (loading || leaveAccessLoading) {
    return (
      <div className="w-full" aria-busy="true">
        <Card className="mb-6">
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="w-full">
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

  // All-empty path: when a member has no balances credited AND no leave
  // applications on file we collapse the two stacked "no data" cards into a
  // single friendly empty state to avoid dominating the viewport with
  // whitespace. Triggers only outside the loading / load-error / plan-locked
  // branches above so it never flashes mid-resolve.
  const hasNoData = balances.length === 0 && requests.length === 0;

  return (
    <FeatureGate module="leave" subFeature="apply" as="h1">
      <div className="w-full">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<CalendarOutlined />}
          right={
            <>
              <HolidaysNextPill />
              {canApply ? (
                <DsButton dsVariant="primary" onClick={openApply}>
                  <PlusOutlined /> {t('applyButton')}
                </DsButton>
              ) : null}
            </>
          }
        />

        {selfApplyBlockedByPolicy && (
          <Alert
            type="info"
            showIcon
            title={t('selfApplyDisabledNote')}
            className="mb-8"
            style={{ borderRadius: 12 }}
          />
        )}

        {/* All-empty consolidation. When the member has no balances credited AND
            no applications on file, the page would otherwise render two stacked
            empty-state cards (Balances + History) and dominate the viewport with
            whitespace - especially painful for fresh members / limited-access
            roles. Collapse both into a single friendly card. We DO NOT swap when
            either section has data: a member with balances but no history must
            still see the balances grid, and vice-versa. Apply CTA is included
            only when the member can actually self-apply (grant + policy ON). */}
        {hasNoData ? (
          <Card>
            <DsEmptyState
              icon="🌴"
              title={t('noActivity.title')}
              sub={t('noActivity.subtitle')}
              action={
                canApply && !selfApplyBlockedByPolicy ? (
                  <DsButton dsVariant="primary" onClick={openApply}>
                    <PlusOutlined /> {t('applyButton')}
                  </DsButton>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            {/* ── Balance widget - gated on the leave.balance.view grant ─ */}
            {canViewBalances && (
              <>
                <h2 className="m-0 mb-3 font-display text-[15px] font-bold text-heading">
                  {t('balancesTitle')}
                </h2>
                {balances.length === 0 ? (
                  <Card className="mb-8">
                    <DsEmptyState title={t('noBalances')} sub={t('noBalancesSub')} />
                  </Card>
                ) : (
                  <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {balances.map((b) => {
                      const lt = types.get(b.leaveTypeId);
                      return (
                        <Card key={b._id} styles={{ body: { padding: 14 } }}>
                          <div className="flex items-center gap-2">
                            <span
                              aria-hidden
                              className="inline-block h-3 w-3 rounded-full"
                              style={{ background: lt?.color ?? 'var(--cr-neutral-300)' }}
                            />
                            <span className="truncate text-[13px] font-semibold text-heading">
                              {typeLabel(lt, locale)}
                            </span>
                          </div>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="font-display text-[26px] font-bold text-heading">
                              {b.available}
                            </span>
                            <span className="text-[12px] text-subtle">{t('balanceAvailable')}</span>
                          </div>
                          <div className="mt-1 text-[12px] text-subtle">
                            {t('balanceUsed', { n: b.used })} ·{' '}
                            {t('balancePending', { n: b.pending })}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* ── My leave history ──────────────────────────────── */}
            <h2 className="m-0 mb-3 font-display text-[15px] font-bold text-heading">
              {t('historyTitle')}
            </h2>
            <Card styles={{ body: { padding: 0 } }}>
              <Table
                rowKey="_id"
                size="middle"
                columns={columns}
                dataSource={requests}
                scroll={{ x: 620 }}
                pagination={{ pageSize: 15, hideOnSinglePage: true }}
                locale={{
                  emptyText: <DsEmptyState title={t('historyEmpty')} sub={t('historyEmptySub')} />,
                }}
              />
            </Card>
          </>
        )}

        {/* ── Apply drawer ──────────────────────────────────── */}
        <Drawer
          open={applyOpen}
          onClose={() => setApplyOpen(false)}
          title={t('drawer.applyTitle')}
          size={480}
          destroyOnHidden
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => setApplyOpen(false)} disabled={applying}>
                {t('drawer.cancelBtn')}
              </Button>
              <DsButton dsVariant="primary" loading={applying} onClick={submitApply}>
                {t('drawer.submit')}
              </DsButton>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="leave-apply-type"
                className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-heading"
              >
                {t('drawer.typeLabel')}
                <InfoTooltip
                  text={t('infoTip.leaveType.title')}
                  body={t('infoTip.leaveType.body')}
                />
              </label>
              <Select
                id="leave-apply-type"
                className="w-full"
                size="large"
                showSearch
                optionFilterProp="label"
                placeholder={t('drawer.typePlaceholder')}
                value={applyTypeId}
                onChange={setApplyTypeId}
                options={typeOptions}
              />
            </div>
            <div>
              <label
                htmlFor="leave-apply-dates"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('drawer.datesLabel')}
              </label>
              <RangePicker
                id="leave-apply-dates"
                className="w-full"
                size="large"
                value={applyRange}
                onChange={(v) => {
                  const from = v?.[0];
                  const to = v?.[1];
                  setApplyRange(from && to ? [from, to] : null);
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="leave-apply-first-half"
                  className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-heading"
                >
                  {isMultiDay ? t('drawer.firstDayLabel') : t('drawer.halfDayLabel')}
                  <InfoTooltip text={t('infoTip.halfDay.title')} body={t('infoTip.halfDay.body')} />
                </label>
                <Select
                  id="leave-apply-first-half"
                  className="w-full"
                  value={firstHalf}
                  onChange={setFirstHalf}
                  options={[
                    { value: 'none', label: t('drawer.halfFull') },
                    { value: 'first_half', label: t('drawer.halfFirst') },
                    { value: 'second_half', label: t('drawer.halfSecond') },
                  ]}
                />
              </div>
              {isMultiDay && (
                <div>
                  <label
                    htmlFor="leave-apply-last-half"
                    className="mb-1 block text-[13px] font-semibold text-heading"
                  >
                    {t('drawer.lastDayLabel')}
                  </label>
                  <Select
                    id="leave-apply-last-half"
                    className="w-full"
                    value={lastHalf}
                    onChange={setLastHalf}
                    options={[
                      { value: 'none', label: t('drawer.halfFull') },
                      { value: 'first_half', label: t('drawer.halfFirst') },
                      { value: 'second_half', label: t('drawer.halfSecond') },
                    ]}
                  />
                </div>
              )}
            </div>
            <div>
              <label
                htmlFor="leave-apply-reason"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('drawer.reasonLabel')}
                <span className="ml-0.5 text-[var(--cr-danger-500)]">*</span>
              </label>
              <Input.TextArea
                id="leave-apply-reason"
                rows={3}
                value={applyReason}
                onChange={(e) => setApplyReason(e.target.value)}
                placeholder={t('drawer.reasonPlaceholder')}
                maxLength={1000}
              />
            </div>

            {/* Live paid-vs-LWP preview */}
            {applyTypeId && applyRange && preview && (
              <div
                className="rounded-lg border border-solid p-3"
                style={{
                  borderColor: 'var(--cr-border)',
                  background: 'var(--cr-surface-2, var(--cr-bg))',
                }}
              >
                <p className="m-0 mb-2 text-[13px] font-semibold text-heading">
                  {t('drawer.previewTitle')}
                </p>
                {preview.totalDays === 0 ? (
                  <p className="m-0 text-[13px] text-subtle">{t('drawer.previewZero')}</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-2">
                      <StatTile
                        label={t('drawer.previewWorkingLabel')}
                        value={String(preview.totalDays)}
                      />
                      <StatTile
                        label={t('drawer.previewPaidLabel')}
                        value={String(preview.paidDays)}
                      />
                      <StatTile
                        label={t('drawer.previewLwpLabel')}
                        value={String(preview.lwpDays)}
                      />
                    </div>
                    {preview.lwpDays > 0 && (
                      <p
                        className="m-0 mt-2 text-[12px]"
                        style={{ color: 'var(--cr-warning-700)' }}
                      >
                        {t('drawer.previewLwpWarn', { n: preview.lwpDays })}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </Drawer>
      </div>
    </FeatureGate>
  );
}
