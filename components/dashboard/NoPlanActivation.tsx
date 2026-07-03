'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Skeleton, Tag } from 'antd';
import {
  CrownOutlined,
  TeamOutlined,
  ScheduleOutlined,
  CalculatorOutlined,
  ArrowRightOutlined,
  CheckCircleFilled,
} from '@ant-design/icons';
import { RupeeOutlined } from '@/components/ui/RupeeIcon';
import dayjs from 'dayjs';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/lib/store';
import { getPlans, getTiers } from '@/lib/actions';
// Shared helper: orders the preview strip by the admin Tier displayOrder so it
// matches the plans hub + marketing pricing grid (single source of truth).
import { sortPlansByTierOrder } from '@/lib/utils/subscription.utils';
import { Money } from '@/lib/money';
import type { PlanWithBilling, Tier } from '@/types';

const PLANS_HREF = '/account/subscription/plans';

/**
 * First-run activation screen shown on the dashboard when the workspace has no
 * active subscription. This is the very first surface a freshly-registered
 * owner sees, so it is framed as an activation moment (value + live entry
 * price + clear path to plans) rather than a dead "no plan" notice.
 *
 * Plan data is fetched live (the same getPlans/getTiers the Plans page uses)
 * so prices are never hardcoded. A failed or empty fetch degrades to the hero
 * plus CTA, so the screen is never broken.
 */
