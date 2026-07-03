'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  AddOnDefinition,
  PurchasedAddOn,
  AddOnPreview,
  PurchaseAddOnPayload,
  AdminAssignAddOnPayload,
  PlanEntitlements,
} from '@/types';

export async function getAvailableAddOns(): Promise<AddOnDefinition[]> {
  const http = await serverHttp();
  return http.get(ApiEndpoints.addOns.list).then(unwrapServer<AddOnDefinition[]>);
}

export async function getMyAddOns(): Promise<PurchasedAddOn[]> {
  const http = await serverHttp();
  return http.get(ApiEndpoints.addOns.my).then(unwrapServer<PurchasedAddOn[]>);
}

export async function previewAddOnPurchase(payload: PurchaseAddOnPayload): Promise<AddOnPreview> {
  const http = await serverHttp();
  return http.post(ApiEndpoints.addOns.preview, payload).then(unwrapServer<AddOnPreview>);
}

export async function purchaseAddOn(
  payload: PurchaseAddOnPayload,
): Promise<{ purchasedAddOn: PurchasedAddOn; appliedEntitlements: PlanEntitlements }> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.addOns.purchase, payload)
    .then(unwrapServer<{ purchasedAddOn: PurchasedAddOn; appliedEntitlements: PlanEntitlements }>);
}

export async function cancelAddOn(
  addOnId: string,
  reason?: string,
): Promise<{ appliedEntitlements: PlanEntitlements }> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.addOns.cancel(addOnId), { reason })
    .then(unwrapServer<{ appliedEntitlements: PlanEntitlements }>);
}

export async function getAddOnDefinitions(): Promise<AddOnDefinition[]> {
  const http = await serverHttp();
  return http.get(ApiEndpoints.admin.addOnDefinitions).then(unwrapServer<AddOnDefinition[]>);
}

export async function createAddOnDefinition(
  payload: Partial<AddOnDefinition>,
): Promise<AddOnDefinition> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.admin.addOnDefinitions, payload)
    .then(unwrapServer<AddOnDefinition>);
}

export async function updateAddOnDefinition(
  id: string,
  payload: Partial<AddOnDefinition>,
): Promise<AddOnDefinition> {
  const http = await serverHttp();
  return http
    .patch(ApiEndpoints.admin.updateAddOnDefinition(id), payload)
    .then(unwrapServer<AddOnDefinition>);
}

export async function deleteAddOnDefinition(id: string): Promise<void> {
  const http = await serverHttp();
  return http.delete(ApiEndpoints.admin.deleteAddOnDefinition(id)).then(unwrapServer<void>);
}

export async function getUserAddOns(userId: string): Promise<PurchasedAddOn[]> {
  const http = await serverHttp();
  return http.get(ApiEndpoints.admin.userAddOns(userId)).then(unwrapServer<PurchasedAddOn[]>);
}

export async function adminAssignAddOn(payload: AdminAssignAddOnPayload): Promise<PurchasedAddOn> {
  const http = await serverHttp();
  return http.post(ApiEndpoints.admin.assignAddOn, payload).then(unwrapServer<PurchasedAddOn>);
}

export async function adminRevokeAddOn(addOnId: string): Promise<void> {
  const http = await serverHttp();
  return http.delete(ApiEndpoints.admin.revokeAddOn(addOnId)).then(unwrapServer<void>);
}

// ── Wave 7 - credit-pack billing flow ───────────────────────────────────

export interface CreateCreditPackOrderPayload {
  addOnDefinitionId: string;
  quantity: number;
}

export interface CreditPackOrderResponse {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  creditPackPaymentId: string;
  addOnDefinitionId: string;
  quantity: number;
}

export interface ConfirmCreditPackPaymentPayload {
  creditPackPaymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface CreditPackConfirmResponse {
  creditPackPaymentId: string;
  purchasedAddOnId: string;
  smsBalance: number;
  whatsappBalance: number;
}

export interface CreditPackPaymentRecord {
  _id: string;
  status: string;
  amountPaise: number;
  quantity: number;
  capturedAt?: string;
  activatedAt?: string;
  createdAt: string;
  addOnDefinitionId: AddOnDefinition | string;
}

export interface AutoRechargeConfigPayload {
  autoRechargeEnabled?: boolean;
  autoRechargeThresholdSms?: number;
  autoRechargeThresholdWhatsapp?: number;
  autoRechargeSmsPackSlug?: string;
  autoRechargeWhatsappPackSlug?: string;
}

export interface AutoRechargeConfigResponse {
  communications: {
    smsCreditsBalance?: number;
    whatsappCreditsBalance?: number;
    autoRechargeEnabled?: boolean;
    autoRechargeThresholdSms?: number;
    autoRechargeThresholdWhatsapp?: number;
    autoRechargeSmsPackSlug?: string;
    autoRechargeWhatsappPackSlug?: string;
  };
}

const idemHeader = (key?: string) => (key ? { headers: { 'Idempotency-Key': key } } : undefined);

export async function createCreditPackOrder(
  payload: CreateCreditPackOrderPayload,
  idempotencyKey?: string,
): Promise<CreditPackOrderResponse> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.addOns.creditPackOrder, payload, idemHeader(idempotencyKey))
    .then(unwrapServer<CreditPackOrderResponse>);
}

export async function confirmCreditPackPayment(
  payload: ConfirmCreditPackPaymentPayload,
  idempotencyKey?: string,
): Promise<CreditPackConfirmResponse> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.addOns.creditPackConfirm, payload, idemHeader(idempotencyKey))
    .then(unwrapServer<CreditPackConfirmResponse>);
}

export async function getCreditPackHistory(): Promise<CreditPackPaymentRecord[]> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.addOns.creditPackHistory)
    .then(unwrapServer<CreditPackPaymentRecord[]>);
}

export async function updateAutoRechargeConfig(
  payload: AutoRechargeConfigPayload,
): Promise<AutoRechargeConfigResponse> {
  const http = await serverHttp();
  return http
    .patch(ApiEndpoints.addOns.autoRecharge, payload)
    .then(unwrapServer<AutoRechargeConfigResponse>);
}
