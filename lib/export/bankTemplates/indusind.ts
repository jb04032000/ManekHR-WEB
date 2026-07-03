import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const indusindTemplate: BankTemplate = {
  id: 'indusind',
  name: 'IndusInd IndusDirect',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `IndusInd_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Name',
    'Account No',
    'IFSC',
    'Amount',
    'Mode',
    'Bank Name',
    'Value Date',
    'Narration',
    'Mobile',
  ]],

  rowMapper: (row) => [
    sanitizeName(row.beneficiaryName, 50),
    row.accountNumber,
    row.ifsc.toUpperCase(),
    row.amount,
    row.paymentMode,
    row.bankName,
    row.txnDate,
    (row.remarks || '').slice(0, 50),
    row.mobile || '',
  ],
};
