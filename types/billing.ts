/**
 * D1 enterprise billing types - mirrors manekhr-backend
 * `src/modules/subscriptions/billing/*` DTOs and schemas.
 *
 * Paise = INR * 100 (integer). All money quoted in paise on the wire,
 * rendered as ₹ in UI (lib/money.ts).
 */

import type { Plan } from './index';

// ── Subscription extensions (D1 fields not yet in Subscription) ─────
export type BillingCycle = 'monthly' | 'yearly';
export type LifecycleCycle = BillingCycle | 'lifetime';

export type PaymentMode = 'one_time' | 'recurring';

export type SubscriptionPaymentStatus =
  | 'created'
  | 'authorised'
  | 'captured'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled';

export type SubscriptionStatusFull =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'trial'
  | 'superseded'
  | 'pending'
  | 'paused'
  | 'past_due'
  | 'grace_period';

// ── Pricing quote - mirror of BE billing.types.ts ───────────────────
export interface PriceQuote {
  planId: string;
  billingCycle: BillingCycle;
  basePricePaise: number;
  discountPaise: number;
  taxableBasePaise: number;
  gstPaise: number;
  gstRatePercent: number;
  totalPaise: number;
  sacCode: string;
  isPriceTaxInclusive: boolean;
  /**
   * Whether GST applies to this quote (mirrors backend Plan.gstEnabled). GST is
   * ON unless explicitly false; when false the backend returns zero GST. The
   * checkout reads this to decide whether to show the GST line at all.
   */
  gstEnabled?: boolean;
  appliedCouponCode?: string;
  appliedCouponId?: string;
}

// ── Coupons - mirror of BE Coupon schema ────────────────────────────
export type CouponType = 'percentage' | 'fixed_amount' | 'fixed_price';

