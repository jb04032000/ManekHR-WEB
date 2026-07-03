'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { JournalVoucher, JournalVoucherType } from '@/types';

const EJ = ApiEndpoints.finance.journalVouchers;
const EC = ApiEndpoints.finance.contras;

// ===== Input types =====

export interface JournalVoucherLineInput {
  accountId: string;
  debitPaise: number;
  creditPaise: number;
  partyId?: string;
  costCentre?: string;
  note?: string;
}

export interface CreateJournalVoucherInput {
  voucherDate: string;
  narration: string;
  lines: JournalVoucherLineInput[];
  reference?: string;
}

export interface CreateContraVoucherInput {
  voucherDate: string;
  fromAccountId: string;
  toAccountId: string;
  amountPaise: number;
  fromCashRegisterId?: string;
  toCashRegisterId?: string;
  narration: string;
}

export interface ListJournalVouchersFilters {
  voucherType?: JournalVoucherType;
  state?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// ===== Journal Voucher actions =====

export async function listJournalVouchers(
  wsId: string,
  firmId: string,
  filters?: ListJournalVouchersFilters,
): Promise<{ items: JournalVoucher[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(EJ.list(wsId, firmId), { params: filters });
  return unwrapServer<{ items: JournalVoucher[]; total: number }>(res);
}

export async function getJournalVoucher(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JournalVoucher> {
  const http = await serverHttp();
  const res = await http.get(EJ.get(wsId, firmId, id));
  return unwrapServer<JournalVoucher>(res);
}

export async function createJournalVoucher(
  wsId: string,
  firmId: string,
  dto: CreateJournalVoucherInput,
): Promise<JournalVoucher> {
  const http = await serverHttp();
  const res = await http.post(EJ.create(wsId, firmId), dto);
  return unwrapServer<JournalVoucher>(res);
}

export async function postJournalVoucher(
  wsId: string,
  firmId: string,
  id: string,
): Promise<JournalVoucher> {
  const http = await serverHttp();
  const res = await http.post(EJ.post(wsId, firmId, id), {});
  return unwrapServer<JournalVoucher>(res);
}

export async function cancelJournalVoucher(
  wsId: string,
  firmId: string,
  id: string,
  reason: string,
): Promise<JournalVoucher> {
  const http = await serverHttp();
  const res = await http.post(EJ.cancel(wsId, firmId, id), { reason });
  return unwrapServer<JournalVoucher>(res);
}

// ===== Contra Voucher actions =====

export async function listContras(
  wsId: string,
  firmId: string,
  filters?: { state?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number },
): Promise<{ items: JournalVoucher[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(EC.list(wsId, firmId), { params: filters });
  return unwrapServer<{ items: JournalVoucher[]; total: number }>(res);
}

export async function getContra(wsId: string, firmId: string, id: string): Promise<JournalVoucher> {
  const http = await serverHttp();
  const res = await http.get(EC.get(wsId, firmId, id));
  return unwrapServer<JournalVoucher>(res);
}

/** Single create+post action - Contra voucher is always posted immediately. */
export async function createContra(
  wsId: string,
  firmId: string,
  dto: CreateContraVoucherInput,
): Promise<JournalVoucher> {
  const http = await serverHttp();
  const res = await http.post(EC.create(wsId, firmId), dto);
  return unwrapServer<JournalVoucher>(res);
}
