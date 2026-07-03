'use server';

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { Plan, Subscription, UpgradeSubscriptionPayload, Tier } from '@/types';

const E = ApiEndpoints.subscriptions;

export async function getPlans() {
  const http = await serverHttp();
  return http.get(E.plans).then(unwrapServer<Plan[]>);
}

export async function getTiers() {
  const http = await serverHttp();
  return http.get(E.tiers).then(unwrapServer<Tier[]>);
}

/** Admin-controlled trial-promo banner config (shape mirrors the BE response). */
export type TrialBannerConfig = { enabled: boolean; headlineOverride: string; days: number };

/**
 * Fetch the public trial-promo banner config (GET /subscriptions/public/trial-banner).
 *
 * Public endpoint (no auth) - drives the TrialPromoBanner on the in-app plans
 * hub AND the marketing pricing page. Fail-soft: on ANY error (network, 4xx/5xx,
 * malformed body) return a disabled config so the banner simply hides - a
 * promo banner must never crash either page. Mirrors getPlans/getTiers' call
 * shape; differs only in swallowing errors here rather than letting them throw.
 */
export async function getTrialBannerConfig(): Promise<TrialBannerConfig> {
  const off: TrialBannerConfig = { enabled: false, headlineOverride: '', days: 0 };
  try {
    const http = await serverHttp();
    const cfg = await http.get(E.publicTrialBanner).then(unwrapServer<Partial<TrialBannerConfig>>);
    return {
      enabled: cfg?.enabled === true,
      headlineOverride: typeof cfg?.headlineOverride === 'string' ? cfg.headlineOverride : '',
      days: typeof cfg?.days === 'number' ? cfg.days : 0,
    };
  } catch {
    return off;
  }
}

/**
 * Opt-in trial state (shape mirrors the BE response). The trial is one-time and
 * opt-in: the user must explicitly start it (no auto-start at signup anymore).
 */
export type TrialState = {
  trialPlanConfigured: boolean;
  hasUsedTrial: boolean;
  isInTrial: boolean;
  trialEndsAt: string | null;
  trialDurationDays: number;
  canStartTrial: boolean;
};

/**
 * Fetch the caller's opt-in trial state (GET /subscriptions/trial-state).
 *
 * Authed. Drives the state-aware TrialStatusBanner on the in-app plans hub
 * (eligible -> start offer; in-trial -> countdown; used -> nothing). Fail-soft:
 * on ANY error return a neutral "no trial available" shape so a fetch blip hides
 * the banner rather than showing a broken / mis-stated offer. Mirrors
 * getTrialBannerConfig's swallow-and-default contract.
 */
export async function getTrialState(): Promise<TrialState> {
  const off: TrialState = {
    trialPlanConfigured: false,
    hasUsedTrial: false,
    isInTrial: false,
    trialEndsAt: null,
    trialDurationDays: 0,
    canStartTrial: false,
  };
  try {
    const http = await serverHttp();
    const s = await http.get(E.trialState).then(unwrapServer<Partial<TrialState>>);
    return {
      trialPlanConfigured: s?.trialPlanConfigured === true,
      hasUsedTrial: s?.hasUsedTrial === true,
      isInTrial: s?.isInTrial === true,
      trialEndsAt: typeof s?.trialEndsAt === 'string' ? s.trialEndsAt : null,
      trialDurationDays: typeof s?.trialDurationDays === 'number' ? s.trialDurationDays : 0,
      canStartTrial: s?.canStartTrial === true,
    };
  } catch {
    return off;
  }
}

/**
 * Start the opt-in trial for the caller (POST /subscriptions/start-trial).
 *
 * Authed, no body. Returns the new subscription on success. Does NOT swallow
 * errors: the BE may 400 with a human message ("Trial already used", "You
 * already have a paid plan", "No trial is available") that the caller surfaces
 * via parseApiError. Cross-module: after success the plans page refetches
 * getTrialState + getMySubscription so the banner flips to the in-trial view.
 */
export async function startTrial() {
  const http = await serverHttp();
  return http.post(E.startTrial).then(unwrapServer<Subscription>);
}

/** Payload for the in-app "Request a custom plan" form (Plans hub). */
export type CustomPlanRequestPayload = {
  teamMembers: number;
  companiesOrFactories?: number;
  mobile: string;
  note?: string;
};

/**
 * Submit a custom-plan lead (POST /subscriptions/custom-plan-request). Authed,
 * does NOT swallow errors (the form surfaces them via parseApiError). Captured
 * when a user's needs don't fit the self-serve plans; an admin triages it in
 * /admin/custom-plan-requests and contacts the user on the given mobile.
 */
export async function submitCustomPlanRequest(payload: CustomPlanRequestPayload) {
  const http = await serverHttp();
  return http.post(E.customPlanRequest, payload).then(unwrapServer<{ _id: string }>);
}

/** Payload for the Subscribe-while-payments-off "request callback" popup. */
export type PlanInterestRequestPayload = {
  planId: string;
  planTier?: string;
  planName?: string;
  mobile: string;
  teamMembers?: number;
  note?: string;
};

