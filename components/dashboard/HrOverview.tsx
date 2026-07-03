'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Row, Skeleton } from 'antd';
import {
  ArrowRightOutlined,
  IdcardOutlined,
  ReloadOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import dayjs from 'dayjs';
import { getHrOverview } from '@/lib/actions';
import type { HrOverviewResponse } from '@/types';
import { useAuthStore, useWorkspaceStore } from '@/lib/store';
import { formatCurrencyFull } from '@/lib/utils';

/**
 * HR OVERVIEW — the ManekHR admin landing screen (replaces the manufacturing
 * dashboard as the post-login home for Owner / HR). People metrics only:
 * headcount, this-month salary, designation mix. The old aggregate dashboard
 * (machines/maintenance/production widgets) lives dormant in
 * `components/dashboard/ManufacturingDashboard.tsx` and is no longer the default.
 *
 * Cross-module links:
 *   - data         -> getHrOverview() -> statistics/hr-overview (RBAC SALARY view@all)
 *   - quick links  -> /dashboard/team, /dashboard/salary (nav-permissions gated)
 *
 * Watch:
 *   - Salary cards hide automatically when `salary === null` (SALARY module off).
 *   - Restricted (self-scope) workers never reach here — app/dashboard/page.tsx
 *     routes them to MySelfDashboard; this is the admin surface only.
 */
export default function HrOverview() {
  const t = useTranslations();
  const { user } = useAuthStore();
  const { currentWorkspaceId, currentWorkspace } = useWorkspaceStore();

  const [data, setData] = useState<HrOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (showRefresh = false) => {
      if (!currentWorkspaceId) {
        setLoading(false);
        return;
      }
      if (showRefresh) setRefreshing(true);
      else setLoading(true);
      setError(false);
      try {
        const res = await getHrOverview(currentWorkspaceId);
        setData(res);
      } catch {
        setError(true);
        setData(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentWorkspaceId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const greeting =
    dayjs().hour() < 12
      ? t('dashboard.goodMorning')
      : dayjs().hour() < 17
        ? t('dashboard.goodAfternoon')
        : t('dashboard.goodEvening');

  const head = data?.headcount;
  const sal = data?.salary;
  const showSalary = data?.modules?.salaryEnabled !== false && sal != null;

  // Metric cards. Salary cards are appended only when the SALARY module is on
  // AND a salary bundle came back, so the grid never shows misleading zeros.
  const metricCards = [
    {
      id: 'headcount',
      label: t('dashboard.hrOverview.activeHeadcount'),
      value: head?.active ?? 0,
      sub: t('dashboard.hrOverview.activeHeadcountSub'),
      icon: <TeamOutlined style={{ fontSize: 22 }} />,
      iconBg: 'var(--cr-primary-light)',
      iconColor: 'var(--cr-primary)',
      href: '/dashboard/team',
    },
    {
      id: 'added-this-month',
      label: t('dashboard.hrOverview.addedThisMonth'),
      value: head?.addedThisMonth ?? 0,
      sub: t('dashboard.hrOverview.addedThisMonthSub'),
      icon: <UserAddOutlined style={{ fontSize: 22 }} />,
      iconBg: 'var(--cr-success-50)',
      iconColor: 'var(--cr-success-500)',
      href: '/dashboard/team',
    },
    {
      id: 'app-access',
      label: t('dashboard.hrOverview.withAppAccess'),
      value: head?.withAppAccess ?? 0,
      sub: t('dashboard.hrOverview.withAppAccessSub'),
      icon: <IdcardOutlined style={{ fontSize: 22 }} />,
      iconBg: 'var(--cr-info-50)',
      iconColor: 'var(--cr-info-500)',
      href: '/dashboard/team',
    },
    ...(showSalary
      ? [
          {
            id: 'payroll-month',
            label: t('dashboard.hrOverview.payrollThisMonth'),
            value: formatCurrencyFull(sal!.totalPayable),
            sub: `${sal!.paidEmployeesCount} / ${sal!.employeesCount} ${t('dashboard.hrOverview.paidLabel')}`,
            icon: <RupeeOutlined style={{ fontSize: 22 }} />,
            iconBg: 'var(--cr-gold-100)',
            iconColor: 'var(--cr-gold-500)',
            href: '/dashboard/salary',
          },
        ]
      : []),
  ];

  // ── Error state ───────────────────────────────────────────────────────────
  if (error && !loading) {
    return (
      <PageShell>
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-red-50 text-[28px]">
            ⚠️
          </div>
          <h2 className="m-0 font-display text-xl font-bold text-heading">
            {t('dashboard.hrOverview.errorTitle')}
          </h2>
          <p className="m-0 max-w-md text-sm text-muted">
            {t('dashboard.hrOverview.errorBody')}
          </p>
          <Button type="primary" onClick={() => load(true)} loading={refreshing}>
            {t('common.retry')}
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      {/* Greeting header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="m-0 font-display text-[22px] font-extrabold text-heading">
            {greeting},{' '}
            <span style={{ color: 'var(--cr-primary)' }}>{user?.name?.split(' ')[0] ?? ''}</span> 👋
          </h1>
          <p className="mt-0.5 mb-0 text-[12px] italic" style={{ color: 'var(--cr-gold-700)' }}>
            {t('dashboard.hrOverview.tagline')}
          </p>
          <p className="mt-1 mb-0 text-[13px] text-muted">
            {currentWorkspace?.name ?? ''} · {dayjs().format('dddd, MMMM D YYYY')}
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

      {/* Metric cards */}
      <Row gutter={[20, 20]}>
        {metricCards.map((card) => (
          <Col xs={12} md={6} key={card.id}>
            <Link href={card.href} className="block no-underline">
              <Card
                className="cursor-pointer transition-all duration-200 hover:border-gray-300 hover:shadow-md"
                style={{
                  borderRadius: 16,
                  border: '1px solid var(--cr-border)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
                styles={{ body: { padding: 20 } }}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: card.iconBg, color: card.iconColor }}
                  >
                    {card.icon}
                  </div>
                  <ArrowRightOutlined className="text-sm text-faint" />
                </div>
                {loading ? (
                  <Skeleton.Input active size="small" className="mb-1.5" />
                ) : (
                  <>
                    <div
                      className="mb-3 text-2xl font-extrabold text-gray-900 tabular-nums"
                      aria-label={`${card.label}: ${card.value}`}
                    >
                      {card.value}
                    </div>
                    <h2 className="m-0 mb-1 text-[11px] font-semibold tracking-wider text-gray-700 uppercase">
                      {card.label}
                    </h2>
                    <p className="m-0 text-[11px] text-faint">{card.sub}</p>
                  </>
                )}
              </Card>
            </Link>
          </Col>
        ))}
      </Row>

      <Row gutter={[20, 20]}>
        {/* This-month payroll snapshot (only when SALARY is enabled) */}
        {showSalary && (
          <Col xs={24} lg={12}>
            <Card
              title={
                <span className="font-display font-bold">
                  {t('dashboard.hrOverview.payrollSnapshotTitle')}
                </span>
              }
              extra={<span className="text-[12px] text-muted">{sal!.monthLabel}</span>}
              loading={loading}
              className="h-full"
              style={{
                borderRadius: 16,
                border: '1px solid var(--cr-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              styles={{ body: { padding: 24 } }}
            >
              {!loading && !sal!.payrollGenerated ? (
                <div className="flex min-h-[180px] flex-col items-center justify-center gap-2 text-center">
                  <RupeeOutlined style={{ fontSize: 36, color: 'var(--cr-text-5)' }} />
                  <p className="m-0 text-[13px] font-medium text-subtle">
                    {t('dashboard.hrOverview.payrollEmptyTitle')}
                  </p>
                  <p className="m-0 text-[12px] text-faint">
                    {t('dashboard.hrOverview.payrollEmptyBody')}
                  </p>
                  <Link href="/dashboard/salary" className="mt-2">
                    <Button type="primary">{t('dashboard.generatePayroll')}</Button>
                  </Link>
                </div>
              ) : (
                !loading && (
                  <div className="flex flex-col gap-5">
                    <div className="border-b border-gray-100 pb-4">
                      <p className="m-0 mb-2 text-xs font-semibold tracking-wide text-gray-700 uppercase">
                        {t('payroll.totalPayable')} - {sal!.monthLabel}
                      </p>
                      <p className="m-0 text-4xl leading-tight font-bold text-gray-900 tabular-nums">
                        {formatCurrencyFull(sal!.totalPayable)}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
                          {t('payroll.paid')}
                        </p>
                        <p className="m-0 text-2xl font-bold text-green-700 tabular-nums">
                          {formatCurrencyFull(sal!.totalPaid)}
                        </p>
                      </div>
                      <div>
                        <p className="m-0 mb-1 text-[11px] font-semibold tracking-wide text-faint uppercase">
                          {t('payroll.remaining')}
                        </p>
                        <p className="m-0 text-2xl font-bold text-gray-700 tabular-nums">
                          {formatCurrencyFull(sal!.totalPending)}
                        </p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex justify-between">
                        <span className="text-xs text-gray-700">
                          {t('dashboard.paymentProgress')}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">
                          {sal!.paidEmployeesCount}/{sal!.employeesCount} {t('navigation.team')}
                        </span>
                      </div>
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-gray-100"
                        role="progressbar"
                        aria-valuenow={
                          sal!.employeesCount > 0
                            ? Math.round((sal!.paidEmployeesCount / sal!.employeesCount) * 100)
                            : 0
                        }
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('dashboard.paymentProgress')}
                      >
                        <div
                          className="h-full rounded-full bg-green-500 transition-all duration-300"
                          style={{
                            width:
                              sal!.employeesCount > 0
                                ? `${Math.round((sal!.paidEmployeesCount / sal!.employeesCount) * 100)}%`
                                : '0%',
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </Card>
          </Col>
        )}

        {/* Team by designation */}
        <Col xs={24} lg={showSalary ? 12 : 24}>
          <Card
            title={
              <span className="font-display font-bold">
                {t('dashboard.hrOverview.byDesignationTitle')}
              </span>
            }
            extra={
              <Link href="/dashboard/team" className="text-[12px]">
                {t('common.viewAll')}
              </Link>
            }
            loading={loading}
            className="h-full"
            style={{
              borderRadius: 16,
              border: '1px solid var(--cr-border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
            styles={{ body: { padding: 24 } }}
          >
            {!loading &&
              (data?.byDesignation?.length ? (
                <div className="flex flex-col gap-3">
                  {data.byDesignation.map((d) => {
                    const max = data.byDesignation[0]?.count || 1;
                    const pct = Math.max(6, Math.round((d.count / max) * 100));
                    return (
                      <div key={d.designation} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[13px] font-medium text-gray-700">
                            {d.designation}
                          </span>
                          <span className="text-[13px] font-bold text-gray-900 tabular-nums">
                            {d.count}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, background: 'var(--cr-primary)' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-center">
                  <TeamOutlined style={{ fontSize: 36, color: 'var(--cr-text-5)' }} />
                  <p className="m-0 text-[13px] font-medium text-subtle">
                    {t('dashboard.hrOverview.emptyTitle')}
                  </p>
                  <p className="m-0 text-[12px] text-faint">
                    {t('dashboard.hrOverview.emptyBody')}
                  </p>
                  <Link href="/dashboard/team" className="mt-2">
                    <Button type="primary">{t('dashboard.addFirstMember')}</Button>
                  </Link>
                </div>
              ))}
          </Card>
        </Col>
      </Row>

      {/* Quick links */}
      <Card
        title={<span className="font-display font-bold">{t('dashboard.quickActions')}</span>}
        style={{
          borderRadius: 16,
          border: '1px solid var(--cr-border)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        styles={{ body: { padding: 16 } }}
      >
        <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
          {[
            {
              key: 'team',
              href: '/dashboard/team',
              label: t('navigation.team'),
              sub: t('dashboard.hrOverview.quickTeamSub'),
              icon: <TeamOutlined />,
              iconBg: 'var(--cr-primary-light)',
              iconColor: 'var(--cr-primary)',
            },
            {
              key: 'add-member',
              href: '/dashboard/team',
              label: t('dashboard.addTeamMember'),
              sub: t('dashboard.onboardNewEmployee'),
              icon: <UserAddOutlined />,
              iconBg: 'var(--cr-success-50)',
              iconColor: 'var(--cr-success-500)',
            },
            ...(showSalary
              ? [
                  {
                    key: 'salary',
                    href: '/dashboard/salary',
                    label: t('navigation.payroll'),
                    sub: t('dashboard.calculateMonthSalary'),
                    icon: <RupeeOutlined />,
                    iconBg: 'var(--cr-gold-100)',
                    iconColor: 'var(--cr-gold-500)',
                  },
                ]
              : []),
          ].map((a) => (
            <Link
              key={a.key}
              href={a.href}
              className="flex items-center gap-3 rounded-xl border border-border-light bg-surface px-3 py-3 no-underline transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
            >
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[16px]"
                style={{ background: a.iconBg, color: a.iconColor }}
              >
                {a.icon}
              </div>
              <div className="flex-1">
                <p className="m-0 text-[13px] font-semibold text-gray-700">{a.label}</p>
                <p className="m-0 text-[11px] text-faint">{a.sub}</p>
              </div>
              <ArrowRightOutlined className="text-xs text-faint" />
            </Link>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}

/** Shared page chrome (cream background, edge-to-edge) — matches MySelfDashboard. */
function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex flex-col gap-5"
      style={{ background: 'var(--cr-bg)', padding: 24, margin: -24, minHeight: '100%' }}
    >
      {children}
    </div>
  );
}
