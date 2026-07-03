'use client';

/**
 * Plan checkout orchestrator - wraps the openCheckout() Razorpay orchestrator
 * with the plan checkout server-action pair (createPlanCheckoutOrder +
 * confirmPlanCheckout). Caller passes the plan + billing cycle; the promise
 * resolves on a captured + confirmed payment, or rejects with
 * CheckoutDismissedError / CheckoutFailedError / a generic Error so the caller
 * can message accordingly. Mirrors components/billing/credit-pack-checkout.ts
 * (purchaseCreditPack) exactly - only the action pair + description differ.
 *
 * Cross-module links: lib/billing/open-checkout (Razorpay SDK), lib/actions
 * subscriptions.actions (BE subscriptions/checkout + /confirm). Used by
 * components/subscription/CheckoutView handleProceed (behind the payments gate).
 */
import {
  createPlanCheckoutOrder,
  confirmPlanCheckout,
  type PlanCheckoutConfirmResult,
} from '@/lib/actions';
import {
  openCheckout,
  CheckoutDismissedError,
  CheckoutFailedError,
} from '@/lib/billing/open-checkout';

export { CheckoutDismissedError, CheckoutFailedError };

export async function purchasePlan(args: {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  planName: string;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<PlanCheckoutConfirmResult> {
  const order = await createPlanCheckoutOrder({
    planId: args.planId,
    billingCycle: args.billingCycle,
  });

  const sdkResp = await openCheckout({
    mode: 'order',
    keyId: order.keyId,
    orderId: order.orderId,
    amountPaise: order.amount,
    currency: order.currency as 'INR',
    name: 'ManekHR',
    description: `${args.planName} (${args.billingCycle})`,
    prefill: args.prefill,
  });

  return confirmPlanCheckout({
    subscriptionPaymentId: order.paymentId,
    razorpayOrderId: sdkResp.razorpay_order_id ?? order.orderId,
    razorpayPaymentId: sdkResp.razorpay_payment_id,
    razorpaySignature: sdkResp.razorpay_signature ?? '',
  });
}
