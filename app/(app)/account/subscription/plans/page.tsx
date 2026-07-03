'use client';

import { useEffect, useState, useCallback, useMemo, startTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Row, Col, Card, Button, Tag, message, Popconfirm, Modal, Input, Alert } from 'antd';
import { RocketOutlined, CalendarOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  getPlans,
  getMySubscription,
  getMySubscriptionHistory,
  getTiers,
  subscribeToPlan,
  forceActivateSubscription,
  cancelScheduledSubscription,
  getTrialState,
  getTrialBannerConfig,
  type TrialState,
  type TrialBannerConfig,
} from '@/lib/actions';
import { parseApiError } from '@/lib/utils';
// Shared helper: orders the plan cards by the admin-controlled Tier displayOrder
// (lower first) so this hub matches the marketing pricing grid + dashboard
// activation strip instead of rendering raw DB order.
import { sortPlansByTierOrder } from '@/lib/utils/subscription.utils';
// Plan-interest analytics: which plan logged-in users actually pick. Keyless-safe
// no-op without analytics env keys. Mirrors the public ErpPricingTable signal.
import { trackEvent, ConnectEvents } from '@/lib/analytics-events';
import { useSubscriptionStore } from '@/lib/store';
// Paid plans now route to the dedicated checkout PAGE (app/account/checkout)
// instead of an in-page modal: the page handles mobile better and gives Razorpay
// a real return surface. The payments gate lives INSIDE CheckoutView, so the
// trigger just navigates; this page no longer needs the modal or usePaymentsGate.
// Single presentational plan card (enriched with the marketing pricing copy);
// the page owns all subscription state and feeds it the resolved flags.
import { PlanCard } from './PlanCard';
// State-aware in-app trial banner (eligible -> start offer; in-trial -> countdown;
// used -> nothing). The PUBLIC marketing pricing page keeps the presentational
// TrialPromoBanner; the in-app hub uses this opt-in, action-driven one instead.
import { TrialStatusBanner } from '@/components/subscription/TrialStatusBanner';
// Custom-plan lead-capture card shown below the self-serve plans (request form ->
// admin triages in /admin/custom-plan-requests). No subscription created here.
import { CustomPlanCard } from '@/components/subscription/CustomPlanCard';
// "Request a callback" popup shown when a paid plan's Subscribe is clicked while
// online payments are off: captures a callback number (lead, kind='plan') instead
// of opening a dead checkout. Bypassed once env.paymentsEnabled is true.
import { PlanContactModal } from '@/components/subscription/PlanContactModal';
// Payments master switch. While false, paid Subscribe -> the callback popup; when
// true it flips to the real checkout with no other change (single source of truth
// for "is the gateway live", shared with usePaymentsGate / CheckoutView).
import { env } from '@/lib/env';
// Full-page loading skeleton (mirrors banner + header + cards + custom card),
// shared with the route-level loading.tsx so the in-flight client fetch shows a
// proper placeholder instead of a bare centred spinner.
import { PlansSkeleton, TrialBannerSkeleton } from './PlansSkeleton';
import type { Plan, PlanWithBilling, Subscription, Tier } from '@/types';

