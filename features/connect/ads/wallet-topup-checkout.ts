'use client';

/**
 * Ads-wallet top-up Razorpay checkout helper.
 *
 * Mirrors components/billing/credit-pack-checkout.tsx: wraps the shared
 * `openCheckout()` orchestrator with the wallet top-up server-action pair
 * (`createWalletTopupOrder` + `confirmWalletTopup`). The caller passes a face
 * amount in whole RUPEES; the promise resolves with the updated WalletView on a
 * captured + verified payment, or rejects with a `CheckoutDismissedError` /
 * `CheckoutFailedError` / generic Error so the panel can branch cleanly.
 *
 * Connect is person-centric: no workspaceId is ever sent. The advertiser is the
 * authenticated user, derived from the JWT on the backend.
 *
 * MONEY UNIT: amountRupees is whole rupees on our side. The backend order's
 * `amount` field is PAISE and is passed straight to openCheckout as amountPaise.
 */

import { createWalletTopupOrder, confirmWalletTopup } from './ads.actions';
// Additive wallet funnel telemetry (topup_started at checkout open + completed
// on confirmed success). Keyless-safe: trackEvent no-ops without analytics keys.
import { ConnectEvents, trackEvent, bucketRupees } from '@/lib/analytics-events';
import type { ConfirmWalletTopupPayload, WalletTopupOrder, WalletView } from './ads.types';
import {
  openCheckout,
  CheckoutDismissedError,
  CheckoutFailedError,
} from '@/lib/billing/open-checkout';
import type { RazorpayCheckoutSuccessResponse } from '@/types';

export { CheckoutDismissedError, CheckoutFailedError };

/**
 * Pure mapper from the created order + the Razorpay SDK success response into
 * the confirm payload. This is the unit-tested seam.
 *
 * Uses the same fallbacks the credit-pack flow relies on: the SDK omits
 * `razorpay_order_id` / `razorpay_signature` in some flows, so we fall back to
 * the order's own id and an empty signature (the backend re-derives / verifies).
 */
export function buildConfirmPayload(
  order: WalletTopupOrder,
  sdkResp: RazorpayCheckoutSuccessResponse,
): ConfirmWalletTopupPayload {
  return {
    walletTopupId: order.walletTopupId,
    razorpayOrderId: sdkResp.razorpay_order_id ?? order.orderId,
    razorpayPaymentId: sdkResp.razorpay_payment_id,
    razorpaySignature: sdkResp.razorpay_signature ?? '',
  };
}

export async function purchaseWalletTopup(args: {
  amountRupees: number;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<WalletView> {
  // Additive funnel telemetry: user initiated a wallet top-up checkout.
  // amountBucket is the coarse band only; the exact rupee amount is never sent.
  trackEvent(ConnectEvents.walletTopupStarted, {
    amountBucket: bucketRupees(args.amountRupees),
  });

  const orderRes = await createWalletTopupOrder(args.amountRupees);
  if (!orderRes.ok) throw new Error(orderRes.error);
  const order = orderRes.data;

  const sdkResp = await openCheckout({
    mode: 'order',
    keyId: order.keyId,
    orderId: order.orderId,
    amountPaise: order.amount,
    currency: order.currency as 'INR',
    name: 'ManekHR',
    description: `Ads wallet top-up Rs ${args.amountRupees}`,
    prefill: args.prefill,
  });

  const confirmRes = await confirmWalletTopup(buildConfirmPayload(order, sdkResp));
  if (!confirmRes.ok) throw new Error(confirmRes.error);
  // Additive funnel telemetry: top-up confirmed (captured + verified). Emit only
  // on confirmed success, before resolving. amountBucket = coarse band only.
  trackEvent(ConnectEvents.walletTopupCompleted, {
    amountBucket: bucketRupees(args.amountRupees),
  });
  return confirmRes.data;
}