export default function NoPlanActivation() {
  const t = useTranslations();
  const { user } = useAuthStore();

  const [plans, setPlans] = useState<PlanWithBilling[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getPlans().catch(() => [] as PlanWithBilling[]),
      getTiers().catch(() => [] as Tier[]),
    ])
      .then(([p, ts]) => {
        if (cancelled) return;
        // Only self-serve ERP plans belong on the ERP dashboard activation
        // screen: active, ERP product (legacy plans omit `product`, which
        // defaults to erp), publicly visible, and not the contact-us Custom.
        // Without this, Connect plans (e.g. Connect Premium ₹499) and the hidden
        // Custom leak in, and Connect Premium wins the "Starting from" Math.min.
        // Mirrors the plans hub (app/account/subscription/plans/page.tsx) and the
        // marketing pricing page (app/(marketing)/erp/pricing selectPublicErpPlans).
        // Keep the three filters in sync.
        setPlans(
          ((p as PlanWithBilling[]) ?? []).filter((pl) => {
            const isErp = !pl.product || pl.product === 'erp';
            const isPublic = pl.isPubliclyVisible !== false;
            const notCustom = pl.isCustom !== true;
            return pl.isActive && isErp && isPublic && notCustom;
          }),
        );
        setTiers((ts as Tier[]) ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const greeting =
    dayjs().hour() < 12
      ? t('dashboard.goodMorning')
      : dayjs().hour() < 17
        ? t('dashboard.goodAfternoon')
        : t('dashboard.goodEvening');

  const tierBy = Object.fromEntries(tiers.map((ts) => [ts.key, ts]));

  // Cheapest paid plan drives the "from ₹X/mo" entry line. A zero-price plan
  // (if any) means a free entry point exists.
  const paidPlans = plans.filter((p) => (p.monthlyPrice ?? 0) > 0);
  const hasFreePlan = plans.some((p) => (p.monthlyPrice ?? 0) === 0 && (p.yearlyPrice ?? 0) === 0);
  const entryPrice = paidPlans.length ? Math.min(...paidPlans.map((p) => p.monthlyPrice)) : null;
  const maxTrialDays = Math.max(0, ...plans.map((p) => p.trialDurationDays ?? 0));

  // Tiers shown in the preview strip, ordered by their configured display order.
  const previewPlans = sortPlansByTierOrder(plans, tiers).slice(0, 4);

  const benefits = [
    { icon: <TeamOutlined />, title: t('navigation.team'), desc: t('dashboard.noPlan.descTeam') },
    {
      icon: <ScheduleOutlined />,
      title: t('navigation.timeAttendance'),
      desc: t('dashboard.noPlan.descTime'),
    },
    {
      icon: <RupeeOutlined />,
      title: t('navigation.payroll'),
      desc: t('dashboard.noPlan.descPayroll'),
    },
    {
      icon: <CalculatorOutlined />,
      title: t('navigation.finance'),
      desc: t('dashboard.noPlan.descFinance'),
    },
  ];

  const unlockChips = [
    t('navigation.team'),
    t('navigation.attendance'),
    t('navigation.leave'),
    t('navigation.shifts'),
    t('navigation.payroll'),
    t('navigation.finance'),
    t('navigation.machines'),
    t('rbac.roles'),
  ];

  return (
    <div
      className="flex flex-col gap-5"
      style={{ background: 'var(--cr-bg)', padding: 24, margin: -24, minHeight: '100%' }}
    >
      {/* Greeting */}
      <div>
        <h1 className="m-0 font-display text-[22px] font-extrabold text-heading">
          {greeting}, {user?.name?.split(' ')[0]}
        </h1>
        <p className="mt-0.5 mb-0 text-[12px] italic" style={{ color: 'var(--cr-gold-700)' }}>
          Apka business. Apke control mein.
        </p>
      </div>

      {/* Hero */}
      <Card
        className="relative overflow-hidden"
        style={{
          borderRadius: 20,
          border: '1px solid var(--cr-gold-400)',
          background: 'linear-gradient(135deg, var(--cr-gold-100), var(--cr-surface) 60%)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        }}
        styles={{ body: { padding: 32 } }}
      >
        {/* Soft decorative gold glow, top-right. Inert. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full"
          style={{ background: 'var(--cr-gold-400)', opacity: 0.18, filter: 'blur(48px)' }}
        />

        {/* Copy block. Plain block flow (NOT a flex item) so it always fills the
            available width up to its max-width and wraps text normally. On large
            screens it reserves right padding for the absolutely-positioned price
            card. */}
        <div className="relative z-[1] max-w-[640px] lg:pr-8">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
            style={{ background: 'var(--cr-gold-100)', border: '1px solid var(--cr-gold-400)' }}
          >
            <CrownOutlined style={{ color: 'var(--cr-gold-700)', fontSize: 26 }} />
          </div>
          <h2 className="m-0 font-display text-[26px] leading-tight font-extrabold text-heading sm:text-[30px]">
            {t('dashboard.noPlan.title')}
          </h2>
          <p
            className="text-[15px] leading-relaxed text-muted"
            style={{ marginTop: 12, marginBottom: 0 }}
          >
            {t('dashboard.noPlan.subtitle')}
          </p>

          <div className="mt-6">
            <Link href={PLANS_HREF}>
              <Button type="primary" size="large" icon={<CrownOutlined />} className="cr-btn-gold">
                {t('dashboard.noPlan.viewPlans')}
              </Button>
            </Link>
          </div>
        </div>

        {/* Price callout. Static (below the copy) on mobile; pinned to the right
            and vertically centred on large screens, so the copy block above keeps
            full-width block flow. */}
        <div className="relative z-[1] mt-8 lg:absolute lg:top-1/2 lg:right-8 lg:mt-0 lg:-translate-y-1/2">
          {loading ? (
            <Skeleton.Button active style={{ width: 180, height: 92 }} />
          ) : entryPrice !== null ? (
            <div
              className="inline-block rounded-2xl px-7 py-5 text-center lg:min-w-[180px]"
              style={{ background: 'var(--cr-surface)', border: '1px solid var(--cr-gold-400)' }}
            >
              <p className="m-0 text-[11px] font-semibold tracking-wide text-subtle uppercase">
                {t('dashboard.noPlan.startingFrom')}
              </p>
              <p
                className="m-0 mt-1 font-display text-[32px] leading-none font-extrabold"
                style={{ color: 'var(--cr-gold-700)' }}
              >
                {Money.fromRupees(entryPrice).format()}
                <span className="text-sm font-normal text-subtle">
                  {t('dashboard.noPlan.perMonth')}
                </span>
              </p>
              {hasFreePlan ? (
                <p className="m-0 mt-1.5 text-[11px] text-muted">
                  {t('dashboard.noPlan.freeAvailable')}
                </p>
              ) : maxTrialDays > 0 ? (
                <p className="m-0 mt-1.5 text-[11px] text-muted">
                  {t('dashboard.noPlan.trial', { days: maxTrialDays })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Benefits */}
      <div>
        <h3
          className="font-display text-base font-bold text-heading"
          style={{ marginTop: 0, marginBottom: 12 }}
        >
          {t('dashboard.noPlan.benefitsTitle')}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <Card
              key={b.title}
              style={{
                borderRadius: 16,
                border: '1px solid var(--cr-border)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
              }}
              styles={{ body: { padding: 18 } }}
            >
              <div
                className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                style={{ background: 'var(--cr-primary-light)', color: 'var(--cr-primary)' }}
              >
                {b.icon}
              </div>
              <p className="m-0 mb-1 text-[13px] font-semibold text-heading">{b.title}</p>
              <p className="m-0 text-[12px] leading-snug text-muted">{b.desc}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* What you'll unlock */}
      <div>
        <h3
          className="font-display text-base font-bold text-heading"
          style={{ marginTop: 0, marginBottom: 12 }}
        >
          {t('dashboard.noPlan.unlockTitle')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {unlockChips.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
              style={{
                background: 'var(--cr-gold-100)',
                border: '1px solid var(--cr-gold-400)',
                color: 'var(--cr-gold-700)',
              }}
            >
              <CrownOutlined className="text-[11px]" />
              {label}
            </span>
          ))}
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-muted"
            style={{ background: 'var(--cr-surface-2)', border: '1px solid var(--cr-border)' }}
          >
            {t('dashboard.noPlan.andMore')}
          </span>
        </div>
      </div>

      {/* Plan preview strip */}
      {!loading && previewPlans.length > 0 && (
        <div>
          <h3
            className="font-display text-base font-bold text-heading"
            style={{ marginTop: 0, marginBottom: 12 }}
          >
            {t('dashboard.noPlan.plansTitle')}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {previewPlans.map((plan) => {
              const tierColor = tierBy[plan.tier]?.color ?? 'default';
              const isFree = (plan.monthlyPrice ?? 0) === 0;
              return (
                <Link key={plan._id} href={PLANS_HREF} className="no-underline">
                  <Card
                    hoverable
                    style={{ borderRadius: 16, border: '1px solid var(--cr-border)' }}
                    styles={{ body: { padding: 18 } }}
                    className="hover:border-gold-400 h-full transition-all"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <CrownOutlined
                        style={{
                          color: tierColor === 'default' ? 'var(--cr-gold-700)' : tierColor,
                        }}
                      />
                      <span className="font-display text-[15px] font-bold text-heading">
                        {plan.name}
                      </span>
                    </div>
                    <p className="m-0 font-display text-[22px] font-extrabold text-heading">
                      {isFree
                        ? t('dashboard.noPlan.free')
                        : Money.fromRupees(plan.monthlyPrice).format()}
                      {!isFree && (
                        <span className="text-[12px] font-normal text-subtle">
                          {t('dashboard.noPlan.perMonth')}
                        </span>
                      )}
                    </p>
                    {plan.trialDurationDays && plan.trialDurationDays > 0 ? (
                      <Tag color="green" className="mt-2" icon={<CheckCircleFilled />}>
                        {t('dashboard.noPlan.trial', { days: plan.trialDurationDays })}
                      </Tag>
                    ) : null}
                    <div
                      className="mt-3 flex items-center gap-1 text-[12px] font-semibold"
                      style={{ color: 'var(--cr-gold-700)' }}
                    >
                      {t('dashboard.noPlan.choosePlan')}
                      <ArrowRightOutlined className="text-[10px]" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
