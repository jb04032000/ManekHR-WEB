'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { App, Button, Card, Input, InputNumber, Modal, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined, SearchOutlined, SlidersOutlined, WalletOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { leaveApi } from '@/lib/api/modules/leave.api';
import { teamApi } from '@/lib/api/modules/team.api';
import { LIST_ALL_LIMIT } from '@/lib/constants';
import { parseApiError } from '@/lib/utils';
import { DsEmptyState, DsPageHeader, InfoTooltip } from '@/components/ui';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { LeaveBalance, LeaveType, LeaveTypeLocale, TeamMember } from '@/types';

function typeLabel(lt: LeaveType | undefined, locale: string): string {
  if (!lt) return '-';
  return lt.labels[locale as LeaveTypeLocale] || lt.labels.en;
}

/** Bold + CR-token colour for an available-balance figure (positive / negative / zero). */
function availableStyle(v: number): CSSProperties {
  if (v > 0) return { fontWeight: 700, color: 'var(--cr-success-700)' };
  if (v < 0) return { fontWeight: 700, color: 'var(--cr-danger-700)' };
  return { fontWeight: 700, color: 'var(--cr-text-3)' };
}

export default function LeaveBalancesPage() {
  const t = useTranslations('leave.balances');
  const locale = useLocale();
  const { message } = App.useApp();
  const { currentWorkspaceId: wsId } = useWorkspaceStore();
  const { loading: permissionsLoading, canPath } = useMyPermissions();

  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [members, setMembers] = useState<Map<string, string>>(new Map());
  const [types, setTypes] = useState<Map<string, LeaveType>>(new Map());
  // `firstLoad` drives the full-card skeleton on first mount only; `loading`
  // drives the in-table spinner for year-filter refetches so the grid stays
  // on screen rather than blanking behind a skeleton.
  const [firstLoad, setFirstLoad] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');

  const [adjustRow, setAdjustRow] = useState<LeaveBalance | null>(null);
  const [adjustQty, setAdjustQty] = useState<number | null>(null);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    if (!wsId) return;
    try {
      const list = await leaveApi.listWorkspaceBalances(wsId, year);
      setBalances(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
      setFirstLoad(false);
    }
  }, [wsId, year]);

  // Mount + year-change fetch - single shared fetch path via `load`.
  // `loading` is already true on mount and is re-armed by the year Select's
  // onChange; the `load` call is deferred through a microtask so it sits
  // outside the synchronous effect body (set-state-in-effect rule).
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

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? balances.filter((b) => memberName(b.teamMemberId).toLowerCase().includes(q))
      : balances;
    return [...filtered].sort((a, b) => {
      const byMember = memberName(a.teamMemberId).localeCompare(memberName(b.teamMemberId));
      if (byMember !== 0) return byMember;
      const ta = types.get(a.leaveTypeId)?.sortOrder ?? 0;
      const tb = types.get(b.leaveTypeId)?.sortOrder ?? 0;
      return ta - tb;
    });
  }, [balances, search, memberName, types]);

  const yearOptions = useMemo(
    () =>
      [currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => ({
        value: y,
        label: String(y),
      })),
    [currentYear],
  );

  const openAdjust = (row: LeaveBalance) => {
    setAdjustRow(row);
    setAdjustQty(null);
    setAdjustReason('');
  };

  const submitAdjust = async () => {
    if (!wsId || !adjustRow) return;
    if (adjustQty == null || adjustQty === 0) {
      message.error(t('qtyRequired'));
      return;
    }
    if (!adjustReason.trim()) {
      message.error(t('reasonRequired'));
      return;
    }
    setAdjusting(true);
    try {
      await leaveApi.postAdjustment(wsId, {
        teamMemberId: adjustRow.teamMemberId,
        leaveTypeId: adjustRow.leaveTypeId,
        year: adjustRow.year,
        quantity: adjustQty,
        reason: adjustReason.trim(),
      });
      message.success(t('adjusted'));
      setAdjustRow(null);
      await load();
    } catch (e) {
      message.error(parseApiError(e));
    } finally {
      setAdjusting(false);
    }
  };

  const columns: ColumnsType<LeaveBalance> = useMemo(
    () => [
      {
        title: t('col.member'),
        key: 'member',
        fixed: 'left',
        render: (_: unknown, b) => memberName(b.teamMemberId),
      },
      {
        title: t('col.type'),
        key: 'type',
        render: (_: unknown, b) => {
          const lt = types.get(b.leaveTypeId);
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
        title: (
          <span className="inline-flex items-center gap-1">
            {t('col.opening')}
            <InfoTooltip text={t('infoTip.opening.title')} body={t('infoTip.opening.body')} />
          </span>
        ),
        dataIndex: 'opening',
        key: 'opening',
        align: 'right',
      },
      {
        title: (
          <span className="inline-flex items-center gap-1">
            {t('col.credited')}
            <InfoTooltip text={t('infoTip.credited.title')} body={t('infoTip.credited.body')} />
          </span>
        ),
        dataIndex: 'credited',
        key: 'credited',
        align: 'right',
      },
      { title: t('col.used'), dataIndex: 'used', key: 'used', align: 'right' },
      {
        title: (
          <span className="inline-flex items-center gap-1">
            {t('col.pending')}
            <InfoTooltip text={t('infoTip.pending.title')} body={t('infoTip.pending.body')} />
          </span>
        ),
        dataIndex: 'pending',
        key: 'pending',
        align: 'right',
      },
      {
        title: t('col.available'),
        key: 'available',
        align: 'right',
        render: (_: unknown, b) => <span style={availableStyle(b.available)}>{b.available}</span>,
      },
      {
        title: '',
        key: 'action',
        align: 'right',
        render: (_: unknown, b) => (
          <Button size="small" icon={<SlidersOutlined />} onClick={() => openAdjust(b)}>
            {t('adjust')}
          </Button>
        ),
      },
    ],
    [t, locale, types, memberName],
  );

  const adjustType = adjustRow ? types.get(adjustRow.leaveTypeId) : undefined;

  // RBAC defense-in-depth (ADR-001 Tier 2): in-page gate layered on top of
  // the central ROUTE_PERMISSIONS guard. Owners short-circuit inside `can`.
  if (permissionsLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </div>
    );
  }
  if (!canPath('leave.balance.view', 'all')) {
    return (
      <div className="mx-auto w-full max-w-6xl p-6">
        <Card>
          <DsEmptyState title={t('accessDenied.title')} sub={t('accessDenied.message')} />
        </Card>
      </div>
    );
  }

  return (
    <FeatureGate module="leave" subFeature="view_balance" as="h1">
      <div className="mx-auto w-full max-w-6xl p-6">
        <DsPageHeader
          title={t('title')}
          sub={t('subtitle')}
          icon={<WalletOutlined />}
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

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2">
            <span className="text-[13px] text-muted">{t('yearLabel')}</span>
            <Select
              value={year}
              onChange={(v) => {
                setYear(v);
                setLoading(true);
              }}
              options={yearOptions}
              style={{ width: 110 }}
            />
          </span>
          <Input
            prefix={<SearchOutlined />}
            allowClear
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ maxWidth: 280 }}
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
        ) : (
          <Card styles={{ body: { padding: 0 } }}>
            <Table
              rowKey="_id"
              size="middle"
              loading={loading}
              columns={columns}
              dataSource={rows}
              scroll={{ x: 820 }}
              pagination={{ pageSize: 25, hideOnSinglePage: true }}
              locale={{
                emptyText: <DsEmptyState title={t('emptyTitle')} sub={t('emptySub')} />,
              }}
            />
          </Card>
        )}

        {/* ── Adjustment modal ──────────────────────────────── */}
        <Modal
          open={adjustRow != null}
          onCancel={() => setAdjustRow(null)}
          onOk={submitAdjust}
          confirmLoading={adjusting}
          destroyOnHidden
          okText={t('save')}
          cancelText={t('cancel')}
          title={t('adjustTitle')}
        >
          {adjustRow && (
            <div className="flex flex-col gap-4">
              <p className="m-0 text-[13px] text-muted">
                {t('adjustContext', {
                  member: memberName(adjustRow.teamMemberId),
                  type: typeLabel(adjustType, locale),
                  year: adjustRow.year,
                })}
              </p>
              <div className="rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">
                {t('currentAvailable')}:{' '}
                <span style={availableStyle(adjustRow.available)}>{adjustRow.available}</span>
              </div>
              <div>
                <label
                  htmlFor="leave-adjust-qty"
                  className="mb-1 inline-flex items-center gap-1 text-[13px] font-semibold text-heading"
                >
                  {t('qtyLabel')}
                  <InfoTooltip
                    text={t('infoTip.adjustment.title')}
                    body={t('infoTip.adjustment.body')}
                  />
                </label>
                <p className="mt-0 mb-1.5 text-[12px] text-subtle">{t('qtyHint')}</p>
                <InputNumber
                  id="leave-adjust-qty"
                  className="w-full"
                  style={{ width: '100%' }}
                  size="large"
                  controls={false}
                  min={-999}
                  max={999}
                  step={0.5}
                  value={adjustQty}
                  onChange={(v) => setAdjustQty(v)}
                  placeholder={t('qtyPlaceholder')}
                />
              </div>
              <div>
                <label
                  htmlFor="leave-adjust-reason"
                  className="mb-1 block text-[13px] font-semibold text-heading"
                >
                  {t('reasonLabel')}
                </label>
                <Input.TextArea
                  id="leave-adjust-reason"
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder={t('reasonPlaceholder')}
                  maxLength={500}
                />
              </div>
            </div>
          )}
        </Modal>
      </div>
    </FeatureGate>
  );
}
