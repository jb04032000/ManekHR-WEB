import type { ExportField } from './types';
import dayjs from 'dayjs';
import { calculateAttendanceNetSalary, resolveEffectiveMonthlySalary } from '@/lib/salary';
import { makeCurrencyFormatter, type CurrencyConfig } from '@/lib/currency';

export interface SalaryExportRow {
  memberId: string;
  memberName: string;
  designation: string;
  shiftName: string;
  baseSalary: number;
  netSalary: number;
  paidAmount: number;
  remaining: number;
  status: string;
  monthYear: string;
  totalDays: number;
  presentDays: number;
  additions: number;
  deductions: number;
  bankName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  upiId?: string;
  paymentMode?: string;
  paymentDate?: string;
  referenceNo?: string;
  preferredMethod?: string;
}

const STATUS_LABEL_MAP: Record<string, string> = {
  salary_not_set: 'Salary Not Set',
  not_generated: 'Not Generated',
  missing_method: 'Payment Method Missing',
  pending: 'Payment Pending',
  partial: 'Partially Paid',
  advance: 'Overpaid',
  overpaid: 'Overpaid',
  paid: 'Fully Paid',
};

function getStatusLabel(status: string): string {
  return STATUS_LABEL_MAP[status] || status;
}

export function getSalaryExportFields(
  currencyConfig?: CurrencyConfig,
): ExportField<SalaryExportRow>[] {
  const fmt = makeCurrencyFormatter(currencyConfig);

  return [
    {
      key: 'memberName',
      label: 'Employee Name',
      defaultEnabled: true,
      getValue: (r) => r.memberName,
    },
    {
      key: 'designation',
      label: 'Designation',
      defaultEnabled: true,
      getValue: (r) => r.designation ?? '-',
    },
    {
      key: 'totalDays',
      label: 'Total Days',
      defaultEnabled: true,
      getValue: (r) => r.totalDays,
    },
    {
      key: 'presentDays',
      label: 'Present Days',
      defaultEnabled: true,
      getValue: (r) => r.presentDays,
    },
    {
      key: 'baseSalary',
      label: 'Base Salary',
      defaultEnabled: true,
      getValue: (r) => r.baseSalary ?? 0,
      pdfValue: (r) => fmt.full(r.baseSalary ?? 0),
    },
    {
      key: 'additions',
      label: 'Additions',
      defaultEnabled: true,
      getValue: (r) => r.additions ?? 0,
      pdfValue: (r) => fmt.full(r.additions ?? 0),
    },
    {
      key: 'deductions',
      label: 'Deductions',
      defaultEnabled: true,
      getValue: (r) => r.deductions ?? 0,
      pdfValue: (r) => fmt.full(r.deductions ?? 0),
    },
    {
      key: 'netSalary',
      label: 'Net Salary',
      defaultEnabled: true,
      getValue: (r) => r.netSalary ?? 0,
      pdfValue: (r) => fmt.full(r.netSalary ?? 0),
    },
    {
      key: 'paidAmount',
      label: 'Paid Amount',
      defaultEnabled: true,
      getValue: (r) => r.paidAmount ?? 0,
      pdfValue: (r) => fmt.full(r.paidAmount ?? 0),
    },
    {
      key: 'remaining',
      label: 'Remaining',
      defaultEnabled: true,
      getValue: (r) => r.remaining ?? 0,
      pdfValue: (r) => fmt.full(r.remaining ?? 0),
    },
    {
      key: 'status',
      label: 'Status',
      defaultEnabled: true,
      getValue: (r) => getStatusLabel(r.status),
    },
    {
      key: 'monthYear',
      label: 'Month',
      defaultEnabled: true,
      getValue: (r) => r.monthYear,
    },
    {
      key: 'shiftName',
      label: 'Shift',
      defaultEnabled: false,
      getValue: (r) => r.shiftName ?? '-',
    },
    {
      key: 'bankName',
      label: 'Bank Name',
      defaultEnabled: false,
      getValue: (r) => r.bankName ?? '-',
    },
    {
      key: 'accountHolderName',
      label: 'Account Holder',
      defaultEnabled: false,
      getValue: (r) => r.accountHolderName ?? '-',
    },
    {
      key: 'accountNumber',
      label: 'Account Number',
      defaultEnabled: false,
      getValue: (r) => r.accountNumber ?? '-',
    },
    {
      key: 'ifscCode',
      label: 'IFSC Code',
      defaultEnabled: false,
      getValue: (r) => r.ifscCode ?? '-',
    },
    {
      key: 'upiId',
      label: 'UPI ID',
      defaultEnabled: false,
      getValue: (r) => r.upiId ?? '-',
    },
    {
      key: 'paymentMode',
      label: 'Payment Mode',
      defaultEnabled: false,
      getValue: (r) => r.paymentMode ?? '-',
    },
    {
      key: 'paymentDate',
      label: 'Last Payment Date',
      defaultEnabled: false,
      getValue: (r) => r.paymentDate ?? '-',
    },
    {
      key: 'referenceNo',
      label: 'Reference No',
      defaultEnabled: false,
      getValue: (r) => r.referenceNo ?? '-',
    },
  ];
}

