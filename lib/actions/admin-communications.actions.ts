'use server';

/**
 * Wave 8 - admin-only MSG91 ops + cost reporting actions.
 *
 * Backed by `manekhr-backend/src/modules/sms/msg91-admin.controller.ts`.
 * All endpoints are guarded by JwtAuthGuard + AdminGuard server-side.
 */

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';

export interface Msg91BalanceStatus {
  balancePaise: number;
  polledAt: string | null;
  burn30dPaise: number;
  avgDailyBurnPaise: number;
  projectedZeroDate: string | null;
  alertLevel: 'ok' | 'warn' | 'alarm' | 'unknown';
}

export interface Msg91TopUpRecord {
  _id: string;
  provider: string;
  amountPaise: number;
  recordedBy: { _id: string; name?: string; email?: string } | string;
  providerReferenceId?: string;
  note?: string;
  createdAt: string;
}

export interface Msg91MarginRow {
  workspaceId: string;
  sentCount: number;
  creditsConsumed: number;
  providerCostPaise: number;
}

export interface Msg91RefundQueueRow {
  workspaceId: string;
  refundedCount: number;
  consumedCount: number;
  refundRatePct: number;
}

export async function getMsg91Balance(): Promise<Msg91BalanceStatus> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.msg91Balance)
    .then(unwrapServer<Msg91BalanceStatus>);
}

export async function recordMsg91TopUp(payload: {
  amountPaise: number;
  providerReferenceId?: string;
  note?: string;
}): Promise<Msg91TopUpRecord> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.adminCommunications.msg91TopUp, payload)
    .then(unwrapServer<Msg91TopUpRecord>);
}

export async function listMsg91TopUps(limit = 50): Promise<Msg91TopUpRecord[]> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.msg91TopUps, { params: { limit } })
    .then(unwrapServer<Msg91TopUpRecord[]>);
}

export async function getMsg91MarginReport(args: {
  from?: string;
  to?: string;
  limit?: number;
}): Promise<Msg91MarginRow[]> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.marginReport, { params: args })
    .then(unwrapServer<Msg91MarginRow[]>);
}

export async function getMsg91RefundQueue(): Promise<Msg91RefundQueueRow[]> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.refundQueue)
    .then(unwrapServer<Msg91RefundQueueRow[]>);
}

// ── Wave 8.2 - pricing CRUD ──────────────────────────────────────────

export interface Msg91PricingRow {
  _id: string;
  provider: 'msg91' | 'aisensy';
  channel: 'sms' | 'whatsapp';
  country: string;
  encoding: 'GSM7' | 'UCS2' | 'N/A';
  segments: number;
  costPaise: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  note?: string;
  createdAt: string;
}

export async function listMsg91Pricing(history = false): Promise<Msg91PricingRow[]> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.pricingList, {
      params: { history: history ? 'true' : 'false' },
    })
    .then(unwrapServer<Msg91PricingRow[]>);
}

export async function addMsg91PricingRow(payload: {
  provider: 'msg91' | 'aisensy';
  channel: 'sms' | 'whatsapp';
  encoding: 'GSM7' | 'UCS2' | 'N/A';
  segments: number;
  costPaise: number;
  country?: string;
  note?: string;
}): Promise<Msg91PricingRow> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.adminCommunications.pricingAdd, payload)
    .then(unwrapServer<Msg91PricingRow>);
}

export async function closeMsg91PricingRow(id: string): Promise<Msg91PricingRow> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.adminCommunications.pricingClose(id))
    .then(unwrapServer<Msg91PricingRow>);
}

// ── Wave 8.2 - marketing pool + bulk send ────────────────────────────

export interface MarketingPoolBalances {
  sms: number;
  whatsapp: number;
}

export interface MarketingLedgerRow {
  _id: string;
  channel: 'sms' | 'whatsapp';
  type: 'topup' | 'send' | 'adjustment';
  amount: number;
  balanceAfter: number;
  recordedBy?: { _id: string; name?: string; email?: string } | string;
  ref?: string;
  note?: string;
  campaignId?: string;
  createdAt: string;
}

export interface MarketingBulkSendResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  campaignId: string;
}

export async function getMarketingPools(): Promise<MarketingPoolBalances> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.marketingPools)
    .then(unwrapServer<MarketingPoolBalances>);
}

export async function topUpMarketingPool(payload: {
  channel: 'sms' | 'whatsapp';
  credits: number;
  ref?: string;
  note?: string;
}): Promise<{ balance: number }> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.adminCommunications.marketingTopUp, payload)
    .then(unwrapServer<{ balance: number }>);
}

export async function getMarketingLedger(
  channel?: 'sms' | 'whatsapp',
  limit = 50,
): Promise<MarketingLedgerRow[]> {
  const http = await serverHttp();
  return http
    .get(ApiEndpoints.adminCommunications.marketingLedger, {
      params: { channel, limit },
    })
    .then(unwrapServer<MarketingLedgerRow[]>);
}

export async function sendMarketingBulk(payload: {
  workspaceId: string;
  templateId: string;
  senderId?: string;
  recipients: string[];
  vars?: Record<string, string>;
  note?: string;
}): Promise<MarketingBulkSendResult> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.adminCommunications.marketingSendBulk, payload)
    .then(unwrapServer<MarketingBulkSendResult>);
}

export async function manualRefundMsg91(payload: {
  workspaceId: string;
  channel: 'sms' | 'whatsapp';
  n: number;
  reason: string;
}): Promise<{ refunded: boolean; newBalance: number }> {
  const http = await serverHttp();
  return http
    .post(ApiEndpoints.adminCommunications.manualRefund, payload)
    .then(unwrapServer<{ refunded: boolean; newBalance: number }>);
}
