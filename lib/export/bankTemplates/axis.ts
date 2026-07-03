import type { BankTemplate } from './types';
import { sanitizeName } from '@/lib/exportFields/bankFileValidators';

export const axisTemplate: BankTemplate = {
  id: 'axis',
  name: 'Axis iConnect',
  fileTypes: ['xlsx', 'csv'],
  nameMaxLen: 50,
  remarksMaxLen: 50,

  filename: (meta) => {
    const mm = String(meta.month).padStart(2, '0');
    return `Axis_iConnect_${mm}_${meta.year}`;
  },

  headerRows: () => [[
    'Beneficiary Name',
    'Beneficiary Account No',
    'Beneficiary IFSC Code',
    'Amount',
    'Transaction Mode',
    'Beneficiary Bank Name',
    'Narration',
    'Effective Date',
  ]],

  rowMapper: (row) => [
    sanitizeName(row.beneficiaryName, 50),
    row.accountNumber,
    row.ifsc.toUpperCase(),
    row.amount,
    row.paymentMode,
    row.bankName,
    (row.remarks || '').slice(0, 50),
    row.txnDate,
  ],
};
