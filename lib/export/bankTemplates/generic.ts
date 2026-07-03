import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const genericTemplate: BankTemplate = {
  id: 'generic',
  name: 'Generic (7-column)',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 100,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `Bank_Transfer_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Name',
    'Account Number',
    'IFSC Code',
    'Amount (INR)',
    'Payment Mode',
    'Transaction Date',
    'Remarks',
  ]],

  rowMapper: (row) => [
    sanitizeName(row.beneficiaryName, 50),
    row.accountNumber,
    row.ifsc.toUpperCase(),
    row.amount,
    row.paymentMode,
    row.txnDate,
    (row.remarks || '').slice(0, 100),
  ],

  footerRows: (rows) => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    return [
      [],
      ['Total Employees', rows.length],
      ['Total Amount (INR)', total],
    ];
  },
};
