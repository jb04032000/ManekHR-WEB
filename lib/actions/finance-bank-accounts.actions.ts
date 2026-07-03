'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { FinanceBankAccount } from '@/types';

const E = ApiEndpoints.finance.bankAccounts;

// ===== Input types =====

export interface CreateBankAccountInput {
  name: string;
  bankName: string;
  accountType: 'current' | 'savings' | 'overdraft' | 'cash_credit';
  accountNumber: string;
  ifscCode: string;
  openingBalancePaise: number;
  openingBalanceDate: string;
  upiId?: string;
  isDefault?: boolean;
}

export interface UpdateBankAccountInput {
  name?: string;
  bankName?: string;
  accountType?: 'current' | 'savings' | 'overdraft' | 'cash_credit';
  ifscCode?: string;
  upiId?: string;
  isDefault?: boolean;
}

export interface ListBankAccountsFilters {
  accountType?: string;
  activeOnly?: boolean;
}

export interface BankStatementFilters {
  fromDate?: string;
  toDate?: string;
}

export interface BankStatementRow {
  date: string;
  voucherNo: string;
  sourceType: string;
  particulars: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
}

export interface BankStatementResult {
  account: FinanceBankAccount;
  rows: BankStatementRow[];
  openingBalancePaise: number;
  closingBalancePaise: number;
  fromDate: string;
  toDate: string;
}

// ===== Actions =====

export async function listBankAccounts(
  wsId: string,
  firmId: string,
  filters?: ListBankAccountsFilters,
): Promise<FinanceBankAccount[]> {
  const http = await serverHttp();
  const res = await http.get(E.list(wsId, firmId), { params: filters });
  return unwrapServer<FinanceBankAccount[]>(res);
}

export async function getBankAccount(
  wsId: string,
  firmId: string,
  id: string,
): Promise<FinanceBankAccount> {
  const http = await serverHttp();
  const res = await http.get(E.get(wsId, firmId, id));
  return unwrapServer<FinanceBankAccount>(res);
}

export async function createBankAccount(
  wsId: string,
  firmId: string,
  dto: CreateBankAccountInput,
): Promise<FinanceBankAccount> {
  const http = await serverHttp();
  const res = await http.post(E.create(wsId, firmId), dto);
  return unwrapServer<FinanceBankAccount>(res);
}

export async function updateBankAccount(
  wsId: string,
  firmId: string,
  id: string,
  dto: UpdateBankAccountInput,
): Promise<FinanceBankAccount> {
  const http = await serverHttp();
  const res = await http.patch(E.update(wsId, firmId, id), dto);
  return unwrapServer<FinanceBankAccount>(res);
}

export async function deleteBankAccount(
  wsId: string,
  firmId: string,
  id: string,
): Promise<void> {
  const http = await serverHttp();
  await http.delete(E.delete(wsId, firmId, id));
}

export async function getBankStatement(
  wsId: string,
  firmId: string,
  id: string,
  filters?: BankStatementFilters,
): Promise<BankStatementResult> {
  const http = await serverHttp();
  const res = await http.get(E.statement(wsId, firmId, id), { params: filters });
  return unwrapServer<BankStatementResult>(res);
}

export async function setDefaultBankAccount(
  wsId: string,
  firmId: string,
  id: string,
): Promise<FinanceBankAccount> {
  const http = await serverHttp();
  const res = await http.patch(E.update(wsId, firmId, id), { isDefault: true });
  return unwrapServer<FinanceBankAccount>(res);
}

export async function getDefaultBankAccount(
  wsId: string,
  firmId: string,
): Promise<FinanceBankAccount | null> {
  try {
    const http = await serverHttp();
    const res = await http.get(E.getDefault(wsId, firmId));
    return unwrapServer<FinanceBankAccount>(res);
  } catch {
    return null;
  }
}
