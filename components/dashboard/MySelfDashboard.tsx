'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, Col, Progress, Row, Skeleton, Tag } from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FieldTimeOutlined,
  SafetyOutlined,
  TeamOutlined,
  ToolOutlined,
  CalculatorOutlined,
  HomeOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { meApi, type MyDashboardResponse } from '@/lib/api/modules/me.api';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { useMyPermissions } from '@/hooks/useMyPermissions';
import { formatCurrencyFull } from '@/lib/utils';
import { NAV_PERMISSIONS } from '@/lib/constants/nav-permissions';

/**
 * Wave B Permission-Gated UI (2026-05-15) - self-scoped dashboard.
 *
 * Renders for restricted invitees (non-owner, no `team.view`) instead of
 * the workspace-aggregate tiles in `app/dashboard/page.tsx`. Shows the
 * caller's own monthly attendance + current-month salary + a shortcuts
 * grid of every module the caller has access to.
 *
 * Data: single `GET /workspaces/:wsId/me/dashboard` (lean BE bundle).
 * Module list derived FE-side from `useMyPermissions()` - no extra BE
 * trip needed.
 */
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

interface ModuleShortcut {
  key: string;
  href: string;
  module: string;
  action: string;
  labelKey: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

const MODULE_SHORTCUTS: ModuleShortcut[] = [
  {
    key: 'team',
    href: '/dashboard/team',
    module: 'team',
    action: 'view',
    labelKey: 'navigation.team',
    icon: <TeamOutlined />,
    iconBg: 'var(--cr-primary-light)',
    iconColor: 'var(--cr-primary)',
  },
  {
    key: 'attendance',
    href: '/dashboard/attendance',
    module: 'attendance',
    action: 'view',
    labelKey: 'navigation.attendance',
    icon: <CheckCircleOutlined />,
    iconBg: 'var(--cr-success-50)',
    iconColor: 'var(--cr-success-500)',
  },
  {
    key: 'salary',
    href: '/dashboard/salary',
    module: 'salary',
    action: 'view',
    labelKey: 'navigation.payroll',
    icon: <RupeeOutlined />,
    iconBg: 'var(--cr-gold-100)',
    iconColor: 'var(--cr-gold-500)',
  },
  {
    key: 'shifts',
    href: '/dashboard/shifts',
    module: 'shifts',
    action: 'view',
    labelKey: 'navigation.shifts',
    icon: <ClockCircleOutlined />,
    iconBg: 'var(--cr-warning-50)',
    iconColor: 'var(--cr-warning-500)',
  },
  {
    key: 'holidays',
    href: '/dashboard/holidays',
    module: 'holidays',
    action: 'view',
    labelKey: 'navigation.holidays',
    icon: <CalendarOutlined />,
    iconBg: 'var(--cr-info-50)',
    iconColor: 'var(--cr-info-500)',
  },
  {
    key: 'finance',
    href: '/dashboard/finance',
    module: 'finance',
    action: 'view',
    labelKey: 'navigation.finance',
    icon: <CalculatorOutlined />,
    iconBg: 'var(--cr-gold-100)',
    iconColor: 'var(--cr-gold-700)',
  },
  {
    key: 'machines',
    href: '/dashboard/machines',
    module: 'machines',
    action: 'view',
    labelKey: 'navigation.machines',
    icon: <ToolOutlined />,
    iconBg: 'var(--cr-indigo-50)',
    iconColor: 'var(--cr-indigo-400)',
  },
  {
    key: 'roles',
    href: '/dashboard/roles',
    module: 'roles',
    action: 'view',
    labelKey: 'rbac.roles',
    icon: <SafetyOutlined />,
    iconBg: 'var(--cr-info-50)',
    iconColor: 'var(--cr-info-700)',
  },
  {
    key: 'workspace',
    href: '/dashboard/workspace',
    module: 'workspaces',
    action: 'view',
    labelKey: 'admin.workspaces',
    icon: <HomeOutlined />,
    iconBg: 'var(--cr-neutral-100)',
    iconColor: 'var(--cr-text-3)',
  },
];

export default function MySelfDashboard() {
  const t = useTranslations();
  const { user } = useAuthStore();
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();
  const { can, canPath, data: permissionsData } = useMyPermissions();
  const [data, setData] = useState<MyDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setLoading(true);
    try {
      const res = await meApi.dashboard(currentWorkspaceId);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const greeting =
    dayjs().hour() < 12
      ? t('dashboard.goodMorning')
      : dayjs().hour() < 17
        ? t('dashboard.goodAfternoon')
        : t('dashboard.goodEvening');

  const memberName = data?.member?.name ?? user?.name ?? '';
  const designation = data?.member?.designation ?? null;

  // Module shortcuts the caller actually has access to. Owner short-
  // circuits via `useMyPermissions().can` so this surface is meaningless
  // for them - the parent only renders MySelfDashboard for non-owners
  // anyway. The fall-back to NAV_PERMISSIONS keeps the action key
  // aligned with the sidebar filter so we never show a shortcut that
  // the deep-link guard would immediately bounce.
  const visibleShortcuts = MODULE_SHORTCUTS.filter((m) => {
    const required = NAV_PERMISSIONS[m.href] ?? { module: m.module, action: m.action };
    // Phase 1d - branch on the path-form vs flat-form RequiredPerm shape.
    if ('path' in required && required.path !== undefined) {
      return canPath(required.path, required.scope);
    }
    return can(required.module, required.action, required.scope);
  });

  const att = data?.attendanceMonthly;
  const sal = data?.salaryCurrentMonth;
  const totalDays = att?.totalDays ?? 0;
  const presentPct = totalDays > 0 ? Math.round(((att?.present ?? 0) / totalDays) * 100) : 0;
  const monthLabel = att
    ? `${MONTH_NAMES[att.month - 1] ?? ''} ${att.year}`
    : `${MONTH_NAMES[dayjs().month()] ?? ''} ${dayjs().year()}`;

  const roleLabel = permissionsData?.role?.name ?? null;

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
      {/* Greeting header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[22px] font-extrabold text-heading">
            {greeting},{' '}
            <span style={{ color: 'var(--cr-primary)' }}>{memberName.split(' ')[0] || ''}</span>
          </h1>
          <p className="mt-1 mb-0 text-[13px] text-muted">
            {currentWorkspace?.name ?? ''}
            {designation ? ` · ${designation}` : ''}
            {roleLabel ? ` · ${roleLabel}` : ''}
          </p>
          <p className="mt-0.5 mb-0 text-[12px] text-faint">
            {dayjs().format('dddd, MMMM D YYYY')}
          </p>
        </div>
      </div>

      <Row gutter={[20, 20]}>
        {/* My monthly attendance */}
        <Col xs={24} md={12}>
          <Card
            title={
              <span className="font-display font-bold">{t('dashboard.myAttendanceTitle')}</span>
            }
            extra={<span className="text-[12px] text-muted">{monthLabel}</span>}
            loading={loading}
            style={{
              borderRadius: 16,
              border: '1px solid var(--cr-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { padding: 24 } }}
          >
            {!loading && att && (
              <div>
                <div className="mb-5 flex justify-center">
                  <Progress
                    type="dashboard"
                    percent={presentPct}
                    strokeColor="var(--cr-success-500)"
                    railColor="var(--cr-border)"
                    size={140}
                    strokeWidth={12}
                    aria-label={`Your attendance rate this month: ${presentPct}%`}
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
                <div className="grid grid-cols-2 gap-3">
                  <SelfStat
                    icon={<CheckCircleOutlined />}
                    color="var(--cr-success-700)"
                    label={t('attendance.present')}
                    value={att.present}
                  />
                  <SelfStat
                    icon={<CloseCircleOutlined />}
                    color="var(--cr-danger-700)"
                    label={t('attendance.absent')}
                    value={att.absent}
                  />
                  <SelfStat
                    icon={<FieldTimeOutlined />}
                    color="var(--cr-warning-700)"
                    label={t('attendance.halfDay')}
                    value={att.halfDay}
                  />
                  <SelfStat
                    icon={<CalendarOutlined />}
                    color="var(--cr-info-700)"
                    label={t('attendance.leave')}
                    value={att.onLeave}
                  />
                </div>
                {totalDays === 0 && (
                  <p className="mt-4 mb-0 text-center text-[12px] text-faint">
                    {t('dashboard.myAttendanceEmpty')}
                  </p>
                )}
              </div>
            )}
            {!loading && !att && <Skeleton.Node active style={{ width: '100%', height: 200 }} />}
          </Card>
        </Col>

        {/* My salary current month */}
        <Col xs={24} md={12}>
          <Card
            title={<span className="font-display font-bold">{t('dashboard.mySalaryTitle')}</span>}
            extra={<span className="text-[12px] text-muted">{monthLabel}</span>}
            loading={loading}
            style={{
              borderRadius: 16,
              border: '1px solid var(--cr-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { padding: 24 } }}
          >
            {!loading && sal && (
              <div className="flex flex-col gap-4">
                <div className="border-b border-gray-100 pb-3">
                  <p className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
                    {t('payroll.netPay')}
                  </p>
                  <p className="m-0 text-3xl font-bold text-gray-900 tabular-nums">
                    {formatCurrencyFull(sal.netSalary)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <SalaryStatusTag status={sal.paymentStatus} t={t} />
                    <span className="text-[12px] text-muted">
                      {t('dashboard.mySalaryAttendanceDays', {
                        present: sal.presentDays,
                        total: sal.totalDays,
                      })}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <SelfStat
                    label={t('payroll.baseSalary')}
                    value={formatCurrencyFull(sal.baseSalary)}
                    color="var(--cr-text-2)"
                  />
                  <SelfStat
                    label={t('payroll.deductions')}
                    value={formatCurrencyFull(sal.deductions)}
                    color="var(--cr-danger-700)"
                  />
                  <SelfStat
                    label={t('payroll.bonus')}
                    value={formatCurrencyFull(sal.additions)}
                    color="var(--cr-success-700)"
                  />
                  <SelfStat
                    label={t('payroll.paid')}
                    value={formatCurrencyFull(sal.paidAmount)}
                    color="var(--cr-info-700)"
                  />
                </div>
              </div>
            )}
            {!loading && !sal && (
              <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-center">
                <RupeeOutlined style={{ fontSize: 36, color: 'var(--cr-text-5)' }} />
                <p className="m-0 text-[13px] font-medium text-subtle">
                  {t('dashboard.mySalaryEmptyTitle')}
                </p>
                <p className="m-0 text-[12px] text-faint">{t('dashboard.mySalaryEmptyBody')}</p>
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Module shortcuts the caller has access to */}
      {visibleShortcuts.length > 0 && (
        <Card
          title={
            <span className="font-display font-bold">{t('dashboard.myAccessibleModules')}</span>
          }
          style={{
            borderRadius: 16,
            border: '1px solid var(--cr-border)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
          styles={{ body: { padding: 16 } }}
        >
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
            {visibleShortcuts.map((m) => (
              <Link
                key={m.key}
                href={m.href}
                className="flex items-center gap-3 rounded-xl border border-border-light bg-surface px-3 py-3 no-underline transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[16px]"
                  style={{ background: m.iconBg, color: m.iconColor }}
                >
                  {m.icon}
                </div>
                <span className="flex-1 text-[13px] font-semibold text-gray-700">
                  {t(m.labelKey)}
                </span>
                <ArrowRightOutlined className="text-xs text-faint" />
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

function SelfStat({
  icon,
  color,
  label,
  value,
}: {
  icon?: React.ReactNode;
  color?: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl border border-border-light bg-surface px-3 py-2">
      <div className="flex items-center gap-2">
        {icon && (
          <span style={{ color }} className="text-[14px]">
            {icon}
          </span>
        )}
        <span className="text-[11px] font-semibold tracking-wide text-faint uppercase">
          {label}
        </span>
      </div>
      <p
        className="m-0 mt-1 text-[18px] font-bold tabular-nums"
        style={{ color: color ?? 'var(--cr-text-1)' }}
      >
        {value}
      </p>
    </div>
  );
}

function SalaryStatusTag({ status, t }: { status: string; t: ReturnType<typeof useTranslations> }) {
  // next-intl `t` types against literal keys; widen to string lookup
  // because status comes from BE as an enum-but-typed-as-string field.
  const tStr = t as unknown as (k: string) => string;
  const labelMap: Record<string, string> = {
    paid: tStr('payroll.paid'),
    partial: tStr('dashboard.mySalaryStatusPartial'),
    pending: tStr('dashboard.mySalaryStatusPending'),
    advance: tStr('dashboard.mySalaryStatusAdvance'),
  };
  const colorMap: Record<string, string> = {
    paid: 'success',
    partial: 'warning',
    pending: 'default',
    advance: 'processing',
  };
  return (
    <Tag color={colorMap[status] ?? 'default'} className="!m-0">
      {labelMap[status] ?? status}
    </Tag>
  );
}
