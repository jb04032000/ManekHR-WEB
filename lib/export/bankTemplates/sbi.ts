import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const sbiTemplate: BankTemplate = {
  id: 'sbi',
  name: 'SBI CINB / Salary Package',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 40,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `SBI_CINB_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Account Number',
    'Beneficiary Name',
    'Amount',
    'Payment Mode',
    'IFSC Code',
    'Remarks',
  ]],

  rowMapper: (row) => [
    row.accountNumber,
    sanitizeName(row.beneficiaryName, 40),
    row.amount,
    row.paymentMode,
    row.ifsc.toUpperCase(),
    (row.remarks || '').slice(0, 50),
  ],
};
