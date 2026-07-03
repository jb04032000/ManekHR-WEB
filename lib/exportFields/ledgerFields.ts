import dayjs from 'dayjs';
import type { ExportField } from './types';
import type { LedgerMonth, LedgerTransaction } from '@/types';
import { makeCurrencyFormatter, type CurrencyConfig } from '@/lib/currency';

type LedgerEmployeeInfo = {
  employeeName: string;
  employeeCode?: string;
};

export interface LedgerExportRow {
  employeeName: string;
  employeeCode: string;
  month: string;
  entryType: 'Payment' | 'Split Line';
  paymentDateTime: string;
  amount: number;
  method: string;
  sourceAccount: string;
  paidBy: string;
  referenceNo: string;
  recordedBy: string;
  note: string;
  salaryForMonth: number;
  paidTotalForMonth: number;
  remainingForMonth: number;
  parentTransactionAmount?: number;
  parentTransactionMethod?: string;
  parentTransactionId?: string;
  proofAttached: boolean;
}

function formatAmount(amount: number | undefined, currencyConfig?: CurrencyConfig): string {
  return makeCurrencyFormatter(currencyConfig).full(Number(amount ?? 0));
}

function formatDateTime(dateTime?: string): string {
  if (!dateTime) return '-';
  const parsed = dayjs(dateTime);
  return parsed.isValid() ? parsed.format('DD MMM YYYY, hh:mm A') : '-';
}

function formatMethod(method?: string): string {
  switch (method) {
    case 'cash':
      return 'Cash';
    case 'upi':
      return 'UPI';
    case 'bank':
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'cheque':
      return 'Cheque';
    case 'split':
      return 'Split';
    case 'other':
      return 'Other';
    default:
      return method ? method.charAt(0).toUpperCase() + method.slice(1) : '-';
  }
}

function buildPaymentRow(params: {
  employee: LedgerEmployeeInfo;
  month: LedgerMonth;
  transaction: LedgerTransaction;
}): LedgerExportRow {
  const { employee, month, transaction } = params;

  return {
    employeeName: employee.employeeName,
    employeeCode: employee.employeeCode || '-',
    month: month.monthLabel,
    entryType: 'Payment',
    paymentDateTime: formatDateTime(transaction.dateTime),
    amount: transaction.amount ?? 0,
    method: formatMethod(transaction.method),
    sourceAccount: transaction.paymentFrom || '-',
    paidBy: transaction.paidBy || '-',
    referenceNo: transaction.referenceNo || '-',
    recordedBy: transaction.recordedBy || '-',
    note: transaction.note || '-',
    salaryForMonth: month.salary ?? 0,
    paidTotalForMonth: month.paid ?? 0,
    remainingForMonth: month.remaining ?? 0,
    parentTransactionAmount: undefined,
    parentTransactionMethod: undefined,
    parentTransactionId: undefined,
    proofAttached:
      !!transaction.proofAttached ||
      !!transaction.proofUrl ||
      !!transaction.proofUrls?.length,
  };
}

export function createLedgerExportRows(params: {
  employee: LedgerEmployeeInfo;
  months: LedgerMonth[];
  currencyConfig?: CurrencyConfig;
}): LedgerExportRow[] {
  const { employee, months, currencyConfig } = params;
  void currencyConfig;

  return months.flatMap((month) =>
    month.transactions.flatMap((transaction) => {
      if (transaction.method === 'split' && transaction.splitLines?.length) {
        return transaction.splitLines.map((line) => ({
          employeeName: employee.employeeName,
          employeeCode: employee.employeeCode || '-',
          month: month.monthLabel,
          entryType: 'Split Line' as const,
          paymentDateTime: formatDateTime(line.dateTime || transaction.dateTime),
          amount: line.amount ?? 0,
          method: formatMethod(line.method),
          sourceAccount: line.paymentFrom || transaction.paymentFrom || '-',
          paidBy: line.paidBy || transaction.paidBy || '-',
          referenceNo: line.referenceNo || transaction.referenceNo || '-',
          recordedBy: transaction.recordedBy || '-',
          note: line.note || transaction.note || '-',
          salaryForMonth: month.salary ?? 0,
          paidTotalForMonth: month.paid ?? 0,
          remainingForMonth: month.remaining ?? 0,
          parentTransactionAmount: transaction.amount ?? 0,
          parentTransactionMethod: 'Split',
          parentTransactionId: transaction.id || '-',
          proofAttached:
            !!line.proofUrls?.length ||
            !!transaction.proofAttached ||
            !!transaction.proofUrl ||
            !!transaction.proofUrls?.length,
        }));
      }

      return [buildPaymentRow({ employee, month, transaction })];
    }),
  );
}

