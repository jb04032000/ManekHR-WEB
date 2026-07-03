import { describe, it, expect } from 'vitest';
import { buildConfirmPayload } from './wallet-topup-checkout';
import type { WalletTopupOrder } from './ads.types';
import type { RazorpayCheckoutSuccessResponse } from '@/types';

const order: WalletTopupOrder = {
  keyId: 'rzp_test_key',
  orderId: 'order_ABC123',
  amount: 29900, // paise (Rs 299)
  currency: 'INR',
  walletTopupId: 'wt_xyz789',
};

describe('buildConfirmPayload', () => {
  it('maps a full SDK response straight through', () => {
    const sdkResp: RazorpayCheckoutSuccessResponse = {
      razorpay_payment_id: 'pay_111',
      razorpay_order_id: 'order_FROM_SDK',
      razorpay_signature: 'sig_222',
    };

    expect(buildConfirmPayload(order, sdkResp)).toEqual({
      walletTopupId: 'wt_xyz789',
      razorpayOrderId: 'order_FROM_SDK',
      razorpayPaymentId: 'pay_111',
      razorpaySignature: 'sig_222',
    });
  });

  it('falls back to order.orderId when razorpay_order_id is missing', () => {
    const sdkResp: RazorpayCheckoutSuccessResponse = {
      razorpay_payment_id: 'pay_111',
      razorpay_signature: 'sig_222',
    };

    const payload = buildConfirmPayload(order, sdkResp);
    expect(payload.razorpayOrderId).toBe('order_ABC123');
  });

  it('falls back to an empty string when razorpay_signature is missing', () => {
    const sdkResp: RazorpayCheckoutSuccessResponse = {
      razorpay_payment_id: 'pay_111',
      razorpay_order_id: 'order_FROM_SDK',
    };

    const payload = buildConfirmPayload(order, sdkResp);
    expect(payload.razorpaySignature).toBe('');
  });

  it('carries walletTopupId and razorpayPaymentId correctly', () => {
    const sdkResp: RazorpayCheckoutSuccessResponse = {
      razorpay_payment_id: 'pay_999',
      razorpay_order_id: 'order_FROM_SDK',
      razorpay_signature: 'sig_222',
    };

    const payload = buildConfirmPayload(order, sdkResp);
    expect(payload.walletTopupId).toBe('wt_xyz789');
    expect(payload.razorpayPaymentId).toBe('pay_999');
  });
});
