'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { App, Table, Tag, Button, Switch, Space, Select, Skeleton } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslations } from 'next-intl';
import { anomaliesApi } from '@/lib/api';
import { useWorkspaceStore } from '@/lib/store';
import { DsCard, DsEmptyState, DsPageHeader } from '@/components/ui';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import type { Anomaly, AnomalyRule, AnomalyRuleType } from '@/types';

dayjs.extend(relativeTime);

const SEVERITY_COLORS: Record<string, string> = {
  low: 'blue',
  med: 'orange',
  high: 'red',
};

const SEVERITY_WEIGHT: Record<string, number> = { high: 3, med: 2, medium: 2, low: 1 };

/** Convert a camelCase / snake_case key to a Title Cased fallback label. */
function titleCase(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Format a value that may be an ISO date/datetime string, array, or primitive. */
function formatCtxValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((v) => formatCtxValue(v)).join(' · ');
  }
  if (typeof value === 'string') {
    // ISO datetime - has a T time component.
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      const d = dayjs(value);
      // If time part is 00:00 treat as date-only
      return d.hour() === 0 && d.minute() === 0 && d.second() === 0
        ? d.format('DD MMM')
        : d.format('DD MMM, HH:mm');
    }
    // Plain ISO date (no time component).
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return dayjs(value).format('DD MMM');
    }
  }
  return String(value);
}

function ContextChips({
  ctx,
  getLabel,
}: {
  ctx: Record<string, unknown> | null | undefined;
  getLabel: (key: string) => string;
}) {
  // Defensive: API context is external data - guard null/empty so the cell
  // never throws on Object.entries and renders a clean placeholder instead.
  if (!ctx || Object.keys(ctx).length === 0) {
    return <span className="text-faint">-</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {Object.entries(ctx).map(([key, value]) => (
        // Inline style - antd v6 Tag ignores Tailwind utility classNames
        // (unlayered CSS-in-JS beats layered utilities).
        <Tag key={key} style={{ margin: 0, fontSize: 12, fontFamily: 'monospace' }}>
          {getLabel(key)}: {formatCtxValue(value)}
        </Tag>
      ))}
    </span>
  );
}

function SeverityTag({ severity }: { severity: string }) {
  const s = severity.toLowerCase();
  const icon =
    s === 'high' ? (
      <WarningOutlined />
    ) : s === 'med' || s === 'medium' ? (
      <ExclamationCircleOutlined />
    ) : (
      <CheckCircleOutlined />
    );
  return (
    <Tag icon={icon} color={SEVERITY_COLORS[s] ?? 'default'}>
      {severity.toUpperCase()}
    </Tag>
  );
}

const RULE_TYPE_COLORS: Record<AnomalyRuleType, string> = {
  unknown_sn: 'volcano',
  rapid_dup: 'orange',
  missed_streak: 'gold',
  off_shift_punch: 'purple',
  time_travel: 'cyan',
  binding_conflict: 'magenta',
  locked_payroll_push: 'red',
};

