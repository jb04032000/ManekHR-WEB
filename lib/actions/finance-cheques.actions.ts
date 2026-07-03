'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { FinanceCheque } from '@/types';

const E = ApiEndpoints.finance.cheques;

// ===== Input types =====

export interface CreateChequeInput {
  chequeType: 'issued' | 'received';
  chequeNumber: string;
  chequeDate: string;
  bankAccountId: string;
  amount: number; // in paise
  partyId?: string;
  partyName?: string;
  sourceVoucherId?: string;
  narration?: string;
}

export interface ListChequesFilters {
  chequeType?: 'issued' | 'received';
  status?: string;
  bankAccountId?: string;
  partyId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface DepositChequeInput {
  depositDate: string;
}

export interface ClearChequeInput {
  clearingDate: string;
  narration?: string;
}

export interface BounceChequeInput {
  bounceDate: string;
  bounceReason: string;
  ourBankChargePaise?: number;
  partyChargePaise?: number;
}

export interface StopPaymentInput {
  narration: string;
}

// ===== Actions =====

export async function listCheques(
  wsId: string,
  firmId: string,
  filters?: ListChequesFilters,
): Promise<{ items: FinanceCheque[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(E.list(wsId, firmId), { params: filters });
  return unwrapServer<{ items: FinanceCheque[]; total: number }>(res);
}

export async function getCheque(wsId: string, firmId: string, id: string): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.get(E.get(wsId, firmId, id));
  return unwrapServer<FinanceCheque>(res);
}

export async function createCheque(
  wsId: string,
  firmId: string,
  dto: CreateChequeInput,
): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.create(wsId, firmId), dto);
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Mark a received cheque as deposited (pending_maturity → in_transit).
 */
export async function depositCheque(
  wsId: string,
  firmId: string,
  id: string,
  dto: DepositChequeInput,
): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.deposit(wsId, firmId, id), dto);
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Mark an issued cheque as presented (pending_maturity → in_transit).
 * Uses the same backend deposit endpoint - the backend checks chequeType.
 */
export async function presentCheque(
  wsId: string,
  firmId: string,
  id: string,
  dto: DepositChequeInput,
): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.present(wsId, firmId, id), dto);
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Mark a cheque as cleared (posts ledger entry, updates bank balance).
 */
export async function clearCheque(
  wsId: string,
  firmId: string,
  id: string,
  dto: ClearChequeInput,
): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.clear(wsId, firmId, id), dto);
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Mark a cheque as bounced (posts reversal + bounce charges).
 */
export async function bounceCheque(
  wsId: string,
  firmId: string,
  id: string,
  dto: BounceChequeInput,
): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.bounce(wsId, firmId, id), dto);
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Stop payment on an issued cheque (pending_maturity → stopped).
 */
export async function stopPayment(
  wsId: string,
  firmId: string,
  id: string,
  dto: StopPaymentInput,
): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.stop(wsId, firmId, id), dto);
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Void a cheque (data entry correction - pending_maturity → void).
 */
export async function voidCheque(wsId: string, firmId: string, id: string): Promise<FinanceCheque> {
  const http = await serverHttp();
  const res = await http.post(E.voidCheque(wsId, firmId, id), {});
  return unwrapServer<FinanceCheque>(res);
}

/**
 * Get cheques that will mature within the next `days` days.
 * Used by PdcMaturityBanner.
 */
export async function getPdcMaturityAlerts(
  wsId: string,
  firmId: string,
  days: number = 7,
): Promise<FinanceCheque[]> {
  const http = await serverHttp();
  const res = await http.get(E.list(wsId, firmId), {
    params: {
      status: 'pending_maturity',
      dateFrom: new Date().toISOString().split('T')[0],
      dateTo: new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0],
    },
  });
  const data = unwrapServer<{ items: FinanceCheque[]; total: number }>(res);
  return data.items;
}
