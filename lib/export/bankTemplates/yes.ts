import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const yesTemplate: BankTemplate = {
  id: 'yes',
  name: 'Yes Corporate',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `Yes_Corporate_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Name',
    'Account Number',
    'IFSC',
    'Bank Name',
    'Amount',
    'Payment Mode',
    'Value Date',
    'Remarks',
  ]],

  rowMapper: (row) => [
    sanitizeName(row.beneficiaryName, 50),
    row.accountNumber,
    row.ifsc.toUpperCase(),
    row.bankName,
    row.amount,
    row.paymentMode,
    row.txnDate,
    (row.remarks || '').slice(0, 50),
  ],
};
