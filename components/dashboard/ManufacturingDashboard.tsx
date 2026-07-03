'use client';
/**
 * DORMANT — legacy manufacturing / org-aggregate dashboard.
 *
 * This was the old `app/(app)/dashboard/page.tsx` landing body. For ManekHR the
 * post-login home is the HR Overview (`components/dashboard/HrOverview.tsx`); this
 * view is kept intact (NOT deleted) but is no longer routed as the default. Its
 * machine/maintenance/production widgets are module-gated by `canSee(...)`, so
 * they render nothing when those (excluded) modules are off — but the aggregate
 * framing belongs to the excluded manufacturing surface, so it stays dormant.
 *
 * It carries the FULL up-to-date ERP aggregate body (the 2026-06 dashboard-
 * enrichment widgets: attendance/payroll trends, money movement, workforce +
 * people radar, upcoming leave, who's-in-now, accounting strip) so no ERP change
 * is lost when the route swaps to HrOverview as the default landing.
 *
 * Restore path: render <ManufacturingDashboard /> from a route to bring it back.
 * Cross-module: getDashboardStats / listTeam / listAttendance / salary overview;
 * machines + finance widgets self-gate on their own entitlements.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Card, Row, Col, Skeleton, Progress, Button, Empty } from 'antd';
import {
  TeamOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  UserAddOutlined,
  SafetyOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore, useAuthStore, useSubscriptionStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import MySelfDashboard from '@/components/dashboard/MySelfDashboard';
import NoPlanActivation from '@/components/dashboard/NoPlanActivation';
import { getDashboardStats, listTeam, listAttendance } from '@/lib/actions';
import { salaryApi } from '@/lib/api';
import type {
  DashboardStats,
  TeamMember,
  AttendanceRecord,
  PaginatedResponse,
  PayrollOverviewResponse,
} from '@/types';
import { formatCurrencyFull, todayISO } from '@/lib/utils';
import { DsAvatar, DsTag, STATUS_COLORS } from '@/components/ui';
import { MaintenanceDueWidget } from '@/components/machines/MaintenanceDueWidget';
import { ProductionAtAGlanceWidget } from '@/components/utilisation/ProductionAtAGlanceWidget';
// Dashboard enrichment widgets (2026-06). Each is permission-gated below and
// self-contained; trends/live-ops cards reuse existing endpoints, workforce +
// people-radar read the extended statistics response. See docs/dashboard-enrichment-plan.md
import { AttendanceTrendCard } from '@/components/dashboard/widgets/AttendanceTrendCard';
import { PayrollTrendCard } from '@/components/dashboard/widgets/PayrollTrendCard';
import { MoneyMovementCard } from '@/components/dashboard/widgets/MoneyMovementCard';
import { WorkforceBreakdownCard } from '@/components/dashboard/widgets/WorkforceBreakdownCard';
import { PeopleRadarCard } from '@/components/dashboard/widgets/PeopleRadarCard';
import { UpcomingLeaveCard } from '@/components/dashboard/widgets/UpcomingLeaveCard';
import { WhosInNowCard } from '@/components/dashboard/widgets/WhosInNowCard';
// Compact accounting KPI strip. Self-gates on the finance entitlement + firm
// existence, so it renders nothing (and fires no finance request) for users
// without accounts access. Cross-module: reads finance dashboardKpis.
import { AccountingSummaryStrip } from '@/components/finance/reports/AccountingSummaryStrip';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';

export default function ManufacturingDashboard() {
  const router = useRouter();
  const t = useTranslations();
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { entitlements, isHydrated: subHydrated } = useSubscriptionStore();
  const hasNoPlan = subHydrated && !entitlements;

  // Wave 1 Permission-Gated UI (2026-05-15) - gate stat cards, quick
  // actions, and section cards by the caller's effective permissions.
  // Owner / loading state render-through (avoids flash-of-empty-dashboard
  // on first paint).
  const {
    can: canPermission,
    canPath: canPathPermission,
    data: permissionsData,
    loading: permissionsLoading,
  } = useMyPermissions();
  const canSee = (mod: string, action: string = 'view'): boolean => {
    if (permissionsData?.isOwner) return true;
    // While permissions are still resolving, do NOT render-through as
    // visible. Return false so aggregate cards stay hidden until the BE
    // permission response lands. This closes the race where a restricted
    // member (e.g. attendance-only) sees org-aggregate tiles for the ~200ms
    // window before permissionsData arrives.
    // Note: `isRestrictedMember` below is still false while loading, so the
    // full dashboard skeleton is shown (not MySelfDashboard) - this is the
    // correct UX (loading state, not wrong content).
    if (permissionsLoading || permissionsData == null) return false;
    // Team is path-migrated (Phase 1d): the grant lives on the PATH model
    // (`team.directory.view`), NOT the flat `team.view`, which the override
    // matrix never writes, so a flat `can('team','view','all')` check here is
    // permanently `self` and silently ignores an admin's `directory.view@all`
    // grant. Resolve team via `canPath` to match nav-permissions, the team
    // page, and the BE directory-list scope. Other modules stay flat.
    if (mod === 'team') return canPathPermission('team.directory.view', 'all');
    // Org-aggregate cards (salary, attendance, machines, maintenance) require
    // `scope:'all'`: a self-scoped Worker must NOT see the aggregate tiles.
    return canPermission(mod, action, 'all');
  };

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  // Payroll overview is fetched ONCE here (only when salary is visible) and shared
  // by PayrollTrendCard + MoneyMovementCard so the dashboard never calls the salary
  // overview endpoint twice. Stays null for users without salary scope.
  const [payrollOverview, setPayrollOverview] = useState<PayrollOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const loadedRef = useRef(false);
  const currentWorkspaceRef = useRef(currentWorkspaceId);

  const load = useCallback(
    async (showRefresh = false) => {
      // RBAC Remediation Tier 1 (2026-05-18): do not fire org-wide API calls
      // before permissions have resolved. The useEffect below also waits; this
      // is a belt-and-suspenders guard for callers that invoke load() directly
      // (e.g. the Refresh button - which is only rendered after the aggregate
      // dashboard is already visible, so permissionsData will be non-null by
      // then, but guarded here for safety).
      if (permissionsLoading || permissionsData == null) {
        setLoading(false);
        return;
      }
      if (!currentWorkspaceId || hasNoPlan) {
        setLoading(false);
        return;
      }
      // Restricted members (self-scope only) are routed to MySelfDashboard;
      // they should never reach here, but guard defensively. Team is path-
      // migrated, gate on the PATH model so an admin's `directory.view@all`
      // grant is honored (flat `team.view` is never written by the override
      // matrix and stays `self` forever).
      const isRestricted =
        permissionsData != null &&
        !permissionsData.isOwner &&
        !canPathPermission('team.directory.view', 'all');
      if (isRestricted) {
        setLoading(false);
        return;
      }
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        // Payroll overview is only fetched when salary is visible to this caller —
        // otherwise we pass a resolved null so the salary cards render their empty
        // state and no salary request is fired for non-salary members.
        const now = dayjs();
        // Mirror canSee('salary') via the stable permission primitives (canSee is
        // recreated each render, so referencing it here would churn this memoized
        // callback). Owner sees all; otherwise needs salary view@all.
        const salaryGated =
          permissionsData?.isOwner === true ||
          (!permissionsLoading &&
            permissionsData != null &&
            canPermission('salary', 'view', 'all'));
        const [statsRes, membersRes, attRes, overviewRes] = await Promise.allSettled([
          getDashboardStats(currentWorkspaceId),
          listTeam(currentWorkspaceId, { limit: 10 }),
          listAttendance(currentWorkspaceId, { date: todayISO(), limit: 20 }),
          salaryGated
            ? salaryApi.getOverview(currentWorkspaceId, {
                month: now.month() + 1,
                year: now.year(),
              })
            : Promise.resolve(null),
        ]);
        if (statsRes.status === 'fulfilled') {
          const val = statsRes.value as DashboardStats & { data?: DashboardStats };
          setStats(val?.data ?? val ?? null);
        }
        if (membersRes.status === 'fulfilled') {
          const val = membersRes.value as TeamMember[] | { members?: TeamMember[] };
          setMembers(Array.isArray(val) ? val : (val.members ?? []));
        }
        if (attRes.status === 'fulfilled') {
          const val = attRes.value;
          setAttendance(
            Array.isArray(val)
              ? val
              : ((val as unknown as PaginatedResponse<AttendanceRecord>).data ?? []),
          );
        }
        if (overviewRes.status === 'fulfilled') {
          setPayrollOverview((overviewRes.value as PayrollOverviewResponse | null) ?? null);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    // permissionsData and canPathPermission added so load() re-evaluates once
    // permissions resolve, and so the restricted-member guard uses the
    // current permission state rather than a stale closure.
    [
      currentWorkspaceId,
      hasNoPlan,
      permissionsData,
      permissionsLoading,
      canPathPermission,
      canPermission,
    ],
  );

  useEffect(() => {
    // Workspace changed - reset loaded flag
    if (currentWorkspaceRef.current !== currentWorkspaceId) {
      loadedRef.current = false;
      currentWorkspaceRef.current = currentWorkspaceId;
    }

    // RBAC Remediation Tier 1 (2026-05-18): wait for permissions to resolve
    // before firing org-wide data fetches. permissionsData == null while the
    // /me/permissions request is in-flight; once it settles (owner or member
    // permissions known), load() proceeds. This closes the race where the
    // aggregate API calls fired before the permission check, briefly exposing
    // org-wide data to restricted members.
    if (permissionsLoading || permissionsData == null) return;

    // Only load once per workspace (after permissions have resolved)
    if (currentWorkspaceId && !loadedRef.current) {
      loadedRef.current = true;
      load();
    }
  }, [currentWorkspaceId, load, permissionsData, permissionsLoading]);

  const att = stats?.attendance;
  const sal = stats?.salary;
  const total = att?.total ?? 0;
  // "Present persons for the day" must never exceed the active headcount, and the
  // attendance rate must never exceed 100% — clamp both defensively so a stray
  // count (e.g. rows for members outside the active roster) can't surface a
  // nonsensical "101/50 · 202%". The backend already scopes to active members;
  // this is the display-side guard.
  const presentToday = Math.min(att?.present ?? 0, total);
  const presentPct = total > 0 ? Math.min(100, Math.round((presentToday / total) * 100)) : 0;

  // Build attendance map for quick lookup
  const attMap: Record<string, string> = {};
  if (Array.isArray(attendance)) {
    attendance.forEach((a) => {
      const id = typeof a.teamMemberId === 'string' ? a.teamMemberId : a.teamMemberId._id;
      attMap[id] = a.status;
    });
  }

  if (!currentWorkspaceId) {
    return (
      <div
        className="flex min-h-[400px] flex-col items-center justify-center gap-4"
        style={{ background: 'var(--cr-bg)', padding: 24, margin: -24, minHeight: '100%' }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-blue-50 text-[28px]">
          🏢
        </div>
        <h2 className="m-0 font-display text-xl font-bold text-gray-900">
          {t('dashboard.noWorkspace')}
        </h2>
        <p className="m-0 text-sm text-gray-700">{t('dashboard.selectWorkspaceToContinue')}</p>
      </div>
    );
  }

  const greeting =
    dayjs().hour() < 12
      ? t('dashboard.goodMorning')
      : dayjs().hour() < 17
        ? t('dashboard.goodAfternoon')
        : t('dashboard.goodEvening');

  // Permission-Gated UI: restricted members land on the self-scoped
  // dashboard. The signal is `team.directory.view` at `'all'` scope (PATH
  // model): a Manager / HR (or any member an admin grants `directory.view@all`
  // via the override matrix) gets the org-wide aggregate dashboard; a
  // self-scoped Worker / Member holds at most `directory.view@self` (own
  // profile) and is routed to MySelfDashboard. They can't read workspace-
  // aggregate tiles anyway (BE 403s), and the sidebar filter hides the
  // corresponding nav entries. Owner bypass + loading render-through keep
  // the aggregate flow for owners and admins.
  const isRestrictedMember =
    permissionsData != null &&
    !permissionsData.isOwner &&
    !canPathPermission('team.directory.view', 'all');
  if (isRestrictedMember) {
    return <MySelfDashboard />;
  }

  if (hasNoPlan) {
    return <NoPlanActivation />;
  }

  const cardColors = [
    // Total employees - brand indigo on indigo tint
    {
      iconBg: 'var(--cr-primary-light)',
      iconColor: 'var(--cr-primary)',
      trendColor: 'var(--cr-success-700)',
    },
    // Present today - semantic success (checkmark = present)
    {
      iconBg: 'var(--cr-success-50)',
      iconColor: 'var(--cr-success-500)',
      trendColor: 'var(--cr-success-700)',
    },
    // Payroll this month - money = gold (premium financial accent)
    {
      iconBg: 'var(--cr-gold-100)',
      iconColor: 'var(--cr-gold-500)',
      trendColor: 'var(--cr-gold-700)',
    },
    // Salary remaining - clock / time-info (informational, not pressure)
    {
      iconBg: 'var(--cr-info-50)',
      iconColor: 'var(--cr-info-500)',
      trendColor: 'var(--cr-info-700)',
    },
  ];

  interface TrendData {
    change: number;
    direction: 'up' | 'down' | 'neutral';
    isNew?: boolean;
  }

  const calculateTrend = (current: number, previous: number): TrendData | null => {
    if (previous === 0 && current === 0) {
      return null;
    }
    if (previous === 0 && current > 0) {
      return { change: 100, direction: 'up', isNew: true };
    }
    if (previous === 0 && current < 0) {
      return { change: 100, direction: 'down', isNew: true };
    }
    const change = Math.round(((current - previous) / Math.abs(previous)) * 100);
    if (change === 0) {
      return { change: 0, direction: 'neutral' };
    }
    return {
      change: Math.abs(change),
      direction: change > 0 ? 'up' : 'down',
    };
  };

  const trendValues: (TrendData | null)[] = [
    stats?.teamView?.previousTotalMembers !== undefined
      ? calculateTrend(stats.teamView.totalMembers ?? 0, stats.teamView.previousTotalMembers)
      : null,
    stats?.attendance?.previousPresent !== undefined
      ? calculateTrend(stats.attendance.present ?? 0, stats.attendance.previousPresent)
      : null,
    stats?.salary?.previousTotalPaid !== undefined
      ? calculateTrend(stats.salary.totalPaid, stats.salary.previousTotalPaid)
      : null,
    stats?.salary?.previousTotalRemaining !== undefined
      ? calculateTrend(stats.salary.totalRemaining, stats.salary.previousTotalRemaining)
      : null,
  ];

  return (
    <div
      className="flex flex-col gap-5"
      style={{
        background: 'var(--cr-bg)',
        padding: 24,
        margin: -24,
        minHeight: '100%',
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[22px] font-extrabold text-heading">
            {greeting},{' '}
            <span style={{ color: 'var(--cr-primary)' }}>{user?.name?.split(' ')[0]}</span> 👋
          </h1>
          <p className="mt-0.5 mb-0 text-[12px] italic" style={{ color: 'var(--cr-gold-700)' }}>
            Apka business. Apke control mein.
          </p>
          <p className="mt-1 mb-0 text-[13px] text-muted">
            {currentWorkspace?.name} · {dayjs().format('dddd, MMMM D YYYY')}
          </p>
        </div>
        <Button
          icon={<ReloadOutlined spin={refreshing} />}
          onClick={() => load(true)}
          loading={refreshing}
        >
          {t('common.refresh')}
        </Button>
      </div>

      <Row gutter={[20, 20]}>
        {[
          {
            id: 'total-employees',
            perm: 'team',
            label: t('dashboard.totalEmployees'),
            value: loading ? '-' : (stats?.teamView?.totalMembers ?? 0),
            icon: <TeamOutlined style={{ fontSize: 22 }} />,
            sub: t('dashboard.activeEmployees'),
            action: () => router.push('/dashboard/team'),
            colors: cardColors[0],
            trend: trendValues[0],
          },
          {
            id: 'present-today',
            perm: 'attendance',
            label: t('dashboard.presentToday'),
            value: loading ? '-' : presentToday,
            icon: <CheckCircleOutlined style={{ fontSize: 22 }} />,
            sub: `${presentPct}% attendance rate`,
            action: () => router.push('/dashboard/attendance'),
            colors: cardColors[1],
            trend: trendValues[1],
          },
          {
            id: 'payroll-month',
            perm: 'salary',
            label: t('dashboard.payrollThisMonth'),
            value: loading ? '-' : formatCurrencyFull(sal?.totalPayable ?? 0),
            icon: <RupeeOutlined style={{ fontSize: 22 }} />,
            sub: `${sal?.paidEmployeesCount ?? 0} of ${sal?.employeesCount ?? 0} paid`,
            action: () => router.push('/dashboard/salary'),
            colors: cardColors[2],
            trend: trendValues[2],
          },
          {
            id: 'salary-remaining',
            perm: 'salary',
            label: t('dashboard.salaryRemaining'),
            value: loading ? '-' : formatCurrencyFull(sal?.totalRemaining ?? 0),
            icon: <ClockCircleOutlined style={{ fontSize: 22 }} />,
            sub: `${sal?.monthLabel ?? ''}`,
            action: () => router.push('/dashboard/salary'),
            colors: cardColors[3],
            trend: trendValues[3],
          },
        ]
          .filter((card) => canSee(card.perm))
          .map((card) => (
            <Col xs={12} md={6} key={card.id}>
              <Card
                className="cursor-pointer transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                style={{
                  borderRadius: 16,
                  border: '1px solid var(--cr-border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                styles={{ body: { padding: 20 } }}
                onClick={card.action}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{
                      background: card.colors.iconBg,
                      color: card.colors.iconColor,
                    }}
                  >
                    {card.icon}
                  </div>
                  <ArrowRightOutlined className="text-sm text-faint" />
                </div>
                {loading ? (
                  <Skeleton.Input active size="small" className="mb-1.5" />
                ) : (
                  <>
                    {/* Value is a number (e.g. "42", "₹50,000"), not a section
                      heading - render as a plain div with display styling.
                      The conceptual label below is the actual heading. */}
                    <div className="mb-3 flex items-center gap-3">
                      <div
                        className="m-0 text-2xl font-extrabold text-gray-900 tabular-nums"
                        aria-label={`${card.label}: ${card.value}`}
                      >
                        {card.value}
                      </div>
                      {!loading && stats && card.trend && (
                        <span
                          className={`flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                            card.trend.direction === 'up'
                              ? 'bg-green-50 text-green-700'
                              : card.trend.direction === 'down'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-gray-50 text-gray-700'
                          }`}
                          style={{
                            color:
                              card.trend.direction === 'up'
                                ? 'var(--cr-success-700)'
                                : card.trend.direction === 'down'
                                  ? 'var(--cr-danger-700)'
                                  : 'var(--cr-text-4)',
                          }}
                        >
                          {card.trend.direction === 'up' && (
                            <ArrowUpOutlined style={{ fontSize: 8 }} />
                          )}
                          {card.trend.direction === 'down' && (
                            <ArrowUpOutlined style={{ fontSize: 8, transform: 'rotate(180deg)' }} />
                          )}
                          {card.trend.direction === 'neutral' && '-'}
                          {card.trend.isNew ? 'New' : `${card.trend.change}%`}
                        </span>
                      )}
                    </div>
                    <h2 className="m-0 mb-1 text-[11px] font-semibold tracking-wider text-gray-700 uppercase">
                      {card.label}
                    </h2>
                    <p className="m-0 text-[11px] text-faint">{card.sub}</p>
                  </>
                )}
              </Card>
            </Col>
          ))}
      </Row>

      {/* Accounting strip — self-gated by finance entitlement + firm presence, so
          it renders nothing for non-finance users and never disrupts the team /
          attendance / salary sections below. */}
      {currentWorkspaceId && <AccountingSummaryStrip wsId={currentWorkspaceId} />}

      {/* Trends row — attendance (30-day) + payroll (6-month). Each col is gated;
          the row only renders when at least one is visible. */}
      {(canSee('attendance') || canSee('salary')) && (
        <Row gutter={[20, 20]}>
          {canSee('attendance') && (
            <Col xs={24} lg={12}>
              {currentWorkspaceId && <AttendanceTrendCard wsId={currentWorkspaceId} />}
            </Col>
          )}
          {canSee('salary') && (
            <Col xs={24} lg={12}>
              <PayrollTrendCard data={payrollOverview} loading={loading} />
            </Col>
          )}
        </Row>
      )}

      <Row gutter={[20, 20]}>
        {canSee('attendance') && (
          <Col xs={24} md={12} lg={8}>
            <Card
              title={
                <span className="font-display font-bold">
                  {t('attendance.title')} {t('dashboard.today')}
                </span>
              }
              extra={
                <Button
                  type="link"
                  size="small"
                  onClick={() => router.push('/dashboard/attendance')}
                >
                  {t('common.viewAll')}
                </Button>
              }
              className="h-full"
              loading={loading}
              style={{
                borderRadius: 16,
                border: '1px solid var(--cr-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              styles={{ body: { padding: 24 } }}
            >
              {att && (
                <div key="attendance-content">
                  <div className="mb-5 flex justify-center">
                    <Progress
                      type="dashboard"
                      percent={presentPct}
                      strokeColor="var(--cr-primary)"
                      railColor="var(--cr-border)"
                      size={140}
                      strokeWidth={12}
                      aria-label={`Today's attendance rate: ${presentPct}%`}
                      format={(p) => (
                        <div className="text-center">
                          <p className="m-0 text-[26px] font-extrabold text-gray-900 tabular-nums">
                            {p}%
                          </p>
                          <p className="m-0 text-[10px] tracking-wide text-faint uppercase">
                            {t('attendance.present')}
                          </p>
                        </div>
                      )}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    {(
                      ['present', 'absent', 'half_day', 'on_leave', 'late', 'unmarked'] as const
                    ).map((key) => {
                      const c = STATUS_COLORS[key];
                      // Present is clamped to the active headcount (presentToday)
                      // so the legend agrees with the card; other statuses pass through.
                      const val =
                        key === 'present' ? presentToday : (att[key as keyof typeof att] as number);
                      const label =
                        key === 'present'
                          ? t('attendance.present')
                          : key === 'absent'
                            ? t('attendance.absent')
                            : key === 'half_day'
                              ? t('attendance.halfDay')
                              : key === 'on_leave'
                                ? t('attendance.leave')
                                : key.charAt(0).toUpperCase() + key.slice(1);
                      return (
                        <div key={key} className="flex items-center justify-between py-1.5">
                          <div className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
                            <span className="text-xs font-medium text-gray-600">{label}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-800">{val}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </Col>
        )}

        {canSee('salary') && (
          <Col xs={24} md={12} lg={8}>
            <Card
              title={
                <span className="font-display font-bold">
                  {t('payroll.title')} {t('dashboard.overview')}
                </span>
              }
              extra={
                sal && sal.totalRemaining === 0 ? (
                  <Button type="link" size="small" onClick={() => router.push('/dashboard/salary')}>
                    View History
                  </Button>
                ) : null
              }
              className="h-full"
              loading={loading}
              style={{
                borderRadius: 16,
                border: '1px solid var(--cr-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              styles={{ body: { padding: 24 } }}
            >
              {sal && (
                <div key="salary-content" className="flex flex-col gap-5">
                  <div className="border-b border-gray-100 pb-4">
                    <p className="m-0 mb-2 text-xs font-semibold tracking-wide text-gray-700 uppercase">
                      {t('payroll.totalPayable')} - {sal.monthLabel}
                    </p>
                    <p className="m-0 text-4xl leading-tight font-bold text-gray-900 tabular-nums">
                      {formatCurrencyFull(sal.totalPayable)}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div key="paid-section">
                      <p className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
                        {t('payroll.paid')}
                      </p>
                      <p className="m-0 text-2xl font-bold text-green-700 tabular-nums">
                        {formatCurrencyFull(sal.totalPaid)}
                      </p>
                    </div>
                    <div key="remaining-section">
                      <p className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
                        {t('payroll.remaining')}
                      </p>
                      <p className="m-0 text-2xl font-bold text-gray-700 tabular-nums">
                        {formatCurrencyFull(sal.totalRemaining)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex justify-between">
                      <span className="text-xs text-gray-700">
                        {t('dashboard.paymentProgress')}
                      </span>
                      <span className="text-xs font-semibold text-gray-700">
                        {sal.paidEmployeesCount}/{sal.employeesCount} {t('navigation.team')}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all duration-300"
                        style={{
                          width:
                            sal.employeesCount > 0
                              ? `${Math.round((sal.paidEmployeesCount / sal.employeesCount) * 100)}%`
                              : '0%',
                        }}
                      />
                    </div>
                  </div>
                  {sal.totalRemaining > 0 && (
                    <Button
                      type="primary"
                      onClick={() => router.push('/dashboard/salary')}
                      block
                      size="large"
                      className="!h-12 !rounded-xl !text-sm !font-semibold"
                      style={{ background: 'var(--cr-info-500)' }}
                    >
                      {t('dashboard.generatePayroll')}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </Col>
        )}

        {canSee('maintenance') && (
          <Col xs={24} md={12} lg={8}>
            {currentWorkspaceId && <MaintenanceDueWidget wsId={currentWorkspaceId} />}
          </Col>
        )}

        {canSee('machines') && (
          <Col xs={24} md={12} lg={8}>
            {currentWorkspaceId && <ProductionAtAGlanceWidget wsId={currentWorkspaceId} />}
          </Col>
        )}

        <Col xs={24} lg={8}>
          <Card
            title={<span className="font-display font-bold">{t('dashboard.quickActions')}</span>}
            className="h-full"
            style={{
              borderRadius: 16,
              border: '1px solid var(--cr-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { padding: 16 } }}
          >
            <div key="quick-actions-content" className="flex flex-col gap-1.5">
              {[
                {
                  icon: <CheckCircleOutlined />,
                  labelKey: 'dashboard.markAttendance',
                  sub: t('dashboard.recordTodayAttendance'),
                  path: '/dashboard/team',
                  perm: 'team',
                  iconBg: 'var(--cr-info-50)',
                  iconColor: 'var(--cr-info-500)',
                },
                {
                  icon: <RupeeOutlined />,
                  labelKey: 'dashboard.generatePayroll',
                  sub: t('dashboard.calculateMonthSalary'),
                  path: '/dashboard/salary',
                  perm: 'salary',
                  iconBg: 'var(--cr-indigo-50)',
                  iconColor: 'var(--cr-indigo-400)',
                },
                {
                  icon: <ClockCircleOutlined />,
                  labelKey: 'dashboard.manageShifts',
                  sub: t('dashboard.viewEditShifts'),
                  path: '/dashboard/shifts',
                  perm: 'shifts',
                  iconBg: 'var(--cr-warning-50)',
                  iconColor: 'var(--cr-warning-500)',
                },
                {
                  icon: <SafetyOutlined />,
                  labelKey: 'dashboard.manageRoles',
                  sub: t('dashboard.configurePermissions'),
                  path: '/dashboard/roles',
                  perm: 'roles',
                  iconBg: 'var(--cr-info-50)',
                  iconColor: 'var(--cr-info-700)',
                },
                {
                  icon: <UserAddOutlined />,
                  labelKey: 'dashboard.addTeamMember',
                  sub: t('dashboard.onboardNewEmployee'),
                  path: '/dashboard/team',
                  perm: 'team',
                  iconBg: 'var(--cr-success-50)',
                  iconColor: 'var(--cr-success-500)',
                },
              ]
                .filter((a) => canSee(a.perm))
                .map((a) => (
                  <div
                    key={a.labelKey}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-transparent px-3 py-2.5 transition-all duration-200 hover:border-gray-100 hover:bg-gray-50 hover:shadow-sm"
                    onClick={() => router.push(a.path)}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 hover:scale-105"
                      style={{
                        background: a.iconBg,
                        color: a.iconColor,
                        fontSize: 16,
                      }}
                    >
                      {a.icon}
                    </div>
                    <div className="flex-1">
                      <p className="m-0 text-[13px] font-semibold text-gray-700">{t(a.labelKey)}</p>
                      <p className="m-0 text-[11px] text-faint">{a.sub}</p>
                    </div>
                    <ArrowRightOutlined className="text-xs text-faint" />
                  </div>
                ))}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Workforce row — team make-up + people radar (both team-gated). */}
      {canSee('team') && (
        <Row gutter={[20, 20]}>
          <Col xs={24} lg={12}>
            <WorkforceBreakdownCard workforce={stats?.workforce} loading={loading} />
          </Col>
          <Col xs={24} lg={12}>
            <PeopleRadarCard radar={stats?.peopleRadar} loading={loading} />
          </Col>
        </Row>
      )}

      {/* Live operations row — money movement (salary) + upcoming leave + who's in
          now (attendance). Each col is gated; the row renders if any is visible. */}
      {(canSee('salary') || canSee('attendance')) && (
        <Row gutter={[20, 20]}>
          {canSee('salary') && (
            <Col xs={24} md={12} lg={8}>
              <MoneyMovementCard data={payrollOverview} loading={loading} />
            </Col>
          )}
          {canSee('attendance') && (
            <Col xs={24} md={12} lg={8}>
              {currentWorkspaceId && <UpcomingLeaveCard wsId={currentWorkspaceId} />}
            </Col>
          )}
          {canSee('attendance') && (
            <Col xs={24} md={12} lg={8}>
              {currentWorkspaceId && <WhosInNowCard wsId={currentWorkspaceId} />}
            </Col>
          )}
        </Row>
      )}

      {canSee('team') && (
        <Card
          title={
            <span className="font-display font-bold">
              {t('navigation.team')} {t('dashboard.overview')} - {t('dashboard.today')}
            </span>
          }
          extra={
            <Button type="link" onClick={() => router.push('/dashboard/team')}>
              {t('dashboard.viewAllMembers')}
            </Button>
          }
          loading={loading}
          style={{
            borderRadius: 16,
            border: '1px solid var(--cr-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          styles={{ body: { padding: 20 } }}
        >
          {members.length === 0 && !loading ? (
            <Empty description={t('dashboard.noTeamMembers')} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={() => router.push('/dashboard/team')}>
                {t('dashboard.addFirstMember')}
              </Button>
            </Empty>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
              {members.slice(0, 12).map((m) => {
                const status = attMap[m.id] ?? 'unmarked';
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-2.5 rounded-xl border border-border-light bg-surface px-3 py-2.5"
                  >
                    <DsAvatar name={m.name} size={36} />
                    <div className="flex-1 overflow-hidden">
                      <p className="m-0 overflow-hidden text-[13px] font-semibold text-ellipsis whitespace-nowrap text-heading">
                        {m.name}
                      </p>
                      <p className="m-0 text-[11px] text-subtle">
                        {m.designation ?? t('team.employee')}
                      </p>
                    </div>
                    <DsTag status={status} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