export interface Coupon {
  _id: string;
  code: string;
  description?: string;
  discountType: CouponType;
  /** percentage 0..100 | fixed_amount paise | fixed_price paise */
  valueOrPaise: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number | null;
  maxRedemptionsPerUser?: number | null;
  redemptionsCount: number;
  isFirstTimeOnly: boolean;
  isStackable: boolean;
  applicablePlanIds: string[];
  applicableBillingCycles: string[];
  autoApplyCampaignKey?: string;
  isActive: boolean;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CouponRedemptionStats {
  couponId: string;
  totalRedemptions: number;
  totalDiscountPaise: number;
  uniqueUsers: number;
  lastRedeemedAt?: string;
}

export interface ResolvedCoupon {
  code: string;
  couponId: string;
  discountPaise: number;
  type: CouponType;
}

/**
 * Mirrors the response from `POST subscriptions/coupons/validate` and
 * `POST subscriptions/coupons/auto-apply`. `warnings` carry non-fatal
 * messages (e.g. "coupon stacked with another"). When no coupon
 * resolved (invalid / expired / over-cap), `resolved` is empty and
 * `warnings` explains why.
 */
export interface CouponValidationResult {
  resolved: ResolvedCoupon[];
  totalDiscountPaise: number;
  warnings: string[];
  baseQuote: PriceQuote;
  finalQuote: PriceQuote;
}

// ── Checkout (one-time) ─────────────────────────────────────────────
export interface CreateCheckoutPayload {
  planId: string;
  billingCycle: BillingCycle;
  couponCodes?: string[];
  autoApplyCampaignKey?: string;
}

/**
 * Mirrors `SubscriptionCheckoutService.createOrder` return shape.
 * Razorpay JS SDK consumes `orderId` + `keyId` + `amount` directly.
 */
export interface CreateCheckoutResponse {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planId: string;
  billingCycle: BillingCycle;
}

export interface ConfirmPaymentPayload {
  subscriptionPaymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** Mirrors `SubscriptionCheckoutService.confirmPayment` return shape. */
export interface ConfirmPaymentResponse {
  subscriptionId: string;
  paymentId: string;
  totalPaise: number;
  capturedAt: string;
}

// ── Mandate (recurring) ─────────────────────────────────────────────
export interface CreateMandatePayload {
  planId: string;
  billingCycle: BillingCycle;
  totalCount?: number;
  couponCodes?: string[];
  autoApplyCampaignKey?: string;
}

/** Mirrors `SubscriptionMandateService.createMandate` return shape. */
export interface CreateMandateResponse {
  shortUrl: string;
  razorpaySubscriptionId: string;
  subscriptionId: string;
  paymentId: string;
  keyId: string;
  amountPaise: number;
  totalCount: number;
}

// ── Payments + invoices ─────────────────────────────────────────────
export interface SubscriptionPaymentRefund {
  refundId: string;
  amountPaise: number;
  reason?: string;
  status: 'pending' | 'processed' | 'failed';
  initiatedAt: string;
  processedAt?: string;
  initiatedBy?: string;
}

export interface BillingSnapshot {
  recipientName?: string;
  recipientEmail?: string;
  recipientContact?: string;
  gstin?: string;
  businessName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  country?: string;
}

export interface SubscriptionPayment {
  _id: string;
  userId: string;
  subscriptionId?:
    | string
    | { _id: string; status: string; currentPeriodStart?: string; currentPeriodEnd?: string };
  planId:
    | string
    | { _id: string; name: string; tier: string; monthlyPrice: number; yearlyPrice: number };
  billingCycle: LifecycleCycle;
  paymentMode: PaymentMode;
  status: SubscriptionPaymentStatus;
  gateway: 'razorpay' | 'manual';
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  gatewaySubscriptionId?: string;
  gatewayPaymentLinkId?: string;
  planPricePaise: number;
  discountPaise: number;
  gstPaise: number;
  totalPaise: number;
  gstRatePercent: number;
  appliedCouponId?: string;
  appliedCouponCode?: string;
  manualReceiptNumber?: string;
  manualPaymentMethod?: string;
  manualPaymentDate?: string;
  manualNotes?: string;
  failureReason?: string;
  attemptNumber?: number;
  refunds: SubscriptionPaymentRefund[];
  invoiceNumber?: string;
  invoicePdfUrl?: string;
  invoiceGeneratedAt?: string;
  billingSnapshot?: BillingSnapshot;
  authorisedAt?: string;
  capturedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentsListQuery {
  status?: SubscriptionPaymentStatus;
  paymentMode?: PaymentMode;
  billingCycle?: LifecycleCycle;
  planId?: string;
  subscriptionId?: string;
  from?: string;
  to?: string;
  invoiceNumber?: string;
  hasInvoice?: boolean;
  limit?: number;
  offset?: number;
}

export interface PaymentsListResponse {
  items: SubscriptionPayment[];
  total: number;
  limit: number;
  offset: number;
}

export interface InvoiceMeta {
  invoiceNumber: string;
  invoiceGeneratedAt?: string;
  paymentId: string;
  totalPaise: number;
  gstPaise: number;
  pdfAvailable: boolean;
}

// ── Refunds ─────────────────────────────────────────────────────────
export type RefundStatus =
  | 'pending_admin'
  | 'approved'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'rejected'
  | 'cancelled';

export interface RefundRequest {
  _id: string;
  userId: string;
  subscriptionPaymentId: string;
  subscriptionId?: string;
  amountPaise: number;
  reason: string;
  status: RefundStatus;
  gatewayRefundId?: string;
  speed?: 'normal' | 'optimum';
  rejectedReason?: string;
  notes?: string;
  initiatedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  processedAt?: string;
  failedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RefundRequestPayload {
  /** Omit for full refund of the remaining balance. */
  amountPaise?: number;
  reason: string;
}

// ── Refund policy (read-only on FE for self-serve gating) ───────────
export interface RefundPolicyPublic {
  customerSelfServiceEnabled: boolean;
  eligibleWithinDays: number;
  allowPartial: boolean;
  reasons: string[];
  speed: 'normal' | 'optimum';
}

// ── Dunning - mirror of BE DunningService.getStatusForUser ──────────
export interface DunningStatus {
  subscriptionId: string;
  status: SubscriptionStatusFull;
  inDunning: boolean;
  inGracePeriod: boolean;
  gracePeriodUntil?: string;
  daysRemaining?: number;
  failedPaymentAttempts: number;
  isReadOnly: boolean;
  showContactSalesCta: boolean;
  salesContact?: { email?: string; phone?: string };
  paymentRecoveryUrl?: string;
}

// ── Billing profile (User.billingProfile) ───────────────────────────
export interface BillingProfile {
  gstin?: string;
  businessName?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  stateCode?: string;
  pincode?: string;
  country?: string;
}

// ── Razorpay JS SDK options (subset used by checkout) ───────────────
export interface RazorpayOpenOptions {
  key: string;
  amount?: number;
  currency?: 'INR';
  name?: string;
  description?: string;
  order_id?: string;
  subscription_id?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; escape?: boolean; confirm_close?: boolean };
  handler?: (response: RazorpayCheckoutSuccessResponse) => void;
}

export interface RazorpayCheckoutSuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id?: string;
  razorpay_signature?: string;
  razorpay_subscription_id?: string;
}

// ── Plan extensions used by D1 (additive, optional) ────────────────
export interface PlanD1Extensions {
  isPriceTaxInclusive?: boolean;
  gstRatePercent?: number;
  /**
   * Optional/configurable GST per plan (mirrors backend Plan.gstEnabled). GST
   * is ON unless explicitly false (undefined/true = ON). Carried through to the
   * public pricing mapping (selectPublicErpPlans) so plan cards only show a GST
   * note when enabled, and the checkout only line-items GST when enabled.
   */
  gstEnabled?: boolean;
  sacCode?: string;
  supportsAutoRenew?: boolean;
  supportsOneTime?: boolean;
  trialDurationDays?: number;
  trialCardRequired?: boolean;
  isCustom?: boolean;
  isPubliclyVisible?: boolean;
  razorpayPlanIdMonthly?: string;
  razorpayPlanIdYearly?: string;
  recurringTotalCountMonthly?: number;
  recurringTotalCountYearly?: number;
  // ── 1-year-term pricing model (drives the plan-card price block) ──────
  // The yearly term is paid EITHER upfront (one payment, optional discount)
  // OR in 0%-interest monthly installments. Backs PlanCard.tsx + the public
  // ErpPricingTable.tsx price block; both compute via lib/pricing.ts. Mirrors
  // backend Plan.upfrontDiscountPercent / installmentsEnabled / installmentMonths.
  /** Upfront-payment discount %, 0 = no discount (pay the full yearly price). */
  upfrontDiscountPercent?: number;
  /** Whether the 0% monthly-installment option is offered for this plan. */
  installmentsEnabled?: boolean;
  /** Installment count the yearly term is split into (default 12). */
  installmentMonths?: number;
}

export type PlanWithBilling = Plan & PlanD1Extensions;

// ────────────────────────────────────────────────────────────────────
// D3 - Admin billing DTOs (mirror of manekhr-backend/src/modules/
//   subscriptions/billing/dto/admin-billing.dto.ts + refund.dto.ts +
//   billing-policy.dto.ts + coupon.dto.ts)
// ────────────────────────────────────────────────────────────────────

// ── Subscription ops ────────────────────────────────────────────────
export interface AdminGrantSubscriptionPayload {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  durationDays?: number;
  reason: string;
}

export interface AdminExtendPeriodPayload {
  additionalDays: number;
  reason: string;
}

export interface AdminOverrideEntitlementsPayload {
  override: Record<string, unknown>;
  reason: string;
}

export interface AdminPausePayload {
  reason?: string;
  /** ISO date string */
  resumeAt?: string;
}

export interface AdminResumePayload {
  reason?: string;
}

export interface AdminForceCancelPayload {
  reason: string;
  immediate?: boolean;
}

export interface AdminManualPaymentPayload {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amountPaise: number;
  paymentMethod: 'cheque' | 'neft' | 'cash' | 'wire' | 'other';
  receiptNumber?: string;
  /** ISO date string */
  paymentDate?: string;
  notes?: string;
}

// ── Payment links ──────────────────────────────────────────────────
export interface AdminIssuePaymentLinkPayload {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amountOverridePaise?: number;
  reason?: string;
  /** Seconds until link expiry. Default 7 days BE-side. */
  expireInSeconds?: number;
}

export interface AdminPaymentLinkResult {
  paymentId: string;
  shortUrl: string;
  razorpayPaymentLinkId: string;
  amountPaise: number;
}

export interface AdminPaymentLinkListQuery {
  userId?: string;
  status?: 'created' | 'captured' | 'failed';
  limit?: number;
  offset?: number;
}

export interface AdminPaymentLinkListResponse {
  items: SubscriptionPayment[];
  total: number;
  limit: number;
  offset: number;
}

// ── Refund admin ───────────────────────────────────────────────────
export interface AdminApproveRefundPayload {
  speed?: 'normal' | 'optimum';
}

export interface AdminRejectRefundPayload {
  reason: string;
}

export interface AdminDirectRefundPayload {
  amountPaise?: number;
  reason: string;
  speed?: 'normal' | 'optimum';
  bypassWindow?: boolean;
}

// ── Coupon admin ───────────────────────────────────────────────────
export interface AdminCreateCouponPayload {
  code: string;
  description?: string;
  discountType: CouponType;
  valueOrPaise: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  maxRedemptionsPerUser?: number;
  isFirstTimeOnly?: boolean;
  isStackable?: boolean;
  applicablePlanIds?: string[];
  applicableBillingCycles?: string[];
  autoApplyCampaignKey?: string;
  isActive?: boolean;
}

export type AdminUpdateCouponPayload = Partial<Omit<AdminCreateCouponPayload, 'code'>>;

export interface AdminCouponListQuery {
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

// ── Policies ───────────────────────────────────────────────────────
/** Full BillingPolicy editable shape (admin). */
export interface BillingPolicy {
  failedPaymentRetry?: {
    maxAttempts?: number;
    retryIntervalDays?: number;
  };
  gracePeriod?: {
    durationDays?: number;
    readOnlyMode?: boolean;
    showContactSalesCta?: boolean;
  };
  trial?: {
    defaultDurationDays?: number;
    defaultCardRequired?: boolean;
    reminderEmailDaysBeforeEnd?: number;
  };
  /** D4 - marketing automation toggles. */
  marketing?: {
    sendTrialReminder?: boolean;
    sendRenewalNotice?: boolean;
    renewalNoticeDaysBeforeEnd?: number;
    sendWinBack?: boolean;
    winBackAfterDays?: number;
    sendAbandonedCheckout?: boolean;
    abandonedCheckoutAfterHours?: number;
  };
  salesContactPhone?: string;
  salesContactEmail?: string;
}

/** D4 - coupon revenue attribution from `GET /admin/billing/coupons/:id/attribution`. */
export interface CouponAttribution {
  couponId: string;
  code: string;
  campaignKey?: string;
  grossRevenuePaise: number;
  discountGivenPaise: number;
  refundedPaise: number;
  netRevenuePaise: number;
  paidConversions: number;
  perCycleBreakdown: Record<string, { count: number; revenuePaise: number }>;
}

/** Full RefundPolicy editable shape (admin). Public read uses RefundPolicyPublic. */
export interface RefundPolicy {
  customerSelfServiceEnabled?: boolean;
  eligibleWithinDays?: number;
  allowPartial?: boolean;
  requireSecondAdminApprovalAfterWindow?: boolean;
  autoDowngradeOnFullRefund?: boolean;
  reasons?: string[];
  speed?: 'normal' | 'optimum';
}

// ── Audit log ──────────────────────────────────────────────────────
export type AuditActorType = 'admin' | 'self' | 'system' | 'webhook';

export interface BillingAuditEntry {
  _id: string;
  action: string;
  actorType: AuditActorType;
  actorUserId?: string;
  targetUserId?: string;
  subscriptionId?: string;
  paymentId?: string;
  refundRequestId?: string;
  planId?: string;
  couponId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  occurredAt: string;
}

export interface AuditLogQuery {
  actorUserId?: string;
  targetUserId?: string;
  subscriptionId?: string;
  paymentId?: string;
  action?: string;
  actorType?: AuditActorType;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogResponse {
  items: BillingAuditEntry[];
  total: number;
  limit: number;
  offset: number;
}

// ── Custom plan admin ──────────────────────────────────────────────
export interface AdminCreateCustomPlanPayload {
  name: string;
  tier: string;
  monthlyPrice: number;
  yearlyPrice: number;
  assignedUserId?: string;
  assignedWorkspaceId?: string;
  description?: string;
  entitlements?: Record<string, unknown>;
  trialDurationDays?: number;
  trialCardRequired?: boolean;
  isPriceTaxInclusive?: boolean;
  gstRatePercent?: number;
  /** Optional/configurable GST on the custom plan (default ON). Mirrors backend. */
  gstEnabled?: boolean;
  sacCode?: string;
  supportsAutoRenew?: boolean;
  supportsOneTime?: boolean;
  recurringTotalCountMonthly?: number;
  recurringTotalCountYearly?: number;
}

export type AdminUpdateCustomPlanPayload = Partial<
  Omit<AdminCreateCustomPlanPayload, 'tier' | 'assignedUserId' | 'assignedWorkspaceId'>
> & {
  isActive?: boolean;
};