/**
 * Submit a plan-interest lead (POST /subscriptions/custom-plan-request/plan-interest).
 * Fired when a user clicks Subscribe on a predefined paid plan while online
 * payments are off: captures the plan + a callback mobile so the team reaches out.
 * Lands in the SAME admin list as custom-plan leads, flagged kind='plan'. Authed,
 * does NOT swallow errors (the popup surfaces them via parseApiError).
 */
export async function submitPlanInterestRequest(payload: PlanInterestRequestPayload) {
  const http = await serverHttp();
  return http.post(E.planInterestRequest, payload).then(unwrapServer<{ _id: string }>);
}

/**
 * Razorpay one-time checkout for a paid plan (POST subscriptions/checkout).
 *
 * Returns the Razorpay order + the PUBLISHABLE keyId the browser needs to open
 * the hosted checkout sheet (the secret key never leaves the backend), plus
 * `paymentId` which the caller must round-trip into confirmPlanCheckout. Mirrors
 * the credit-pack order flow (add-ons.actions createCreditPackOrder). Consumed by
 * lib/billing/plan-checkout purchasePlan -> CheckoutView.
 */
export type PlanCheckoutOrder = {
  orderId: string;
  amount: number; // paise
  currency: string;
  keyId: string; // Razorpay publishable key_id (safe for the browser)
  planId: string;
  billingCycle: string;
  paymentId: string; // SubscriptionPayment._id - round-trip to confirm
};

export async function createPlanCheckoutOrder(payload: {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  couponCodes?: string[];
  autoApplyCampaignKey?: string;
}): Promise<PlanCheckoutOrder> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.billing.checkoutCreate, payload)
    .then(unwrapServer<PlanCheckoutOrder>);
}

/**
 * Confirm a captured Razorpay payment (POST subscriptions/checkout/confirm). The
 * backend verifies the signature, captures the payment, and activates the
 * subscription. `subscriptionPaymentId` is the `paymentId` from createPlanCheckoutOrder.
 */
export type PlanCheckoutConfirmResult = {
  subscriptionId: string;
  paymentId: string;
  totalPaise: number;
  capturedAt: string;
};

export async function confirmPlanCheckout(payload: {
  subscriptionPaymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<PlanCheckoutConfirmResult> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.billing.checkoutConfirm, payload)
    .then(unwrapServer<PlanCheckoutConfirmResult>);
}

export async function getMySubscription(token?: string, workspaceId?: string) {
  const http = await serverHttp(token);
  // Wave A Permission-Gated UI (2026-05-15) - workspaceId lets BE resolve
  // the active workspace's subscription chain (owner's plan flows to
  // members). Without it BE falls back to caller-owned-only - used by the
  // own-billing page where the caller is the purchaser.
  const url = workspaceId ? `${E.my}?workspaceId=${encodeURIComponent(workspaceId)}` : E.my;
  try {
    const res = await http.get(url).then(
      unwrapServer<{
        subscription: Subscription | null;
        plan: Plan | null;
        entitlements: any;
        usage: any;
        scheduled: any;
      }>,
    );
    return res;
  } catch (e) {
    // Fail SOFT on the benign "this workspaceId isn't valid for you right now"
    // outcomes. Letting these propagate out of a Server Action turns every
    // render that awaits this into a `POST /<route> 500` (console noise + an
    // aborted RSC, and it white-screens the subscription server-component
    // pages). Returning null mirrors getErpEntryState's fail-open contract; all
    // callers read the result via `my?.subscription` / `my?.entitlements`, so
    // null is handled (the persisted store is kept). The cases:
    //   423 = App-Locked (idle Quick-PIN timeout) - re-PIN clears it.
    //   403 = the active workspaceId points at a workspace the caller is NOT a
    //         member of - e.g. a stale persisted selection carried over from
    //         another account/session, or a member who was removed.
    //   404 = that workspace no longer exists.
    // Genuine server faults (5xx) still propagate unchanged.
    const benign = isAxiosError(e) && [403, 404, 423].includes(e.response?.status ?? 0);
    if (benign) return null;
    throw e;
  }
}

export async function subscribeToPlan(
  data: UpgradeSubscriptionPayload & { activateImmediately?: boolean },
) {
  const http = await serverHttp();
  return http.post(E.subscribe, data).then(unwrapServer<Subscription>);
}

export async function cancelSubscription() {
  const http = await serverHttp();
  return http.post(E.cancel).then(unwrapServer<{ subscription: Subscription; message: string }>);
}

export async function forceActivateSubscription(subscriptionId: string) {
  const http = await serverHttp();
  return http.post(E.forceActivate, { subscriptionId }).then(unwrapServer<{ message: string }>);
}

export async function cancelScheduledSubscription(subscriptionId: string) {
  const http = await serverHttp();
  return http.post(E.cancelScheduled, { subscriptionId }).then(unwrapServer<{ message: string }>);
}

export async function getMySubscriptionHistory() {
  const http = await serverHttp();
  return http.get(E.myHistory).then(unwrapServer<Subscription[]>);
}
