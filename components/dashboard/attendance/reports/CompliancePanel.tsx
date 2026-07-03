'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  Radio,
  Select,
  Skeleton,
  Slider,
  Switch,
  Table,
  Tag,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { LeftOutlined, ReloadOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useWorkspaceStore } from '@/lib/store';
import { attendanceApi } from '@/lib/api/modules/attendance.api';
import { workspacesApi } from '@/lib/api/modules/workspaces.api';
import { teamApi } from '@/lib/api/modules/team.api';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { FeatureGate } from '@/components/subscription/FeatureGate';
import { DsAvatar, DsEmptyState, InfoTooltip, StatTile } from '@/components/ui';
import type {
  ComplianceMember,
  ComplianceReport,
  DefaulterAlertsConfig,
  PaginatedResponse,
  TeamMember,
} from '@/types';

// Schema-aligned bounds for the threshold (workspace.attendanceSettings
// .complianceThresholdPct enforces these on the BE - keep the FE bounds in
// lockstep so the slider never sends a 422-able value).
const THRESHOLD_MIN = 50;
const THRESHOLD_MAX = 100;
const THRESHOLD_DEFAULT = 90;

// Stable fallback for defaulter-alerts config - defined at module scope so
// the reference is stable across renders (avoids triggering sync useEffect).
const DEFAULT_ALERT_CONFIG: DefaulterAlertsConfig = {
  enabled: false,
  channels: { inApp: true, email: false },
  recipients: { mode: 'managers', specificPeople: [] },
};

type RecipientMode = DefaulterAlertsConfig['recipients']['mode'];

type Band = 'excellent' | 'good' | 'watch' | 'critical' | 'na';

const BAND_ORDER: Band[] = ['excellent', 'good', 'watch', 'critical', 'na'];

// antd Tag colour per compliance band.
const BAND_COLOR: Record<Band, string> = {
  excellent: 'green',
  good: 'cyan',
  watch: 'gold',
  critical: 'red',
  na: 'default',
};

// Bar / dot colour per band (CSS, for the breakdown card).
const BAND_HEX: Record<Band, string> = {
  excellent: 'var(--cr-success-500, #52c41a)',
  good: 'var(--cr-info-500, #13c2c2)',
  watch: 'var(--cr-warning-500, #faad14)',
  critical: 'var(--cr-danger-500, #ff4d4f)',
  na: 'var(--cr-border, #d9d9d9)',
};

function bandOf(rate: number | null): Band {
  if (rate === null) return 'na';
  if (rate >= 95) return 'excellent';
  if (rate >= 90) return 'good';
  if (rate >= 75) return 'watch';
  return 'critical';
}

interface LeaderRow {
  memberId: string;
  name: string;
  designation: string;
  value: number;
}