export default function PlansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promoCode = searchParams?.get('promo') ?? undefined;

  const [plans, setPlans] = useState<PlanWithBilling[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  // Opt-in trial state. Default neutral so nothing flashes before it loads; the
  // action is itself fail-soft (returns this same "no trial" shape on any error).
  const [trialState, setTrialState] = useState<TrialState>({
    trialPlanConfigured: false,
    hasUsedTrial: false,
    isInTrial: false,
    trialEndsAt: null,
    trialDurationDays: 0,
    canStartTrial: false,
  });
  // Admin "Trial Banner" config (getTrialBannerConfig) - the SAME toggle +
  // custom headline that drive the public TrialPromoBanner. Feeds the in-app
  // TrialStatusBanner's eligible promo so the owner's text/toggle apply here
  // too. Default off + fail-soft so nothing flashes before it loads.
  const [bannerCfg, setBannerCfg] = useState<TrialBannerConfig>({
    enabled: false,
    headlineOverride: '',
    days: 0,
  });
  const [data, setData] = useState<{
    subscription: Subscription | null;
    scheduled: Subscription | null;
    plan: Plan | null;
  } | null>(null);
  // Cards/header/custom-card loading. The trial banner has its OWN flag below so
  // the cards rendering never hides the banner skeleton prematurely.
  const [loading, setLoading] = useState(true);
  // Dedicated loading flag for the trial banner: the trial API (trialState +
  // banner config) resolves on a different timeline from the plans, so the gold
  // banner keeps its skeleton until ITS response lands - even after the faster
  // cards have already rendered. This fixes the banner blinking to empty when the
  // cards appeared first.
  const [trialLoading, setTrialLoading] = useState(true);

  const [forceActivateModal, setForceActivateModal] = useState(false);
  const [forceActivateConfirm, setForceActivateConfirm] = useState('');
  const [forceActivating, setForceActivating] = useState(false);
  // The paid plan whose Subscribe was clicked while payments are off -> drives the
  // "request a callback" popup (null = closed). Unused once payments go live.
  const [interestPlan, setInterestPlan] = useState<PlanWithBilling | null>(null);
  const [msgApi, ctx] = message.useMessage();

  const refresh = useCallback(async () => {
    // Refetch the subscription AND the opt-in trial state together so a freshly
    // started trial flips the banner (canStartTrial -> isInTrial) and updates the
    // user's current plan without a full reload. Both actions are fail-soft.
    const [my, ts] = await Promise.all([getMySubscription(), getTrialState()]);
    startTransition(() => {
      setData(my ?? null);
      setTrialState(ts);
    });
    const store = useSubscriptionStore.getState();
    store.setSubscription(my?.subscription ?? null);
    if (my?.entitlements) store.setEntitlements(my.entitlements);
  }, []);

  useEffect(() => {
    // TWO independent fetch groups so each section reveals on its OWN data,
    // instead of one shared loading flag that let the banner blink to empty the
    // moment the (faster) cards landed.

    // Cards group: plans + tiers + current subscription drive the header, the
    // plan cards, and the scheduled banner. Reveal them as soon as THESE land.
    Promise.all([getPlans(), getTiers().catch(() => []), getMySubscription()])
      .then(([p, t, my]) => {
        setData(my ?? null);
        // Only self-serve ERP plans belong in the ERP plan hub: active, ERP
        // product (legacy plans omit `product`, which defaults to erp), publicly
        // visible, and not the contact-us Custom. Mirrors the marketing pricing
        // page's selectPublicErpPlans so Connect plans, the hidden Custom, and
        // retired/test plans never show here. Keep the two filters in sync.
        setPlans(
          ((p as PlanWithBilling[]) ?? []).filter((pl) => {
            const isErp = !pl.product || pl.product === 'erp';
            const isPublic = pl.isPubliclyVisible !== false;
            const notCustom = pl.isCustom !== true;
            return pl.isActive && isErp && isPublic && notCustom;
          }),
        );
        setTiers((t as Tier[]) ?? []);
        const store = useSubscriptionStore.getState();
        store.setSubscription(my?.subscription ?? null);
        if (my?.entitlements) store.setEntitlements(my.entitlements);
      })
      .finally(() => setLoading(false));

    // Trial-banner group: the trial state + the admin banner config. Keep the
    // banner skeleton up until BOTH respond (no startTransition here - commit
    // directly so the real banner replaces its skeleton the instant its data
    // lands). Both actions are fail-soft (return a neutral "no trial"/disabled
    // shape on any error), so this never blocks or throws.
    Promise.all([getTrialState(), getTrialBannerConfig()])
      .then(([ts, banner]) => {
        setTrialState(ts);
        setBannerCfg(banner);
      })
      .finally(() => setTrialLoading(false));
  }, []);

  const sub = data?.subscription ?? null;
  const scheduled = data?.scheduled ?? null;
  const isActive = sub?.status === 'active' || sub?.status === 'trial';
  const tierBy = useMemo(() => Object.fromEntries(tiers.map((t) => [t.key, t])), [tiers]);

  // Render cards in the admin-controlled Tier order (lower displayOrder first),
  // not the raw filtered DB order. Recomputes when either plans or tiers change.
  const sortedPlans = useMemo(() => sortPlansByTierOrder(plans, tiers), [plans, tiers]);

  const currentTierLevel = useMemo(() => {
    const planTier = typeof sub?.planId === 'object' ? sub.planId.tier : data?.plan?.tier;
    return planTier ? (tierBy[planTier]?.displayOrder ?? 0) : 0;
  }, [sub, data, tierBy]);

  const currentPlanId =
    typeof sub?.planId === 'object'
      ? sub.planId._id
      : ((sub?.planId as string | undefined) ?? data?.plan?._id);
  const scheduledPlanId =
    typeof scheduled?.planId === 'object'
      ? scheduled.planId._id
      : (scheduled?.planId as string | undefined);

  const handleCancelScheduled = async () => {
    if (!scheduled) return;
    try {
      await cancelScheduledSubscription(scheduled._id);
      msgApi.success('Scheduled plan cancelled.');
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    }
  };

  const handleForceActivate = async () => {
    if (!scheduled) return;
    setForceActivating(true);
    try {
      await forceActivateSubscription(scheduled._id);
      msgApi.success('Plan activated.');
      setForceActivateModal(false);
      setForceActivateConfirm('');
      refresh();
    } catch (e) {
      msgApi.error(parseApiError(e));
    } finally {
      setForceActivating(false);
    }
  };

  const handleSelectPlan = async (plan: PlanWithBilling) => {
    // Single chokepoint for every actionable plan CTA on this hub -> record which
    // plan a logged-in user picked (tier slug + surface only, no price/PII). The
    // active/queued/downgrade cards are disabled upstream, so this is genuine
    // intent. Mirrors the public ErpPricingTable's plan.cta_clicked.
    trackEvent(ConnectEvents.planCtaClicked, { tier: plan.tier, surface: 'app_plans' });
    // Free tier: legacy /subscribe endpoint (no payment, no checkout screen).
    if ((plan.monthlyPrice ?? 0) === 0 && (plan.yearlyPrice ?? 0) === 0) {
      try {
        await subscribeToPlan({
          planId: plan._id,
          billingCycle: 'monthly',
          activateImmediately: true,
        });
        msgApi.success('Free plan activated.');
        refresh();
        getMySubscriptionHistory().catch(() => {});
      } catch (e) {
        msgApi.error(parseApiError(e));
      }
      return;
    }
    // Paid tier, payments NOT live yet: skip the dead checkout and open the
    // "request a callback" popup instead (captures a lead, kind='plan'; the team
    // contacts the user). When env.paymentsEnabled flips true this branch is
    // bypassed and we route straight to the real checkout below - no other change.
    if (!env.paymentsEnabled) {
      setInterestPlan(plan);
      return;
    }
    // Paid tier (payments live): navigate to the dedicated checkout PAGE (plan
    // summary + billing choice + breakdown + coupon + order summary). The payments
    // gate inside CheckoutView is a no-op once live, so this completes the charge.
    router.push(`/account/checkout?plan=${encodeURIComponent(plan._id)}`);
  };

  // Show the section-mirroring skeleton (gold trial banner + header + plan cards
  // + custom card) while the client fetch is in flight - not a bare spinner.
  if (loading) {
    return <PlansSkeleton />;
  }

  return (
    <>
      {ctx}

      {/* State-aware trial banner: start-offer / countdown / nothing. onStarted
          refetches so it flips to the in-trial view in place. Its own mb-6 keeps
          a clear gap before the "Choose a plan" title (the banner renders null in
          the used/unavailable state, so no empty gap when there's no banner).
          While the trial API is still in flight we show the banner's OWN skeleton
          (not the real banner, which would render null and look empty) so it stays
          visible until a proper response lands - even after the cards rendered. */}
      {trialLoading ? (
        <TrialBannerSkeleton />
      ) : (
        <TrialStatusBanner
          state={trialState}
          onStarted={refresh}
          bannerEnabled={bannerCfg.enabled}
          headlineOverride={bannerCfg.headlineOverride}
        />
      )}

      {/* Scheduled banner */}
      {scheduled && (
        <Card className="mb-4 rounded-2xl border-[1.5px] border-blue-300 bg-blue-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CalendarOutlined className="text-2xl text-blue-700" />
              <div>
                <p className="m-0 mb-0.5 font-semibold text-heading">
                  Next plan queued:{' '}
                  {typeof scheduled.planId === 'object' ? scheduled.planId.name : 'Custom'}
                </p>
                <p className="m-0 text-xs text-muted">
                  Activates{' '}
                  {scheduled.currentPeriodStart
                    ? dayjs(scheduled.currentPeriodStart).format('DD MMM YYYY')
                    : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="primary"
                icon={<RocketOutlined />}
                onClick={() => setForceActivateModal(true)}
              >
                Activate Now
              </Button>
              <Popconfirm title="Cancel scheduled plan?" onConfirm={handleCancelScheduled}>
                <Button danger>Cancel Queue</Button>
              </Popconfirm>
            </div>
          </div>
        </Card>
      )}

      {/* mt-2 + the preceding banner's mb-6 guarantee a clear gap above the
          title (owner reported it was flush against the banner). */}
      <div className="mt-2 mb-5">
        <h2 className="m-0 mb-1 font-display text-2xl font-bold text-heading">Choose a plan</h2>
        <p className="m-0 text-sm text-muted">
          Upgrade, downgrade, or change billing cycle anytime.
          {promoCode && (
            <span className="ml-2 font-medium text-green-700">
              Promo <Tag color="green">{promoCode}</Tag> auto-applies at checkout.
            </span>
          )}
        </p>
      </div>

      <Row gutter={[20, 20]}>
        {sortedPlans.map((plan) => {
          const tier = tierBy[plan.tier];
          const tierColor = tier?.color ?? 'default';
          const tierOrder = tier?.displayOrder ?? 0;
          const isThisActive = plan._id === currentPlanId;
          const isThisQueued = !!scheduledPlanId && plan._id === scheduledPlanId;
          const isAnyQueued = !!scheduled;
          const isDowngrade = isActive && tierOrder < currentTierLevel;
          const buttonDisabled =
            isThisActive ||
            isThisQueued ||
            (isAnyQueued && !isThisQueued) ||
            (isActive && isDowngrade);

          // The card render lives in PlanCard (presentational); this page owns
          // the subscription state and passes the resolved flags down.
          return (
            <Col xs={24} sm={12} lg={6} key={plan._id}>
              <PlanCard
                plan={plan}
                tierColor={tierColor}
                isThisActive={isThisActive}
                isThisQueued={isThisQueued}
                isDowngrade={isDowngrade}
                buttonDisabled={buttonDisabled}
                onSelect={handleSelectPlan}
                onCancelQueued={handleCancelScheduled}
              />
            </Col>
          );
        })}
      </Row>

      {/* Custom plan option for users who don't fit the self-serve plans: opens a
          short "request a custom plan" form (lead capture; admin handles it).
          pt-8 lives on this plain wrapper (padding, not margin) because a Tailwind
          margin on the AntD Card root gets overridden by AntD's own card styles. */}
      <div className="pt-4">
        <CustomPlanCard />
      </div>

      {/* "Request a callback" popup for a paid Subscribe click while payments are
          off. Controlled by interestPlan (null = closed); dormant once live. */}
      <PlanContactModal plan={interestPlan} onClose={() => setInterestPlan(null)} />

      <Modal
        open={forceActivateModal}
        onCancel={() => {
          setForceActivateModal(false);
          setForceActivateConfirm('');
        }}
        title={<span className="font-display font-bold">Activate Now</span>}
        okText="Activate"
        okButtonProps={{
          danger: true,
          disabled: forceActivateConfirm !== 'ACTIVATE',
          loading: forceActivating,
        }}
        onOk={handleForceActivate}
        width={480}
      >
        <Alert
          type="warning"
          showIcon
          className="mb-4"
          title="This will immediately cancel your current plan"
          description="Any remaining access time will be forfeited. This action is non-refundable."
        />
        <p className="mb-2 text-sm font-medium">Type ACTIVATE to confirm</p>
        <Input
          value={forceActivateConfirm}
          onChange={(e) => setForceActivateConfirm(e.target.value)}
          placeholder="ACTIVATE"
        />
      </Modal>
    </>
  );
}
