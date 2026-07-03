import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const idfcTemplate: BankTemplate = {
  id: 'idfc',
  name: 'IDFC First',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `IDFC_First_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Name',
    'Account Number',
    'IFSC Code',
    'Bank Name',
    'Amount',
    'Transfer Mode',
    'Transfer Date',
    'Purpose',
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
    'SAL',
    (row.remarks || '').slice(0, 50),
  ],
};