function Leaderboard({
  title,
  rows,
  emptyText,
  barColor,
  renderValue,
}: {
  title: string;
  rows: LeaderRow[];
  emptyText: string;
  barColor: string;
  renderValue: (v: number) => string;
}) {
  const max = rows.length > 0 ? rows[0].value : 0;
  return (
    <Card styles={{ body: { padding: 16 } }}>
      <p className="m-0 mb-3 text-[14px] font-semibold text-gray-900">{title}</p>
      {rows.length === 0 ? (
        <DsEmptyState title={emptyText} />
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((r, i) => (
            <div key={r.memberId} className="flex items-center gap-3">
              <span className="w-5 shrink-0 text-center text-[12px] font-bold text-gray-400 tabular-nums">
                {i + 1}
              </span>
              <DsAvatar name={r.name} size={30} />
              <div className="min-w-0 flex-1">
                <p className="m-0 truncate text-[13px] font-semibold text-gray-900">{r.name}</p>
                <div
                  className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-gray-100"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${max > 0 ? Math.max((r.value / max) * 100, 6) : 0}%`,
                      background: barColor,
                    }}
                  />
                </div>
              </div>
              <span className="shrink-0 text-[13px] font-semibold text-gray-900 tabular-nums">
                {renderValue(r.value)}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function CompliancePanel() {
  const t = useTranslations('attendance.compliance');
  const { message: msgApi } = App.useApp();
  const { currentWorkspaceId: wsId, currentWorkspace, setCurrentWorkspace } = useWorkspaceStore();
  const { can, data: perms } = useMyPermissions();

  // Threshold is a workspace setting (workspace.attendanceSettings
  // .complianceThresholdPct). Initial state mirrors the workspace value;
  // any change saves through PATCH /workspaces/:id on slider release and
  // optimistically updates the store so other surfaces see the new value
  // without a refetch.
  const persistedThreshold =
    currentWorkspace?.attendanceSettings?.complianceThresholdPct ?? THRESHOLD_DEFAULT;
  const canEditThreshold = !!perms?.isOwner || can('workspaces', 'edit');
  // Defaulter alerts are a workspace setting - same permission as the threshold.
  const canEditAlerts = canEditThreshold;

  const [month, setMonth] = useState(() => dayjs().month() + 1);
  const [year, setYear] = useState(() => dayjs().year());
  const [data, setData] = useState<ComplianceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [threshold, setThreshold] = useState(persistedThreshold);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // ── Defaulter alerts config ───────────────────────────────────────────────
  const [alertConfig, setAlertConfig] = useState<DefaulterAlertsConfig>(
    currentWorkspace?.attendanceSettings?.defaulterAlerts ?? DEFAULT_ALERT_CONFIG,
  );
  const [savingAlerts, setSavingAlerts] = useState(false);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamMembersLoading, setTeamMembersLoading] = useState(false);
  const teamFetchedRef = useRef(false);

  // Keep alertConfig in sync with workspace store changes (e.g. cross-tab).
  useEffect(() => {
    setAlertConfig(currentWorkspace?.attendanceSettings?.defaulterAlerts ?? DEFAULT_ALERT_CONFIG);
  }, [currentWorkspace?.attendanceSettings?.defaulterAlerts]);

  // Load team members when the picker is needed.
  useEffect(() => {
    const needsPicker =
      alertConfig.recipients.mode === 'specificPeople' || alertConfig.recipients.mode === 'both';
    if (!needsPicker || !wsId || teamFetchedRef.current) return;
    teamFetchedRef.current = true;
    setTeamMembersLoading(true);
    teamApi
      .list(wsId)
      .then((res) => {
        const arr: TeamMember[] = Array.isArray(res)
          ? res
          : ((res as PaginatedResponse<TeamMember>).data ?? []);
        setTeamMembers(arr);
      })
      .catch(() => {
        /* non-critical - picker stays empty */
      })
      .finally(() => setTeamMembersLoading(false));
  }, [alertConfig.recipients.mode, wsId]);

  const saveAlerts = useCallback(() => {
    if (!wsId) return;
    if (!canEditAlerts) return;
    setSavingAlerts(true);
    workspacesApi
      .updateDefaulterAlerts(wsId, alertConfig)
      .then((updated) => {
        setCurrentWorkspace(updated);
        msgApi.success(t('defaulterAlerts.saved'));
      })
      .catch(() => {
        msgApi.error(t('defaulterAlerts.saveError'));
      })
      .finally(() => setSavingAlerts(false));
  }, [wsId, canEditAlerts, alertConfig, setCurrentWorkspace, msgApi, t]);

  // Keep local slider in sync when the persisted value changes underneath
  // (e.g. another manager updates the setting in another tab).
  useEffect(() => {
    setThreshold(persistedThreshold);
  }, [persistedThreshold]);

  // Save on slider release. Debounce both as a safety net (rapid commits
  // from keyboard arrow flicks) and to coalesce multiple click-and-drags.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  const persistThreshold = useCallback(
    (next: number) => {
      if (!wsId) return;
      if (!canEditThreshold) return;
      if (next === persistedThreshold) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        setSavingThreshold(true);
        workspacesApi
          .update(wsId, { attendanceSettings: { complianceThresholdPct: next } })
          .then((updated) => {
            setCurrentWorkspace(updated);
            msgApi.success(t('thresholdSaved', { pct: next }));
          })
          .catch(() => {
            setThreshold(persistedThreshold);
            msgApi.error(t('thresholdSaveError'));
          })
          .finally(() => setSavingThreshold(false));
      }, 350);
    },
    [wsId, canEditThreshold, persistedThreshold, setCurrentWorkspace, msgApi, t],
  );

  // Fetch effect - setState only inside promise callbacks (does not trip
  // react-hooks/set-state-in-effect). `fetching` is flipped on by the
  // month-nav handlers and cleared here. The threshold filter is applied
  // client-side from the persisted workspace setting (see persistThreshold).
  useEffect(() => {
    if (!wsId) return;
    attendanceApi
      .complianceReport(wsId, month, year)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => {
        setLoading(false);
        setFetching(false);
      });
  }, [wsId, month, year]);

  const retry = useCallback(() => {
    if (!wsId) return;
    setFetching(true);
    attendanceApi
      .complianceReport(wsId, month, year)
      .then((res) => {
        setData(res);
        setError(false);
      })
      .catch(() => setError(true))
      .finally(() => setFetching(false));
  }, [wsId, month, year]);

  const goPrev = () => {
    setFetching(true);
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goNext = () => {
    setFetching(true);
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const pickMonth = (d: dayjs.Dayjs | null) => {
    if (!d) return;
    setFetching(true);
    setMonth(d.month() + 1);
    setYear(d.year());
  };

  const summary = data?.summary;
  const members = useMemo(() => data?.members ?? [], [data]);

  // Defaulters - rated members below the threshold, worst first.
  const defaulters = useMemo(
    () =>
      members
        .filter((m) => m.attendanceRate !== null && m.attendanceRate < threshold)
        .sort((a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0)),
    [members, threshold],
  );

  const filteredDefaulters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return defaulters;
    return defaulters.filter(
      (m) => m.name.toLowerCase().includes(q) || m.designation.toLowerCase().includes(q),
    );
  }, [defaulters, search]);

  const lateBoard: LeaderRow[] = useMemo(
    () =>
      members
        .filter((m) => m.late > 0)
        .sort((a, b) => b.late - a.late)
        .slice(0, 10)
        .map((m) => ({
          memberId: m.memberId,
          name: m.name,
          designation: m.designation,
          value: m.late,
        })),
    [members],
  );

  const absentBoard: LeaderRow[] = useMemo(
    () =>
      members
        .filter((m) => m.absent > 0)
        .sort((a, b) => b.absent - a.absent)
        .slice(0, 10)
        .map((m) => ({
          memberId: m.memberId,
          name: m.name,
          designation: m.designation,
          value: m.absent,
        })),
    [members],
  );

  const bandCounts = useMemo(() => {
    const counts: Record<Band, number> = {
      excellent: 0,
      good: 0,
      watch: 0,
      critical: 0,
      na: 0,
    };
    for (const m of members) counts[bandOf(m.attendanceRate)] += 1;
    return counts;
  }, [members]);

  const columns: ColumnsType<ComplianceMember> = useMemo(
    () => [
      {
        title: t('defaulters.colMember'),
        key: 'member',
        render: (_: unknown, m) => (
          <div className="flex items-center gap-2.5">
            <DsAvatar name={m.name} size={32} />
            <div className="min-w-0">
              <p className="m-0 truncate text-[13px] font-semibold text-gray-900">{m.name}</p>
              {m.designation && (
                <p className="m-0 truncate text-[12px] text-gray-500">{m.designation}</p>
              )}
            </div>
          </div>
        ),
      },
      {
        title: t('defaulters.colShift'),
        dataIndex: 'shiftName',
        key: 'shift',
        render: (s: string) => s || '-',
      },
      {
        title: t('defaulters.colRate'),
        key: 'rate',
        align: 'right',
        defaultSortOrder: 'ascend',
        sorter: (a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0),
        render: (_: unknown, m) => {
          const band = bandOf(m.attendanceRate);
          return (
            <Tag color={BAND_COLOR[band]} className="m-0 tabular-nums">
              {m.attendanceRate === null ? t('rateNa') : `${m.attendanceRate}%`}
            </Tag>
          );
        },
      },
      {
        title: t('defaulters.colPresent'),
        dataIndex: 'present',
        key: 'present',
        align: 'right',
        render: (v: number) => <span className="tabular-nums">{v}</span>,
      },
      {
        title: t('defaulters.colLate'),
        dataIndex: 'late',
        key: 'late',
        align: 'right',
        sorter: (a, b) => a.late - b.late,
        render: (v: number) => <span className="tabular-nums">{v}</span>,
      },
      {
        title: t('defaulters.colAbsent'),
        dataIndex: 'absent',
        key: 'absent',
        align: 'right',
        sorter: (a, b) => a.absent - b.absent,
        render: (v: number) => (
          <span className="font-semibold tabular-nums" style={{ color: 'var(--cr-danger-700)' }}>
            {v}
          </span>
        ),
      },
    ],
    [t],
  );

  return (
    <FeatureGate module="attendance" subFeature="compliance_report" as="h1">
      <div>
        {/* Toolbar - date navigation controls from DsPageHeader right= */}
        <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
          <Button icon={<LeftOutlined />} onClick={goPrev} aria-label={t('prevMonth')} />
          <DatePicker
            picker="month"
            allowClear={false}
            value={dayjs(new Date(year, month - 1, 1))}
            format="MMMM YYYY"
            onChange={pickMonth}
          />
          <Button icon={<RightOutlined />} onClick={goNext} aria-label={t('nextMonth')} />
        </div>

        {loading ? (
          <Card>
            <Skeleton active paragraph={{ rows: 10 }} />
          </Card>
        ) : error ? (
          <Card>
            <DsEmptyState
              title={t('loadError')}
              action={
                <Button icon={<ReloadOutlined />} onClick={retry}>
                  {t('retry')}
                </Button>
              }
            />
          </Card>
        ) : (
          <>
            {/* Inline marginBottom, not a Tailwind `mb-*` class: antd v6's
              Card root carries a CSS-in-JS `margin:0` reset (injected
              unlayered) that overrides layered Tailwind utilities set on
              the Card itself. Inline style wins the cascade reliably. */}
            <Card style={{ marginBottom: 16 }} styles={{ body: { padding: '16px 24px' } }}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="shrink-0">
                  <div className="flex items-center gap-1.5">
                    <p className="m-0 text-[13px] font-semibold text-gray-900">
                      {t('thresholdLabel')}
                    </p>
                    <InfoTooltip
                      text={t('thresholdInfoTitle')}
                      body={
                        <div className="space-y-2 text-[13px] leading-[1.55] text-gray-700">
                          <p className="m-0">{t('thresholdInfoBody1')}</p>
                          <p className="m-0">{t('thresholdInfoBody2')}</p>
                          <p className="m-0">{t('thresholdInfoBody3')}</p>
                        </div>
                      }
                    />
                    <span
                      className="text-[11px] font-medium"
                      style={{ color: 'var(--cr-text-4)' }}
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {savingThreshold ? t('thresholdSaving') : ''}
                    </span>
                  </div>
                  <p className="m-0 text-[12px] text-gray-500">
                    {canEditThreshold ? t('thresholdHint') : t('thresholdReadOnlyHint')}
                  </p>
                </div>
                <div className="flex min-w-[260px] flex-1 items-center gap-4">
                  <Slider
                    className="flex-1"
                    min={THRESHOLD_MIN}
                    max={THRESHOLD_MAX}
                    value={threshold}
                    disabled={!canEditThreshold}
                    onChange={(v) => setThreshold(v)}
                    onChangeComplete={(v) => persistThreshold(v)}
                    marks={{ 50: '50%', 75: '75%', 90: '90%', 100: '100%' }}
                  />
                  <span className="w-14 shrink-0 text-right text-[18px] font-bold text-gray-900 tabular-nums">
                    {threshold}%
                  </span>
                </div>
              </div>
            </Card>

            {/* ── Defaulter Alerts config card ────────────────────────────────── */}
            <FeatureGate module="attendance" subFeature="defaulter_alerts">
              <Card style={{ marginBottom: 16 }}>
                <div className="mb-1 flex items-center gap-2">
                  <p className="m-0 text-[15px] font-semibold text-gray-900">
                    {t('defaulterAlerts.title')}
                  </p>
                </div>
                <p className="m-0 mb-4 text-[13px] text-gray-500">
                  {t('defaulterAlerts.subtitle')}
                </p>

                {/* Enable toggle */}
                <div className="mb-4 flex items-center gap-3">
                  <Switch
                    aria-label={t('defaulterAlerts.enable')}
                    checked={alertConfig.enabled}
                    disabled={!canEditAlerts}
                    onChange={(checked) =>
                      setAlertConfig((prev) => ({ ...prev, enabled: checked }))
                    }
                  />
                  <span className="text-[13px] text-gray-700">{t('defaulterAlerts.enable')}</span>
                </div>

                {/* Channels */}
                <div className="mb-4">
                  <p className="m-0 mb-2 text-[13px] font-medium text-gray-700">
                    {t('defaulterAlerts.channels')}
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <Checkbox
                      checked={alertConfig.channels.inApp}
                      disabled={!canEditAlerts}
                      onChange={(e) =>
                        setAlertConfig((prev) => ({
                          ...prev,
                          channels: { ...prev.channels, inApp: e.target.checked },
                        }))
                      }
                    >
                      {t('defaulterAlerts.channelInApp')}
                    </Checkbox>
                    <Checkbox
                      checked={alertConfig.channels.email}
                      disabled={!canEditAlerts}
                      onChange={(e) =>
                        setAlertConfig((prev) => ({
                          ...prev,
                          channels: { ...prev.channels, email: e.target.checked },
                        }))
                      }
                    >
                      {t('defaulterAlerts.channelEmail')}
                    </Checkbox>
                  </div>
                </div>

                {/* Recipients mode */}
                <div className="mb-4">
                  <p className="m-0 mb-2 text-[13px] font-medium text-gray-700">
                    {t('defaulterAlerts.recipients')}
                  </p>
                  <Radio.Group
                    value={alertConfig.recipients.mode}
                    disabled={!canEditAlerts}
                    onChange={(e) =>
                      setAlertConfig((prev) => ({
                        ...prev,
                        recipients: { ...prev.recipients, mode: e.target.value as RecipientMode },
                      }))
                    }
                  >
                    <Radio value="managers">{t('defaulterAlerts.recipientManagers')}</Radio>
                    <Radio value="specificPeople">{t('defaulterAlerts.recipientSpecific')}</Radio>
                    <Radio value="both">{t('defaulterAlerts.recipientBoth')}</Radio>
                  </Radio.Group>
                </div>

                {/* Specific-people picker - shown when mode includes specificPeople */}
                {(alertConfig.recipients.mode === 'specificPeople' ||
                  alertConfig.recipients.mode === 'both') && (
                  <div className="mb-4">
                    <Select
                      mode="multiple"
                      allowClear
                      style={{ width: '100%' }}
                      placeholder={t('defaulterAlerts.pickPeople')}
                      disabled={!canEditAlerts}
                      loading={teamMembersLoading}
                      value={alertConfig.recipients.specificPeople}
                      onChange={(value: string[]) =>
                        setAlertConfig((prev) => ({
                          ...prev,
                          recipients: { ...prev.recipients, specificPeople: value },
                        }))
                      }
                      options={teamMembers
                        .filter((m) => !!m.linkedUserId)
                        .map((m) => ({
                          value: m.linkedUserId as string,
                          label: m.name,
                        }))}
                      filterOption={(input, option) =>
                        (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                      }
                    />
                  </div>
                )}

                {/* Read-only hint or Save button */}
                {canEditAlerts ? (
                  <Button type="primary" loading={savingAlerts} onClick={saveAlerts}>
                    {t('defaulterAlerts.save')}
                  </Button>
                ) : (
                  <p className="m-0 text-[12px] text-gray-400">
                    {t('defaulterAlerts.readOnlyHint')}
                  </p>
                )}
              </Card>
            </FeatureGate>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatTile
                label={t('kpi.avgAttendance')}
                value={String(summary?.avgAttendanceRate ?? 0)}
                valueSuffix="%"
              />
              <StatTile
                label={t('kpi.perfect')}
                value={String(summary?.perfectCount ?? 0)}
                hint={t('kpi.perfectHint')}
              />
              <StatTile
                label={t('kpi.belowThreshold')}
                value={String(defaulters.length)}
                tone={defaulters.length > 0 ? 'danger' : 'neutral'}
                hint={t('kpi.belowThresholdHint', { threshold })}
              />
              <StatTile label={t('kpi.lateDays')} value={String(summary?.totalLateDays ?? 0)} />
              <StatTile
                label={t('kpi.absentDays')}
                value={String(summary?.totalAbsentDays ?? 0)}
                tone={(summary?.totalAbsentDays ?? 0) > 0 ? 'danger' : 'neutral'}
              />
            </div>

            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2" styles={{ body: { padding: 12 } }}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="m-0 px-1 text-[14px] font-semibold text-gray-900">
                    {t('defaulters.title')}
                  </p>
                  {defaulters.length > 0 && (
                    <Input
                      allowClear
                      prefix={<SearchOutlined />}
                      placeholder={t('searchPlaceholder')}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="max-w-xs"
                      data-shortcut="attendance-search"
                    />
                  )}
                </div>
                {defaulters.length === 0 ? (
                  <DsEmptyState
                    title={t('defaulters.emptyTitle')}
                    sub={t('defaulters.emptySub', { threshold })}
                  />
                ) : (
                  <Table
                    size="small"
                    rowKey="memberId"
                    loading={fetching}
                    columns={columns}
                    dataSource={filteredDefaulters}
                    scroll={{ x: 'max-content' }}
                    pagination={{ pageSize: 12, hideOnSinglePage: true }}
                    locale={{
                      emptyText: (
                        <DsEmptyState
                          title={t('defaulters.searchEmptyTitle')}
                          sub={t('defaulters.searchEmptySub')}
                        />
                      ),
                    }}
                  />
                )}
              </Card>

              <Card styles={{ body: { padding: 16 } }}>
                <p className="m-0 mb-3 text-[14px] font-semibold text-gray-900">
                  {t('bands.title')}
                </p>
                <div className="flex flex-col gap-2.5">
                  {BAND_ORDER.map((band) => (
                    <div key={band} className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: BAND_HEX[band] }}
                      />
                      <span className="flex-1 text-[13px] text-gray-700">{t(`bands.${band}`)}</span>
                      <span className="text-[14px] font-bold text-gray-900 tabular-nums">
                        {bandCounts[band]}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Leaderboard
                title={t('lateBoard.title')}
                rows={lateBoard}
                emptyText={t('lateBoard.empty')}
                barColor="var(--cr-warning-500, #faad14)"
                renderValue={(v) => t('unitDays', { count: v })}
              />
              <Leaderboard
                title={t('absentBoard.title')}
                rows={absentBoard}
                emptyText={t('absentBoard.empty')}
                barColor="var(--cr-danger-500, #ff4d4f)"
                renderValue={(v) => t('unitDays', { count: v })}
              />
            </div>
          </>
        )}
      </div>
    </FeatureGate>
  );
}
