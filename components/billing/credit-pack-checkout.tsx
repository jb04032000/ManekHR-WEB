'use client';

/**
 * Wave 7 - credit-pack Razorpay checkout helper.
 *
 * Wraps the existing `openCheckout()` orchestrator with the credit-pack
 * server-action pair (`createCreditPackOrder` + `confirmCreditPackPayment`).
 * Caller passes a pack + qty; promise resolves on captured payment OR
 * rejects with a `CheckoutDismissedError` / `CheckoutFailedError` /
 * generic Error so the calling page can `messageApi.error()` cleanly.
 */

import {
  createCreditPackOrder,
  confirmCreditPackPayment,
  type CreditPackConfirmResponse,
} from '@/lib/actions/add-ons.actions';
import {
  openCheckout,
  CheckoutDismissedError,
  CheckoutFailedError,
} from '@/lib/billing/open-checkout';

export { CheckoutDismissedError, CheckoutFailedError };

export async function purchaseCreditPack(args: {
  addOnDefinitionId: string;
  quantity: number;
  packName: string;
  prefill?: { name?: string; email?: string; contact?: string };
}): Promise<CreditPackConfirmResponse> {
  const order = await createCreditPackOrder({
    addOnDefinitionId: args.addOnDefinitionId,
    quantity: args.quantity,
  });

  const sdkResp = await openCheckout({
    mode: 'order',
    keyId: order.keyId,
    orderId: order.orderId,
    amountPaise: order.amount,
    currency: order.currency as 'INR',
    name: 'ManekHR',
    description: `${args.packName} × ${args.quantity}`,
    prefill: args.prefill,
  });

  return confirmCreditPackPayment({
    creditPackPaymentId: order.creditPackPaymentId,
    razorpayOrderId: sdkResp.razorpay_order_id ?? order.orderId,
    razorpayPaymentId: sdkResp.razorpay_payment_id,
    razorpaySignature: sdkResp.razorpay_signature ?? '',
  });
}
