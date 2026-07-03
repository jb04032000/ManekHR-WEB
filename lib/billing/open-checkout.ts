'use client';

/**
 * Thin orchestrator around the Razorpay JS SDK. Hides the SDK shape and
 * surfaces a typed Promise that resolves on payment success or rejects
 * on failure / dismissal.
 *
 * Two modes:
 *   - `order_id`     → one-time checkout (Orders API)
 *   - `subscription_id` → recurring auto-renew (Subscriptions API)
 *
 * The caller decides the mode by setting the matching field on
 * `OpenCheckoutArgs`. Razorpay's SDK switches between the flows based
 * on which id is provided.
 */

import { loadRazorpay } from './razorpay-loader';
import type { RazorpayCheckoutSuccessResponse } from '@/types';

export type CheckoutMode = 'order' | 'subscription';

export interface OpenCheckoutArgs {
  mode: CheckoutMode;
  keyId: string;
  amountPaise?: number; // required for orders, ignored for subscriptions
  currency?: 'INR';
  orderId?: string;
  subscriptionId?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  themeColor?: string;
}

export class CheckoutDismissedError extends Error {
  constructor() {
    super('checkout_dismissed');
    this.name = 'CheckoutDismissedError';
  }
}

export class CheckoutFailedError extends Error {
  payload: unknown;
  constructor(payload: unknown) {
    super('checkout_failed');
    this.name = 'CheckoutFailedError';
    this.payload = payload;
  }
}

export async function openCheckout(
  args: OpenCheckoutArgs,
): Promise<RazorpayCheckoutSuccessResponse> {
  if (args.mode === 'order' && !args.orderId)
    throw new Error('openCheckout: orderId required when mode=order');
  if (args.mode === 'subscription' && !args.subscriptionId)
    throw new Error('openCheckout: subscriptionId required when mode=subscription');

  const Razorpay = await loadRazorpay();

  return new Promise<RazorpayCheckoutSuccessResponse>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const options: Record<string, unknown> = {
      key: args.keyId,
      currency: args.currency ?? 'INR',
      name: args.name ?? 'ManekHR',
      description: args.description,
      prefill: args.prefill,
      notes: args.notes,
      theme: { color: args.themeColor ?? 'var(--cr-info-500)' },
      modal: {
        escape: true,
        confirm_close: true,
        ondismiss: () => settle(() => reject(new CheckoutDismissedError())),
      },
      handler: (resp: RazorpayCheckoutSuccessResponse) => settle(() => resolve(resp)),
    };

    if (args.mode === 'order') {
      options.order_id = args.orderId;
      if (args.amountPaise !== undefined) options.amount = args.amountPaise;
    } else {
      options.subscription_id = args.subscriptionId;
    }

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', (resp) => settle(() => reject(new CheckoutFailedError(resp))));
    rzp.open();
  });
}
