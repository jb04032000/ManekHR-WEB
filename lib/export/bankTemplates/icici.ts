import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const iciciTemplate: BankTemplate = {
  id: 'icici',
  name: 'ICICI CIB',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `ICICI_CIB_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Debit Account No',
    'Beneficiary Name',
    'Beneficiary Account No',
    'Beneficiary IFSC',
    'Amount',
    'Payment Mode',
    'Remarks',
    'Email',
    'Mobile',
  ]],

  rowMapper: (row) => [
    '',
    sanitizeName(row.beneficiaryName, 50),
    row.accountNumber,
    row.ifsc.toUpperCase(),
    row.amount,
    row.paymentMode,
    (row.remarks || '').slice(0, 50),
    row.email || '',
    row.mobile || '',
  ],
};
