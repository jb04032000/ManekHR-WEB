'use server';

import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { LoanAccount, LoanScheduleEntry } from '@/types';

const E = ApiEndpoints.finance.loans;

// ===== Input / preview types =====

export interface CreateLoanInput {
  name: string;
  lenderName: string;
  lenderPartyId?: string;
  loanType: 'term_loan' | 'overdraft' | 'cash_credit';
  sanctionedAmountPaise: number;
  disbursedAmountPaise: number;
  disbursementDate: string;
  interestRateAnnual: number;
  tenureMonths: number;
  repaymentStartDate: string;
  processingFeePaise?: number;
  coaLiabilityAccountId: string;
  coaLiabilityAccountCode: string;
}

export interface ListLoansFilters {
  status?: string;
  loanType?: string;
  page?: number;
  limit?: number;
}

export interface PreviewScheduleInput {
  sanctionedAmountPaise: number;
  interestRateAnnual: number;
  tenureMonths: number;
  repaymentStartDate: string;
}

export interface ScheduleRowPreview {
  monthIndex: number;
  month: string;
  openingPrincipalPaise: number;
  emiAmountPaise: number;
  principalComponentPaise: number;
  interestComponentPaise: number;
  closingPrincipalPaise: number;
}

export interface PrepayLoanInput {
  amountPaise: number;
  prepaymentDate: string;
  bankCoaCode: string;
  narration?: string;
}

// ===== Actions =====

export async function listLoans(
  wsId: string,
  firmId: string,
  filters?: ListLoansFilters,
): Promise<{ items: LoanAccount[]; total: number }> {
  const http = await serverHttp();
  const res = await http.get(E.list(wsId, firmId), { params: filters });
  return unwrapServer<{ items: LoanAccount[]; total: number }>(res);
}

export async function getLoan(wsId: string, firmId: string, id: string): Promise<LoanAccount> {
  const http = await serverHttp();
  const res = await http.get(E.get(wsId, firmId, id));
  return unwrapServer<LoanAccount>(res);
}

export async function createLoan(
  wsId: string,
  firmId: string,
  dto: CreateLoanInput,
): Promise<LoanAccount> {
  const http = await serverHttp();
  const res = await http.post(E.create(wsId, firmId), dto);
  return unwrapServer<LoanAccount>(res);
}

export async function getLoanSchedule(
  wsId: string,
  firmId: string,
  id: string,
): Promise<LoanScheduleEntry[]> {
  const http = await serverHttp();
  const res = await http.get(E.schedule(wsId, firmId, id));
  return unwrapServer<LoanScheduleEntry[]>(res);
}

/**
 * Preview amortisation schedule without persisting - used by LoanForm live preview.
 */
export async function previewLoanSchedule(
  wsId: string,
  firmId: string,
  dto: PreviewScheduleInput,
): Promise<ScheduleRowPreview[]> {
  const http = await serverHttp();
  const res = await http.post(E.previewSchedule(wsId, firmId), dto);
  return unwrapServer<ScheduleRowPreview[]>(res);
}

/**
 * Record a loan prepayment - reduces principal, recomputes schedule (preserve EMI, shorten tenure).
 */
export async function prepayLoan(
  wsId: string,
  firmId: string,
  id: string,
  dto: PrepayLoanInput,
): Promise<LoanAccount> {
  const http = await serverHttp();
  const res = await http.post(E.prepay(wsId, firmId, id), dto);
  return unwrapServer<LoanAccount>(res);
}

/**
 * Manually trigger EMI for the current calendar month.
 * Idempotent - returns { skipped: true } if already posted.
 */
export async function runEmiNow(
  wsId: string,
  firmId: string,
  id: string,
  bankCoaCode?: string,
): Promise<{ skipped?: boolean; ledgerEntryId?: string }> {
  const http = await serverHttp();
  const res = await http.post(E.runEmi(wsId, firmId, id), { bankCoaCode: bankCoaCode ?? '1002' });
  return unwrapServer<{ skipped?: boolean; ledgerEntryId?: string }>(res);
}

/**
 * Close a loan account (foreclosure or full_repayment).
 */
export async function closeLoan(
  wsId: string,
  firmId: string,
  id: string,
  closureType: 'foreclosure' | 'full_repayment',
): Promise<LoanAccount> {
  const http = await serverHttp();
  const res = await http.post(E.close(wsId, firmId, id), { closureType });
  return unwrapServer<LoanAccount>(res);
}

/**
 * Soft-delete a loan account (only allowed if no EMIs have been posted).
 */
export async function deleteLoan(wsId: string, firmId: string, id: string): Promise<void> {
  const http = await serverHttp();
  await http.delete(E.delete(wsId, firmId, id));
}
