import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const kotakTemplate: BankTemplate = {
  id: 'kotak',
  name: 'Kotak FyndnPay',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `Kotak_FyndnPay_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Name',
    'Beneficiary Account Number',
    'IFSC Code',
    'Amount',
    'Payment Mode',
    'Purpose Code',
    'Remarks',
    'Email',
    'Mobile',
  ]],

  rowMapper: (row) => [
    sanitizeName(row.beneficiaryName, 50),
    row.accountNumber,
    row.ifsc.toUpperCase(),
    row.amount,
    row.paymentMode,
    'SAL',
    (row.remarks || '').slice(0, 50),
    row.email || '',
    row.mobile || '',
  ],
};
