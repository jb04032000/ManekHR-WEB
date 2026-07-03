import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildCashBankAccountOptions, isCashBankAccount } from './cash-bank-accounts';
import type { Account } from '@/types';

const acct = (over: Partial<Account>): Account =>
  ({
    _id: 'id-' + (over.code ?? 'x'),
    workspaceId: 'ws',
    firmId: 'firm',
    name: 'Account',
    code: '0000',
    type: 'asset',
    isFromTemplate: true,
    isSystem: false,
    isDeleted: false,
    createdAt: '2026-01-01',
    ...over,
  }) as Account;

describe('isCashBankAccount', () => {
  it('accepts asset accounts under a Cash & Bank subgroup', () => {
    assert.equal(
      isCashBankAccount(acct({ code: '1001', name: 'Cash', subGroup: 'Cash & Bank' })),
      true,
    );
    assert.equal(
      isCashBankAccount(acct({ code: '1002', name: 'Bank', subGroup: 'Cash & Bank' })),
      true,
    );
  });

  it('rejects Sundry Debtors (an asset, but a receivable - the bug the hardcoded 1003 caused)', () => {
    assert.equal(
      isCashBankAccount(acct({ code: '1003', name: 'Sundry Debtors', subGroup: 'Receivables' })),
      false,
    );
  });

  it('rejects non-asset accounts even when the name mentions bank', () => {
    assert.equal(
      isCashBankAccount(
        acct({
          code: '5008',
          name: 'Bank Charges',
          type: 'expense',
          subGroup: 'Indirect Expenses',
        }),
      ),
      false,
    );
    assert.equal(
      isCashBankAccount(
        acct({
          code: '2017',
          name: 'Loan from Bank',
          type: 'liability',
          subGroup: 'Long-term Debt',
        }),
      ),
      false,
    );
  });

  it('matches subgroup case-insensitively and tolerates label variants', () => {
    assert.equal(isCashBankAccount(acct({ subGroup: 'cash and bank' })), true);
    assert.equal(isCashBankAccount(acct({ subGroup: 'Bank Accounts' })), true);
  });
});

describe('buildCashBankAccountOptions', () => {
  const accounts = [
    acct({ code: '1001', name: 'Cash', subGroup: 'Cash & Bank' }),
    acct({ code: '1002', name: 'Bank', subGroup: 'Cash & Bank' }),
    acct({ code: '1003', name: 'Sundry Debtors', subGroup: 'Receivables' }),
    acct({ code: '5008', name: 'Bank Charges', type: 'expense', subGroup: 'Indirect Expenses' }),
    acct({ code: '1009', name: 'HDFC Current A/c', subGroup: 'Cash & Bank', isDeleted: true }),
  ];

  it('keeps only live cash/bank accounts', () => {
    const opts = buildCashBankAccountOptions(accounts);
    assert.deepEqual(
      opts.map((o) => o.value),
      ['1001', '1002'],
    );
  });

  it('uses the account CODE as the value (backend resolves cashOrBankAccountCode by code)', () => {
    const opts = buildCashBankAccountOptions(accounts);
    assert.equal(opts[0].value, '1001');
    assert.equal(opts[0].label, '1001 - Cash');
  });
});