function AnomaliesPageInner() {
  const t = useTranslations('attendance.anomalies');
  const { message } = App.useApp();
  const { currentWorkspaceId } = useWorkspaceStore();

  const RULE_LABELS: Record<AnomalyRuleType, string> = {
    unknown_sn: t('rule.unknownDevice'),
    rapid_dup: t('rule.rapidDup'),
    missed_streak: t('rule.missedStreak'),
    off_shift_punch: t('rule.offShiftPunch'),
    time_travel: t('rule.timeTravel'),
    binding_conflict: t('rule.bindingConflict'),
    locked_payroll_push: t('rule.lockedPayrollPush'),
  };

  /** Map raw context keys to human-readable labels via i18n; fall back to title-case. */
  const getCtxLabel = (key: string): string => {
    const knownKeys = [
      'streakLength',
      'missingDays',
      'deltaMinutes',
      'eventCount',
      'windowSeconds',
      'shiftStart',
      'shiftEnd',
      'eventTimestamp',
      'serverTime',
      'serial',
      'deviceSerial',
    ] as const;
    type KnownKey = (typeof knownKeys)[number];
    if ((knownKeys as readonly string[]).includes(key)) {
      return t(`ctxLabel.${key as KnownKey}`);
    }
    return titleCase(key);
  };

  const [items, setItems] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [unackOnly, setUnackOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rules, setRules] = useState<AnomalyRule[]>([]);
  const [typeFilter, setTypeFilter] = useState<AnomalyRuleType[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkAcking, setBulkAcking] = useState(false);

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const res = await anomaliesApi.list(currentWorkspaceId, {
        unacknowledgedOnly: unackOnly,
        page,
        limit: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (e: unknown) {
      message.error((e instanceof Error ? e.message : null) ?? t('toast.failLoad'));
    } finally {
      setLoading(false);
    }
    // t (next-intl) and message (antd App) are stable refs - listed to satisfy
    // exhaustive-deps without changing fetch cadence.
  }, [currentWorkspaceId, unackOnly, page, t, message]);

  // Inline-async-IIFE with cancel flag - cancellable on dependency change.
  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await anomaliesApi.list(currentWorkspaceId, {
          unacknowledgedOnly: unackOnly,
          page,
          limit: 50,
        });
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      } catch (e: unknown) {
        if (!cancelled)
          message.error((e instanceof Error ? e.message : null) ?? t('toast.failLoad'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // t (next-intl) and message (antd App) are stable refs - listed to satisfy
    // exhaustive-deps without changing fetch cadence.
  }, [currentWorkspaceId, unackOnly, page, t, message]);

  useEffect(() => {
    if (!currentWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await anomaliesApi.listRules(currentWorkspaceId);
        if (!cancelled) setRules(next);
      } catch (e: unknown) {
        if (!cancelled)
          message.error((e instanceof Error ? e.message : null) ?? t('toast.failLoadRules'));
      }
    })();
    return () => {
      cancelled = true;
    };
    // t / message are stable refs - listed to satisfy exhaustive-deps.
  }, [currentWorkspaceId, t, message]);

  // Reset to page 1 whenever filters change - wrap setState in a microtask
  // to defer the state update out of the synchronous effect body (avoids the
  // setState-in-effect rule cascading-render warning).
  useEffect(() => {
    queueMicrotask(() => setPage(1));
  }, [unackOnly, typeFilter]);

  const acknowledge = async (id: string) => {
    if (!currentWorkspaceId) return;
    // Capture previous state atomically via functional updater to avoid stale closure
    let prevSnapshot: Anomaly[] = [];
    setItems((current) => {
      prevSnapshot = current;
      return current.filter((x) => x._id !== id);
    });
    try {
      await anomaliesApi.acknowledge(currentWorkspaceId, id);
    } catch (e: unknown) {
      setItems(prevSnapshot);
      message.error((e instanceof Error ? e.message : null) ?? t('toast.ackFailed'));
    }
  };

  const visibleRows =
    typeFilter.length === 0 ? items : items.filter((r) => typeFilter.includes(r.ruleType));

  // When a type filter is active the server total is for the unfiltered page -
  // drive pagination off the filtered client-side count instead so the control
  // is not misleading.
  const paginationTotal = typeFilter.length > 0 ? visibleRows.length : total;

  async function handleBulkAcknowledge() {
    if (selectedRowKeys.length === 0) return;
    setBulkAcking(true);
    try {
      await Promise.all(
        selectedRowKeys.map((id) => anomaliesApi.acknowledge(currentWorkspaceId!, String(id))),
      );
      setSelectedRowKeys([]);
    } catch {
      message.error(t('toast.failBulkAck'));
    } finally {
      // Always reconcile the list regardless of partial failure
      setBulkAcking(false);
      await load();
    }
  }

  const toggleRule = async (ruleType: AnomalyRuleType, enabled: boolean) => {
    if (!currentWorkspaceId) return;
    try {
      const updated = await anomaliesApi.toggleRule(currentWorkspaceId, ruleType, enabled);
      setRules(rules.map((r) => (r.ruleType === ruleType ? updated : r)));
    } catch (e: unknown) {
      message.error((e instanceof Error ? e.message : null) ?? t('toast.toggleFailed'));
    }
  };

  return (
    <FeatureGate module="attendance" subFeature="anomaly_detection" as="h1">
      {/* Section gaps use inline marginTop on each card - Tailwind `space-y`
          is inert against antd v6 cards (unlayered CSS-in-JS beats layered
          utilities), so explicit per-card style is the reliable path. */}
      <div className="mx-auto max-w-7xl p-6">
        <DsPageHeader
          title={t('pageTitle')}
          icon={<WarningOutlined />}
          right={<InfoTooltip text={t('headerExplainer')} body={t('headerExplainerBody')} />}
        />
        {/* ── Feed card ─────────────────────────────────────────── */}
        <DsCard
          style={{ marginTop: 24 }}
          title={t('feedTitle')}
          extra={
            <Space size="small">
              <Switch
                checked={unackOnly}
                onChange={setUnackOnly}
                checkedChildren={t('unackedOnly')}
                unCheckedChildren={t('all')}
                size="small"
                aria-label={t('showUnackedAria')}
              />
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading} size="small">
                {t('refresh')}
              </Button>
            </Space>
          }
          styles={{ body: { padding: 0 } }}
        >
          <Space
            wrap
            style={{
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              width: '100%',
              padding: '12px 16px 0',
            }}
          >
            <Select
              mode="multiple"
              allowClear
              placeholder={t('filterPlaceholder')}
              aria-label={t('filterPlaceholder')}
              style={{ minWidth: 280 }}
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as AnomalyRuleType[])}
              options={Object.keys(RULE_LABELS).map((k) => ({
                value: k,
                label: RULE_LABELS[k as AnomalyRuleType],
              }))}
            />
            {selectedRowKeys.length > 0 ? (
              <Button type="primary" loading={bulkAcking} onClick={handleBulkAcknowledge}>
                {t('acknowledgeSelected', { count: selectedRowKeys.length })}
              </Button>
            ) : null}
          </Space>
          <Table
            rowKey="_id"
            loading={loading}
            dataSource={visibleRows}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              // axe-core a11y: per-row checkboxes need an accessible name; the
              // header checkbox needs a label other than the empty cell title.
              getCheckboxProps: (record) =>
                ({
                  'aria-label': t('selectAnomalyAria', {
                    rule: RULE_LABELS[record.ruleType] ?? record.ruleType,
                  }),
                }) as never,
              columnTitle: <span className="sr-only">{t('selectAllAria')}</span>,
            }}
            pagination={{
              current: page,
              total: paginationTotal,
              pageSize: 50,
              onChange: setPage,
              style: { padding: '12px 16px', margin: 0 },
            }}
            scroll={{ x: 800 }}
            columns={[
              {
                title: t('col.rule'),
                dataIndex: 'ruleType',
                width: 180,
                render: (rt: AnomalyRuleType) => (
                  <Tag color={RULE_TYPE_COLORS[rt] ?? 'default'}>{RULE_LABELS[rt] ?? rt}</Tag>
                ),
              },
              {
                title: t('col.severity'),
                dataIndex: 'severity',
                width: 120,
                sorter: (a, b) => SEVERITY_WEIGHT[a.severity] - SEVERITY_WEIGHT[b.severity],
                defaultSortOrder: 'descend' as const,
                render: (s: string) => <SeverityTag severity={s} />,
              },
              {
                title: t('col.context'),
                dataIndex: 'context',
                render: (c: Record<string, unknown>) => (
                  <ContextChips ctx={c} getLabel={getCtxLabel} />
                ),
              },
              {
                title: t('col.triggered'),
                dataIndex: 'createdAt',
                width: 140,
                render: (ts: string) => (
                  <span className="text-[13px] text-[var(--cr-text-2,var(--cr-text-5))]">
                    {dayjs(ts).fromNow()}
                  </span>
                ),
              },
              {
                title: <span className="sr-only">{t('actionsColAria')}</span>,
                key: 'act',
                width: 140,
                render: (_: unknown, row: Anomaly) =>
                  row.acknowledged ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] text-[var(--cr-text-2,var(--cr-text-5))]">
                      <CheckCircleOutlined className="text-emerald-700" />
                      {t('acknowledged')}
                    </span>
                  ) : (
                    <Button size="small" onClick={() => acknowledge(row._id)}>
                      {t('acknowledge')}
                    </Button>
                  ),
              },
            ]}
          />
        </DsCard>

        {/* ── Detection Rules card ───────────────────────────────── */}
        <DsCard title={t('rulesTitle')} style={{ marginTop: 24 }} styles={{ body: { padding: 0 } }}>
          <Table
            rowKey="ruleType"
            dataSource={rules}
            pagination={false}
            scroll={{ x: 400 }}
            columns={[
              {
                title: t('col.rule'),
                dataIndex: 'ruleType',
                render: (rt: AnomalyRuleType) => (
                  <span className="text-[13px] font-medium text-heading">
                    {RULE_LABELS[rt] ?? rt}
                  </span>
                ),
              },
              {
                title: t('col.enabled'),
                dataIndex: 'enabled',
                width: 100,
                render: (en: boolean, row: AnomalyRule) => (
                  <Switch
                    checked={en}
                    onChange={(v) => toggleRule(row.ruleType, v)}
                    aria-label={t('toggleRuleAria', {
                      action: en ? t('toggleDisable') : t('toggleEnable'),
                      rule: RULE_LABELS[row.ruleType] ?? row.ruleType,
                    })}
                  />
                ),
              },
            ]}
          />
        </DsCard>
      </div>
    </FeatureGate>
  );
}

/**
 * RBAC guard - anomaly detection is a manager-only queue (MANAGE_ANOMALIES).
 * While permissions are loading, render a skeleton so an unauthorized user
 * never sees the management page even for a frame. Once resolved, anyone who
 * is NOT the owner AND lacks `attendance.MANAGE_ANOMALIES` gets the
 * access-denied surface; everyone else renders the full page.
 */
export default function AnomaliesPage() {
  const t = useTranslations('attendance.anomalies');
  const { canPath, data, loading } = useMyPermissions();

  if (loading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton active paragraph={{ rows: 1 }} />
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  if (!data.isOwner && !canPath('attendance.anomaly.manage')) {
    return (
      <div className="space-y-5">
        <DsPageHeader title={t('pageTitle')} icon={<LockOutlined />} />
        <DsEmptyState icon="🔒" title={t('accessDenied.title')} sub={t('accessDenied.message')} />
      </div>
    );
  }

  return <AnomaliesPageInner />;
}