export function getLedgerExportFields(
  currencyConfig?: CurrencyConfig,
): ExportField<LedgerExportRow>[] {
  return [
    {
      key: 'employeeName',
      label: 'Employee Name',
      defaultEnabled: true,
      getValue: (row) => row.employeeName,
    },
    {
      key: 'employeeCode',
      label: 'Employee Code / Designation',
      defaultEnabled: true,
      getValue: (row) => row.employeeCode,
    },
    {
      key: 'month',
      label: 'Month',
      defaultEnabled: true,
      getValue: (row) => row.month,
    },
    {
      key: 'entryType',
      label: 'Entry Type',
      defaultEnabled: true,
      getValue: (row) => row.entryType,
    },
    {
      key: 'paymentDateTime',
      label: 'Payment Date & Time',
      defaultEnabled: true,
      getValue: (row) => row.paymentDateTime,
    },
    {
      key: 'amount',
      label: 'Amount',
      defaultEnabled: true,
      getValue: (row) => row.amount,
      pdfValue: (row) => formatAmount(row.amount, currencyConfig),
    },
    {
      key: 'method',
      label: 'Method',
      defaultEnabled: true,
      getValue: (row) => row.method,
    },
    {
      key: 'sourceAccount',
      label: 'Source Account',
      defaultEnabled: true,
      getValue: (row) => row.sourceAccount,
    },
    {
      key: 'paidBy',
      label: 'Paid By',
      defaultEnabled: true,
      getValue: (row) => row.paidBy,
    },
    {
      key: 'referenceNo',
      label: 'Reference No',
      defaultEnabled: true,
      getValue: (row) => row.referenceNo,
    },
    {
      key: 'recordedBy',
      label: 'Recorded By',
      defaultEnabled: true,
      getValue: (row) => row.recordedBy,
    },
    {
      key: 'note',
      label: 'Note',
      defaultEnabled: true,
      getValue: (row) => row.note,
    },
    {
      key: 'salaryForMonth',
      label: 'Salary for Month',
      defaultEnabled: false,
      getValue: (row) => row.salaryForMonth,
      pdfValue: (row) => formatAmount(row.salaryForMonth, currencyConfig),
    },
    {
      key: 'paidTotalForMonth',
      label: 'Paid Total for Month',
      defaultEnabled: false,
      getValue: (row) => row.paidTotalForMonth,
      pdfValue: (row) => formatAmount(row.paidTotalForMonth, currencyConfig),
    },
    {
      key: 'remainingForMonth',
      label: 'Remaining for Month',
      defaultEnabled: false,
      getValue: (row) => row.remainingForMonth,
      pdfValue: (row) => formatAmount(row.remainingForMonth, currencyConfig),
    },
    {
      key: 'parentTransactionAmount',
      label: 'Parent Transaction Amount',
      defaultEnabled: false,
      getValue: (row) => row.parentTransactionAmount ?? '-',
      pdfValue: (row) =>
        row.parentTransactionAmount !== undefined
          ? formatAmount(row.parentTransactionAmount, currencyConfig)
          : '-',
    },
    {
      key: 'parentTransactionMethod',
      label: 'Parent Transaction Method',
      defaultEnabled: false,
      getValue: (row) => row.parentTransactionMethod ?? '-',
    },
    {
      key: 'parentTransactionId',
      label: 'Parent Transaction ID',
      defaultEnabled: false,
      getValue: (row) => row.parentTransactionId ?? '-',
    },
    {
      key: 'proofAttached',
      label: 'Proof Attached',
      defaultEnabled: false,
      getValue: (row) => (row.proofAttached ? 'Yes' : 'No'),
    },
  ];
}

export const LEDGER_EXPORT_FIELDS: ExportField<LedgerExportRow>[] =
  getLedgerExportFields();
