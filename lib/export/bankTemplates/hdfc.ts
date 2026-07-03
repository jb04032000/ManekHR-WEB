import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const hdfcTemplate: BankTemplate = {
  id: 'hdfc',
  name: 'HDFC ENet',
  fileTypes: ['xlsx', 'csv'],
  maxRows: 5000,
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `HDFC_ENet_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Transaction Type',
    'Beneficiary Account No',
    'Beneficiary Name',
    'Amount',
    'IFSC Code',
    'Beneficiary Bank Name',
    'Payment Mode',
    'Remarks',
  ]],

  rowMapper: (row) => [
    'P',
    row.accountNumber,
    sanitizeName(row.beneficiaryName, 50),
    row.amount,
    row.ifsc.toUpperCase(),
    row.bankName,
    row.paymentMode,
    (row.remarks || '').slice(0, 50),
  ],
};
