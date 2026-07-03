'use server';

/**
 * D1 enterprise billing - server actions.
 *
 * All endpoints in `subscriptions/{checkout|mandate|coupons|payments|
 * dunning|refund-requests}` and `users/me/billing`. Razorpay JS SDK
 * (window.Razorpay) opens client-side; only signed payloads round-trip
 * through these server actions.
 *
 * Idempotency: createCheckoutOrder + confirmCheckoutPayment + the four
 * mandate verbs forward an `Idempotency-Key` header to satisfy the BE's
 * `@Idempotent()` interceptor. Caller supplies the key (typically a UUID
 * persisted via the useBillingIdempotencyKey hook so retries dedup).
 */

import { isAxiosError } from 'axios';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  BillingProfile,
  ConfirmPaymentPayload,
  ConfirmPaymentResponse,
  CouponValidationResult,
  CreateCheckoutPayload,
  CreateCheckoutResponse,
  CreateMandatePayload,
  CreateMandateResponse,
  DunningStatus,
  InvoiceMeta,
  PaymentsListQuery,
  PaymentsListResponse,
  RefundRequest,
  RefundRequestPayload,
} from '@/types';

const E = ApiEndpoints.billing;

const idemHeader = (key?: string) => (key ? { headers: { 'Idempotency-Key': key } } : undefined);

// ── Checkout (one-time) ─────────────────────────────────────────────
export async function createCheckoutOrder(payload: CreateCheckoutPayload, idempotencyKey?: string) {
  const http = await serverHttp();
  return http
    .post(E.checkoutCreate, payload, idemHeader(idempotencyKey))
    .then(unwrapServer<CreateCheckoutResponse>);
}

export async function confirmCheckoutPayment(
  payload: ConfirmPaymentPayload,
  idempotencyKey?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.checkoutConfirm, payload, idemHeader(idempotencyKey))
    .then(unwrapServer<ConfirmPaymentResponse>);
}

// ── Mandate (recurring) ─────────────────────────────────────────────
export async function createMandate(payload: CreateMandatePayload, idempotencyKey?: string) {
  const http = await serverHttp();
  return http
    .post(E.mandateCreate, payload, idemHeader(idempotencyKey))
    .then(unwrapServer<CreateMandateResponse>);
}

export async function cancelMandate(
  body: { cancelAtCycleEnd?: boolean } = {},
  idempotencyKey?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.mandateCancel, body, idemHeader(idempotencyKey))
    .then(unwrapServer<{ subscriptionId: string; status: string; razorpaySubscriptionId: string }>);
}

export async function pauseMandate(body: { reason?: string } = {}, idempotencyKey?: string) {
  const http = await serverHttp();
  return http
    .post(E.mandatePause, body, idemHeader(idempotencyKey))
    .then(unwrapServer<{ subscriptionId: string; status: string; razorpaySubscriptionId: string }>);
}

export async function resumeMandate(idempotencyKey?: string) {
  const http = await serverHttp();
  return http
    .post(E.mandateResume, {}, idemHeader(idempotencyKey))
    .then(unwrapServer<{ subscriptionId: string; status: string; razorpaySubscriptionId: string }>);
}

// ── Coupons ─────────────────────────────────────────────────────────
export async function validateCoupons(payload: {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  codes: string[];
}) {
  const http = await serverHttp();
  return http.post(E.couponValidate, payload).then(unwrapServer<CouponValidationResult>);
}

/**
 * `?promo=<key>` is the query parameter expected by the BE - body only
 * carries planId + billingCycle.
 */
export async function autoApplyCoupon(payload: {
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  campaignKey?: string;
}) {
  const http = await serverHttp();
  const { campaignKey, ...body } = payload;
  return http
    .post(E.couponAutoApply, body, {
      params: campaignKey ? { promo: campaignKey } : undefined,
    })
    .then(unwrapServer<CouponValidationResult>);
}

// ── Payments + invoices ─────────────────────────────────────────────
export async function listPayments(query: PaymentsListQuery = {}) {
  const http = await serverHttp();
  return http.get(E.paymentsList, { params: query }).then(unwrapServer<PaymentsListResponse>);
}

export async function getInvoiceMeta(paymentId: string) {
  const http = await serverHttp();
  return http.get(E.invoiceMeta(paymentId)).then(unwrapServer<InvoiceMeta>);
}

export async function regenerateInvoice(paymentId: string) {
  const http = await serverHttp();
  return http.post(E.invoiceRegenerate(paymentId)).then(unwrapServer<InvoiceMeta>);
}

/**
 * Server-action variant of the invoice download. Returns base64 +
 * filename so a client component can trigger a Blob download. The
 * actual binary bytes never enter the client bundle - only when the
 * action resolves.
 */
export async function downloadInvoice(paymentId: string) {
  const http = await serverHttp();
  const res = await http.get(E.invoiceDownload(paymentId), {
    responseType: 'arraybuffer',
  });
  const buf = Buffer.from(res.data);
  return {
    base64: buf.toString('base64'),
    filename: extractFilename(res.headers['content-disposition']) ?? `invoice-${paymentId}.pdf`,
    contentType: (res.headers['content-type'] as string) ?? 'application/pdf',
  };
}

function extractFilename(disposition?: string): string | null {
  if (!disposition) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)/i.exec(disposition);
  return match ? decodeURIComponent(match[1].replace(/"/g, '')) : null;
}

// ── Refunds ─────────────────────────────────────────────────────────
export async function requestRefund(paymentId: string, payload: RefundRequestPayload) {
  const http = await serverHttp();
  return http.post(E.refundRequest(paymentId), payload).then(unwrapServer<RefundRequest>);
}

export async function listMyRefundRequests() {
  const http = await serverHttp();
  return http.get(E.refundList).then(unwrapServer<RefundRequest[]>);
}

export async function getRefundRequest(id: string) {
  const http = await serverHttp();
  return http.get(E.refundGet(id)).then(unwrapServer<RefundRequest>);
}

// ── Dunning ─────────────────────────────────────────────────────────
/**
 * Dunning-banner status for the current ERP subscription. Powers the global
 * <DunningBanner/>, which polls this every 60s from the shared app shell.
 *
 * Fail SOFT on 423 APP_LOCKED. The dunning endpoint is an ERP billing route
 * behind the Quick-PIN App-Lock guard, so an idle/locked session (or one that
 * still needs PIN setup - both surface as 423) rejects it on every poll. An
 * uncaught AxiosError out of a Server Action becomes a `POST 500` plus a red
 * server-log line every 60s on EVERY page - including Connect, where the banner
 * shell still mounts. Returning null = "no banner" until the next poll after
 * unlock. Mirrors `getMySubscription`'s 423 fail-open contract; the sole caller
 * (DunningBanner) already reads `s ?? null`. Real (non-lock) errors still throw.
 */
export async function getDunningStatus(): Promise<DunningStatus | null> {
  const http = await serverHttp();
  try {
    return await http.get(E.dunningStatus).then(unwrapServer<DunningStatus>);
  } catch (e) {
    if (isAxiosError(e) && e.response?.status === 423) return null;
    throw e;
  }
}

// ── Billing profile ─────────────────────────────────────────────────
export async function getBillingProfile() {
  const http = await serverHttp();
  return http.get(E.billingProfile).then(unwrapServer<BillingProfile>);
}

export async function updateBillingProfile(payload: BillingProfile) {
  const http = await serverHttp();
  return http.patch(E.billingProfile, payload).then(unwrapServer<BillingProfile>);
}
