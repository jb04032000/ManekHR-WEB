import type { Account } from '@/types';

/**
 * Options for a "Cash / Bank account" picker. The value is the chart-of-accounts
 * CODE because the backend resolves the posting account via findByCode
 * (e.g. asset disposal proceeds, contra vouchers).
 */
export interface CashBankAccountOption {
  value: string;
  label: string;
}

/**
 * A cash/bank account is an ASSET sitting under a Cash/Bank subgroup. Keying off
 * the subgroup (not a hardcoded code list) keeps this correct for any firm's
 * chart of accounts and excludes look-alikes such as "Sundry Debtors" (a
 * receivable), "Bank Charges" (an expense) and "Loan from Bank" (a liability).
 */
export function isCashBankAccount(account: Account): boolean {
  return account.type === 'asset' && /cash|bank/i.test(account.subGroup ?? '');
}

/** Live cash/bank accounts mapped to "<code> - <name>" picker options. */
export function buildCashBankAccountOptions(accounts: Account[]): CashBankAccountOption[] {
  return accounts
    .filter((a) => !a.isDeleted && isCashBankAccount(a))
    .map((a) => ({ value: a.code, label: `${a.code} - ${a.name}` }));
}
