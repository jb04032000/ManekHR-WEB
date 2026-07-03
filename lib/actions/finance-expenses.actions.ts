'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type {
  ExpenseVoucher,
  ExpenseVoucherLine,
  ItcEligibility,
  ExpensePaymentMode,
} from '@/types';

const E = ApiEndpoints.finance.expenses;

// ===== Input types =====

export interface CreateExpenseLineInput {
  expenseAccountId: string;
  description?: string;
  amountPaise: number;
  gstRate?: number;
  itcEligibility: ItcEligibility;
  costCentre?: string;
}

export interface CreateExpenseVoucherInput {
  voucherDate: string;
  partyId?: string;
  paymentMode: ExpensePaymentMode;
  cashRegisterId?: string;
  bankAccountId?: string;
  chequeId?: string;
  utrReference?: string;
  isIntraState: boolean;
  placeOfSupplyStateCode?: string;
  narration: string;
  lineItems: CreateExpenseLineInput[];
}

export interface ListExpensesFilters {
  state?: string;
  dateFrom?: string;
  dateTo?: string;
  partyId?: string;
  page?: number;
  limit?: number;
}

// ===== Actions =====

export async function listExpenses(
  wsId: string,
  firmId: string,
  filters?: ListExpensesFilters,
): Promise<{ items: ExpenseVoucher[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(E.list(wsId, firmId), { params: filters });
  return unwrapServer<{ items: ExpenseVoucher[]; total: number }>(res);
}

export async function getExpense(
  wsId: string,
  firmId: string,
  id: string,
): Promise<ExpenseVoucher> {
  const http = await serverHttp();
  const res = await http.get(E.get(wsId, firmId, id));
  return unwrapServer<ExpenseVoucher>(res);
}

export async function createExpense(
  wsId: string,
  firmId: string,
  dto: CreateExpenseVoucherInput,
): Promise<ExpenseVoucher> {
  const http = await serverHttp();
  const res = await http.post(E.create(wsId, firmId), dto);
  return unwrapServer<ExpenseVoucher>(res);
}

export async function updateExpense(
  wsId: string,
  firmId: string,
  id: string,
  dto: Partial<CreateExpenseVoucherInput>,
): Promise<ExpenseVoucher> {
  const http = await serverHttp();
  const res = await http.patch(E.update(wsId, firmId, id), dto);
  return unwrapServer<ExpenseVoucher>(res);
}

export async function postExpense(
  wsId: string,
  firmId: string,
  id: string,
): Promise<ExpenseVoucher> {
  const http = await serverHttp();
  const res = await http.post(E.post(wsId, firmId, id), {});
  return unwrapServer<ExpenseVoucher>(res);
}

export async function cancelExpense(
  wsId: string,
  firmId: string,
  id: string,
  reason: string,
): Promise<ExpenseVoucher> {
  const http = await serverHttp();
  const res = await http.post(E.cancel(wsId, firmId, id), { reason });
  return unwrapServer<ExpenseVoucher>(res);
}
