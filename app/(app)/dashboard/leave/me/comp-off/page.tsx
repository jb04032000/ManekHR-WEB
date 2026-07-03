'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, App, Button, Card, DatePicker, Drawer, Input, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { GiftOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useTranslations } from 'next-intl';
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
import type { CompOffLotView, CompOffRequest } from '@/types';

/**
 * Map a comp-off request status onto a key in the shared `STATUS_COLORS`
 * palette so request tags use CR design tokens instead of antd presets.
 */
function statusTone(status: string): string {
  switch (status) {
    case 'approved':
      return 'active';
    case 'rejected':
      return 'inactive';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/** A lot within this many days of lapsing is flagged as expiring soon. */
const EXPIRY_SOON_DAYS = 14;

/** Whole calendar days from today until `iso` (0 = today, negative = past). */
function daysUntil(iso: string): number {
  return dayjs(iso).startOf('day').diff(dayjs().startOf('day'), 'day');
}

/**
 * Urgency tone for a lot's expiry countdown, mapped to a `STATUS_COLORS` key:
 * imminent (≤3 days) → danger, soon (≤14 days) → warning, else healthy.
 */
function expiryTone(days: number): string {
  if (days <= 3) return 'inactive';
  if (days <= EXPIRY_SOON_DAYS) return 'warning';
  return 'active';
}

export default function MyCompOffPage() {
  const t = useTranslations('leave.compOff');
  const { message, modal } = App.useApp();
  const { currentWorkspaceId: wsId, currentWorkspace } = useWorkspaceStore();
  const { canPath, data: myPerms, loading: permsLoading } = useMyPermissions();
  // Page-level access guard: comp-off self-service requires the comp-off grant.
  // The nav tab is gated on the same grant; this guards direct URL navigation
  // so an ungranted member gets a clean access notice, not a failed load.
  const canAccessCompOff = !!myPerms?.isOwner || canPath('leave.compOff.apply');
  // Subscription gate (dynamic plans): when Leave is plan-locked the reads
  // 403 - show the upgrade prompt instead of doomed calls / a generic error.
  const { isLocked: leaveLocked, isLoading: leaveAccessLoading } = useFeatureAccess(
    'leave',
    'apply',
  );
  // Mirror the backend self-leave gate: a self-scoped member may claim comp-off
  // only when the workspace enabled self-service; an all-scope approver / owner
  // bypasses the toggle so the claim button stays available for them.
  const appliesAtAll = !!myPerms?.isOwner || canPath('leave.compOff.apply', 'all');
  const canClaim =
    canPath('leave.compOff.apply', 'self') &&
    (appliesAtAll || !!currentWorkspace?.selfServiceConfig?.selfLeaveApply);
  // Has the self-claim grant but the workspace policy is OFF - explain it
  // instead of silently hiding the Claim button (mirrors My Attendance).
  const selfClaimBlockedByPolicy =
    canPath('leave.compOff.apply', 'self') &&
    !appliesAtAll &&
    !currentWorkspace?.selfServiceConfig?.selfLeaveApply;

  const [lots, setLots] = useState<CompOffLotView[]>([]);
  const [requests, setRequests] = useState<CompOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // Claim drawer
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimDate, setClaimDate] = useState<Dayjs | null>(null);
  const [claimQty, setClaimQty] = useState<number>(1);
  const [claimReason, setClaimReason] = useState('');
  const [claiming, setClaiming] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    // Both reads share the leave.request.view (self) grant. Settle them
    // independently and render whatever loaded - a hard error only when BOTH
    // fail (mirrors My Leave). A lone failure still shows the half that loaded.
    const [lotRes, reqRes] = await Promise.allSettled([
      leaveApi.myCompOffLots(wsId),
      leaveApi.myCompOffRequests(wsId),
    ]);
    if (lotRes.status === 'fulfilled') setLots(lotRes.value);
    if (reqRes.status === 'fulfilled') setRequests(reqRes.value);
    setLoadError(lotRes.status === 'rejected' && reqRes.status === 'rejected');
    setLoading(false);
  }, [wsId]);

  // Mount + workspace-change fetch - single shared fetch path via `load`.
  // `loading` is already true on mount; the `load` call is deferred through a
  // microtask so it sits outside the synchronous effect body
  // (set-state-in-effect rule). `load` writes state only in its async body.
  useEffect(() => {
    // Skip the fetch for an ungranted member (RBAC) or a plan-locked Leave
    // module (subscription) - the access guard / upgrade prompt renders
    // instead, and these reads would 403 anyway.
    if (!canAccessCompOff || leaveAccessLoading || leaveLocked) return;
    queueMicrotask(() => {
      void load();
    });
  }, [load, canAccessCompOff, leaveAccessLoading, leaveLocked]);

  const availableTotal = useMemo(() => lots.reduce((s, l) => s + l.remainingDays, 0), [lots]);
  const expiringSoon = useMemo(
    () =>
      lots
        .filter((l) => daysUntil(l.expiresOn) <= EXPIRY_SOON_DAYS)
        .reduce((s, l) => s + l.remainingDays, 0),
    [lots],
  );

  const openClaim = () => {
    setClaimDate(null);
    setClaimQty(1);
    setClaimReason('');
    setClaimOpen(true);
  };

  const submitClaim = async () => {
    if (!wsId) return;
    if (!claimDate) {
      message.error(t('drawer.dateRequired'));
      return;
    }
    setClaiming(true);
    try {
      await leaveApi.applyCompOff(wsId, {
        workDate: claimDate.format('YYYY-MM-DD'),
        quantity: claimQty,
        reason: claimReason.trim() || undefined,
      });
      message.success(t('claimed'));
      setClaimOpen(false);
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setClaiming(false);
    }
  };

  const confirmCancel = (req: CompOffRequest) => {
    if (!wsId) return;
    modal.confirm({
      title: t('cancelConfirm'),
      content: t('cancelConfirmDesc'),
      okText: t('cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await leaveApi.cancelCompOffRequest(wsId, req._id);
          message.success(t('cancelled'));
          await load();
        } catch (e) {
          message.error(parseApiError(e));
        }
      },
    });
  };

  const lotColumns: ColumnsType<CompOffLotView> = useMemo(
    () => [
      {
        title: t('lots.col.earnedFor'),
        key: 'earnedFor',
        render: (_: unknown, l) => dayjs(l.sourceWorkDate).format('DD MMM YYYY'),
      },
      {
        title: t('lots.col.credited'),
        key: 'credited',
        align: 'right',
        render: (_: unknown, l) => l.creditedDays,
      },
      {
        title: t('lots.col.remaining'),
        key: 'remaining',
        align: 'right',
        render: (_: unknown, l) => (
          <span className="font-semibold text-heading">{l.remainingDays}</span>
        ),
      },
      {
        title: t('lots.col.expires'),
        key: 'expires',
        render: (_: unknown, l) => dayjs(l.expiresOn).format('DD MMM YYYY'),
      },
      {
        title: (
          <span className="inline-flex items-center gap-1">
            {t('lots.col.expiresIn')}
            <InfoTooltip text={t('infoTip.expiry.title')} body={t('infoTip.expiry.body')} />
          </span>
        ),
        key: 'expiresIn',
        render: (_: unknown, l) => {
          const d = daysUntil(l.expiresOn);
          return (
            <DsTag
              status={expiryTone(d)}
              label={d <= 0 ? t('lots.expiresToday') : t('lots.expiresInDays', { n: d })}
            />
          );
        },
      },
    ],
    [t],
  );

  const historyColumns: ColumnsType<CompOffRequest> = useMemo(
    () => [
      {
        title: t('history.col.workDate'),
        key: 'workDate',
        render: (_: unknown, r) => dayjs(r.workDate).format('DD MMM YYYY'),
      },
      {
        title: t('history.col.days'),
        key: 'days',
        align: 'right',
        render: (_: unknown, r) => r.quantity,
      },
      {
        title: t('history.col.status'),
        key: 'status',
        render: (_: unknown, r) => (
          <DsTag status={statusTone(r.status)} label={t(`status.${r.status}`)} />
        ),
      },
      {
        title: t('history.col.lotExpires'),
        key: 'lotExpires',
        render: (_: unknown, r) =>
          r.lotExpiresOn ? dayjs(r.lotExpiresOn).format('DD MMM YYYY') : '-',
      },
      {
        title: '',
        key: 'action',
        align: 'right',
        render: (_: unknown, r) =>
          r.status === 'pending' ? (
            <Button size="small" danger onClick={() => confirmCancel(r)}>
              {t('cancel')}
            </Button>
          ) : null,
      },
    ],
    // confirmCancel is stable for this list's lifetime.
    [t], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Wait for permissions + subscription access before deciding - avoids a
  // no-access / upgrade flash mid-resolve.
  if (permsLoading || !myPerms || leaveAccessLoading) {
    return (
      <div className="w-full">
        <Card className="mb-6">
          <Skeleton active paragraph={{ rows: 3 }} />
        </Card>
        <Card>
          <Skeleton active paragraph={{ rows: 5 }} />
        </Card>
      </div>
    );
  }

  // Plan-locked (subscription) trumps the RBAC grant - show the upgrade prompt
  // rather than the access notice or a generic load error.
  if (leaveLocked) {
    return <FeatureGate module="leave" subFeature="apply" as="h1" />;
  }

  if (!canAccessCompOff) {
    return (
      <div className="w-full">
        <Card>
          <DsEmptyState title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full">
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

  return (
    <FeatureGate module="leave" subFeature="apply" as="h1">
      <div className="w-full">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<GiftOutlined />}
          titleAside={
            <InfoTooltip
              text={t('infoTip.compOff.title')}
              body={
                <div className="flex flex-col gap-2 text-[13px] leading-snug">
                  <p className="m-0">{t('infoTip.compOff.intro')}</p>
                  <div>
                    <p className="m-0 mb-1 font-semibold">{t('infoTip.compOff.howTitle')}</p>
                    <ol className="m-0 flex list-decimal flex-col gap-1 pl-4">
                      <li>{t('infoTip.compOff.step1')}</li>
                      <li>{t('infoTip.compOff.step2')}</li>
                      <li>{t('infoTip.compOff.step3')}</li>
                      <li>{t('infoTip.compOff.step4')}</li>
                      <li>{t('infoTip.compOff.step5')}</li>
                    </ol>
                  </div>
                </div>
              }
            />
          }
          right={
            canClaim ? (
              <DsButton dsVariant="primary" onClick={openClaim}>
                <PlusOutlined /> {t('claimButton')}
              </DsButton>
            ) : undefined
          }
        />

        {selfClaimBlockedByPolicy && (
          <Alert
            type="info"
            showIcon
            title={t('selfClaimDisabledNote')}
            className="mb-8"
            style={{ borderRadius: 12 }}
          />
        )}

        {/* ── Comp-off balance ──────────────────────────────── */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <StatTile label={t('statAvailable')} value={String(availableTotal)} />
          <StatTile label={t('statExpiringSoon')} value={String(expiringSoon)} />
        </div>

        {/* ── Banked comp-off lots ──────────────────────────── */}
        <h2 className="m-0 mb-3 inline-flex items-center gap-1 font-display text-[15px] font-bold text-heading">
          {t('lotsTitle')}
          <InfoTooltip text={t('infoTip.lot.title')} body={t('infoTip.lot.body')} />
        </h2>
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            rowKey="ledgerEntryId"
            size="middle"
            columns={lotColumns}
            dataSource={lots}
            scroll={{ x: 620 }}
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            locale={{
              emptyText: <DsEmptyState title={t('lotsEmpty')} sub={t('lotsEmptySub')} />,
            }}
          />
        </Card>
        <p className="mt-2 mb-8 text-[12px] text-subtle">{t('useHint')}</p>

        {/* ── Claim history ─────────────────────────────────── */}
        <h2 className="m-0 mb-3 font-display text-[15px] font-bold text-heading">
          {t('historyTitle')}
        </h2>
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            rowKey="_id"
            size="middle"
            columns={historyColumns}
            dataSource={requests}
            scroll={{ x: 620 }}
            pagination={{ pageSize: 15, hideOnSinglePage: true }}
            locale={{
              emptyText: <DsEmptyState title={t('historyEmpty')} sub={t('historyEmptySub')} />,
            }}
          />
        </Card>

        {/* ── Claim drawer ──────────────────────────────────── */}
        <Drawer
          open={claimOpen}
          onClose={() => setClaimOpen(false)}
          title={t('drawer.claimTitle')}
          size={460}
          destroyOnHidden
          footer={
            <div className="flex justify-end gap-2">
              <Button onClick={() => setClaimOpen(false)} disabled={claiming}>
                {t('drawer.cancelBtn')}
              </Button>
              <DsButton dsVariant="primary" loading={claiming} onClick={submitClaim}>
                {t('drawer.submit')}
              </DsButton>
            </div>
          }
        >
          <div className="flex flex-col gap-4">
            <div>
              <label
                htmlFor="comp-off-claim-date"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('drawer.dateLabel')}
              </label>
              <DatePicker
                id="comp-off-claim-date"
                className="w-full"
                size="large"
                value={claimDate}
                onChange={setClaimDate}
                disabledDate={(d) => !!d && d.isAfter(dayjs(), 'day')}
              />
              <p className="m-0 mt-1 text-[12px] text-subtle">{t('drawer.dateHint')}</p>
            </div>
            <div>
              <label
                htmlFor="comp-off-claim-qty"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('drawer.qtyLabel')}
              </label>
              <Select
                id="comp-off-claim-qty"
                className="w-full"
                size="large"
                value={claimQty}
                onChange={setClaimQty}
                options={[
                  { value: 1, label: t('drawer.qtyFull') },
                  { value: 0.5, label: t('drawer.qtyHalf') },
                ]}
              />
            </div>
            <div>
              <label
                htmlFor="comp-off-claim-reason"
                className="mb-1 block text-[13px] font-semibold text-heading"
              >
                {t('drawer.reasonLabel')}
              </label>
              <Input.TextArea
                id="comp-off-claim-reason"
                rows={3}
                value={claimReason}
                onChange={(e) => setClaimReason(e.target.value)}
                placeholder={t('drawer.reasonPlaceholder')}
                maxLength={1000}
              />
            </div>
          </div>
        </Drawer>
      </div>
    </FeatureGate>
  );
}