export const SALARY_EXPORT_FIELDS: ExportField<SalaryExportRow>[] = getSalaryExportFields();

export function formatSalaryStatus(raw: string): string {
  return getStatusLabel(raw);
}

export function createSalaryExportRows(
  salaryData: Array<{
    teamMember?: {
      id: string;
      name: string;
      designation?: string;
      shift?: { name: string };
      bankDetails?: {
        bankName: string;
        accountHolderName: string;
        accountNumber: string;
        ifscCode: string;
      };
      upiDetails?: { upiId: string };
      salaryType?: 'monthly' | 'hourly' | 'piece_rate';
      salaryAmount?: number;
      salaryDayBasis?: 'fixed_month_days' | 'calendar_month_days';
      fixedMonthDays?: number | null;
      attendancePayMode?: 'default' | 'enabled' | 'disabled';
      dailyHours?: number;
      workingDays?: number;
      finalMonthlyOverride?: number;
      preferredMethod?: string;
    };
    _id?: string;
    baseSalary?: number;
    netSalary?: number;
    paidAmount?: number;
    status?: string;
    settlementStatus?:
      | 'salary_not_set'
      | 'not_generated'
      | 'pending'
      | 'partial'
      | 'paid'
      | 'overpaid';
    month?: number;
    year?: number;
    additions?: number;
    deductions?: number;
    totalDays?: number;
    presentDays?: number;
    teamMemberId?: string | { _id: string };
  }>,
  month: number,
  year: number,
  currencyConfig?: CurrencyConfig,
): SalaryExportRow[] {
  void currencyConfig;
  const monthYear = dayjs(`${year}-${String(month).padStart(2, '0')}-01`).format('MMMM YYYY');

  return salaryData.map((record) => {
    const member = record.teamMember;
    const memberId =
      member?.id ||
      (typeof record.teamMemberId === 'string'
        ? record.teamMemberId
        : (record.teamMemberId as { _id: string })?._id) ||
      '';

    const baseSalary = record.baseSalary ?? 0;
    const effectiveBaseSalary =
      baseSalary > 0 ? baseSalary : resolveEffectiveMonthlySalary(member, { month, year });
    const netSalary =
      record.netSalary && record.netSalary > 0
        ? record.netSalary
        : calculateAttendanceNetSalary({
            baseSalary: effectiveBaseSalary,
            totalDays: record.totalDays ?? 0,
            presentDays: record.presentDays ?? 0,
            additions: record.additions ?? 0,
            deductions: record.deductions ?? 0,
          });
    const paidAmount = record.paidAmount ?? 0;
    const remaining = netSalary - paidAmount;

    let bankName: string | undefined;
    let accountHolderName: string | undefined;
    let accountNumber: string | undefined;
    let ifscCode: string | undefined;
    let upiId: string | undefined;

    if (member?.bankDetails) {
      bankName = member.bankDetails.bankName;
      accountHolderName = member.bankDetails.accountHolderName;
      accountNumber = member.bankDetails.accountNumber;
      ifscCode = member.bankDetails.ifscCode;
    }

    if (member?.upiDetails) {
      upiId = member.upiDetails.upiId;
    }

    const hasPreferredMethod = member?.preferredMethod;
    const hasPaymentMethod = hasPreferredMethod || bankName || upiId;

    const computedStatus = (() => {
      const effectiveBaseSalary =
        baseSalary > 0 ? baseSalary : resolveEffectiveMonthlySalary(member, { month, year });

      if (effectiveBaseSalary === 0) return 'salary_not_set';
      if (!hasPaymentMethod) return 'missing_method';

      const effectiveNetSalary = netSalary > 0 ? netSalary : effectiveBaseSalary;
      if (record.settlementStatus === 'overpaid') return 'overpaid';
      if (paidAmount > effectiveNetSalary && effectiveNetSalary > 0) return 'advance';
      if (paidAmount >= effectiveNetSalary && effectiveNetSalary > 0) return 'paid';
      if (paidAmount > 0) return 'partial';
      return 'pending';
    })();

    return {
      memberId,
      memberName: member?.name || 'Unknown',
      designation: member?.designation || '-',
      shiftName: member?.shift?.name || '-',
      baseSalary: effectiveBaseSalary,
      netSalary,
      paidAmount,
      remaining: remaining < 0 ? 0 : remaining,
      status: computedStatus,
      monthYear,
      totalDays: record.totalDays || 0,
      presentDays: record.presentDays || 0,
      additions: record.additions || 0,
      deductions: record.deductions || 0,
      bankName,
      accountHolderName,
      accountNumber,
      ifscCode,
      upiId,
      preferredMethod: member?.preferredMethod,
    };
  });
}
