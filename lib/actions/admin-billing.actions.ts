'use server';

/**
 * D3 - Admin billing server actions.
 *
 * Wraps every admin endpoint shipped in D1i / D1j / D1k. All routes
 * are guarded BE-side by `JwtAuthGuard + IsAdminGuard`. Mutations
 * accept an optional `Idempotency-Key` so the FE can dedup retries.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  AdminApproveRefundPayload,
  AdminCouponListQuery,
  AdminCreateCouponPayload,
  AdminCreateCustomPlanPayload,
  AdminDirectRefundPayload,
  AdminExtendPeriodPayload,
  AdminForceCancelPayload,
  AdminGrantSubscriptionPayload,
  AdminIssuePaymentLinkPayload,
  AdminManualPaymentPayload,
  AdminOverrideEntitlementsPayload,
  AdminPausePayload,
  AdminPaymentLinkListQuery,
  AdminPaymentLinkListResponse,
  AdminPaymentLinkResult,
  AdminRejectRefundPayload,
  AdminResumePayload,
  AdminUpdateCouponPayload,
  AdminUpdateCustomPlanPayload,
  AuditLogQuery,
  AuditLogResponse,
  BillingAuditEntry,
  BillingPolicy,
  Coupon,
  CouponAttribution,
  CouponRedemptionStats,
  CreateMandatePayload,
  CreateMandateResponse,
  PlanWithBilling,
  RefundPolicy,
  RefundRequest,
  Subscription,
} from '@/types';

const E = ApiEndpoints.adminBilling;

const idem = (key?: string) => (key ? { headers: { 'Idempotency-Key': key } } : undefined);

// ── Subscription operations ────────────────────────────────────────
export async function adminGrantSubscription(payload: AdminGrantSubscriptionPayload, key?: string) {
  const http = await serverHttp();
  return http.post(E.grant, payload, idem(key)).then(unwrapServer<Subscription>);
}

export async function adminListUserSubscriptions(userId: string) {
  const http = await serverHttp();
  return http.get(E.listUserSubscriptions(userId)).then(unwrapServer<Subscription[]>);
}

export async function adminFetchSubscription(id: string) {
  const http = await serverHttp();
  return http.get(E.fetchSubscription(id)).then(unwrapServer<Subscription>);
}

export async function adminExtendPeriod(
  subscriptionId: string,
  payload: AdminExtendPeriodPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.extendPeriod(subscriptionId), payload, idem(key))
    .then(unwrapServer<Subscription>);
}

export async function adminOverrideEntitlements(
  subscriptionId: string,
  payload: AdminOverrideEntitlementsPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.overrideEntitlements(subscriptionId), payload, idem(key))
    .then(unwrapServer<Subscription>);
}

export async function adminPauseSubscription(
  subscriptionId: string,
  payload: AdminPausePayload = {},
  key?: string,
) {
  const http = await serverHttp();
  return http.post(E.pause(subscriptionId), payload, idem(key)).then(unwrapServer<Subscription>);
}

export async function adminResumeSubscription(
  subscriptionId: string,
  payload: AdminResumePayload = {},
  key?: string,
) {
  const http = await serverHttp();
  return http.post(E.resume(subscriptionId), payload, idem(key)).then(unwrapServer<Subscription>);
}

export async function adminForceCancelSubscription(
  subscriptionId: string,
  payload: AdminForceCancelPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.forceCancel(subscriptionId), payload, idem(key))
    .then(unwrapServer<Subscription>);
}

// ── Manual payment + payment links ────────────────────────────────
export async function adminRecordManualPayment(payload: AdminManualPaymentPayload, key?: string) {
  const http = await serverHttp();
  return http
    .post(E.manualPayment, payload, idem(key))
    .then(unwrapServer<{ subscription: Subscription; payment: unknown }>);
}

export async function adminIssuePaymentLink(payload: AdminIssuePaymentLinkPayload, key?: string) {
  const http = await serverHttp();
  return http.post(E.paymentLinks, payload, idem(key)).then(unwrapServer<AdminPaymentLinkResult>);
}

export async function adminListPaymentLinks(query: AdminPaymentLinkListQuery = {}) {
  const http = await serverHttp();
  return http
    .get(E.paymentLinks, { params: query })
    .then(unwrapServer<AdminPaymentLinkListResponse>);
}

export async function adminCancelPaymentLink(paymentId: string, key?: string) {
  const http = await serverHttp();
  return http
    .post(E.cancelPaymentLink(paymentId), {}, idem(key))
    .then(unwrapServer<{ paymentId: string; status: string }>);
}

// ── Refund queue ──────────────────────────────────────────────────
export async function adminListPendingRefunds(query: { limit?: number; offset?: number } = {}) {
  const http = await serverHttp();
  return http.get(E.refundsPending, { params: query }).then(unwrapServer<RefundRequest[]>);
}

export async function adminApproveRefund(
  id: string,
  payload: AdminApproveRefundPayload = {},
  key?: string,
) {
  const http = await serverHttp();
  return http.post(E.approveRefund(id), payload, idem(key)).then(unwrapServer<RefundRequest>);
}

export async function adminRejectRefund(
  id: string,
  payload: AdminRejectRefundPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http.post(E.rejectRefund(id), payload, idem(key)).then(unwrapServer<RefundRequest>);
}

export async function adminDirectRefund(
  paymentId: string,
  payload: AdminDirectRefundPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http.post(E.directRefund(paymentId), payload, idem(key)).then(unwrapServer<RefundRequest>);
}

export async function adminRegenerateInvoice(paymentId: string, key?: string) {
  const http = await serverHttp();
  return http
    .post(E.regenerateInvoice(paymentId), {}, idem(key))
    .then(unwrapServer<{ invoiceNumber: string; invoiceGeneratedAt?: string }>);
}

// ── Coupons ───────────────────────────────────────────────────────
export async function adminCreateCoupon(payload: AdminCreateCouponPayload, key?: string) {
  const http = await serverHttp();
  return http.post(E.coupons, payload, idem(key)).then(unwrapServer<Coupon>);
}

export async function adminListCoupons(query: AdminCouponListQuery = {}) {
  const http = await serverHttp();
  return http
    .get(E.coupons, { params: query })
    .then(unwrapServer<{ items: Coupon[]; total: number; limit: number; offset: number }>);
}

export async function adminFetchCoupon(id: string) {
  const http = await serverHttp();
  return http.get(E.couponDetail(id)).then(unwrapServer<Coupon>);
}

export async function adminUpdateCoupon(
  id: string,
  payload: AdminUpdateCouponPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http.patch(E.couponDetail(id), payload, idem(key)).then(unwrapServer<Coupon>);
}

export async function adminArchiveCoupon(id: string) {
  const http = await serverHttp();
  return http.delete(E.couponDetail(id)).then(unwrapServer<Coupon>);
}

export async function adminCouponStats(id: string) {
  const http = await serverHttp();
  return http.get(E.couponStats(id)).then(unwrapServer<CouponRedemptionStats>);
}

export async function adminCouponAttribution(id: string) {
  const http = await serverHttp();
  return http.get(E.couponAttribution(id)).then(unwrapServer<CouponAttribution>);
}

// ── Policies ──────────────────────────────────────────────────────
export async function adminGetBillingPolicy() {
  const http = await serverHttp();
  return http.get(E.billingPolicy).then(unwrapServer<BillingPolicy>);
}

export async function adminUpdateBillingPolicy(payload: BillingPolicy, key?: string) {
  const http = await serverHttp();
  return http.patch(E.billingPolicy, payload, idem(key)).then(unwrapServer<BillingPolicy>);
}

export async function adminGetRefundPolicy() {
  const http = await serverHttp();
  return http.get(E.refundPolicy).then(unwrapServer<RefundPolicy>);
}

export async function adminUpdateRefundPolicy(payload: RefundPolicy, key?: string) {
  const http = await serverHttp();
  return http.patch(E.refundPolicy, payload, idem(key)).then(unwrapServer<RefundPolicy>);
}

// ── Audit log ─────────────────────────────────────────────────────
export async function adminQueryAuditLog(query: AuditLogQuery = {}) {
  const http = await serverHttp();
  const res = await http.get(E.auditQuery, { params: query });
  // BE returns either a paginated object or a plain array depending on
  // service shape - accept both.
  const body = unwrapServer<AuditLogResponse | BillingAuditEntry[]>(res);
  if (Array.isArray(body)) {
    return {
      items: body,
      total: body.length,
      limit: query.limit ?? body.length,
      offset: query.offset ?? 0,
    } satisfies AuditLogResponse;
  }
  return body;
}

// ── Custom plans (D1j) ────────────────────────────────────────────
export async function adminCreateCustomPlan(payload: AdminCreateCustomPlanPayload, key?: string) {
  const http = await serverHttp();
  return http.post(E.customPlans, payload, idem(key)).then(unwrapServer<PlanWithBilling>);
}

export async function adminListCustomPlans(
  query: {
    assignedUserId?: string;
    assignedWorkspaceId?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  } = {},
) {
  const http = await serverHttp();
  return http
    .get(E.customPlans, { params: query })
    .then(unwrapServer<{ items: PlanWithBilling[]; total: number; limit: number; offset: number }>);
}

export async function adminFetchCustomPlan(id: string) {
  const http = await serverHttp();
  return http.get(E.customPlanDetail(id)).then(unwrapServer<PlanWithBilling>);
}

export async function adminUpdateCustomPlan(
  id: string,
  payload: AdminUpdateCustomPlanPayload,
  key?: string,
) {
  const http = await serverHttp();
  return http.patch(E.customPlanDetail(id), payload, idem(key)).then(unwrapServer<PlanWithBilling>);
}

export async function adminArchiveCustomPlan(id: string) {
  const http = await serverHttp();
  return http.delete(E.customPlanDetail(id)).then(unwrapServer<PlanWithBilling>);
}

// ── Mandate admin-on-behalf ───────────────────────────────────────
export async function adminCreateMandate(
  payload: CreateMandatePayload & { userId: string },
  key?: string,
) {
  const http = await serverHttp();
  return http.post(E.mandateCreate, payload, idem(key)).then(unwrapServer<CreateMandateResponse>);
}

export async function adminCancelMandate(
  payload: { userId: string; cancelAtCycleEnd?: boolean },
  key?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.mandateCancel, payload, idem(key))
    .then(unwrapServer<{ subscriptionId: string; status: string; razorpaySubscriptionId: string }>);
}

export async function adminPauseMandate(
  payload: { userId: string; reason?: string },
  key?: string,
) {
  const http = await serverHttp();
  return http
    .post(E.mandatePause, payload, idem(key))
    .then(unwrapServer<{ subscriptionId: string; status: string; razorpaySubscriptionId: string }>);
}

export async function adminResumeMandate(payload: { userId: string }, key?: string) {
  const http = await serverHttp();
  return http
    .post(E.mandateResume, payload, idem(key))
    .then(unwrapServer<{ subscriptionId: string; status: string; razorpaySubscriptionId: string }>);
}
